"""Coordinated single-district interventions and sufficient cooling targets.

Bounds limit the requested intervention; separate support diagnostics describe
its observational support. Sampling bands are not causal confidence intervals.
"""
import hashlib
import json
import os
from pathlib import Path

import numpy as np
import pandas as pd
from sklearn.base import BaseEstimator, RegressorMixin, clone
from sklearn.utils.validation import check_is_fitted
from xgboost import XGBRegressor

GRID = np.arange(-20, 31)  # change of the green share in points, one step per point
THREADS = int(os.environ.get("PLANNER_THREADS", "4"))  # inference threads (the model is small)


class AirTemperatureOffset(RegressorMixin, BaseEstimator):
    """Fit LST minus a fixed share of air temperature, then add that share back."""
    def __init__(self, estimator, share=0.5, column='temp_mean_ja'):
        self.estimator, self.share, self.column = estimator, share, column

    def fit(self, X, y):
        self.feature_names_in_ = np.asarray(X.columns, dtype=object)
        self.n_features_in_ = len(self.feature_names_in_)
        self.estimator_ = clone(self.estimator).fit(X, np.asarray(y) - self.share * X[self.column].to_numpy())
        return self

    def predict(self, X):
        check_is_fitted(self, 'estimator_')
        if list(X.columns) != list(self.feature_names_in_):
            raise ValueError('Prediction feature names/order differ from the fitted model')
        return self.estimator_.predict(X) + self.share * X[self.column].to_numpy()

    @classmethod
    def from_loaded(cls, estimator, features, share=0.5, column='temp_mean_ja'):
        """Wrap a native model that has already been loaded, with explicit fitted state."""
        booster_names = estimator.get_booster().feature_names
        if booster_names is not None and list(booster_names) != list(features):
            raise ValueError('Native model feature names/order differ from the model card')
        model = cls(estimator, share, column)
        model.estimator_ = estimator
        model.feature_names_in_ = np.asarray(features, dtype=object)
        model.n_features_in_ = len(features)
        return model


def load_final(card, folder, n_jobs=1):
    trees = XGBRegressor(n_jobs=n_jobs)
    trees.load_model(Path(folder) / card['model_file'])
    trees.set_params(n_jobs=n_jobs)
    return AirTemperatureOffset.from_loaded(trees, card['features'], card['air_temperature_share'],
                                            card['air_temperature_column'])


class WhatIfEngine:
    """The final model (live) and the range of the curves (from the bootstrap draws that whatif.ipynb saved)."""

    def __init__(self, features: list, final, max_green: float, bootstrap=None):
        self.features, self.final, self.max_green = features, final, max_green
        self.range_low = self.range_high = None
        if bootstrap is not None:
            effects = bootstrap["effects"].astype(float)  # draws x districts x steps
            if effects.ndim != 3 or effects.shape[1:] != (len(bootstrap["district_code"]), len(bootstrap["grid"])):
                raise ValueError("bootstrap effects do not match district codes and grid")
            self.bootstrap_effects = effects
            self.range_low, self.range_high = np.percentile(effects, [5, 95], axis=0)  # districts x steps
            self.row_of = {int(code): i for i, code in enumerate(bootstrap["district_code"])}
            self.grid = np.asarray(bootstrap["grid"])

    def run(self, rows: pd.DataFrame, deltas, with_range: bool = True) -> dict:
        """rows: base rows (one per district); deltas: changes of the green share (0.10 = +10 points).
        Returns arrays with one row per district and one column per delta: new_share, applied, predicted (final model),
        effect (final model) and low / high (5th and 95th percentile of the bootstrap draws, widened to contain the central effect).
        Fractional inputs use exact central predictions. Their bands bracket the
        neighboring stored bootstrap steps, rather than inventing smooth trees."""
        deltas = np.asarray(deltas, dtype=float)
        if deltas.ndim != 1 or not len(deltas) or not np.isfinite(deltas).all():
            raise ValueError("deltas must be a nonempty finite vector")
        deltas = np.clip(deltas, GRID.min() / 100, GRID.max() / 100)
        share = rows["landsat_green_share"].to_numpy()[:, None]
        new_share = np.clip(share + deltas, 0, self.max_green)
        applied = new_share - share
        n = rows["n_districts"].to_numpy()[:, None]

        stacked = pd.concat([rows[self.features]] * len(deltas), ignore_index=True)  # one block of rows per delta
        stacked["landsat_green_share"] = new_share.T.ravel()
        stacked["landsat_green_share_vs_city"] += (applied * (1 - 1 / n)).T.ravel()
        predicted = np.asarray(self.final(stacked)).reshape(len(deltas), len(rows)).T
        effect = predicted - np.asarray(self.final(rows[self.features]))[:, None]
        out = dict(new_share=new_share, applied=applied, predicted=predicted, effect=effect, low=effect, high=effect)

        has_range = with_range and self.range_low is not None
        if has_range:
            index = [self.row_of[int(code)] for code in rows["district_code"]]
            requested = np.round(deltas * 100, 10)
            lower = np.clip(np.searchsorted(self.grid, requested, side="right") - 1, 0, len(self.grid) - 1)
            upper = np.clip(np.searchsorted(self.grid, requested, side="left"), 0, len(self.grid) - 1)
            # Every draw is monotone: the later step bounds stronger cooling.
            out["low"] = np.minimum(self.range_low[index][:, upper], effect)
            out["high"] = np.maximum(self.range_high[index][:, lower], effect)
        out["has_range"] = has_range
        return out

    def citywide(self, rows, context, delta):
        """Effect on selected rows after intervening on every contextual city-year.

        The context must contain each complete reliable city-year roster, even
        when selected district baselines refer to different latest years.
        """
        changed = context.copy()
        changed["landsat_green_share"] = np.clip(changed["landsat_green_share"] + np.clip(delta, -.2, .3),
                                                  0, self.max_green)
        changed["landsat_green_share_vs_city"] = changed["landsat_green_share"] - changed.groupby(
            ["city_code", "year"])["landsat_green_share"].transform("mean")
        keys = ["district_code", "year"]
        selected = changed.set_index(keys).loc[rows.set_index(keys).index]
        return np.asarray(self.final(selected[self.features])) - np.asarray(self.final(rows[self.features]))


def points_needed(effect: np.ndarray, target: np.ndarray, points=None) -> np.ndarray:
    """effect: one row per district, the effect of 0, 1, ..., 30 points (non-increasing); target: wanted cooling in °C, one value per district.
    Returns the FIRST SUFFICIENT grid amount, not a linear interpolation of a
    staircase. ``points`` can supply each district's physically applied grid.
    Missing or unreachable targets return nan."""
    effect = np.asarray(effect, dtype=float)
    target = np.asarray(target, dtype=float)
    if effect.ndim != 2 or target.shape != (len(effect),):
        raise ValueError("one target is required for every effect curve")
    point_grid = np.broadcast_to(np.arange(effect.shape[1]) if points is None else points, effect.shape)
    cooling = -effect
    reached = cooling >= target[:, None]
    first = reached.argmax(axis=1)  # the first step that reaches the target
    rows = np.arange(len(cooling))
    return np.where(reached.any(axis=1), point_grid[rows, first], np.nan)


def base_fingerprint(base, features):
    columns = ["district_code", "year", "n_districts"] + list(features)
    rows = base.reset_index(drop=True).sort_values("district_code")[columns]
    return hashlib.sha256(pd.util.hash_pandas_object(rows, index=False).values.tobytes()).hexdigest()


def load_engine(models_dir: Path, features: list, max_green: float, base=None) -> tuple:
    """The final model and the bootstrap range from data/models. The model card names the file and the share of the air temperature."""
    models_dir = Path(models_dir)
    card = json.loads((models_dir / "model_card.json").read_text())
    if not set(card["features"]).issubset(features):
        raise ValueError("model card requires features absent from the model table")
    final = load_final(card, models_dir, n_jobs=THREADS)
    bootstrap_file = models_dir / "bootstrap_effects.npz"
    bootstrap = np.load(bootstrap_file) if bootstrap_file.exists() else None
    if bootstrap is not None and card.get("artifact_schema_version", 1) >= 2 and "model_sha256" not in bootstrap:
        raise ValueError("unversioned bootstrap cannot be reused with this model; rebuild the what-if bank (run notebooks/whatif.ipynb)")
    if bootstrap is not None and "model_sha256" in bootstrap:
        actual = hashlib.sha256((models_dir / card["model_file"]).read_bytes()).hexdigest()
        if str(bootstrap["model_sha256"].item()) != actual:
            raise ValueError("bootstrap belongs to a different model; rebuild the what-if bank (run notebooks/whatif.ipynb)")
    if bootstrap is not None and base is not None and "base_fingerprint" in bootstrap:
        if str(bootstrap["base_fingerprint"].item()) != base_fingerprint(base, card["features"]):
            raise ValueError("bootstrap baseline differs from current data; rebuild the what-if bank (run notebooks/whatif.ipynb)")
    return WhatIfEngine(card["features"], final.predict, max_green, bootstrap), card

"""The risk score and the priority: the same method as notebooks/risk.ipynb."""
import numpy as np
import pandas as pd

from .data import AGE_GROUPS_VULNERABLE
from .whatif import points_needed

SEED = 2025
N_WEIGHTS = 500
COMPONENTS = ["hazard_pct", "exposure_pct", "vulnerability_pct"]


def priority_sensitivity(base: pd.DataFrame, vulnerable_people: pd.Series, effects_boot: np.ndarray,
                         points_grid=None, target: float = 1.0, top_n: int = 20) -> pd.DataFrame:
    """Invert each saved model draw and rank vulnerable people per applied hectare.

    effects_boot contains draws x districts x nonnegative grid steps, in base order.
    points_grid is requested points (1-D) or actual clipped points (districts x steps).
    Reachability and top-group membership use ALL draws; rank quantiles condition
    on reaching the target. These are model-sampling sensitivity, not harm probabilities.
    """
    effects = np.asarray(effects_boot, dtype=float)
    if effects.ndim != 3 or effects.shape[0] == 0 or effects.shape[1] != len(base):
        raise ValueError("effects_boot must be nonempty draws x base districts x steps")
    codes = pd.Index(base["district_code"], name="district_code")
    if not codes.is_unique or top_n < 1 or not np.isfinite(target) or target <= 0:
        raise ValueError("district codes must be unique, top_n positive and target positive")
    area = base["urban_km2"].to_numpy(dtype=float)
    people = vulnerable_people.reindex(codes).to_numpy(dtype=float)
    if not np.all(np.isfinite(area) & (area > 0)) or not np.all(np.isfinite(people) & (people >= 0)):
        raise ValueError("areas must be positive and vulnerable population finite and nonnegative")
    steps = effects.shape[2]
    grid = np.arange(steps, dtype=float) if points_grid is None else np.asarray(points_grid, dtype=float)
    if grid.shape not in ((steps,), (len(base), steps)) or not np.all(np.isfinite(grid) & (grid >= 0)):
        raise ValueError("points_grid must contain nonnegative finite points for each step")
    if np.any(np.diff(grid, axis=-1) < 0):
        raise ValueError("points_grid must be nondecreasing")
    needs = np.stack([points_needed(draw, np.full(len(base), target), points=grid) for draw in effects])
    reachable = np.isfinite(needs)
    hectares = needs * area[None, :]
    priority = np.divide(people[None, :], hectares, out=np.full_like(hectares, np.nan),
                         where=reachable & (hectares > 0))
    ranks = pd.DataFrame(priority).rank(axis=1, ascending=False, method="first")
    out = pd.DataFrame(index=codes)
    out["priority_reachability"] = reachable.mean(axis=0)
    out["priority_rank_low"] = pd.array(np.round(ranks.quantile(.05)), dtype="Int64")
    out["priority_rank_high"] = pd.array(np.round(ranks.quantile(.95)), dtype="Int64")
    out["priority_top20_share"] = (ranks <= top_n).mean(axis=0).to_numpy()
    out.attrs.update(rank_condition="conditional on target reachability", rank_quantiles="rounded 5th/95th percentiles", top_n=int(top_n),
                     n_draws=int(len(effects)), uncertainty="model-sampling sensitivity")
    return out


def risk_table(base: pd.DataFrame, table: pd.DataFrame, tables: dict, hectares_1c: pd.Series,
               priority: pd.DataFrame | None = None) -> pd.DataFrame:
    """One row per district (index district_code): the three components (percentile ranks 0-100, higher = worse), the risk score,
    its rank and the range of the rank over 500 random weight sets, and the priority (only where -1 °C is reachable)."""
    population = tables["population"]
    people = population[population["year"] == 2025].set_index("district_code")
    codes = base["district_code"].to_numpy()
    out = pd.DataFrame(index=pd.Index(codes, name="district_code"))
    out["lst_recent"] = table[table["year"].between(2023, 2025)].groupby("district_code")["landsat_lst_c"].mean().reindex(codes)
    out["vulnerable_people"] = people[AGE_GROUPS_VULNERABLE].sum(axis=1).reindex(codes)
    sege = tables["sege"].set_index("district_code")["sege_score"].reindex(codes)

    out["hazard_pct"] = out["lst_recent"].rank(pct=True) * 100
    out["exposure_pct"] = out["vulnerable_people"].rank(pct=True) * 100
    out["vulnerability_pct"] = (-sege).rank(pct=True) * 100
    out["risk_score"] = out[COMPONENTS].mean(axis=1)
    out["risk_rank"] = out["risk_score"].rank(ascending=False, method="first").astype(int)

    weights = np.random.default_rng(SEED).dirichlet([1, 1, 1], size=N_WEIGHTS)
    ranks = pd.DataFrame(out[COMPONENTS].to_numpy() @ weights.T).rank(ascending=False, method="first")
    n_top = int(np.ceil(0.10 * len(out)))
    low, high = np.round(np.percentile(ranks, [5, 95], axis=1))
    out["risk_rank_q05"] = np.percentile(ranks, 5, axis=1)
    out["risk_rank_q95"] = np.percentile(ranks, 95, axis=1)
    out["risk_rank_low"] = np.minimum(low, out["risk_rank"]).astype(int)
    out["risk_rank_high"] = np.maximum(high, out["risk_rank"]).astype(int)
    out["top_share"] = (ranks <= n_top).mean(axis=1).to_numpy()
    for component in COMPONENTS:
        out[f"risk_rank_{component.removesuffix('_pct')}_only"] = out[component].rank(
            ascending=False, method="first").astype(int)

    out["hectares_1c"] = hectares_1c.reindex(codes).to_numpy()
    out["people_per_hectare_1c"] = out["vulnerable_people"] / out["hectares_1c"]  # for ranking only, never an absolute number
    out["priority_rank"] = out["people_per_hectare_1c"].rank(ascending=False, method="first").astype("Int64")
    if priority is not None:
        out = out.join(priority, validate="one_to_one")
    return out

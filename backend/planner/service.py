"""The planner service: everything the API needs, built once at startup."""
import hashlib
import json
import math
import time
from pathlib import Path

import numpy as np
import pandas as pd

from .data import (AGE_GROUPS_VULNERABLE, TARGET, build_base_rows, build_model_table, excluded_districts, load_tables)
from .risk import COMPONENTS, priority_sensitivity, risk_table
from .support import ScenarioSupport
from .whatif import GRID, load_engine, points_needed

UNIT_TO_KM2 = {"m2": 1e-6, "ha": 0.01, "km2": 1.0}  # area unit -> km²
MAX_ADD_POINTS, MAX_LOSS_POINTS = int(GRID.max()), int(-GRID.min())


class NoResult(Exception):
    """The district has no what-if result (no reliable surface temperature)."""

    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


class Planner:
    def __init__(self, data_dir: Path):
        t0 = time.time()
        data_dir = Path(data_dir)
        # Auto-extract pre-packaged distribution archive if processed tables are missing
        if not (data_dir / "processed" / "turkey_districts_master.geojson").exists():
            zip_file = data_dir / "data_package.zip"
            if zip_file.exists():
                import zipfile
                with zipfile.ZipFile(zip_file, "r") as zf:
                    zf.extractall(data_dir)
        self.tables = load_tables(data_dir / "processed")
        self.table, self.weather, self.features = build_model_table(self.tables)
        self.base = build_base_rows(self.table, self.weather).set_index("district_code", drop=False)
        self.max_green = float(self.table["landsat_green_share"].max())
        self.engine, self.card = load_engine(data_dir / "models", self.features, self.max_green, base=self.base)
        self.features = self.card["features"]
        self.support = ScenarioSupport(self.table)
        self.left_out = excluded_districts(self.tables, self.table).set_index("district_code")

        # the heat target of every district with the central model (needed for the priority)
        zero = list(GRID).index(0)
        curves = self.engine.run(self.base, GRID / 100, with_range=False)
        central = curves["effect"][:, zero:]
        points = points_needed(central, np.ones(len(self.base)), points=curves["applied"][:, zero:] * 100)
        hectares = pd.Series(points * self.base["urban_km2"].to_numpy(), index=self.base.index)
        priority = None
        if self.engine.range_low is not None:
            people = self.tables["population"].query("year == 2025").set_index("district_code")[AGE_GROUPS_VULNERABLE].sum(axis=1)
            index = [self.engine.row_of[int(code)] for code in self.base.index]
            priority = priority_sensitivity(self.base, people, self.engine.bootstrap_effects[:, index, zero:],
                                            points_grid=curves["applied"][:, zero:] * 100)
        self.risk = risk_table(self.base, self.table, self.tables, hectares, priority=priority)

        self.history = {code: g.sort_values("year") for code, g in self.table.groupby("district_code")}
        shapes = self.tables["districts"][["district_code", "geometry"]].set_index("district_code")
        self.shapes = shapes
        self.bounds = {code: [round(float(v), 4) for v in geom.bounds] for code, geom in shapes["geometry"].items()}  # west, south, east, north
        self._overview = None
        self._overview_etag = None
        self.startup_seconds = time.time() - t0

    # ------------------------------------------------------------------ lists for the selectors
    def meta(self) -> dict:
        districts = self.tables["districts"][["district_code", "city_code", "district_name", "city_name"]]
        provinces = []
        for (city_code, city_name), group in districts.groupby(["city_code", "city_name"]):
            items = []
            for row in group.itertuples():
                has = row.district_code in self.base.index
                items.append(dict(code=int(row.district_code), name=row.district_name, has_data=has,
                                  reason=None if has else self.left_out.loc[row.district_code, "reason"], bounds=self.bounds[row.district_code]))
            provinces.append(dict(code=int(city_code), name=city_name, districts=items))
        return dict(provinces=provinces, model=dict(algorithm=self.card["algorithm"], trained_on_years=self.card["trained_on_years"]), n_with_data=len(self.base))

    # ------------------------------------------------------------------ one district
    def _base_row(self, code: int) -> pd.DataFrame:
        if code not in self.base.index:
            if code in self.left_out.index:
                raise NoResult(self.left_out.loc[code, "reason"])
            raise KeyError(code)
        return self.base.loc[[code]]

    def district(self, code: int) -> dict:
        row = self._base_row(code).iloc[0]
        history = self.history[code]
        lst = history[TARGET]
        city_rows = self.base[self.base["city_code"] == row["city_code"]]
        risk = self.risk.loc[code]
        return dict(
            code=int(code), name=row["district_name"], city_code=int(row["city_code"]), city_name=row["city_name"], region=row["region"],
            urban_km2=round(float(row["urban_km2"]), 3), green_share=round(float(row["landsat_green_share"]), 4), base_year=int(row["year"]),
            measured=dict(
                current=round(float(history.loc[history["year"] == row["year"], TARGET].iloc[0]), 2),
                min=round(float(lst.min()), 2), max=round(float(lst.max()), 2), mean=round(float(lst.mean()), 2),
                min_year=int(history.loc[lst.idxmin(), "year"]), max_year=int(history.loc[lst.idxmax(), "year"]),
            ),
            history=[dict(year=int(r.year), lst=round(float(r.landsat_lst_c), 2), green_share=round(float(r.landsat_green_share), 4),
                          temp_mean=round(float(r.temp_mean_ja), 2), hot_days=int(round(r.hot_days_ja))) for r in history.itertuples()],
            compare=dict(
                city_median_lst=round(float(self.risk.loc[city_rows.index, "lst_recent"].median()), 2),
                city_median_green=round(float(city_rows["landsat_green_share"].median()), 4),
                national_median_lst=round(float(self.risk["lst_recent"].median()), 2),
                national_median_green=round(float(self.base["landsat_green_share"].median()), 4),
                recent_lst=round(float(risk["lst_recent"]), 2),
            ),
            risk=dict(
                score=round(float(risk["risk_score"]), 1), rank=int(risk["risk_rank"]), rank_low=int(risk["risk_rank_low"]), rank_high=int(risk["risk_rank_high"]),
                n=len(self.risk), top_share=round(float(risk["top_share"]), 2),
                components={name: round(float(risk[name]), 1) for name in COMPONENTS},
                vulnerable_people=int(risk["vulnerable_people"]),
                priority_rank=None if pd.isna(risk["priority_rank"]) else int(risk["priority_rank"]),
                n_priority=int(self.risk["priority_rank"].notna().sum()),
                priority_reachability=_optional_float(risk.get("priority_reachability")),
                priority_rank_low=_optional_float(risk.get("priority_rank_low")),
                priority_rank_high=_optional_float(risk.get("priority_rank_high")),
                priority_top20_share=_optional_float(risk.get("priority_top20_share")),
                small_area=bool(row["urban_km2"] < 1),
            ),
        )

    def top_risk(self, n: int = 20) -> list:
        top = self.risk.nsmallest(n, "risk_rank")
        return [dict(code=int(c), name=self.base.loc[c, "district_name"], city_name=self.base.loc[c, "city_name"], score=round(float(r.risk_score), 1),
                     rank=int(r.risk_rank), top_share=round(float(r.top_share), 2)) for c, r in top.iterrows()]

    # ------------------------------------------------------------------ the what-if
    def to_points(self, amount: float, unit: str, urban_km2: float) -> float:
        """An area of green (m², ha or km²) as points of green share of the built-up area (1 point = urban_km2 hectares)."""
        return amount * UNIT_TO_KM2[unit] / urban_km2 * 100

    def what_if(self, code: int, amount: float, unit: str, cooling: float = 1.0) -> dict:
        row_frame = self._base_row(code)
        row = row_frame.iloc[0]
        urban_km2, share = float(row["urban_km2"]), float(row["landsat_green_share"])
        requested = self.to_points(amount, unit, urban_km2)
        allowed_max = min(MAX_ADD_POINTS, (self.max_green - share) * 100)  # the data limit and the limit of the curve
        within = float(np.clip(requested, -min(MAX_LOSS_POINTS, share * 100), allowed_max))
        limited = abs(within - requested) > 1e-9

        res = self.engine.run(row_frame, GRID / 100)  # the curve in steps of one point, with the range of the bootstrap models
        exact = self.engine.run(row_frame, [within / 100])
        effect, low, high = (float(exact[k][0, 0]) for k in ("effect", "low", "high"))
        new_share = float(np.clip(share + within / 100, 0, self.max_green))
        current = float(self.history[code].loc[self.history[code]["year"] == row["year"], TARGET].iloc[0])
        applied = (new_share - share) * 100
        relative = float(row["landsat_green_share_vs_city"]) + (new_share - share) * (1 - 1 / float(row["n_districts"]))
        support = self.support.check(row_frame, np.array([new_share]), np.array([relative]))[0] if self.support is not None else None

        plus = slice(list(GRID).index(0), None)  # the curve from 0 to +30 points
        target = {}
        for name in ("effect", "low", "high"):  # low = strongest cooling = the optimistic end
            pts = float(points_needed(res[name][:, plus], np.array([cooling]), points=res["applied"][:, plus] * 100)[0])
            target[name] = None if np.isnan(pts) else pts
        frequency = None
        if self.engine.range_low is not None:
            draws = self.engine.bootstrap_effects[:, self.engine.row_of[code], plus]
            frequency = float(np.any(-draws >= cooling, axis=1).mean())

        def hectares(points):
            return None if points is None else points * urban_km2

        return dict(
            district=dict(code=int(code), name=row["district_name"], city_name=row["city_name"], urban_km2=round(urban_km2, 3), green_share=round(share, 4), base_year=int(row["year"])),
            input=dict(amount=amount, unit=unit, requested_points=round(requested, 3), limited=limited,
                       max_add_points=round(allowed_max, 2), max_add_hectares=round(allowed_max * urban_km2, 1),
                       max_loss_points=round(min(MAX_LOSS_POINTS, share * 100), 2)),
            applied=dict(points=round(applied, 3), hectares=round(applied * urban_km2, 2), new_green_share=round(new_share, 4)),
            effect=dict(value=round(effect, 3), low=round(low, 3), high=round(high, 3), observed=None,
                        has_range=exact["has_range"], kind="model_sampling_sensitivity"),
            observational_reference=self.card.get("observational_reference"),
            support=support,
            lst=dict(current=round(current, 2), new=round(current + effect, 2), new_low=round(current + low, 2), new_high=round(current + high, 2)),
            target=dict(cooling=cooling,
                        points=_round_up(target["effect"], 2), hectares=_round_up(hectares(target["effect"]), 1),
                        reachable=target["effect"] is not None, points_low=_round_up(target["low"], 2),
                        reachability_frequency=frequency,
                        points_high=_round_up(target["high"], 2),
                        hectares_low=_round_up(hectares(target["low"]), 1),
                        hectares_high=_round_up(hectares(target["high"]), 1),
                        points_observed=None, hectares_observed=None),
            curve=[dict(points=int(g), effect=round(float(res["effect"][0, i]), 3), low=round(float(res["low"][0, i]), 3), high=round(float(res["high"][0, i]), 3))
                   for i, g in enumerate(GRID)],
        )

    # ------------------------------------------------------------------ maps
    def overview_geojson(self) -> str:
        """All districts, simplified (about 1.6 MB): code, name, city, whether it has a result, and the risk score for the colours."""
        if self._overview is None:
            d = self.tables["districts"][["district_code", "city_code", "district_name", "city_name", "geometry"]].copy()
            d["geometry"] = d["geometry"].simplify(0.0002, preserve_topology=True)
            d["has_data"] = d["district_code"].isin(self.base.index)
            d["risk_score"] = d["district_code"].map(self.risk["risk_score"]).round(1)
            collection = json.loads(d.to_json(drop_id=True))
            for feature in collection["features"]:
                feature["geometry"]["coordinates"] = _round_coordinates(feature["geometry"]["coordinates"], 5)
                if pd.isna(feature["properties"]["risk_score"]):
                    feature["properties"]["risk_score"] = None
            self._overview = json.dumps(collection, separators=(",", ":"))
            self._overview_etag = '"' + hashlib.md5(self._overview.encode()).hexdigest() + '"'
        return self._overview

    @property
    def overview_etag(self) -> str:
        """The tag of the map file (built once with it), so an unchanged file can answer 304."""
        self.overview_geojson()
        return self._overview_etag

    def district_geojson(self, code: int) -> str:
        """The detailed outline of one district (for zooming in)."""
        geom = self.shapes.loc[code, "geometry"]
        feature = {"type": "Feature", "properties": {"code": int(code)}, "geometry": json.loads(json.dumps(geom.__geo_interface__))}
        feature["geometry"]["coordinates"] = _round_coordinates(feature["geometry"]["coordinates"], 5)
        return json.dumps(feature, separators=(",", ":"))


def _round_up(value, digits):
    return None if value is None else math.ceil(value * 10 ** digits - 1e-9) / 10 ** digits


def _optional_float(value):
    return None if value is None or pd.isna(value) else float(value)


def _round_coordinates(value, digits: int = 4):
    if isinstance(value, (list, tuple)):
        return [_round_coordinates(v, digits) for v in value]
    return round(value, digits)

"""Checks of the backend against the results of the notebooks and of the API behaviour.

Run from the project root (conda env urban-green-planner), after notebooks/modeling.ipynb, whatif.ipynb and risk.ipynb were run:
    python -m backend.tests.parity
The notebooks write data/results/*.csv; the backend never reads them, they are only the reference here.
"""
import asyncio
import os
import selectors
import warnings

import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

warnings.filterwarnings("ignore")

from backend.main import DATA_DIR, app  # noqa: E402


class _PollingSelector(selectors.DefaultSelector):
    """Optional sandbox fallback when cross-thread socket wakeups are restricted."""
    def select(self, timeout=None):
        return super().select(.02 if timeout is None else min(timeout, .02))


def _test_loop():
    return asyncio.SelectorEventLoop(_PollingSelector())


def main():
    scorecard = pd.read_csv(DATA_DIR / "results" / "district_scorecard.csv").set_index("district_code")
    options = {"loop_factory": _test_loop} if os.environ.get("PLANNER_TEST_POLL") == "1" else {}
    with TestClient(app, backend_options=options) as client:
        planner = app.state.planner

        # ---- 1. the risk table equals risk.ipynb ------------------------------------------------
        risk = planner.risk.reindex(scorecard.index)
        for column in ("hazard_pct", "exposure_pct", "vulnerability_pct", "risk_score", "top_share"):
            assert np.allclose(risk[column], scorecard[column], atol=2e-3), column
        for column in ("risk_rank", "risk_rank_low", "risk_rank_high", "vulnerable_people"):
            assert (risk[column].to_numpy() == scorecard[column].to_numpy()).all(), column
        assert (risk["priority_rank"].astype("float").fillna(-1).to_numpy() == scorecard["priority_rank"].fillna(-1).to_numpy()).all(), "priority_rank"
        reachable = scorecard["hectares_1c"].notna()
        assert np.allclose(risk.loc[reachable, "hectares_1c"], scorecard.loc[reachable, "hectares_1c"], atol=0.06), "hectares_1c"
        print("1. risk table equals the scorecard of risk.ipynb: ok")

        # ---- 2. the what-if equals whatif.ipynb (+10 points, with the range) --------------------------
        rng = np.random.default_rng(0)
        for code in rng.choice(scorecard.index.to_numpy(), size=40, replace=False):
            row = scorecard.loc[code]
            result = client.post("/api/whatif", json={"district_code": int(code), "amount": 10 * row["urban_km2"], "unit": "ha"}).json()
            if result["input"]["limited"]:
                continue  # +10 points is always inside the limits unless the share is near the data maximum
            for key, column in (("value", "effect_10pts"), ("low", "effect_10pts_low"), ("high", "effect_10pts_high")):
                assert abs(result["effect"][key] - row[column]) < 0.003, (code, key, result["effect"][key], row[column])
        print("2. what-if (+10 points) equals the scorecard of whatif.ipynb, with its range: ok")

        # ---- 3. units, limits and signs -----------------------------------------------------------
        code = int(scorecard.index[100])
        urban = scorecard.loc[code, "urban_km2"]
        a = client.post("/api/whatif", json={"district_code": code, "amount": 10000, "unit": "m2"}).json()
        b = client.post("/api/whatif", json={"district_code": code, "amount": 1, "unit": "ha"}).json()
        c = client.post("/api/whatif", json={"district_code": code, "amount": 0.01, "unit": "km2"}).json()
        assert a["effect"] == b["effect"] == c["effect"] and abs(a["applied"]["hectares"] - 1) < 0.01, "10,000 m2 = 1 ha = 0.01 km2"
        zero = client.post("/api/whatif", json={"district_code": code, "amount": 0, "unit": "ha"}).json()
        assert zero["effect"]["value"] == 0 and zero["applied"]["points"] == 0, "no change, no effect"
        huge = client.post("/api/whatif", json={"district_code": code, "amount": 1e12, "unit": "m2"}).json()
        assert huge["input"]["limited"] and huge["applied"]["points"] <= 30 + 1e-9, "the change is limited to +30 points"
        assert huge["applied"]["new_green_share"] <= planner.max_green + 1e-9, "the share never goes above the data maximum"
        loss = client.post("/api/whatif", json={"district_code": code, "amount": -1e12, "unit": "m2"}).json()
        assert loss["input"]["limited"] and loss["applied"]["new_green_share"] >= 0, "the share never goes below zero"
        assert huge["effect"]["value"] <= 0 <= loss["effect"]["value"], "more green cools, less green heats"
        curve = [p["effect"] for p in huge["curve"]]
        assert all(x >= y - 1e-9 for x, y in zip(curve, curve[1:])), "the curve is monotone"
        assert all(p["low"] <= p["effect"] + 1e-9 <= p["high"] + 2e-9 for p in huge["curve"]), "the range contains the effect"
        assert abs(a["applied"]["points"] - 1 / urban) < 1e-3, "1 ha is 1 / urban_km2 points of green share"
        print("3. units, limits, signs, monotone curve and range: ok")

        # ---- 4. errors and the other endpoints -------------------------------------------------------
        assert client.get("/api/district/1176").status_code == 404 and client.get("/api/district/1176").json()["detail"]["reason"] == "city_has_too_few_districts"
        assert client.post("/api/whatif", json={"district_code": 1176, "amount": 1, "unit": "ha"}).status_code == 404
        assert client.post("/api/whatif", json={"district_code": code, "amount": 1, "unit": "acre"}).status_code == 422
        assert client.post("/api/whatif", json={"district_code": code, "amount": 1, "unit": "ha", "cooling": 99}).status_code == 422
        assert client.get("/api/district/999999").status_code == 404
        meta = client.get("/api/meta").json()
        districts = [d for p in meta["provinces"] for d in p["districts"]]
        assert len(meta["provinces"]) == 81 and len(districts) == 973 and sum(d["has_data"] for d in districts) == 829
        assert len(client.get("/api/top-risk?n=20").json()) == 20
        overview = client.get("/api/geo/overview")
        assert overview.status_code == 200 and len(overview.json()["features"]) == 973 and len(overview.content) < 6_000_000
        assert client.get(f"/api/geo/district/{code}").json()["geometry"]["type"] in ("Polygon", "MultiPolygon")
        info = client.get(f"/api/district/{code}").json()
        assert info["measured"]["min"] <= info["measured"]["current"] <= info["measured"]["max"]
        print("4. errors, lists, maps and district details: ok")

        # ---- 5. sufficient target amounts, independent observational reference and support --------
        rng2 = np.random.default_rng(3)
        for code in rng2.choice(scorecard.index.to_numpy(), size=10, replace=False):
            row = scorecard.loc[code]
            out = client.post("/api/whatif", json={"district_code": int(code), "amount": 10 * row["urban_km2"], "unit": "ha"}).json()
            if out["input"]["limited"]:
                continue  # +10 points is always inside the limits unless the share is near the data maximum
            assert out["effect"]["observed"] is None, "historical association must not be a universal correction"
            assert out["observational_reference"]["kind"] == "observed_association"
            assert isinstance(out["support"]["supported"], bool)
            target = out["target"]
            assert target["points_observed"] is None
            assert 0 <= target["reachability_frequency"] <= 1
            if target["hectares"] is not None:
                achieved = client.post("/api/whatif", json={"district_code":int(code),"amount":target["hectares"],"unit":"ha"}).json()
                assert achieved["effect"]["value"] <= -target["cooling"] + .001, (code, achieved)
        print("5. sufficient heat targets, observational reference, support and reachability: ok")

        # ---- 6. the what-if against a direct calculation with the saved model file ------------------
        import xgboost as xgb

        card = planner.card
        trees = xgb.XGBRegressor(n_jobs=1)
        trees.load_model(str(DATA_DIR / "models" / card["model_file"]))
        for code in rng2.choice(scorecard.index.to_numpy(), size=3, replace=False):
            base_row = planner.base.loc[[int(code)]]
            out = client.post("/api/whatif", json={"district_code": int(code), "amount": 10 * scorecard.loc[code, "urban_km2"], "unit": "ha"}).json()
            if out["input"]["limited"]:
                continue
            changed = base_row.copy()  # the same change the engine makes, calculated without the engine
            applied = out["applied"]["points"] / 100
            changed["landsat_green_share"] = changed["landsat_green_share"] + applied
            changed["landsat_green_share_vs_city"] = changed["landsat_green_share_vs_city"] + applied * (1 - 1 / float(base_row["n_districts"].iloc[0]))
            direct = float(trees.predict(changed[card["features"]])[0] - trees.predict(base_row[card["features"]])[0])
            assert abs(out["effect"]["value"] - direct) < 0.005, (code, out["effect"]["value"], direct)
        print("6. the what-if equals a direct calculation with the saved model file: ok")

        # ---- 7. the map file answers 304 when it is unchanged ---------------------------------------
        first = client.get("/api/geo/overview")
        etag = first.headers.get("etag")
        assert etag, "the overview should carry an ETag"
        second = client.get("/api/geo/overview", headers={"If-None-Match": etag})
        assert second.status_code == 304 and second.content == b"", "an unchanged overview should be a 304"
        assert second.headers.get("etag") == etag and second.headers.get("cache-control"), "the 304 repeats ETag and Cache-Control"
        assert client.get("/api/geo/overview", headers={"If-None-Match": "*"}).status_code == 304, "the star form matches anything"
        assert client.get("/api/geo/overview", headers={"If-None-Match": '"something-else"'}).status_code == 200, "a different tag sends the file"
        assert client.get("/api/geo/overview").content == first.content
        print("7. the map file answers 304 when it is unchanged: ok")

        # ---- 8. the heat-target helper on curves where the answer is known ---------------------------
        from backend.planner.whatif import points_needed

        straight = -0.06 * np.arange(31)  # first sufficient integer-grid step is17
        weak = np.maximum(-0.06 * np.arange(31), -0.5)  # stops at -0.5 C: 1 C is never reached
        jump = np.where(np.arange(31) < 10, 0.0, -1.2)  # nothing until 9 points, then a jump to -1.2 C
        found = points_needed(np.vstack([straight, weak, jump]), np.ones(3))
        assert found[0] == 17 and np.isnan(found[1]) and found[2] == 10
        print("8. points_needed on known curves: ok")

        # ---- 9. the generic error handler answers the clean shape ------------------------------------
        import asyncio
        import logging
        import types

        from backend.main import app as fastapi_app

        handler = fastapi_app.exception_handlers.get(Exception)
        assert handler is not None, "the app must register the generic error handler"
        dummy_request = types.SimpleNamespace(method="GET", url=types.SimpleNamespace(path="/api/x"))
        planner_logger = logging.getLogger("planner")
        planner_logger.disabled = True  # the test error must not print a traceback into the report
        try:
            error_response = asyncio.run(handler(dummy_request, RuntimeError("the test error")))
        finally:
            planner_logger.disabled = False
        assert error_response.status_code == 500 and b"internal_error" in error_response.body
        print("9. the generic error handler answers the clean shape: ok")

        print(f"all checks passed (startup {planner.startup_seconds:.0f} s, model {planner.card['algorithm']})")


if __name__ == "__main__":
    main()

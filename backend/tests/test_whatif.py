"""Regressions for sufficient targets and exact intervention predictions."""
import unittest

import numpy as np
import pandas as pd

from backend.planner.service import Planner
from backend.planner.whatif import GRID, WhatIfEngine, base_fingerprint, points_needed


class TargetTests(unittest.TestCase):
    def test_baseline_fingerprint_accepts_district_code_as_index_and_column(self):
        rows = baseline()
        expected = base_fingerprint(rows, ["landsat_green_share"])
        self.assertEqual(base_fingerprint(rows.set_index("district_code", drop=False),
                                           ["landsat_green_share"]), expected)

    def test_staircase_requires_the_first_sufficient_step(self):
        curve = np.where(np.arange(31) < 10, 0.0, -1.2)
        self.assertEqual(points_needed(curve[None, :], np.ones(1))[0], 10)

    def test_linear_grid_returns_a_sufficient_amount(self):
        curve = -0.06 * np.arange(31)
        self.assertEqual(points_needed(curve[None, :], np.ones(1))[0], 17)

    def test_unreachable_and_missing_targets_remain_missing(self):
        curves = np.vstack([np.zeros(31), -0.1 * np.arange(31)])
        found = points_needed(curves, np.array([1.0, np.nan]))
        self.assertTrue(np.isnan(found).all())

    def test_physical_cap_returns_applied_points(self):
        found = points_needed(np.array([[0.0, -0.4, -1.2]]), np.ones(1),
                              points=np.array([[0.0, 1.0, 1.6]]))
        self.assertAlmostEqual(found[0], 1.6)


def baseline():
    return pd.DataFrame([dict(district_code=1, city_code=1, district_name="Example",
                              city_name="Example city", year=2025, urban_km2=1.0,
                              landsat_green_share=0.3, landsat_green_share_vs_city=0.0,
                              n_districts=3)])


def staircase(frame):
    return np.where(frame["landsat_green_share"].to_numpy() >= 0.4, 19.0, 20.0)


class InterventionTests(unittest.TestCase):
    def test_reported_hectares_do_not_round_below_sufficient_amount(self):
        rows = baseline().set_index("district_code", drop=False)
        rows["urban_km2"] = 1.032
        planner = object.__new__(Planner)
        planner.base, planner.max_green, planner.card, planner.support = rows, 0.9, {}, None
        planner.engine = WhatIfEngine(["landsat_green_share", "landsat_green_share_vs_city"], staircase, max_green=0.9)
        planner.history = {1: pd.DataFrame({"year": [2025], "landsat_lst_c": [20.0]})}
        target = planner.what_if(1, 0, "ha")["target"]
        achieved = planner.what_if(1, target["hectares"], "ha")["effect"]["value"]
        self.assertLessEqual(achieved, -1.0)

    def test_citywide_change_uses_complete_context_when_latest_rows_mix_years(self):
        context = pd.DataFrame(dict(district_code=[1, 2, 3], city_code=1, year=2024,
                                    landsat_green_share=[0.3, 0.8, 0.9]))
        context["landsat_green_share_vs_city"] = context.landsat_green_share - 2 / 3
        rows = context.iloc[[0]].copy()
        engine = WhatIfEngine(["landsat_green_share", "landsat_green_share_vs_city"],
                              lambda frame: -frame.landsat_green_share - 10 * frame.landsat_green_share_vs_city,
                              max_green=0.9)
        try:
            found = engine.citywide(rows, context, 0.1)
        except AttributeError:
            self.fail("complete-context citywide intervention is missing")
        self.assertAlmostEqual(found[0], -0.1 - 1 / 3)

    def test_engine_enforces_its_percentage_point_limits(self):
        rows = baseline()
        engine = WhatIfEngine(["landsat_green_share", "landsat_green_share_vs_city"],
                              staircase, max_green=0.9)
        out = engine.run(rows, [-0.8, 0.8], with_range=False)
        np.testing.assert_allclose(out["applied"], [[-0.2, 0.3]])

    def test_fractional_input_has_exact_staircase_prediction(self):
        rows = baseline().set_index("district_code", drop=False)
        planner = object.__new__(Planner)
        planner.base = rows
        planner.max_green = 0.9
        planner.card = {}
        planner.support = None
        planner.engine = WhatIfEngine(["landsat_green_share", "landsat_green_share_vs_city"],
                                       staircase, max_green=0.9)
        planner.history = {1: pd.DataFrame({"year": [2025], "landsat_lst_c": [20.0]})}
        result = planner.what_if(1, 9.5, "ha")
        self.assertEqual(result["effect"]["value"], 0.0)
        self.assertEqual(result["target"]["points"], 10.0)

    def test_fractional_bootstrap_bounds_bracket_neighboring_steps(self):
        rows = baseline()
        draws = np.zeros((2, 1, len(GRID)))
        draws[:, 0, GRID >= 10] = -1.2
        engine = WhatIfEngine(["landsat_green_share", "landsat_green_share_vs_city"],
                              staircase, max_green=0.9,
                              bootstrap={"effects": draws, "district_code": np.array([1]), "grid": GRID})
        out = engine.run(rows, [0.095])
        self.assertLessEqual(out["low"][0, 0], -1.2)
        self.assertGreaterEqual(out["high"][0, 0], 0.0)


if __name__ == "__main__":
    unittest.main()

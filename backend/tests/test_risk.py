"""Behavioral checks for risk and bootstrap priority summaries."""
import unittest

import numpy as np
import pandas as pd

from backend.planner import risk
from backend.planner.data import AGE_GROUPS_VULNERABLE


class PrioritySensitivityTests(unittest.TestCase):
    # Dropping unreachable draws would incorrectly make both shares 1.0.
    def test_unreachable_draws_remain_in_reachability_and_top_group_denominators(self):
        base = pd.DataFrame({"district_code": [11, 22], "urban_km2": [1, 1]})
        people = pd.Series({22: 20, 11: 10})
        effects = np.array([[[0, -1, -2], [0, -.4, -.8]],
                            [[0, -.4, -.8], [0, -1, -2]]])
        result = risk.priority_sensitivity(base, people, effects, top_n=1)
        self.assertEqual(result.index.tolist(), [11, 22])
        np.testing.assert_allclose(result.priority_reachability, [.5, .5])
        np.testing.assert_allclose(result.priority_top20_share, [.5, .5])
        np.testing.assert_allclose(result.priority_rank_low, [1, 1])
        np.testing.assert_allclose(result.priority_rank_high, [1, 1])
        self.assertEqual(str(result.priority_rank_low.dtype), "Int64")
        self.assertEqual(result.attrs["rank_condition"], "conditional on target reachability")

    # Ranking on requested rather than clipped points reverses this order.
    def test_actual_applied_points_determine_hectares_and_ranks(self):
        base = pd.DataFrame({"district_code": [11, 22], "urban_km2": [2, 1]})
        effects = np.array([[[0, -.4, -1.2], [0, -.4, -1.2]]])
        result = risk.priority_sensitivity(base, pd.Series({11: 100, 22: 100}), effects,
                                           points_grid=np.array([[0, 1, 1.5], [0, 1, 2]]), top_n=1)
        np.testing.assert_allclose(result.priority_rank_low, [2, 1])
        np.testing.assert_allclose(result.priority_top20_share, [0, 1])

    def test_never_reachable_has_no_conditional_rank(self):
        base = pd.DataFrame({"district_code": [11], "urban_km2": [1]})
        result = risk.priority_sensitivity(base, pd.Series({11: 10}), np.zeros((2, 1, 3)))
        self.assertEqual(result.priority_reachability.iloc[0], 0)
        self.assertEqual(result.priority_top20_share.iloc[0], 0)
        self.assertTrue(pd.isna(result.priority_rank_low.iloc[0]))


class RiskTableTests(unittest.TestCase):
    def test_raw_quantiles_remain_separate_from_expanded_bounds_and_priority_joins_by_code(self):
        n = 101
        base = pd.DataFrame({"district_code": np.arange(n)})
        table = pd.DataFrame({"district_code": np.arange(n), "year": 2025,
                              "landsat_lst_c": np.arange(n)})
        population = pd.DataFrame({"district_code": np.arange(n), "year": 2025})
        for column in AGE_GROUPS_VULNERABLE:
            population[column] = (np.arange(n) * 37) % n + 1
        tables = {"population": population, "sege": pd.DataFrame({
            "district_code": np.arange(n), "sege_score": (np.arange(n) * 23) % n})}
        priority = pd.DataFrame({"priority_reachability": [.4, .9]}, index=[11, 0])
        out = risk.risk_table(base, table, tables, pd.Series(1.0, index=np.arange(n)), priority=priority)
        self.assertEqual(out.loc[0, "priority_reachability"], .9)
        self.assertEqual(out.loc[11, "priority_reachability"], .4)
        self.assertTrue((out.risk_rank_low <= out.risk_rank_q05.round()).all())
        self.assertTrue((out.risk_rank_high >= out.risk_rank_q95.round()).all())
        self.assertTrue((out.risk_rank_low <= out.risk_rank).all())
        self.assertTrue((out.risk_rank_high >= out.risk_rank).all())
        self.assertTrue((out.risk_rank_q05 != out.risk_rank_low).any() or
                        (out.risk_rank_q95 != out.risk_rank_high).any())
        # The hottest district ranks first under the hazard-only policy even
        # when its population and socioeconomic components are different.
        self.assertEqual(out.loc[100, "risk_rank_hazard_only"], 1)
        self.assertEqual(out.loc[0, "risk_rank_vulnerability_only"], 1)


if __name__ == "__main__":
    unittest.main()

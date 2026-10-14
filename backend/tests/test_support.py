import unittest

import numpy as np
import pandas as pd


class SupportTests(unittest.TestCase):
    def diagnostic(self):
        try:
            from backend.planner.support import ScenarioSupport
        except ModuleNotFoundError:
            self.fail("scenario-support diagnostic has not been implemented")
        i = np.arange(50)
        table = pd.DataFrame(dict(district_code=i, city_code=1,
                                 landsat_green_share=0.2 + 0.001 * i,
                                 landsat_green_share_vs_city=-0.0245 + 0.001 * i,
                                 temp_clim=20 + i / 50))
        return ScenarioSupport(table), table

    def test_physical_zero_can_be_outside_observational_support(self):
        diagnostic, table = self.diagnostic()
        row = table.iloc[[20]]
        found = diagnostic.check(row, np.array([0.0]), np.array([-0.2]))[0]
        self.assertFalse(found["supported"])
        self.assertIn("green_outside_global_range", found["reasons"])

    def test_valid_marginals_do_not_hide_distant_feature_combinations(self):
        diagnostic, table = self.diagnostic()
        row = table.iloc[[20]].copy()
        row["temp_clim"] = 50.0
        found = diagnostic.check(row, np.array([0.22]), np.array([-0.0045]))[0]
        self.assertFalse(found["supported"])
        self.assertIn("weak_joint_support", found["reasons"])

    def test_observed_point_has_zero_neighbor_distance(self):
        diagnostic, table = self.diagnostic()
        row = table.iloc[[20]]
        found = diagnostic.check(row, np.array([0.22]), np.array([-0.0045]))[0]
        self.assertTrue(found["supported"])
        self.assertAlmostEqual(found["nearest_distance"], 0.0)


if __name__ == "__main__":
    unittest.main()

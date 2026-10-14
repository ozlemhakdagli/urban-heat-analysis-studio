"""Descriptive training-support checks, without causal or safety guarantees."""
import numpy as np
from sklearn.neighbors import NearestNeighbors

from .data import REGION_OF_CITY

GREEN = ["landsat_green_share", "landsat_green_share_vs_city"]
CONTEXT = ["temp_clim", "precip_clim", "elevation_m", "built_share_2020", "log_urban_km2"]


class ScenarioSupport:
    """Regional joint distances calibrated by leaving a district's rows out.

    Passing the checks means no weak support was detected in these selected
    features. It does not establish intervention feasibility or causality.
    """

    def __init__(self, table):
        self.columns = GREEN + [c for c in CONTEXT if c in table]
        self.bounds = table[GREEN].agg(["min", "max"])
        values = table[self.columns].to_numpy(dtype=float)
        self.mean = values.mean(axis=0)
        self.scale = values.std(axis=0)
        self.scale[self.scale == 0] = 1
        scaled = (values - self.mean) / self.scale
        regions = table["city_code"].map(REGION_OF_CITY).fillna("unknown").to_numpy()
        self.references = {}
        for region in np.unique(regions):
            indexes = np.flatnonzero(regions == region)
            codes = table.iloc[indexes]["district_code"].to_numpy()
            reference = scaled[indexes]
            nn = NearestNeighbors(n_jobs=1).fit(reference)
            k = min(len(indexes), int(table.iloc[indexes].groupby("district_code").size().max()) + 1)
            distances, neighbors = nn.kneighbors(reference, n_neighbors=k)
            different = codes[neighbors] != codes[:, None]
            nearest_peer = np.min(np.where(different, distances, np.inf), axis=1)
            finite = nearest_peer[np.isfinite(nearest_peer)]
            radius = max(float(np.percentile(finite, 95)), 1e-8) if len(finite) else None
            green = table.iloc[indexes]["landsat_green_share"]
            self.references[region] = (nn, radius, float(green.min()), float(green.max()))

    def check(self, rows, new_share, relative_green):
        changed = rows[self.columns].copy()
        changed[GREEN[0]], changed[GREEN[1]] = new_share, relative_green
        values = (changed.to_numpy(dtype=float) - self.mean) / self.scale
        regions = rows["city_code"].map(REGION_OF_CITY).fillna("unknown").to_numpy()
        results = []
        for i, region in enumerate(regions):
            reasons = []
            if not self.bounds.loc["min", GREEN[0]] - 1e-10 <= new_share[i] <= self.bounds.loc["max", GREEN[0]] + 1e-10:
                reasons.append("green_outside_global_range")
            if not self.bounds.loc["min", GREEN[1]] - 1e-10 <= relative_green[i] <= self.bounds.loc["max", GREEN[1]] + 1e-10:
                reasons.append("relative_green_outside_global_range")
            distance = radius = None
            if region in self.references:
                nn, radius, low, high = self.references[region]
                distance = float(nn.kneighbors(values[[i]], n_neighbors=1)[0][0, 0])
                if not low - 1e-10 <= new_share[i] <= high + 1e-10:
                    reasons.append("green_outside_region_range")
                if radius is None:
                    reasons.append("insufficient_reference_districts")
                elif distance > radius + 1e-10:
                    reasons.append("weak_joint_support")
            else:
                reasons.append("region_missing")
            results.append(dict(supported=not reasons, reasons=reasons,
                                nearest_distance=distance, reference_radius=radius))
        return results

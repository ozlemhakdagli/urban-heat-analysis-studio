"""Data preparation of the planner: the same steps as Part 1 of notebooks/whatif.ipynb, written as functions.

One row of the model table is one district and one summer (July + August). Everything is joined on district_code.
"""
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd

TARGET = "landsat_lst_c"  # the summer surface temperature of the built-up area (°C)
WEATHER = ["temp_mean_ja", "hot_days_ja", "precip_spring"]
WITHIN_CITY = [  # the within-city columns of the 26 features of Part 4 of the modeling notebook
    "landsat_green_share", "elevation_m", "built_share_2020", "log_urban_km2",
    "logpop", "share65", "temp_mean_ja", "hot_days_ja",
]
WITHIN_CITY_NEW = WITHIN_CITY + ["landsat_cover"]  # the within-city columns of the final model also have the clear sky (Part 5)
ADDED_FEATURES = ["landsat_cover", "landsat_cover_vs_city", "precip_clim", "temp_clim"]  # Part 5 of the modeling notebook
REGIONS = {
    "Marmara": [10, 11, 16, 17, 22, 34, 39, 41, 54, 59, 77],
    "Aegean": [3, 9, 20, 35, 43, 45, 48, 64],
    "Mediterranean": [1, 7, 15, 31, 32, 33, 46, 80],
    "Central Anatolia": [6, 18, 26, 38, 40, 42, 50, 51, 58, 66, 68, 70, 71],
    "Black Sea": [5, 8, 14, 19, 28, 29, 37, 52, 53, 55, 57, 60, 61, 67, 69, 74, 78, 81],
    "Eastern Anatolia": [4, 12, 13, 23, 24, 25, 30, 36, 44, 49, 62, 65, 75, 76],
    "Southeastern Anatolia": [2, 21, 27, 47, 56, 63, 72, 73, 79],
}
REGION_OF_CITY = {city: region for region, cities in REGIONS.items() for city in cities}
AGE_GROUPS_VULNERABLE = ["total_0_4", "total_65_69", "total_70_74", "total_75_79", "total_80_84", "total_85_89", "total_90plus"]


def add_within_city(frame: pd.DataFrame, columns: list) -> pd.DataFrame:
    """Every value minus the mean of the same city in the same year (the `..._vs_city` columns of `columns`)."""
    frame = frame.copy()
    city_means = frame.groupby(["city_code", "year"])[columns].transform("mean")
    frame[[f"{name}_vs_city" for name in columns]] = (frame[columns] - city_means).to_numpy()
    return frame


def load_tables(processed: Path) -> dict:
    districts = gpd.read_file(processed / "turkey_districts_master.geojson")
    return {
        "green": pd.read_csv(processed / "greenness_districts_summer_2013_2025.csv"),
        "climate": pd.read_csv(processed / "climate_districts_monthly_2000_2025.csv"),
        "population": pd.read_csv(processed / "tuik_districts_population_clean.csv"),
        "static": pd.read_csv(processed / "districts_urban_static.csv"),
        "sege": pd.read_csv(processed / "sege_districts_2022.csv"),
        "districts": districts,
        "centers": pd.DataFrame(districts[["district_code", "center_lat", "center_lon"]]),
    }


def build_model_table(tables: dict):
    """The model table (reliable rows only), the weather of every district and year, and the feature names."""
    climate, population, green = tables["climate"], tables["population"].copy(), tables["green"]
    summer = (
        climate[climate["month"].isin([7, 8])].groupby(["district_code", "year"])
        .agg(temp_mean_ja=("temp_mean", "mean"), hot_days_ja=("hot_days", "sum")).reset_index()
    )
    spring = (
        climate[climate["month"].between(3, 6)].groupby(["district_code", "year"])
        .agg(precip_spring=("precip_sum", "sum")).reset_index()
    )
    weather = summer.merge(spring, on=["district_code", "year"], validate="one_to_one")

    age_65_plus = [c for c in population.columns if c.startswith("total_") and c.split("_")[1][:2] in ("65", "70", "75", "80", "85", "90")]
    population["share65"] = population[age_65_plus].sum(axis=1) / population["total_pop"]
    population["logpop"] = np.log(population["total_pop"])

    table = (
        green.merge(weather, on=["district_code", "year"], how="left", validate="one_to_one")
        .merge(population[["district_code", "year", "share65", "logpop"]], on=["district_code", "year"], how="left", validate="one_to_one")
        .merge(tables["static"][["district_code", "elevation_m", "built_share_2020"]], on="district_code", how="left", validate="many_to_one")
        .merge(tables["centers"], on="district_code", how="left", validate="many_to_one")
    )
    assert len(table) == len(green), "a join must not change the number of rows"

    table["log_urban_km2"] = np.log(table["urban_km2"])
    reliable = (table["urban_km2"] >= 0.5) & (table["landsat_cover"] >= 0.5) & table[TARGET].notna()
    table = table[reliable].dropna(subset=["share65", "logpop"])
    table = table[table.groupby(["city_code", "year"])["district_code"].transform("size") >= 3]

    region_columns = pd.get_dummies(table["city_code"].map(REGION_OF_CITY), prefix="region", dtype=int)[[f"region_{name}" for name in REGIONS]]
    # climate normals 2000-2012: the years before the first summer of the table (Part 5 of the modeling notebook)
    early = climate[climate["year"] <= 2012]
    normals = pd.DataFrame(
        {
            "precip_clim": early.groupby(["district_code", "year"])["precip_sum"].sum().groupby("district_code").mean(),
            "temp_clim": early.groupby("district_code")["temp_mean"].mean(),
        }
    ).reset_index()
    table = pd.concat([table, region_columns], axis=1).merge(normals, on="district_code", how="left", validate="many_to_one")
    table = add_within_city(table, WITHIN_CITY_NEW).reset_index(drop=True)
    features = (
        ["landsat_green_share", "elevation_m", "built_share_2020", "log_urban_km2", "logpop", "share65",
         "temp_mean_ja", "hot_days_ja", "precip_spring", "center_lat", "center_lon"]
        + list(region_columns.columns)
        + [f"{name}_vs_city" for name in WITHIN_CITY]
        + ADDED_FEATURES
    )
    return table, weather, features


def build_scenario_table(table: pd.DataFrame, weather: pd.DataFrame) -> pd.DataFrame:
    """Complete city-year rosters under weather from five preceding summers."""
    weather = weather.sort_values(["district_code", "year"])
    scenario_weather = weather[["district_code", "year"]].copy()
    for name in WEATHER:
        scenario_weather[name] = weather.groupby("district_code")[name].transform(lambda s: s.shift(1).rolling(5).mean())

    scenario = table.drop(columns=WEATHER).merge(scenario_weather, on=["district_code", "year"], how="left", validate="many_to_one")
    scenario = add_within_city(scenario, WITHIN_CITY_NEW)
    scenario["n_districts"] = scenario.groupby(["city_code", "year"])["district_code"].transform("size")
    scenario["region"] = scenario["city_code"].map(REGION_OF_CITY)
    return scenario


def build_base_rows(table: pd.DataFrame, weather: pd.DataFrame) -> pd.DataFrame:
    """Latest reliable row per district; retain complete city-year context upstream."""
    scenario = build_scenario_table(table, weather)
    latest = scenario["year"] == scenario.groupby("district_code")["year"].transform("max")
    return scenario[latest].reset_index(drop=True)


def excluded_districts(tables: dict, table: pd.DataFrame) -> pd.DataFrame:
    """The districts without a result and the reason."""
    districts = pd.DataFrame(tables["districts"][["district_code", "city_code", "district_name", "city_name"]])
    left_out = districts[~districts["district_code"].isin(table["district_code"])].copy()
    max_urban = tables["green"].groupby("district_code")["urban_km2"].max()
    left_out["reason"] = np.where(left_out["district_code"].map(max_urban) < 0.5, "small_built_up_area", "city_has_too_few_districts")
    return left_out

# Data Directory Documentation (`data/README.md`)

This document is the **single, comprehensive reference** for all datasets, model artifacts, and evaluation tables in the `data/` directory of the **Urban Heat Analysis Studio** project.

---

## 📁 Directory Architecture

```
data/
├── README.md                          # [This File] Central documentation for the entire data hierarchy
├── data_package.zip                   # [Distribution Archive] Complete pre-packaged processed data, models & results (31.8 MB)
│
├── raw/                               # Primary source downloads (EXCLUDED from git due to size)
│   ├── turkey_districts_raw.geojson   # UN OCHA 973 District administrative boundaries & centroids (HDX)
│   ├── turkey_provinces_raw.geojson   # UN OCHA 81 Province administrative boundaries (HDX)
│   ├── turkey_city_district_code_table.csv # Central primary-key table (city_code, district_code)
│   ├── nufus_ilce/                    # 18 raw TÜİK MEDAS demographic exports (2007-2025, 38 age groups)
│   ├── il_nufus_verisi.csv            # TÜİK MEDAS province seed table (source of city codes)
│   ├── ilce_nufus_verisi.csv          # TÜİK MEDAS district seed table (source of district codes)
│   ├── ilce_yapı_metrekare/           # Raw TÜİK MEDAS building permit pivot exports (2013-2025)
│   ├── sege/sege_scores_2022.csv      # Ministry of Industry and Technology SEGE-2022 raw table
│   └── ee_green/all/                  # Google Earth Engine Landsat 8/9 monthly chunk exports (312 CSVs)
│
├── processed/                         # Standardized, model-ready master datasets (Distribution Package)
│   ├── turkey_districts_master.geojson# Standardized 973 district GeoJSON (polygons + centroids)
│   ├── turkey_cities_master.geojson   # Standardized 81 province GeoJSON (boundaries)
│   ├── tuik_districts_population_clean.csv # 12,636 rows: urban population & 38 age groups (2013-2025)
│   ├── climate_districts_monthly_2000_2025.csv # 303,576 rows: ERA5-Land monthly temperature, extremes & rain
│   ├── greenness_districts_summer_2013_2025.csv # 12,649 rows: Landsat summer built-up green share & LST
│   ├── districts_urban_static.csv     # 973 rows: GHSL built-up area (2000-2020), elevation & built-up share
│   ├── building_permits_districts_monthly_2013_2025.csv # 151,788 rows: monthly permitted floor area (m²)
│   └── sege_districts_2022.csv        # 973 rows: socio-economic development index, ranks and tiers
│
├── models/                            # Trained artifacts for sub-15ms live inference in the web app
│   ├── final_model.ubj                # Trained XGBoost regressor (monotone cooling, LST - 0.5*Tair)
│   ├── model_card.json                # Model metadata, feature list (30 features) & configuration
│   └── bootstrap_effects.npz          # 60 bootstrap uncertainty curves (5th and 95th percentile bands)
│
└── results/                           # Local notebook summaries & parity test benchmarks (EXCLUDED from git push)
    ├── district_scorecard.csv         # Complete analytical scorecard of the 829 reliable districts
    └── what_if_curves.csv             # Pre-computed lookup curves (-20 to +30 points) for offline reference
```

---

## 1. 📥 Raw Data Directory (`data/raw/`)

The `data/raw/` directory contains original primary-source data downloaded directly from official institutions.

### Data Sources & Scope

| Resource | Source / Provider | Files | Scope & Role |
| :--- | :--- | :--- | :--- |
| **Administrative Boundaries** | UN OCHA via HDX | `turkey_districts_raw.geojson`, `turkey_provinces_raw.geojson` | 973 districts and 81 provinces vector boundaries. |
| **Central Code Table** | TÜİK MEDAS | `turkey_city_district_code_table.csv` | Primary reference: `city_code`, `city_name`, `district_code`, `district_name`. |
| **Demographics** | TÜİK MEDAS (ADNKS) | `nufus_ilce/` (18 CSV files) | 2007–2025 demographic time-series across 38 age-gender groups. |
| **Building Permits** | TÜİK MEDAS | `ilce_yapı_metrekare/` (5 CSV files) | Monthly permitted construction floor space ($m^2$). |
| **Socio-Economic Index** | Sanayi ve Teknoloji Bakanlığı | `sege/sege_scores_2022.csv` | Official SEGE-2022 socio-economic development index report. |
| **Satellite Imagery** | Google Earth Engine / USGS | `ee_green/all/` (312 CSV chunks) | Landsat 8/9 Level-2 30m NDVI and Land Surface Temperature (LST). |

### Usage & Pipeline Integration
* The files in `data/raw/` are **strictly read only by [`notebooks/preprocessing.ipynb`](../notebooks/preprocessing.ipynb)**.
* Downstream analysis notebooks (`eda.ipynb`, `modeling.ipynb`, `whatif.ipynb`, `risk.ipynb`, `explain.ipynb`) and the FastAPI backend **never access `data/raw/`**.

> [!IMPORTANT]
> **Git Exclusion Policy & Optional Raw Downloads:**
> Due to their large uncompressed size (GeoJSON polygons, raw MEDAS batches, and satellite chunk tables), files in `data/raw/` **are not tracked in git** and are excluded via `.gitignore`. 
> Raw downloads (`data/raw/`) are completely optional and excluded from git, as the full analysis, notebook workflows, and live application can run directly from `data/data_package.zip`.

---

## 2. 📦 Processed Master Datasets (`data/processed/`)

This directory is the **core data package** of the project. It provides standardized, unified, and model-ready tables covering **all 973 districts and 81 provinces of Turkey**.

> [!NOTE]
> **Pre-Packaged Distribution Archive (`data_package.zip`):**
> `data/data_package.zip` is bundled with the project. Unpacking it via:
> ```bash
> unzip data/data_package.zip -d data/
> # or using Python's standard zipfile module:
> python -m zipfile -e data/data_package.zip data/
> ```
> instantly extracts all 8 processed master datasets, 3 production model artifacts, and verification scorecards.

### Package Summary

| File | One Row Per | Row Count | Temporal Scope | Disk Size |
| :--- | :--- | ---: | :--- | ---: |
| `turkey_districts_master.geojson` | District | 973 | Static | 28.8 MB |
| `turkey_cities_master.geojson` | Province | 81 | Static | 16.6 MB |
| `tuik_districts_population_clean.csv` | District × Year | 12,636 | 2013–2025 | 3.7 MB |
| `climate_districts_monthly_2000_2025.csv` | District × Month | 303,576 | 2000–2025 | 18.1 MB |
| `greenness_districts_summer_2013_2025.csv` | District × Summer Year | 12,649 | 2013–2025 | 0.8 MB |
| `districts_urban_static.csv` | District | 973 | Static | 0.2 MB |
| `building_permits_districts_monthly_2013_2025.csv` | District × Month | 151,788 | 2013–2025 | 5.5 MB |
| `sege_districts_2022.csv` | District | 973 | 2022 (Static) | 0.04 MB |

*Total package size is ~74 MB (~20 MB compressed zip).*

---

### Key Identifiers & Join Conventions

Every table shares standard primary and secondary keys:
* **`district_code` (Integer):** Official TÜİK 4-digit district code (e.g., `1421` for Kadıköy). **Universal Primary Key**. Always join on `district_code`, never on string names (because district names like *Merkez* repeat across 51 provinces).
* **`city_code` (Integer):** Province plate code (1–81). Secondary key.
* **`district_name`, `city_name` (String):** Standardized Turkish names for display purposes.
* **`year`, `month` (Integer):** Calendar year and month (1–12).

#### Join Rules by Table Grain:
```python
import pandas as pd

climate = pd.read_csv("data/processed/climate_districts_monthly_2000_2025.csv")
green = pd.read_csv("data/processed/greenness_districts_summer_2013_2025.csv")
population = pd.read_csv("data/processed/tuik_districts_population_clean.csv")
static = pd.read_csv("data/processed/districts_urban_static.csv")
sege = pd.read_csv("data/processed/sege_districts_2022.csv")

# 1. Join climate and green on [district_code, year] (summer subset)
summer_panel = green.merge(
    climate[(climate["month"].isin([7, 8]))].groupby(["district_code", "year"])
    .agg(temp_mean_ja=("temp_mean", "mean"), hot_days_ja=("hot_days", "sum")).reset_index(),
    on=["district_code", "year"], how="left", validate="one_to_one"
)

# 2. Join static district attributes on [district_code] only (NEVER on year)
master_table = summer_panel.merge(
    static[["district_code", "elevation_m", "built_share_2020", "urban_km2"]],
    on="district_code", how="left", validate="many_to_one"
).merge(
    sege[["district_code", "sege_score", "sege_tier"]],
    on="district_code", how="left", validate="many_to_one"
)
```

---

### Detailed Column Schemas

#### 1. `turkey_districts_master.geojson` & `turkey_cities_master.geojson`
* **Source:** UN OCHA (HDX), matched 1:1 with official TÜİK codes.
* **CRS:** EPSG:4326 (WGS84).
* **Attributes:** `district_code`, `city_code`, `district_name`, `city_name`, `area_sqkm`, `center_lat`, `center_lon`, `geometry`.
* **Validation:** 100% of centroids strictly lie inside (or within 0.02° of) their own district polygon.

#### 2. `climate_districts_monthly_2000_2025.csv`
* **Source:** ECMWF ERA5-Land (0.1° resolution) & ERA5 precipitation (0.25° resolution).
* **Columns:** `year`, `month`, `district_code`, `city_code`, `district_name`, `city_name`, `temp_mean` (°C), `temp_max` (°C), `temp_min` (°C), `hot_days` (days with max $\ge 30^\circ\text{C}$), `very_hot_days` ($\ge 35^\circ\text{C}$), `tropical_nights` (min $\ge 20^\circ\text{C}$), `precip_sum` (mm).
* **Completeness:** 303,576 rows with **0 null values** across all columns.

#### 3. `greenness_districts_summer_2013_2025.csv`
* **Source:** USGS Landsat 8/9 Collection 2 Level-2 via Google Earth Engine.
* **Spatial Mask:** Extracted strictly over the built-up area footprint ($GHSL \ge 20\%$).
* **Columns:** `urban_km2`, `landsat_ndvi`, `landsat_green_share` (share of urban pixels with $NDVI \ge 0.3$), `landsat_lst_c` (mean Land Surface Temperature °C in late morning), `landsat_cover` (clear-sky observation share), `months_used`.
* **Reliability Filter:** Rows with `urban_km2 >= 0.5` and `landsat_cover >= 0.5` represent reliable urban observations (covering 829 districts across 80 provinces).

#### 4. `tuik_districts_population_clean.csv`
* **Source:** TÜİK ADNKS Settlement Populations (2013–2025).
* **Columns:** `year`, `district_code`, `city_code`, `district_name`, `city_name`, `total_pop`, `male_pop`, `female_pop`, plus 19 combined age totals (`total_0_4` to `total_90plus`) and 38 gender-specific columns.

#### 5. `districts_urban_static.csv`
* **Source:** JRC Global Human Settlement Layer (GHSL) & USGS SRTM.
* **Columns:** `district_code`, `elevation_m` (mean SRTM elevation), `built_m2_2000` through `built_m2_2020` (5-year GHSL urban footprints), `area_sqkm`, `built_share_2020`.

#### 6. `sege_districts_2022.csv`
* **Source:** Ministry of Industry and Technology SEGE-2022 Official Report.
* **Columns:** `district_code`, `sege_score` (standardized index, mean 0, std 1; higher = more developed), `sege_rank` (1–973), `sege_rank_in_city`, `sege_tier` (1–6; Tier 1 most developed, Tier 6 least developed), `sege_year` (2022).

#### 7. `building_permits_districts_monthly_2013_2025.csv`
* **Source:** TÜİK MEDAS Yapı İzin İstatistikleri.
* **Columns:** `year`, `month`, `district_code`, `permit_area_total_m2` (total floor construction area licensed in $m^2$). Analyzed in EDA; omitted from final model features due to lack of predictive gain.

---

## 3. 🤖 Model Artifacts (`data/models/`)

This directory houses the trained machine learning artifacts used by the **FastAPI backend for sub-15ms live inference**.

```
data/models/
├── final_model.ubj        # Trained XGBoost binary model (15.6 MB)
├── model_card.json        # Model identity card & hyperparameter specification (3 KB)
└── bootstrap_effects.npz  # 60 bootstrap uncertainty curves (7.6 MB)
```

### Artifact Specifications

1. [**`final_model.ubj`**](models/final_model.ubj):
   * Selected through an exhaustive 150-trial Optuna search across 7 competing algorithms.
   * Model Formulation: Learns built-up Land Surface Temperature minus half of air temperature ($LST - 0.5 \times T_{\text{air}}$), adding $0.5 \times T_{\text{air}}$ back during prediction.
   * Monotonic Constraint: Enforces that increasing green share can never increase surface temperature ($\frac{\partial LST}{\partial \text{green}} \le 0$).
   * Performance: Test RMSE $1.28^\circ\text{C}$, within-city $R^2 = 0.726$, city-level $R^2 = 0.912$.
2. [**`model_card.json`**](models/model_card.json):
   * Documents the 30 input features, target variable, training bounds, and runtime settings.
3. [**`bootstrap_effects.npz`**](models/bootstrap_effects.npz):
   * Contains 60 bootstrap resample curves for each district across green changes from -20 to +30 points.
   * Supplies the 5th and 95th percentile confidence intervals displayed in the frontend scenario charts.

---

## 4. 📊 Results Directory (`data/results/`)

The `data/results/` directory stores offline analytical summaries and regression test benchmarks.

```
data/results/
├── district_scorecard.csv  # 829 districts complete summary scorecard (201 KB)
└── what_if_curves.csv      # Offline lookup curves for static reference (558 KB)
```

### Operational Role & Exclusion Policy

* **Live Web App Independence:** 
  The production FastAPI backend and React frontend **do not read `data/results/`**. All what-if cooling predictions, temperature deltas, and priority ranks are computed **live in RAM** using `final_model.ubj`.
* **Testing & Golden Master Validation:** 
  `district_scorecard.csv` serves as the golden-master benchmark for the automated test suite ([`backend/tests/parity.py`](../backend/tests/parity.py)). The test validates that live backend calculations match notebook analytical outputs to the last decimal place.
* **Git Push Exclusion:** 
  `data/results/` is reserved for local development and verification. It will **not be pushed to remote git repositories** in the final deployment package.

---

## 🚀 Quick Verification

To verify that all required processed tables and model artifacts load correctly and pass the parity checks:

```bash
# Run parity validation from the project root
python -m backend.tests.parity
```
*Expected result: `all checks passed (startup 2 s, model XGBoost on the surface temperature minus half of the air temperature)`.*

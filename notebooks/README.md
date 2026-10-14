# Notebooks Directory Documentation (`notebooks/README.md`)

This directory houses the complete analytical, empirical, and machine learning pipeline for the **AI-Driven Urban Green Planner** project. 

The notebooks are designed as **self-contained research and engineering modules**: they explore the empirical data, conduct hyperparameter searches, train the production model, evaluate what-if scenarios, and export all verified artifacts required by the live web application.

---

## 🧭 Pipeline Architecture & Execution Flow

The analysis follows a strict, sequential pipeline. Each notebook builds directly upon the validated outputs of the preceding stages:

```
[1. preprocessing.ipynb]
   └── Ingests raw data (UN OCHA, TÜİK, ERA5, Landsat GEE, SEGE) → Exports data/processed/
         │
[2. eda.ipynb]
   └── Empirical exploration, 829-district reliability filtering & spatial variance decomposition
         │
[3. modeling.ipynb]
   └── 150-Trial Optuna search (7 algorithms) → Trains & pins data/models/final_model.ubj
         │
         ├───► [4. whatif.ipynb]
         │        └── What-if counterfactual engine, city-cluster bootstrap & target green solver
         │              │
         │        [5. risk.ipynb]
         │              └── 3-Component Risk Scorecard, Dirichlet sensitivity & priority ranking
         │
         └───► [6. explain.ipynb] (Supplementary / Post-Modeling)
                  └── TreeSHAP interpretability & systematic feature ablation
```

---

## 📋 Master Pipeline Matrix

| Order | Notebook | Core Objective | Primary Inputs | Key Outputs | Approx. Run Time |
| :---: | :--- | :--- | :--- | :--- | :---: |
| **1** | [`preprocessing.ipynb`](preprocessing.ipynb) | Raw data ETL, ID harmonization & master dataset construction | `../data/raw/*` | `../data/processed/*` | ~10 min *(cached)* |
| **2** | [`eda.ipynb`](eda.ipynb) | Exploratory analysis, reliability filtering & spatial variance | `../data/processed/*` | Empirical insights & maps | ~3 min |
| **3** | [`modeling.ipynb`](modeling.ipynb) | Model benchmarking, Optuna tuning & production model training | `../data/processed/*` | `../data/models/final_model.ubj`, `model_card.json` | ~30 min *(N=30)* |
| **4** | [`whatif.ipynb`](whatif.ipynb) | Counterfactual green simulation & bootstrap uncertainty | `../data/processed/*`, `final_model.ubj` | `../data/models/bootstrap_effects.npz`, `../data/results/` | ~5 min |
| **5** | [`risk.ipynb`](risk.ipynb) | Heat risk index, Dirichlet sensitivity & priority scorecard | `../data/processed/*`, `district_scorecard.csv` | `../data/results/district_scorecard.csv` | ~2 min |
| **6** | [`explain.ipynb`](explain.ipynb) | Model interpretability (TreeSHAP) & feature ablation study | `../data/processed/*`, `final_model.ubj` | SHAP plots & `ablation.csv` | ~15 min *(first run)* |

---

## 🔬 Detailed Step-by-Step Breakdown

### 1. [`preprocessing.ipynb`](preprocessing.ipynb) — Data Engineering & Harmonization
* **Purpose:** Serves as the extract, transform, and load (ETL) pipeline. It reads raw primary sources and compiles them into clean, standardized master datasets.
* **Key Tasks:**
  1. **Central Reference Table:** Constructs `turkey_city_district_code_table.csv` by matching TÜİK MEDAS settlement tables, providing a verified 1:1 mapping for all 973 districts and 81 provinces.
  2. **Spatial Boundaries & Centroids:** Ingests UN OCHA GeoJSON shapes, validates spatial centroids (100% point-in-polygon verification), and exports `turkey_districts_master.geojson` and `turkey_cities_master.geojson`.
  3. **Demographics:** Ingests 18 TÜİK MEDAS batch files, forward-fills observation years, cleans 38 age-gender columns into standardized attributes, and exports `tuik_districts_population_clean.csv`.
  4. **Climate Aggregation:** Aggregates hourly ERA5-Land temperature and ERA5 rain into monthly metrics (`temp_mean`, `temp_max`, `temp_min`, `hot_days`, `precip_sum`), exporting `climate_districts_monthly_2000_2025.csv`.
  5. **Satellite Greenness & LST:** Processes Google Earth Engine Landsat 8/9 Level-2 30m summer composites over built-up urban footprints, exporting `greenness_districts_summer_2013_2025.csv` and `districts_urban_static.csv`.
* **Prerequisites:** Requires `earthengine-api` and AWS S3 open data access only if rebuilding from scratch. By default, `DOWNLOAD = False`, allowing instant execution from existing raw caches.

---

### 2. [`eda.ipynb`](eda.ipynb) — Exploratory Data Analysis & Spatial Dynamics
* **Purpose:** Investigates the spatial, temporal, and demographic structure of the district data before model design.
* **Empirical Discoveries:**
  * **The 829-District Reliability Filter:** Districts with built-up area $\text{urban\_km2} \ge 0.5$ and satellite clear-sky cover $\ge 0.50$ provide consistent physical signals (**829 reliable districts** across 80 provinces; 144 rural/small districts excluded).
  * **Within-City Variation vs. Raw Geography:** Proves that raw numbers can be misleading due to macro-geography (e.g., latitude and elevation show inverted raw correlations across Turkey). De-meaning features against their city-year mean (`..._vs_city`) isolates the true local relationship between green space and surface temperature (correlation -0.43).
  * **Variance Decomposition:** Demonstrates that summer surface temperature is 65% geography (between cities), 17% local district differences, and 18% inter-annual weather. Green space varies primarily between districts (59%), not over time.
  * **Validation Split Integrity:** Confirms that a 2013–2022 train vs. 2023–2025 test temporal split is balanced and free of data leakage (adversarial AUC 0.71–0.73 without weather).

---

### 3. [`modeling.ipynb`](modeling.ipynb) — Model Benchmarking, Tuning & Production Training
* **Purpose:** Benchmarks competing machine learning architectures, performs hyperparameter searches, and exports the final model artifact.
* **Methodology:**
  * **Two-Front Evaluation Protocol:** Models are evaluated across two strict generalization challenges:
    1. *New Cities Test:* 5-fold cross-validation holding out entire provinces (spatial generalization).
    2. *Next Summers Test:* Temporal walk-forward validation predicting the subsequent summer (temporal generalization).
    *Joint Score* is defined as the arithmetic mean of both tests.
  * **Algorithm Benchmarking:** Compares 7 architectures (XGBoost, LightGBM, CatBoost, HistGradientBoosting, RandomForest, ExtraTrees, Ridge) under identical Optuna hyperparameter searches.
  * **Winning Architecture:** **XGBoost** wins with fresh-seed joint score **1.356** (outperforming LightGBM 1.350, HistGB 1.340, ExtraTrees 1.321).
  * **Target Transformation:** Discovers that predicting Land Surface Temperature minus half of air temperature ($LST - 0.5 \times T_{\text{air}}$) and enforcing monotonic cooling ($\frac{\partial LST}{\partial \text{green}} \le 0$) significantly improves generalization.
  * **Final Exam (2023–2025 Holdout):** Achieves RMSE **$1.28^\circ\text{C}$**, within-city $R^2 = 0.726$, and city-level $R^2 = 0.912$.
* **Production Model Pinning:** The production model configuration is pinned (`PRODUCTION_PARAMS`) to guarantee that `final_model.ubj` (hash `652321e2...`) remains bit-identical across runs.

---

### 4. [`whatif.ipynb`](whatif.ipynb) — Counterfactual Scenario Engine & Uncertainty
* **Purpose:** Evaluates the cooling impact of altering district green space, quantifies bootstrap uncertainty, and calculates green investment needed to reach cooling goals.
* **Methodology:**
  * **Base District State:** Builds one representative baseline row per district (latest reliable summer under a typical 5-year weather normal).
  * **Counterfactual Prediction:** Simulates changing green share for one district at a time (from -20 to +30 percentage points), updating both raw share and the `..._vs_city` feature.
  * **Key Findings:**
    * +10 percentage points of green share lowers built-up surface temperature by **$-0.63^\circ\text{C}$ on average**.
    * Real observed changes between 2013-2015 and 2023-2025 show **$-0.48^\circ\text{C}$** per +10 points (published ratio: 0.76, displayed as a cautious reading in the app).
  * **City-Cluster Bootstrap Uncertainty:** 60 province-level bootstrap resamples yield 5th and 95th percentile confidence intervals for every district (exported to `data/models/bootstrap_effects.npz`).
  * **Sufficient-Step Target Solver:** A cooling of $-1.0^\circ\text{C}$ is achievable for **94.7% of districts** (785 of 829); the median district requires ~17 points (~64 hectares).
  * **Observational Diagnostics:** Evaluates 4 pre-specified historical periods with weather/coverage controls and district/city-year fixed effects, framing the results as observed empirical associations rather than causal guarantees.

---

### 5. [`risk.ipynb`](risk.ipynb) — Multi-Criteria Heat Risk & Priority Scorecard
* **Purpose:** Integrates physical climate hazard, demographic exposure, and socio-economic vulnerability into an actionable decision-support scorecard.
* **Methodology:**
  * **Three Standardized Components (Percentile Ranks 0–100, higher = worse):**
    1. *Hazard (Tehlike):* Recent summer Land Surface Temperature (LST).
    2. *Exposure (Maruziyet):* Count of vulnerable residents (children 0–4 + seniors 65+).
    3. *Vulnerability (Hassasiyet):* Inverted SEGE-2022 score (socio-economic disadvantage).
  * **Risk Score:** Arithmetic mean of the three components.
  * **Dirichlet Sensitivity Analysis:** 500 Dirichlet random weight sets evaluate rank stability, supplying a 5th–95th percentile rank range for every district.
  * **Intervention Priority:** Ranked by vulnerable population protected per hectare of green needed for $-1^\circ\text{C}$ cooling ($\text{vulnerable\_people} / \text{hectares}_{1^\circ\text{C}}$), conditional on reachability.
* **Output:** Generates and exports the complete [`data/results/district_scorecard.csv`](../data/results/district_scorecard.csv) (829 districts × 45 analytical columns).

---

### 6. [`explain.ipynb`](explain.ipynb) — Model Interpretability & Feature Ablation
* **Purpose:** Supplementary post-modeling analysis providing scientific explainability for the final XGBoost model.
* **Methodology:**
  * **TreeSHAP:** Explains which features drive predictions across all reliable districts. Visualizes main effects, feature interactions, and the non-linear cooling curve of green share.
  * **Feature Ablation:** Systematically removes feature groups (weather, population, elevation, within-city comparisons, green share) to measure test score degradation. Demonstrates that within-city comparison features and summer weather are the most critical predictors.

---

## 🔗 Connection to the Live Web Application (`backend/`)

The web application does **not** execute Jupyter notebooks at runtime:
1. **Model Loading:** The FastAPI backend directly loads the verified artifacts exported by Notebooks 3 and 4:
   * `../data/models/final_model.ubj` (XGBoost binary model for live inference)
   * `../data/models/model_card.json` (feature schemas and air-temperature transformation parameters)
   * `../data/models/bootstrap_effects.npz` (pre-computed confidence interval bands)
2. **Dynamic In-Memory Computation:** When a user requests a green space addition in the frontend, the backend runs live inference in under 15 milliseconds.
3. **Automated Parity Verification:** Run the test suite to ensure the live backend math matches the notebook outputs to the last decimal place:
   ```bash
   python -m backend.tests.parity
   ```
   *Expected outcome: `all checks passed (startup 2 s, model XGBoost on the surface temperature minus half of the air temperature)`.*

---

## 🛠️ Execution & Environment Guidelines

* **Conda Environment:** Run all notebooks in the project conda environment (`environment.yml`):
  ```bash
  conda env create -f environment.yml
  conda activate urban-green-planner
  ```
* **Clean Outputs Policy:** Notebooks in git are committed **without cell outputs** to keep diffs clean and maintain repository hygiene. All generated artifacts and tables are written to `data/models/` and `data/results/`.

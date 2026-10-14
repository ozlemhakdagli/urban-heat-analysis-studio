# Notebooks

The notebooks are **self-contained**: they hold the whole analysis and write everything the application needs. Preprocessing and EDA remain the original data preparation and exploration; rerun `preprocessing.ipynb` only to rebuild the processed tables from the raw downloads (it needs `earthengine-api`, see `environment.yml`) — it is not needed to use the project.

| Order | Notebook | Purpose |
| :---: | :--- | :--- |
| 1 | [`preprocessing.ipynb`](preprocessing.ipynb) | Harmonize TÜİK population, boundaries, ERA5 weather, Landsat greenness/surface temperature, and SEGE inputs into `data/processed/` |
| 2 | [`eda.ipynb`](eda.ipynb) | Inspect reliability, within-city variation, and validation splits |
| 3 | [`modeling.ipynb`](modeling.ipynb) | The deep search (6 algorithms + a linear baseline, `N_TRIALS` trials each), the choice, the improvements, the exam and the final model — writes `final_model.ubj`, `model_card.json` and `exam_predictions.csv` |
| 4 | [`whatif.ipynb`](whatif.ipynb) | The what-if engine, the city-cluster bootstrap, the real-change checks, the support checks and the heat targets — writes `bootstrap_effects.npz`, the first part of `district_scorecard.csv`, `what_if_curves.csv`, `observational_validation.json` and `historical_changes.csv` |
| 5 | [`risk.ipynb`](risk.ipynb) | Risk components, weight sensitivity, and priority with its uncertainty — completes `district_scorecard.csv` |
| Optional | [`explain.ipynb`](explain.ipynb) | TreeSHAP and feature-group ablations of the final model (`ablation.csv`); run it after `modeling.ipynb` |

**Run time.** The search in `modeling.ipynb` is the long part: with the default `N_TRIALS = 30` it takes about 25-35 minutes on 16 CPU cores, and the fresh-seed tests of Part 4 about 15 minutes more; the trials are cached in `data/models/search/`, so a second run only reads them. `whatif.ipynb` takes a few minutes (the city-cluster bootstrap is its long part), `risk.ipynb` seconds, and the first `explain.ipynb` run about 15 minutes (its ablation is cached in `ablation.csv`).

**The production model is pinned.** The settings of the saved model are fixed in `modeling.ipynb` to the configuration the first full search selected, so the file the application serves does not change when the lighter search picks slightly different trials.

## Interpretation

The baseline uses each district's latest reliable summer and typical recent weather. Temperature is **built-up land surface temperature**, not air temperature. Green share is changed for one district at a time, updating both raw share and within-city relative share. Physical and scenario clipping is reported separately from weak support among comparable observations.

The target solver returns the first sufficient applied grid amount at one percentage-point resolution, including fractional physical caps. Every bootstrap curve is solved separately. Unreachable draws remain in target-reachability and top-20 frequencies; priority rank bounds are conditional on reaching the target. Priority is vulnerable population divided by required hectares, not people proven to benefit. Risk-rank bounds describe sampled weight sets, not guaranteed ranks under every weighting.

Historical early/late changes are kept as an **observed association**, separate from scenario predictions: the what-if notebook compares four prespecified periods, adds weather/coverage controls and a district/city-year panel view, and writes the reference into the model card. The association does not bound the true effect of planting and is not a multiplier for district effects or green requirements.

## Production

The app loads `data/models/final_model.ubj`, `model_card.json` and `bootstrap_effects.npz` and rebuilds the features from `data/processed`; it does not execute notebooks at request time, does not train and does not read the result files. `python -m backend.tests.parity` checks the live service against the files the notebooks wrote. The committed notebooks are saved **without their outputs** (the repository strips them on the way in); everything a run produces lives under `data/`.

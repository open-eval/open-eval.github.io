# Rasch item difficulty

Run `python scripts/compute-landscape.py`, then `npm run build`. Requires PyArrow, NumPy, SciPy and the pinned corrected Parquet cache used by the ability pipeline.

Refits the same binary Rasch MAP model as Model Performance and verifies that model estimates exactly match the saved ability results. Uses fitted item difficulty parameters b from P(success)=sigmoid(theta-b), not observed item means. Higher b means harder. The coverage, deduplication, direction reversal, priors and connected-component rules are unchanged.

Each metric stores a 20-bin histogram, its axis limits, median item difficulty (logits), fitted item/model counts and archived item count. Histograms use separate horizontal and vertical scales. These are independent benchmark/metric fits; absolute item difficulty values are not a common cross-benchmark scale. Source summary hashes and the method identifier are checked during the build.

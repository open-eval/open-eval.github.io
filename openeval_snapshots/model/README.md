# Corrected-data latent ability

Generated with `python scripts/compute-ability.py` (PyArrow, NumPy, SciPy). Pass benchmark slugs to compute a subset; `--force` recomputes. Files are embedded by `npm run build` and work with `file://`.

Each file records its raw-summary checksum and exact source file hashes. Inputs must reproduce each retained raw model's score count and mean before fitting. No reference website estimates are used.

Only direction-defined metrics whose retained observations are strictly 0 or 1 are fitted. Fractional, categorical, unbounded and unresolved-direction metrics are not converted to binary outcomes. Known lower-is-better binary scores are reversed before fitting; raw scores remain unchanged.

Model: P(y=1) = sigmoid(theta - difficulty). Independent normal priors have SD 2 for theta and SD 3 for difficulty. Joint MAP is fitted by L-BFGS with an analytic gradient. Uncertainty is the joint Laplace marginal posterior SD for theta, using the item-difficulty Schur complement of the Hessian. The UI shows theta ± one SD, not a 95% interval.

The same score-independent model-item deduplication and raw coverage eligibility apply. Iteratively require at least max(20, ceil(10% of archived items)) responses per model and at least 3 models per item. Fit the largest connected component and require at least three models, two items and both outcomes. Priors retain models/items with extreme outcomes. UI counts and coverage use the actual fitted set.

These are within-benchmark, within-metric estimates. They assume a single latent dimension and conditional independence; correlated model families and multidimensional tasks can violate these assumptions. Posterior uncertainty is approximate and model-dependent. The scale cannot be compared across benchmark/metric fits; latent estimates do not establish validity by themselves.

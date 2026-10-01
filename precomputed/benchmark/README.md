# Benchmark statistics

`advbench.json` is computed from the complete HF item and response Parquet splits, not the browser preview. It contains per-metric summaries, retained model means and item counts, provenance, checksums, and calculation rules.

Recompute from `website/` with Python and PyArrow installed:

```sh
python3 scripts/compute-benchmark.py advbench
```

The script pins a converted-Parquet revision, downloads all files for the requested split into a temporary directory, validates item links, and atomically replaces the summary only after computation succeeds. The observed main revision is recorded separately from the actual converted-data revision. Downloaded Parquet files are not kept in the website.

Rules: retain one response per model name and item ID using the lexicographically smallest response ID (identical IDs keep the first row in sorted Parquet file/row order; conflicting scores are counted in the summary); require finite scores on at least 10% of distinct benchmark items for each metric; compute each model's mean over available items; summarize those model means with equal weight. SE uses sample standard deviation divided by the square root of the retained model count. Different models may cover different item sets.

Summaries are generated for all available benchmark splits. The build embeds saved summaries in benchmark.js so they also work when HTML is opened via file://. Run `npm run build` after recomputing the JSON; item browsing remains live. Benchmarks without a saved summary use the live preview loader.

Test the computation:

```sh
python3 -m unittest discover -s tests -p 'test_benchmark_statistics.py'
```

To compute all missing benchmark summaries (resumable):

```sh
python3 scripts/compute-all-benchmarks.py
npm run build
```

The batch skips existing JSON files; run `compute-benchmark.py NAME` explicitly to refresh an existing benchmark. Each summary records its own exact Parquet revision.

Entropy (`monte_carlo_entropy`), log-probability (`logprob`), and Self-BLEU (`self_bleu`) remain in score summaries, but the browser shows “This metric does not establish benchmark validity.” instead of diagnostic tiles for these metrics.

Scores of -1 in `safety_llama_score` and `*_correctness` are missing values, excluded per metric after deduplication and before coverage filtering and aggregation. Other metric scores on the same response remain eligible.

`do-not-answer_annotation` reports pooled label counts across retained model–item pairs; percentages use the retained annotation count, not equal model weighting. Labels are shown verbatim (including -1); no unverified category mapping is applied. Aggregate numerical statistics are null.

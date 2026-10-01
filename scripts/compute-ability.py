#!/usr/bin/env python3
"""Fit binary Rasch MAP estimates from the exact corrected summary source files.
Requires pyarrow, numpy and scipy. Outputs are resumable, one per benchmark.
"""
import argparse
import hashlib
import importlib.util
import json
import math
from pathlib import Path
from datetime import datetime, timezone
import numpy as np
import pyarrow.parquet as pq
from scipy.optimize import minimize
from scipy.special import expit
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('summary', ROOT / 'scripts/compute-benchmark.py')
summary = importlib.util.module_from_spec(spec)
spec.loader.exec_module(summary)
VERSION = 1


def fit(entries, minimum):
    """No thresholding of fractional scores. Normal priors stabilize extreme rows."""
    if any(value not in (0, 1) for _, _, value in entries):
        raise ValueError('Rasch fitting requires binary outcomes')
    models = sorted({m for m, _, _ in entries})
    items = sorted({i for _, i, _ in entries})
    mi, ii = {m: k for k, m in enumerate(models)}, {i: k for k, i in enumerate(items)}
    a = np.array([mi[m] for m, _, _ in entries], dtype=np.int32)
    b = np.array([ii[i] for _, i, _ in entries], dtype=np.int32)
    y = np.array([v for _, _, v in entries], dtype=float)
    # Prune sparse rows/columns to a stable set, then retain its largest connected component.
    while len(y):
        keep = (np.bincount(a, minlength=len(models))[a] >= minimum) & (np.bincount(b, minlength=len(items))[b] >= 3)
        if keep.all():
            break
        a, b, y = a[keep], b[keep], y[keep]
    if not len(y):
        return {'available': False, 'reason': 'Insufficient overlapping binary responses after coverage filtering.'}
    graph = coo_matrix((np.ones(len(y)), (a, b + len(models))), shape=(len(models) + len(items),) * 2).tocsr()
    _, labels = connected_components(graph, directed=False)
    components, counts = np.unique(labels[a], return_counts=True)
    keep = labels[a] == components[np.argmax(counts)]
    a, b, y = a[keep], b[keep], y[keep]
    am, bi = np.unique(a), np.unique(b)
    names = [models[k] for k in am]
    a, b = np.searchsorted(am, a), np.searchsorted(bi, b)
    M, I = len(am), len(bi)
    if M < 3 or I < 2 or len(np.unique(y)) < 2:
        return {'available': False, 'reason': 'Too little connected response variation for an ability estimate.'}
    # P(success)=sigmoid(theta - difficulty), theta~N(0,2²), difficulty~N(0,3²).
    def objective(z):
        t = z[a] - z[M + b]
        residual = expit(t) - y
        value = np.sum(np.logaddexp(0, t) - y * t) + np.sum(z[:M] ** 2) / 8 + np.sum(z[M:] ** 2) / 18
        grad = np.r_[np.bincount(a, residual, minlength=M) + z[:M] / 4,
                     -np.bincount(b, residual, minlength=I) + z[M:] / 9]
        return value, grad
    result = minimize(objective, np.zeros(M + I), jac=True, method='L-BFGS-B', options={'maxiter': 1500, 'ftol': 1e-11, 'gtol': 1e-5})
    if not result.success:
        raise RuntimeError('Rasch optimizer did not converge: ' + str(result.message))
    theta = result.x[:M]
    p = expit(theta[a] - result.x[M + b])
    # Schur complement includes uncertainty in fitted item difficulties (Laplace approximation).
    w = p * (1 - p)
    diag_t = np.bincount(a, w, minlength=M) + .25
    diag_b = np.bincount(b, w, minlength=I) + 1 / 9
    cross = coo_matrix((w, (a, b)), shape=(M, I)).tocsr()
    precision = np.diag(diag_t) - (cross.multiply(1 / diag_b) @ cross.T).toarray()
    sd = np.sqrt(np.diag(np.linalg.inv(precision)))
    ns = np.bincount(a, minlength=M)
    difficulties = result.x[M:]
    histogram, edges = np.histogram(difficulties, bins=20)
    return {'available': True, 'itemCount': I, 'modelCount': M, 'pairCount': len(y),
            'iterations': int(result.nit), 'converged': True,
            'itemDifficulty': {'bins': histogram.tolist(), 'min': float(edges[0]), 'max': float(edges[-1]), 'median': float(np.median(difficulties))},
            'models': sorted([{'name': name, 'theta': round(float(theta[k]), 6), 'sd': round(float(sd[k]), 6), 'n': int(ns[k])} for k, name in enumerate(names)], key=lambda m: (-m['theta'], m['name']))}


def direction(slug, metric):
    if (slug == 'or_bench' and metric == 'orbench-refusal') or metric in ('logprob', 'do-not-answer_annotation'):
        return None
    if metric in ('attack_success', 'ft-mistral-7b-sorrybench') or (slug == 'health_orsc_bench' and metric == 'refusal-strings'):
        return 'lower'
    if metric.endswith(('exact_match', 'correctness', 'accuracy', '_acc')) or metric in ('refusal-strings', 'safety_gpt_score', 'safety_llama_score', 'haiku-llm-judge', 'longformer-action-ro'):
        return 'higher'
    return None


def load_pairs(source, candidates, cache):
    slug = source["benchmark"]
    files = []
    for f in source['source']['files']:
        target = cache / (f['sha256'] + '.parquet')
        if not target.exists() or summary.file_hash(target) != f['sha256']:
            print('Downloading ' + slug + ' ' + f['config'], flush=True)
            summary.fetch(f['url'], target)
        if summary.file_hash(target) != f['sha256']:
            raise ValueError('Source checksum mismatch: ' + f['url'])
        files.append((f['config'], target))
    items = set()
    for config, target in files:
        if config == 'item':
            items.update(pq.read_table(target, columns=['item_id']).column(0).to_pylist())
    candidate_names = {m['metrics'][0] for m in candidates}
    pairs = {}
    for config, target in files:
        if config != 'response':
            continue
        for batch in pq.ParquetFile(target).iter_batches(batch_size=5000, columns=['response_id', 'model.name', 'scores']):
            for row in batch.to_pylist():
                rid = row['response_id']
                name = row.get('name') or row.get('model', {}).get('name')
                item = rid
                while item not in items and '_' in item:
                    item = item.rsplit('_', 1)[0]
                if item not in items:
                    raise ValueError('Unresolved item: ' + rid)
                key = (name, item)
                if key in pairs and rid >= pairs[key][0]:
                    continue
                scores = row.get('scores') or {}
                values = scores.get('value') or []
                parsed = {}
                for idx, met in enumerate(scores.get('metric') or []):
                    metric = met.get('name')
                    value = values[idx] if idx < len(values) else None
                    if metric in candidate_names and isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
                        if value == -1 and (metric == 'safety_llama_score' or metric.endswith('_correctness')):
                            continue
                        parsed[metric] = value
                pairs[key] = (rid, parsed)
    return items, pairs


def compute(path, cache):
    source = json.loads(path.read_text())
    slug = source['benchmark']
    results = {}
    candidates = []
    for m in source['measurements']:
        metric = m['metrics'][0]
        if direction(slug, metric) is None:
            results[metric] = {'available': False, 'reason': 'This metric does not support the binary, direction-defined ability model.'}
        else:
            candidates.append(m)
    if candidates:
        items, pairs = load_pairs(source, candidates, cache)
        for m in candidates:
            metric = m['metrics'][0]
            eligible = {v['name']: v for v in m['models']}
            entries = [(name, item, values[metric]) for (name, item), (_, values) in pairs.items() if name in eligible and metric in values]
            # Verify exact agreement with the corrected raw summaries before any ability-only filtering.
            grouped = {}
            for name, _, value in entries:
                grouped.setdefault(name, []).append(value)
            for name, raw in eligible.items():
                values = grouped.get(name, [])
                if len(values) != raw['n'] or not math.isclose(sum(values) / max(1, len(values)), raw['mean'], abs_tol=1e-8):
                    raise ValueError('Summary mismatch: ' + slug + '/' + metric + '/' + name)
            if any(value not in (0, 1) for _, _, value in entries):
                results[metric] = {'available': False, 'reason': 'Scores are not strictly binary; no thresholding is applied.'}
                continue
            lower = direction(slug, metric) == 'lower'
            print('Fitting ' + slug + '/' + metric + ': ' + str(len(entries)) + ' pairs', flush=True)
            result = fit([(name, item, 1 - value if lower else value) for name, item, value in entries], max(20, math.ceil(len(items) * .1)))
            result['reverseCoded'] = lower
            results[metric] = result
    return {'schemaVersion': VERSION, 'benchmark': slug, 'computedAt': datetime.now(timezone.utc).isoformat(),
            'summarySha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'source': source['source'],
            'method': 'Binary Rasch 1PL MAP; theta prior SD=2, item difficulty prior SD=3',
            'uncertainty': 'Joint Laplace posterior SD, including item-difficulty uncertainty via the Schur complement; displayed as theta ± 1 SD',
            'rules': 'Same pinned data and score-independent model-item deduplication as raw summaries. Keep raw-eligible models; require max(20, ceil(10% archived items)) responses per model and 3 models per item iteratively. Fit largest connected component. No fractional-score binarization. Higher theta means more of the direction-defined outcome.',
            'limitations': 'Within-benchmark and within-metric scale only. Assumes one latent dimension and conditionally independent responses; model families may violate independence. Approximate model-based uncertainty, not a guarantee of validity.',
            'metrics': results}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('benchmarks', nargs='*')
    parser.add_argument('--cache', type=Path, default=Path('/tmp/openeval-ability-parquet'))
    parser.add_argument('--force', action='store_true')
    args = parser.parse_args()
    args.cache.mkdir(parents=True, exist_ok=True)
    out = ROOT / 'precomputed/model'
    out.mkdir(exist_ok=True)
    for path in sorted((ROOT / 'precomputed/benchmark').glob('*.json')):
        if args.benchmarks and path.stem not in args.benchmarks:
            continue
        target = out / path.name
        if target.exists() and not args.force:
            old = json.loads(target.read_text())
            if old.get('schemaVersion') == VERSION and old.get('summarySha256') == hashlib.sha256(path.read_bytes()).hexdigest():
                print('Current: ' + path.stem, flush=True)
                continue
        result = compute(path, args.cache)
        temporary = target.with_suffix('.json.tmp')
        temporary.write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
        temporary.replace(target)
        print('Saved ' + str(target), flush=True)

if __name__ == '__main__':
    main()

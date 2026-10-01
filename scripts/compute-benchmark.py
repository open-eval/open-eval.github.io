#!/usr/bin/env python3
"""Compute full-data benchmark summaries. Requires pyarrow; no HF credentials needed."""
from collections import Counter
import argparse
import hashlib
import json
import math
from pathlib import Path
import statistics
import subprocess
import tempfile
from datetime import datetime, timezone
from urllib.parse import quote

DATASET = 'Open-Eval-Commons/OpenEval'


def fetch(url, path):
    subprocess.run(['curl', '--fail', '--location', '--silent', '--show-error',
                    '--retry', '4', '--retry-all-errors', '--max-time', '300',
                    url, '-o', str(path)], check=True)


def file_hash(path):
    digest = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def json_fetch(url, directory, name):
    path = directory / name
    fetch(url, path)
    return json.loads(path.read_text())


def calculate(item_rows, response_rows):
    items = {}
    for row in item_rows:
        key = row['item_id']
        has_refs = bool(row.get('references', row.get('item_content', {}).get('references')))
        if key in items and items[key] != has_refs:
            raise ValueError('Conflicting duplicate item: ' + key)
        items[key] = has_refs
    if not items:
        raise ValueError('No benchmark items')
    pairs, metrics = {}, set()
    total = 0
    conflicting_duplicates = 0
    conflict_examples = []
    for row in response_rows:
        total += 1
        rid = row['response_id']
        model = row.get('name') or row.get('model', {}).get('name')
        if not model:
            raise ValueError('Response has no model name: ' + rid)
        item = row.get('item_id')
        if not item:
            prefix = rid
            while '_' in prefix:
                prefix = prefix.rsplit('_', 1)[0]
                if prefix in items:
                    item = prefix
                    break
        if item not in items:
            raise ValueError('Unresolved item link: ' + rid)
        scores = row.get('scores') or {}
        values = scores.get('value') or []
        parsed = {}
        for index, metric in enumerate(scores.get('metric') or []):
            name = metric.get('name')
            if not name:
                continue
            metrics.add(name)
            value = values[index] if index < len(values) else None
            if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
                parsed[name] = value
        # Score-independent selection, matching the browser's documented rule.
        key = (model, item)
        candidate = (rid, parsed)
        if key in pairs and rid == pairs[key][0] and parsed != pairs[key][1]:
            conflicting_duplicates += 1
            if len(conflict_examples) < 10:
                conflict_examples.append(rid)
            # Stable source order resolves identical IDs; never prefer a higher score.
            continue
        if key not in pairs or rid < pairs[key][0]:
            pairs[key] = candidate
    minimum = math.ceil(len(items) * .1)
    summaries = []
    for metric in sorted(metrics or {"Unspecified"}):
        by_model = {}
        for (model, item), (_, scores) in pairs.items():
            if metric in scores and not (scores[metric] == -1 and (metric == "safety_llama_score" or metric.endswith("_correctness"))):
                by_model.setdefault(model, []).append(scores[metric])
        models = sorted([
            {'name': model, 'n': len(values), 'coverage': len(values) / len(items),
             'mean': statistics.mean(values)}
            for model, values in by_model.items() if len(values) >= minimum
        ], key=lambda model: (-model['mean'], model['name']))
        if not models:
            continue
        means = [model['mean'] for model in models]
        retained = [value for model in models for value in by_model[model['name']]]
        summaries.append({
            'metrics': [metric], 'itemCount': len(items), 'totalResponses': total,
            'loadedResponses': total, 'minimumItems': minimum,
            'modelCount': len(models), 'scoredResponses': len(retained),
            'excludedModelCount': len({model for model, _ in pairs}) - len(models),
            'avgScore': statistics.mean(means) if means else None,
            'medianScore': statistics.median(means) if means else None,
            'standardError': statistics.stdev(means) / math.sqrt(len(means)) if len(means) > 1 else None,
            'discrimination': statistics.pstdev(means) if means else None,
            'refCoverage': sum(items.values()) / len(items),
            'bounded': all(0 <= value <= 1 for value in retained),
            'binary': all(value in (0, 1) for value in retained),
            'best': models[0] if models else None, 'worst': models[-1] if models else None,
            'models': models,
        })
        if metric == 'do-not-answer_annotation':
            summaries[-1]['labelFrequencies'] = [
                {'label': str(int(label)) if label == int(label) else str(label), 'count': count}
                for label, count in sorted(Counter(retained).items())]
            for key in ['avgScore', 'medianScore', 'standardError', 'discrimination', 'best', 'worst']:
                summaries[-1][key] = None
    return {'itemCount': len(items), 'responseCount': total, 'distinctModelCount': len({m for m, _ in pairs}),
            'distinctModelItemPairs': len(pairs), 'duplicateResponsesRemoved': total - len(pairs),
            'conflictingDuplicateRows': conflicting_duplicates, 'conflictingDuplicateExamples': conflict_examples,
            'measurements': summaries}


def main():
    import pyarrow.parquet as pq
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('benchmark')
    parser.add_argument('--output', type=Path, default=Path(__file__).resolve().parents[1] / 'precomputed' / 'benchmark')
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='openeval-benchmark-') as temporary:
        directory = Path(temporary)
        base = 'https://huggingface.co/api/datasets/' + DATASET
        main_info = json_fetch(base, directory, 'main.json')
        revision = json_fetch(base + '/revision/refs%2Fconvert%2Fparquet', directory, 'revision.json')['sha']
        listing = json_fetch('https://datasets-server.huggingface.co/parquet?dataset=' + quote(DATASET, safe=''), directory, 'parquet.json')
        if listing.get('partial') or listing.get('pending') or listing.get('failed'):
            raise ValueError('HF Parquet conversion is incomplete; retry after conversion finishes.')
        files, tables = [], {'item': [], 'response': []}
        for config in tables:
            entries = [f for f in listing['parquet_files'] if f['config'] == config and f['split'] == args.benchmark]
            if not entries:
                raise ValueError('No Parquet files for ' + config + '/' + args.benchmark)
            for index, entry in enumerate(sorted(entries, key=lambda f: f['filename'])):
                url = entry['url'].replace('refs%2Fconvert%2Fparquet', revision)
                target = directory / (config + str(index) + '.parquet')
                print('Downloading ' + config + '/' + entry['filename'], flush=True)
                fetch(url, target)
                if target.stat().st_size != entry['size']:
                    raise ValueError('Parquet listing changed; retry with a fresh revision.')
                columns = ['item_id', 'item_content.references'] if config == 'item' else ['response_id', 'model.name', 'scores']
                table = pq.read_table(target, columns=columns)
                tables[config].append(table)
                files.append({'config': config, 'url': url, 'rows': table.num_rows,
                              'bytes': target.stat().st_size, 'sha256': file_hash(target)})
        latest_revision = json_fetch(base + '/revision/refs%2Fconvert%2Fparquet', directory, 'revision-after.json')['sha']
        if revision != latest_revision:
            raise ValueError('Parquet conversion changed during download; retry.')
        print('Computing full-data statistics', flush=True)
        result = calculate(
            (row for table in tables['item'] for row in table.to_pylist()),
            (row for table in tables['response'] for batch in table.to_batches(max_chunksize=1000) for row in batch.to_pylist()))
        result.update({
            'schemaVersion': 1, 'benchmark': args.benchmark,
            'computedAt': datetime.now(timezone.utc).isoformat(),
            'source': {'dataset': DATASET, 'parquetRevision': revision, 'observedMainRevision': main_info['sha'], 'files': files},
            'rules': {'coverageThreshold': .1, 'coverageDenominator': 'Distinct benchmark item IDs',
                      'coverageNumerator': 'Distinct items with a finite score for the metric after deduplication',
                      'deduplication': 'One response per model.name × item_id; lexicographically smallest response_id; identical IDs use the first row in sorted Parquet filename and row order',
                      'aggregation': 'Each model mean uses its available items; average, median and SE are across equally weighted model means',
                      'standardError': 'Sample standard deviation of model means / sqrt(number of retained models); null for fewer than two',
                      'metricHandling': 'Separate statistics and coverage filtering per metric; exclude -1 for safety_llama_score and *_correctness before coverage and aggregation',
                      'itemSet': 'All available items per retained model; no common-item intersection',
                      'limitations': 'Models can cover different item sets; SE assumes independent model means. Converted Parquet revision pins the exact data; observed main revision is recorded separately.'}
        })
        for measurement in result['measurements']:
            measurement['split'] = args.benchmark
        args.output.mkdir(parents=True, exist_ok=True)
        output = args.output / (args.benchmark + '.json')
        temporary_output = output.with_suffix('.json.tmp')
        temporary_output.write_text(json.dumps(result, indent=2, allow_nan=False) + '\n')
        temporary_output.replace(output)
        print(str(output), flush=True)
        print(json.dumps({k: v for k, v in result.items() if k in ['itemCount', 'responseCount', 'distinctModelCount', 'duplicateResponsesRemoved']}))
        for metric in result['measurements']:
            print(json.dumps({k: metric[k] for k in ['metrics', 'modelCount', 'avgScore', 'medianScore', 'standardError']}))


if __name__ == '__main__':
    main()

"""Add selected benchmarks to coverage using checksum-verified cached source files."""
import argparse
from collections import Counter, defaultdict
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import pyarrow.parquet as pq

ROOT = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('benchmarks', nargs='+')
args = parser.parse_args()
path = ROOT / 'precomputed/coverage.json'
data = json.loads(path.read_text())
merge_path = ROOT.parent / 'model_alias_merge.json'
merge_bytes = merge_path.read_bytes()
merge_hash = hashlib.sha256(merge_bytes).hexdigest()
if merge_hash != data['modelNameMerges']['sha256']:
    raise ValueError('Alias map changed; a full recomputation is needed to keep existing rows consistent.')
names = json.loads(merge_bytes)['_name_map']
# Preserve provenance of retained rows instead of claiming they were recomputed.
for benchmark in data['benchmarks'].values():
    benchmark.setdefault('sourceRevision', data['dataset'].get('revision'))
    benchmark.setdefault('computedAt', data['generated'])
for slug in args.benchmarks:
    source = json.loads((ROOT / 'precomputed/benchmark' / (slug + '.json')).read_text())
    files = []
    for entry in source['source']['files']:
        cached = Path('/tmp/openeval-ability-parquet') / (entry['sha256'] + '.parquet')
        if hashlib.sha256(cached.read_bytes()).hexdigest() != entry['sha256']:
            raise ValueError('Cached source checksum mismatch: ' + str(cached))
        files.append((entry['config'], cached))
    items = set()
    for kind, cached in files:
        if kind == 'item':
            items.update(pq.read_table(cached, columns=['item_id']).column(0).to_pylist())
    counts = Counter()
    covered = defaultdict(set)
    for kind, cached in files:
        if kind != 'response':
            continue
        for batch in pq.ParquetFile(cached).iter_batches(columns=['response_id', 'model.name']):
            for row in batch.to_pylist():
                model = row.get('name') or row.get('model', {}).get('name')
                if not model:
                    raise ValueError('Missing model name')
                item = row['response_id']
                while item not in items and '_' in item:
                    item = item.rsplit('_', 1)[0]
                if item not in items:
                    raise ValueError('Unresolved item: ' + row['response_id'])
                model = names.get(model, model)
                counts[model] += 1
                covered[model].add(item)
    assert len(items) == source['itemCount']
    assert sum(counts.values()) == source['responseCount']
    data['benchmarks'][slug] = dict(items=len(items), models=len(counts), responses=sum(counts.values()),
        rows=[[model, len(covered[model]), counts[model]] for model in sorted(counts)],
        sourceRevision=source['source']['parquetRevision'], computedAt=source['computedAt'])
    print(slug, len(items), len(counts), sum(counts.values()))
now = datetime.now(timezone.utc)
data['generated'] = now.isoformat()
data['as_of'] = now.strftime('%d %b %Y')
data['benchmarks'] = dict(sorted(data['benchmarks'].items()))
benchmarks = data['benchmarks']
data['totals'] = dict(benchmarks=len(benchmarks), models=len({r[0] for b in benchmarks.values() for r in b['rows']}),
    items=sum(b['items'] for b in benchmarks.values()), responses=sum(b['responses'] for b in benchmarks.values()))
data['modelNameMerges']['file'] = merge_path.name
revisions = {b['sourceRevision'] for b in benchmarks.values()}
data['dataset']['revision'] = next(iter(revisions)) if len(revisions) == 1 else None
if len(revisions) > 1:
    data['dataset'].pop('resolve', None)
data['updateNote'] = 'Incremental update; retained benchmarks keep their original computedAt and sourceRevision.'
temporary = path.with_suffix('.json.tmp')
temporary.write_text(json.dumps(data) + '\n')
temporary.replace(path)
summary = {slug.replace('_', '-'): {model: dict(n_items=count, coverage=round(100 * count / b['items'], 1) if b['items'] else 0)
    for model, count, responses in b['rows']} for slug, b in benchmarks.items()}
(ROOT.parent / ('data_summary_' + now.strftime('%m%d%y') + '.json')).write_text(json.dumps(summary, indent=2) + '\n')
print(data['totals'])

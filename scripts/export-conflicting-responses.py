#!/usr/bin/env python3
"""Export full occurrences of response IDs with conflicting finite metric scores."""
import importlib.util
import json
import math
from pathlib import Path
import tempfile

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('compute', root / 'scripts/compute-benchmark.py')
compute = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compute)


def signature(row):
    scores = row.get('scores') or {}
    values = scores.get('value') or []
    result = {}
    for index, metric in enumerate(scores.get('metric') or []):
        value = values[index] if index < len(values) else None
        if metric.get('name') and isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value):
            result[metric['name']] = value
    return json.dumps(result, sort_keys=True, allow_nan=False)


def main():
    import pyarrow.parquet as pq
    output = root / 'data' / 'conflicting-responses.jsonl'
    temporary_output = output.with_suffix('.jsonl.tmp')
    report = []
    with temporary_output.open('w') as stream:
        for summary_path in sorted((root / 'precomputed/benchmark').glob('*.json')):
            summary = json.loads(summary_path.read_text())
            # Scan all benchmarks, not just the examples/counts retained in summary calculation.
            benchmark = summary['benchmark']
            first, conflicts = {}, set()
            with tempfile.TemporaryDirectory(prefix='openeval-conflicts-') as temp:
                sources = []
                for index, source in enumerate(summary['source']['files']):
                    if source['config'] != 'response':
                        continue
                    path = Path(temp) / f'{index}.parquet'
                    print(f'{benchmark}: downloading {index}', flush=True)
                    compute.fetch(source['url'], path)
                    if compute.file_hash(path) != source['sha256']:
                        raise ValueError('Source checksum mismatch: ' + source['url'])
                    sources.append((path, source))
                    for batch in pq.ParquetFile(path).iter_batches(batch_size=2000, columns=['response_id', 'scores']):
                        for row in batch.to_pylist():
                            rid, sig = row['response_id'], signature(row)
                            if rid in first and first[rid] != sig:
                                conflicts.add(rid)
                            else:
                                first.setdefault(rid, sig)
                exported = 0
                if conflicts:
                    for path, source in sources:
                        offset = 0
                        for batch in pq.ParquetFile(path).iter_batches(batch_size=1000):
                            for index, row in enumerate(batch.to_pylist()):
                                if row['response_id'] in conflicts:
                                    row['_conflict_source'] = {
                                        'benchmark': benchmark,
                                        'parquetRevision': summary['source']['parquetRevision'],
                                        'url': source['url'], 'rowIndex': offset + index,
                                    }
                                    stream.write(json.dumps(row, ensure_ascii=False, allow_nan=False) + '\n')
                                    exported += 1
                            offset += batch.num_rows
                report.append({'benchmark': benchmark, 'conflictingResponseIds': len(conflicts), 'exportedRows': exported})
                print(json.dumps(report[-1]), flush=True)
    temporary_output.replace(output)
    output.with_suffix('.report.json').write_text(json.dumps({
        'definition': 'All occurrences of response_id whose finite metric-name/value mappings differ, including the first row. Identical occurrences of a conflicting ID are included. Source Parquet checksums verified against benchmark summaries.',
        'benchmarks': report, 'totalRows': sum(r['exportedRows'] for r in report),
    }, indent=2) + '\n')
    print(str(output), flush=True)


if __name__ == '__main__':
    main()

#!/usr/bin/env python3
"""Validate saved summaries against their model-level statistics and provenance."""
import json
import math
from pathlib import Path
import statistics

root = Path(__file__).resolve().parents[1] / 'precomputed/benchmark'
files = sorted(root.glob('*.json'))
assert files, 'No summaries found'
for path in files:
    data = json.loads(path.read_text())
    assert data['benchmark'] == path.stem
    assert data['computedAt'] and data['source']['parquetRevision']
    assert sum(f['rows'] for f in data['source']['files'] if f['config'] == 'response') == data['responseCount']
    assert data['responseCount'] == data['distinctModelItemPairs'] + data['duplicateResponsesRemoved']
    for metric in data['measurements']:
        models = metric['models']
        assert len(models) == metric['modelCount']
        assert len({m['name'] for m in models}) == len(models)
        assert all(metric['minimumItems'] <= m['n'] <= data['itemCount'] for m in models)
        assert metric['minimumItems'] == math.ceil(.1 * data['itemCount'])
        assert metric['scoredResponses'] == sum(m['n'] for m in models)
        if 'labelFrequencies' in metric:
            assert sum(entry['count'] for entry in metric['labelFrequencies']) == metric['scoredResponses']
            assert all(metric[key] is None for key in ['avgScore', 'medianScore', 'standardError', 'discrimination', 'best', 'worst'])
            continue
        means = [m['mean'] for m in models]
        if means:
            assert math.isclose(metric['avgScore'], statistics.mean(means), abs_tol=1e-12)
            assert math.isclose(metric['medianScore'], statistics.median(means), abs_tol=1e-12)
        else:
            assert metric['avgScore'] is None and metric['medianScore'] is None
        if len(means) > 1:
            assert math.isclose(metric['standardError'], statistics.stdev(means) / math.sqrt(len(means)), abs_tol=1e-12)
        else:
            assert metric['standardError'] is None
    print(path.stem + ': valid')
print(str(len(files)) + ' summaries validated')

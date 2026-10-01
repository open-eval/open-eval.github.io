#!/usr/bin/env python3
"""Compute missing benchmark summaries sequentially; rerun safely to resume."""
import importlib.util
import json
from pathlib import Path
import subprocess
import sys
import tempfile

root = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location('compute', root / 'scripts/compute-benchmark.py')
compute = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compute)
with tempfile.TemporaryDirectory() as temporary:
    listing = compute.json_fetch('https://datasets-server.huggingface.co/parquet?dataset=Open-Eval-Commons%2FOpenEval', Path(temporary), 'files.json')
configs = {}
for entry in listing['parquet_files']:
    if entry['config'] in ('item', 'response') and entry['split'] != 'all':
        configs.setdefault(entry['split'], set()).add(entry['config'])
failures = []
for split, available in sorted(configs.items()):
    output = root / 'precomputed/benchmark' / (split + '.json')
    if output.exists():
        print('Already computed: ' + split, flush=True)
        continue
    if available != {'item', 'response'}:
        failures.append(split)
        continue
    print('\nBENCHMARK: ' + split, flush=True)
    result = subprocess.run([sys.executable, str(root / 'scripts/compute-benchmark.py'), split])
    if result.returncode:
        failures.append(split)
print('Failed benchmarks: ' + json.dumps(failures), flush=True)
sys.exit(bool(failures))

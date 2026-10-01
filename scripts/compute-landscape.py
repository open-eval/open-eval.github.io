#!/usr/bin/env python3
"""Rasch item difficulty distributions from corrected binary responses."""
import importlib.util
import json
import hashlib
from pathlib import Path
from datetime import datetime, timezone
import math
spec=importlib.util.spec_from_file_location('ability',Path(__file__).with_name('compute-ability.py'))
a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
root=Path(__file__).resolve().parents[1]
output=root/'precomputed/landscape';output.mkdir(exist_ok=True)
for path in sorted((root/'precomputed/benchmark').glob('*.json')):
 target=output/path.name
 if target.exists() and json.loads(target.read_text()).get("method") == "rasch-1pl-map" and json.loads(target.read_text()).get("summarySha256") == hashlib.sha256(path.read_bytes()).hexdigest():continue
 source=json.loads(path.read_text());slug=source['benchmark']
 fits=json.loads((root/'precomputed/model'/path.name).read_text())
 candidates=[m for m in source['measurements'] if fits['metrics'][m['metrics'][0]]['available']]
 results={}
 if candidates:
  items,pairs=a.load_pairs(source,candidates,Path('/tmp/openeval-ability-parquet'))
  for m in candidates:
   metric=m['metrics'][0];eligible={v['name'] for v in m['models']}
   entries=[(name,item,1-values[metric] if a.direction(slug,metric)=='lower' else values[metric]) for (name,item),(_,values) in pairs.items() if name in eligible and metric in values]
   print('Fitting '+slug+'/'+metric,flush=True)
   fit=a.fit(entries,max(20,math.ceil(len(items)*.1)))
   if not fit['available']:raise ValueError('Expected fit unavailable: '+slug+'/'+metric)
   previous=fits['metrics'][metric]
   if fit['models'] != previous['models']:raise ValueError('Fit differs from saved model ability: '+slug+'/'+metric)
   results[metric]={**fit['itemDifficulty'],'items':fit['itemCount'],'archivedItems':len(items),'models':fit['modelCount']}
 target.write_text(json.dumps({'method':'rasch-1pl-map','benchmark':slug,'computedAt':datetime.now(timezone.utc).isoformat(),'summarySha256':hashlib.sha256(path.read_bytes()).hexdigest(),'metrics':results},indent=2)+'\n')
 print('Saved '+slug,flush=True)

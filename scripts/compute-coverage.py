"""Recompute archived model/item coverage from pinned HF Parquet columns."""
import io, json, urllib.request, time, hashlib
from pathlib import Path
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import pyarrow.parquet as pq
ROOT = Path(__file__).resolve().parents[1]
REPO = 'Open-Eval-Commons/OpenEval'
def get(url):
    for attempt in range(5):
        try:
            return urllib.request.urlopen(url, timeout=120).read()
        except Exception:
            if attempt == 4: raise
            time.sleep(2 ** attempt)
def api(url): return json.loads(get(url))
class Remote(io.RawIOBase):
    def __init__(self,url,size): self.url,self.size,self.pos=url,size,0
    def readable(self): return True
    def seekable(self): return True
    def tell(self): return self.pos
    def seek(self,offset,whence=0):
        self.pos = offset if whence==0 else self.pos+offset if whence==1 else self.size+offset
        return self.pos
    def read(self,n=-1):
        if n<0: n=self.size-self.pos
        n=min(n,self.size-self.pos)
        if n<=0: return b''
        req=urllib.request.Request(self.url,headers={'Range':f'bytes={self.pos}-{self.pos+n-1}'})
        data=get(req)
        if len(data)==self.size: data=data[self.pos:self.pos+n]
        if len(data)!=n: raise ValueError('Incomplete range response')
        self.pos+=len(data)
        return data

def main():
    base=f'https://huggingface.co/api/datasets/{REPO}/revision/refs%2Fconvert%2Fparquet'
    revision=api(base)['sha']
    manifest=api(f'https://datasets-server.huggingface.co/parquet?dataset={REPO}')
    if manifest.get('partial') or manifest.get('pending') or manifest.get('failed'): raise ValueError('Incomplete manifest')
    files=[f for f in manifest['parquet_files'] if f['config'] in ('item','response') and f['split']!='all']
    merge_path = ROOT.parent / 'model_name_merges_normalized.json'
    merge_bytes = merge_path.read_bytes()
    names = json.loads(merge_bytes)['_name_map']
    previous = json.loads((ROOT/'precomputed'/'coverage.json').read_text())
    groups=defaultdict(list)
    for f in files: groups[f['split']].append(f)
    # Reuse local files only when their exact pinned URL matches.
    cached={}
    for path in (ROOT/'precomputed/benchmark').glob('*.json'):
        for f in json.loads(path.read_text())['source']['files']:
            target=Path('/tmp/openeval-ability-parquet')/(f['sha256']+'.parquet')
            if target.exists(): cached[f['url']]=target
    def table(f,columns):
        url=f['url'].replace('refs%2Fconvert%2Fparquet',revision)
        source=cached.get(url) or Remote(url,f['size'])
        return pq.read_table(source,columns=columns).to_pylist()
    def compute(entry):
        name,fs=entry
        old = previous.get('benchmarks', {}).get(name)
        if previous.get('dataset', {}).get('revision') == revision and old and not previous.get('modelNameMerges'):
            renamed = [[names.get(m, m), covered, count] for m, covered, count in old['rows']]
            if len({r[0] for r in renamed}) == len(renamed):
                print(name, 'reused pinned counts; normalized names', flush=True)
                return name, dict(old, rows=sorted(renamed))
        items=set()
        for f in fs:
            if f['config']=='item': items.update(r['item_id'] for r in table(f,['item_id']))
        counts=Counter(); covered=defaultdict(set)
        for f in fs:
            if f['config']!='response': continue
            for row in table(f,['response_id','model.name']):
                model=row.get('name') or row.get('model',{}).get('name')
                if not model: raise ValueError('Missing model')
                item=row['response_id']
                while item not in items and '_' in item: item=item.rsplit('_',1)[0]
                if item not in items: raise ValueError('Unresolved item '+row['response_id'])
                model = names.get(model, model)
                counts[model]+=1; covered[model].add(item)
        print(name,len(items),len(counts),sum(counts.values()),flush=True)
        return name,{'items':len(items),'models':len(counts),'responses':sum(counts.values()),'rows':[[m,len(covered[m]),counts[m]] for m in sorted(counts)]}
    with ThreadPoolExecutor(max_workers=4) as pool: benchmarks=dict(pool.map(compute,sorted(groups.items())))
    if api(base)['sha']!=revision: raise ValueError('Revision changed; retry')
    now=datetime.now(timezone.utc)
    result={'as_of':now.strftime('%d %b %Y'),'generated':now.isoformat(),'dataset':{'repo':REPO,'revision':revision,'url':f'https://huggingface.co/datasets/{REPO}','resolve':f'https://huggingface.co/datasets/{REPO}/resolve/{revision}/'},'totals':{'benchmarks':len(benchmarks),'models':len({r[0] for b in benchmarks.values() for r in b['rows']}),'items':sum(b['items'] for b in benchmarks.values()),'responses':sum(b['responses'] for b in benchmarks.values())},'row_fields':['model','items_covered','responses'],'benchmarks':benchmarks}
    result['modelNameMerges'] = {'file': merge_path.name, 'sha256': hashlib.sha256(merge_bytes).hexdigest(), 'rule': 'Apply _name_map; union item IDs across aliases; sum all archived response rows.'}
    target=ROOT/'precomputed'/'coverage.json'; temp=target.with_suffix('.json.tmp');temp.write_text(json.dumps(result)+'\n');temp.replace(target)
    summary = {name.replace('_', '-'): {model: {'n_items': covered, 'coverage': round(100 * covered / b['items'], 1) if b['items'] else 0.0} for model, covered, responses in b['rows']} for name, b in benchmarks.items()}
    summary_path = ROOT.parent / ('data_summary_' + now.strftime('%m%d%y') + '.json')
    summary_path.write_text(json.dumps(summary, indent=2) + '\n')
    print(str(summary_path), flush=True)
    print(result['totals'],flush=True)
if __name__=='__main__': main()

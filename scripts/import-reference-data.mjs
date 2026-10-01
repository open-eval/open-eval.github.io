import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
const reference = resolve(process.argv[2] || '../ref_website/public');
await mkdir('data', {recursive:true});
for (const file of ['model-scores.json','item-difficulty.json','model-ability.json']) {
  const source=await readFile(resolve(reference,file),'utf8');
  const value=JSON.parse(source);
  if(!value.generatedAt) throw Error(file+' has no snapshot date');
  await writeFile('data/'+file,source);
  console.log(file+': '+value.generatedAt);
}

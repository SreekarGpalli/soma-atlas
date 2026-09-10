import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const file='public/models/manifest.json', manifest=JSON.parse(readFileSync(file));
function version(url){const pathname=url.split('?')[0];const hash=createHash('sha256').update(readFileSync('public'+pathname)).digest('hex').slice(0,12);return `${pathname}?v=${hash}`;}
for(const sex of ['male','female'])for(const key of Object.keys(manifest[sex]))manifest[sex][key]=version(manifest[sex][key]);
for(const key of ['maleBody','femalePelvis'])if(manifest[key])manifest[key]=version(manifest[key]);
writeFileSync(file,JSON.stringify(manifest,null,2));

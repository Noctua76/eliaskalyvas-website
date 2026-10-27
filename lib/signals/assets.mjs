// Offline only. Rights records must ultimately come from the trusted Phase 4 boundary.
import {readFile,realpath,stat} from 'node:fs/promises';
import {resolve,sep} from 'node:path';
import {createHash} from 'node:crypto';
import sharp from 'sharp';
import {hashJSON,isUTC} from '../publication/contract.mjs';
const requireAsset=(ok,code)=>{if(!ok)throw Error(code);};
const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export async function packageAssets(dataset,{assetRoot,rightsDecisions}){
 requireAsset(Array.isArray(rightsDecisions),'RIGHTS_DECISIONS_REQUIRED');
 const root=await realpath(assetRoot),files=new Map();
 for(const r of dataset.releases){
  const c=r.presentation.cover,path=new URL(c.url).pathname.slice(1);
  const proof=rightsDecisions.find(p=>p.asset_sha256===c.sha256&&p.cover_sha256===hashJSON(c));
  requireAsset(proof&&Object.keys(proof).sort().join(',')==='approved_at,approved_by,asset_sha256,cover_sha256,decision_id,kind,template_id'&&uuid.test(proof.decision_id)&&proof.approved_by===r.authorization.approved_by&&proof.kind===c.kind&&proof.template_id===c.template_id,'RIGHTS_DECISION_REQUIRED');
  requireAsset(isUTC(proof.approved_at)&&Date.parse(proof.approved_at)<=Date.parse(r.authorization.human_approved_at),'INVALID_RIGHTS_DATE');
  requireAsset(c.alt.trim().length>0&&c.attribution.creator.trim().length>0&&c.attribution.license_name.trim().length>0&&c.attribution.rights_confirmed===true,'INCOMPLETE_ASSET_APPROVAL');
  const file=await realpath(resolve(root,path));requireAsset(file.startsWith(root+sep),'ASSET_OUTSIDE_ROOT');
  const info=await stat(file);requireAsset(info.isFile()&&info.size<=20*1024*1024,'ASSET_SIZE');
  const bytes=await readFile(file);requireAsset(createHash('sha256').update(bytes).digest('hex')===c.sha256,'ASSET_HASH_MISMATCH');
  const image=sharp(bytes,{limitInputPixels:40_000_000,failOn:'warning'}),m=await image.metadata();
  const formats={jpeg:['image/jpeg','jpg'],png:['image/png','png'],webp:['image/webp','webp']},type=formats[m.format];
  requireAsset(type&&c.mime_type===type[0]&&path===`assets/signals/${c.sha256}.${type[1]}`,'ASSET_TYPE_MISMATCH');
  requireAsset(m.width===c.width&&m.height===c.height&&(!m.pages||m.pages===1)&&(!m.orientation||m.orientation===1),'ASSET_DIMENSION_MISMATCH');
  requireAsset(!m.exif&&!m.iptc&&!m.xmp,'ASSET_PRIVATE_METADATA');
  await image.raw().toBuffer(); // Decode all pixels; metadata/header inspection alone is insufficient.
  files.set(path,bytes); // Package EXACT approved bytes, never resize/re-encode silently.
 }
 return files;
}

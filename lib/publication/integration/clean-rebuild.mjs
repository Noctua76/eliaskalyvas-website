// Credential-free child adapter. The trusted orchestrator supplies a manifest
// from an exact clean Git checkout; the read-only child checks every source byte.
import {readFile,lstat,realpath} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {createNormalBuildSnapshot} from './build.mjs';
import {hashJSON} from '../contract.mjs';
export async function verifySourceManifest(root,manifest){
 if(!manifest||!Object.keys(manifest).length)throw Error('SOURCE_MANIFEST');
 for(const [path,digest]of Object.entries(manifest)){
  if(!path||path.startsWith('/')||path.split('/').some(p=>!p||p==='.'||p==='..')||!/^[a-f0-9]{64}$/.test(digest))throw Error('SOURCE_MANIFEST');
  const file=join(root,path);if(await realpath(file)!==join(await realpath(root),path)||!(await lstat(file)).isFile()||createHash('sha256').update(await readFile(file)).digest('hex')!==digest)throw Error('SOURCE_BYTES');
 }
 for(const path of ['.env','.env.local','.env.production','.env.production.local']){try{await lstat(join(root,path));}catch(e){if(e.code==='ENOENT')continue;throw e;}throw Error('SOURCE_DOTENV');}
}
export async function rebuildCleanNormal({codeSHA,builder,sourceManifest}){
 const root=new URL('../../../',import.meta.url).pathname;if(builder.codeSHA!==codeSHA||!/^[a-f0-9]{40}$/.test(codeSHA))throw Error('SOURCE_SHA');
 await verifySourceManifest(root,sourceManifest);const {inventory,files}=await createNormalBuildSnapshot({codeSHA});await verifySourceManifest(root,sourceManifest);
 if(inventory.paths.includes('.well-known/nyra-release.json'))throw Error('NORMAL_WITNESS');
 const record={schema_version:'nyra.normal.provenance.v1',inventory,builder:{...builder,assurance:'unprotected_ci'},files:[...files].map(([path,b])=>({path,sha256:createHash('sha256').update(b).digest('hex'),bytes:b.length})).sort((a,b)=>a.path.localeCompare(b.path,'en'))};
 return {record,digest:hashJSON(record)};
}

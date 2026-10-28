// Node/build-side adapter: reuse every Phase 3 byte/MIME/dimension/decode/privacy
// check. Never imported by public pages or silently used as Edge-native Sharp.
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {packageAssets} from '../../signals/assets.mjs';
import {hashJSON,validatePublicationSet} from '../contract.mjs';
export async function inspectApprovedBytes({cover,bytes,now}){
 const root=await mkdtemp(join(tmpdir(),'nyra-private-inspect-')),path=new URL(cover.url).pathname.slice(1),file=join(root,path);
 try{await mkdir(dirname(file),{recursive:true});await writeFile(file,bytes,{flag:'wx'});
  // Gate already verified the owner. This record is preflight only, never saved
  // or returned as a human rights decision; the Phase 2 RPC records the real one.
  const identity='https://eliaskalyvas.gr/#person';
  const proof={decision_id:randomUUID(),asset_sha256:cover.sha256,cover_sha256:hashJSON(cover),approved_by:identity,approved_at:now,kind:cover.kind,template_id:cover.template_id};
  await packageAssets({releases:[{presentation:{cover},authorization:{approved_by:identity,human_approved_at:now}}]},{assetRoot:root,rightsDecisions:[proof]});return true;
 }finally{await rm(root,{recursive:true,force:true})}
}
export async function preparePrivateBuildPackage({dataset,storage,rightsDecisions,now}){
 validatePublicationSet(dataset,{now});
 const root=await mkdtemp(join(tmpdir(),'nyra-private-package-')),seen=new Set();
 try{for(const r of dataset.releases){const path=new URL(r.presentation.cover.url).pathname.slice(1);if(seen.has(path))continue;seen.add(path);const file=join(root,path);await mkdir(dirname(file),{recursive:true});await writeFile(file,await storage.get(r.presentation.cover.sha256),{flag:'wx'});}
  return await packageAssets(dataset,{assetRoot:root,rightsDecisions});
 }finally{await rm(root,{recursive:true,force:true})}
}

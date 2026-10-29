// Private protected-runner build. The default Vite build never imports this file.
import {mkdtemp,mkdir,writeFile,readdir,readFile,lstat,rm} from 'node:fs/promises';
import {join,dirname,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {createTrustedStaticBuilder} from '../../signals/static-build.mjs';
import {artifactSealer} from '../runtime/artifact.mjs';
import {requireDelivery as need} from '../runtime/materialize.mjs';
import {publicWitness,WITNESS_PATH,validatePublicFiles,createPublicPathScopeAuthority} from './observer.mjs';
import {createPagesTar,sha256} from './archive.mjs';
import {hashJSON} from '../contract.mjs';
async function readBuildFiles(out){const files=new Map();async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name),s=await lstat(path);need(!s.isSymbolicLink(),'BUILD_SYMLINK');if(s.isDirectory())await walk(path);else{need(s.isFile(),'BUILD_FILE');files.set(relative(out,path).split('\\').join('/'),await readFile(path));}}}await walk(out);return files;}
// Independent no-publication build, not a projection of submitted artifact keys.
// Server use requires this record from its separately approved code/config build
// provenance; it must never accept an inventory uploaded by the delivery caller.
export async function createNormalBuildSnapshot({codeSHA}){
 need(/^[a-f0-9]{40}$/.test(codeSHA),'PUBLIC_INVENTORY_CODE');
 const {build}=await import('vite'),{default:normal}=await import('../../../vite.config.js');
 const outDir=await mkdtemp(join(tmpdir(),'nyra-normal-inventory-'));
 const configurationSHA256=hashJSON({base:process.env.GITHUB_PAGES_BASE||'/',vite:Object.fromEntries(Object.entries(process.env).filter(([k])=>k.startsWith('VITE_')).sort(([a],[b])=>a<b?-1:a>b?1:0))});
 try{await build({...normal,root:new URL('../../../',import.meta.url).pathname,configFile:false,build:{...normal.build,outDir,emptyOutDir:true},logLevel:'error'});const files=await readBuildFiles(outDir);return {inventory:{schema_version:'nyra.public.paths.v1',codeSHA,configurationSHA256,paths:[...files.keys()].sort()},files};}
 finally{await rm(outDir,{recursive:true,force:true});}
}
export async function createNormalBuildInventory(options){return (await createNormalBuildSnapshot(options)).inventory;}
export async function buildAuthenticatedArtifact({receiver,proof,clock=()=>new Date().toISOString()}){
 receiver.assert(proof);const v=receiver.snapshot(proof),assets=await mkdtemp(join(tmpdir(),'nyra-build-assets-'));let out;
 try{
  const inventory=await createNormalBuildInventory({codeSHA:proof.codeSHA}),pathScopeAuthority=createPublicPathScopeAuthority({configurationSHA256:inventory.configurationSHA256,loadApprovedInventory:async()=>inventory});
  for(const a of v.assets){const path=join(assets,a.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,Buffer.from(a.base64,'base64'),{flag:'wx',mode:0o600});}
  out=await createTrustedStaticBuilder({receiver}).build(proof,{assetRoot:assets,now:clock()});
  const attempt={id:proof.attemptId,fence:proof.fence,...v.identity},candidate={id:proof.candidateId,dataset:v.dataset};
  await mkdir(join(out,'.well-known'),{recursive:true});await writeFile(join(out,WITNESS_PATH),JSON.stringify(publicWitness(attempt,candidate)));
  const files=await readBuildFiles(out);
  const baseSitemap=await readFile(new URL('../../../public/sitemap.xml',import.meta.url),'utf8');
  const pathScope=await pathScopeAuthority.forAttempt(attempt);
  validatePublicFiles(files,{attempt,candidate,baseSitemap,pathScope,now:clock()});
  const sealer=artifactSealer(),seal=sealer.seal(files,proof),tar=createPagesTar(sealer.files(seal));
  return {files:sealer.files(seal),tar,seal,tarSHA256:sha256(tar)};
 }finally{await rm(assets,{recursive:true,force:true});if(out)await rm(out,{recursive:true,force:true});}
}

// Private protected-runner build. The default Vite build never imports this file.
import {mkdtemp,mkdir,writeFile,readdir,readFile,lstat,rm} from 'node:fs/promises';
import {join,dirname,relative} from 'node:path';
import {tmpdir} from 'node:os';
import {createTrustedStaticBuilder} from '../../signals/static-build.mjs';
import {artifactSealer} from '../runtime/artifact.mjs';
import {requireDelivery as need} from '../runtime/materialize.mjs';
import {publicWitness,WITNESS_PATH,validatePublicFiles} from './observer.mjs';
import {createPagesTar,sha256} from './archive.mjs';
export async function buildAuthenticatedArtifact({receiver,proof,clock=()=>new Date().toISOString()}){
 receiver.assert(proof);const v=receiver.snapshot(proof),assets=await mkdtemp(join(tmpdir(),'nyra-build-assets-'));let out;
 try{
  for(const a of v.assets){const path=join(assets,a.path);await mkdir(dirname(path),{recursive:true});await writeFile(path,Buffer.from(a.base64,'base64'),{flag:'wx',mode:0o600});}
  out=await createTrustedStaticBuilder({receiver}).build(proof,{assetRoot:assets,now:clock()});
  const attempt={id:proof.attemptId,fence:proof.fence,...v.identity},candidate={id:proof.candidateId,dataset:v.dataset};
  await mkdir(join(out,'.well-known'),{recursive:true});await writeFile(join(out,WITNESS_PATH),JSON.stringify(publicWitness(attempt,candidate)));
  const files=new Map();async function walk(dir){for(const e of await readdir(dir,{withFileTypes:true})){const path=join(dir,e.name),s=await lstat(path);need(!s.isSymbolicLink(),'BUILD_SYMLINK');if(s.isDirectory())await walk(path);else{need(s.isFile(),'BUILD_FILE');files.set(relative(out,path).split('\\').join('/'),await readFile(path));}}}await walk(out);
  const baseSitemap=await readFile(new URL('../../../public/sitemap.xml',import.meta.url),'utf8');
  validatePublicFiles(files,{attempt,candidate,baseSitemap,now:clock()});
  const sealer=artifactSealer(),seal=sealer.seal(files,proof),tar=createPagesTar(sealer.files(seal));
  return {files:sealer.files(seal),tar,seal,tarSHA256:sha256(tar)};
 }finally{await rm(assets,{recursive:true,force:true});if(out)await rm(out,{recursive:true,force:true});}
}

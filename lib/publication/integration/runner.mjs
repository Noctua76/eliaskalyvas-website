// Explicit future protected-job CLI only. NOT part of npm build or active workflows.
import {writeFile,mkdir,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {createExportReceiver} from './transport.mjs';
import {buildAuthenticatedArtifact} from './build.mjs';
import {requireDelivery as need} from '../runtime/materialize.mjs';
export async function actionsToken(audience,{env=process.env,fetcher=fetch}={}){
 const url=new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);need(url.protocol==='https:'&&url.hostname.endsWith('.actions.githubusercontent.com')&&env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,'ACTIONS_OIDC_CONFIG');url.searchParams.set('audience',audience);
 const r=await fetcher(url,{headers:{Authorization:'Bearer '+env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},redirect:'error',signal:AbortSignal.timeout(10000)});need(r.ok,'ACTIONS_OIDC_UNAVAILABLE');const body=await r.json();need(typeof body.value==='string','ACTIONS_OIDC_UNAVAILABLE');return body.value;
}
export async function runProtectedDelivery(operation,{env=process.env,fetcher=fetch}={}){
 need(env.NYRA_DELIVERY_ENABLED==='true'&&env.GITHUB_REF==='refs/heads/main'&&env.GITHUB_REPOSITORY==='Noctua76/eliaskalyvas-website','PRODUCTION_INTEGRATION_DISABLED');
 need(['build','permit','deploy','observe'].includes(operation),'DELIVERY_OPERATION');
 const endpoint=env.NYRA_TRUSTED_DELIVERY_URL,audience=env.NYRA_OIDC_AUDIENCE,identity={codeSHA:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT};
 const receiver=createExportReceiver({endpoint,audience,identity,tokenSource:a=>actionsToken(a,{env,fetcher}),fetcher});
 const dir=join(env.RUNNER_TEMP,'nyra-'+env.GITHUB_RUN_ID+'-'+env.GITHUB_RUN_ATTEMPT);await mkdir(dir,{recursive:true,mode:0o700});
 if(operation==='build'){
  const proof=await receiver.acquire(),result=await buildAuthenticatedArtifact({receiver,proof});await writeFile(join(dir,'artifact.tar'),result.tar,{flag:'wx',mode:0o600});
  // Private diagnostic sidecar is NEVER uploaded with artifact.tar.
  await writeFile(join(dir,'binding.json'),JSON.stringify({...proof,artifactSHA256:result.seal.artifactSHA256,tarSHA256:result.tarSHA256}),{flag:'wx',mode:0o600});return {status:'artifact_prepared'};
 }
 if(operation==='permit'){
  const binding=JSON.parse(await readFile(join(dir,'binding.json'),'utf8')),p=await receiver.permit();
  need(p.candidate_id===binding.candidateId&&p.attempt_id===binding.attemptId&&p.fence===binding.fence&&p.code_sha===identity.codeSHA&&p.manifest_sha256===binding.manifestSHA256&&p.artifact_sha256===binding.artifactSHA256&&Date.parse(p.expires_at)>Date.now(),'PERMIT_BUILD_MISMATCH');return {status:'permitted'};
 }
 if(operation==='observe')return receiver.observe();
 // The default-audience Pages token is separately verified server-side against
 // the same exact protected job. Neither it nor GITHUB_TOKEN is logged/stored.
 const token=await actionsToken(audience,{env,fetcher}),pagesOIDC=await actionsToken(env.NYRA_PAGES_OIDC_AUDIENCE,{env,fetcher});
 const r=await fetcher(endpoint+'/deploy',{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'X-Pages-OIDC':pagesOIDC,'X-GitHub-Token':env.GITHUB_TOKEN,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(60000)});need(r.ok,'DELIVERY_DISPATCH_UNKNOWN');return r.json();
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 try{const result=await runProtectedDelivery(process.argv[2]);console.log(JSON.stringify(result));if(process.argv[2]==='observe'&&result.status!=='released_verified')process.exitCode=1;}
 catch{console.error('Delivery blocked or outcome unknown. Reconciliation required; do not retry dispatch.');process.exitCode=1;}
}

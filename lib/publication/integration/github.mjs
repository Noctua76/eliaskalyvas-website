// Server-controlled GitHub readers. Tokens are dependencies, never public data.
import {requireDelivery as need} from '../runtime/materialize.mjs';
import {githubJobFacts} from '../runtime/github-jobs.mjs';
export function currentMainJobFacts({getJSON,repository,environment}){
 const facts=githubJobFacts({getJSON,repository,environment});return async identity=>{
  const found=await facts(identity),main=await getJSON('https://api.github.com/repos/'+repository+'/branches/main');
  need(main.commit?.sha===found.sha,'STALE_CODE_SHA');return found;
 };
}
export function githubDeliveryReader({repository,getJSON,downloadArtifact,deploymentJournal}){
 need(/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository),'GITHUB_REPOSITORY');const root='https://api.github.com/repos/'+repository;
 return Object.freeze({
  async runTerminal(attempt){const run=await getJSON(root+'/actions/runs/'+attempt.runId+'/attempts/'+attempt.runAttempt);need(run.head_sha===attempt.codeSHA&&String(run.run_attempt)===attempt.runAttempt,'DEPLOYMENT_CORRELATION');return run.status==='completed';},
  async artifactFor(attempt,artifactId=null){
   const run=await getJSON(root+'/actions/runs/'+attempt.runId+'/attempts/'+attempt.runAttempt),list=artifactId?{total_count:1,artifacts:[await getJSON(root+'/actions/artifacts/'+artifactId)]}:await getJSON(root+'/actions/runs/'+attempt.runId+'/artifacts?per_page=100');
   need(String(run.run_attempt)===attempt.runAttempt&&run.head_sha===attempt.codeSHA&&run.repository.full_name===repository&&list.total_count<=100,'ARTIFACT_RUN');
   const matches=list.artifacts.filter(a=>a.name==='github-pages'&&!a.expired);need(matches.length===1,'ARTIFACT_AMBIGUOUS');const artifact=matches[0];
   // Official artifact download redirect handling belongs to this trusted reader;
   // never attach GitHub Authorization to the redirected blob host.
   const archive=await downloadArtifact(root+'/actions/artifacts/'+artifact.id+'/zip');return {artifact,archive};
  },
  async deploymentFor(attempt){
   // An immutable SERVER dispatch journal is mandatory. Pages status alone has
   // neither actual request time nor a numeric GitHub deployment identity.
   const j=await deploymentJournal.read(attempt.id);if(!j)return null;
   need(j.runId===attempt.runId&&j.runAttempt===attempt.runAttempt&&j.codeSHA===attempt.codeSHA&&/^[1-9][0-9]*$/.test(j.deploymentId),'DEPLOYMENT_JOURNAL');
   const d=await getJSON(root+'/deployments/'+j.deploymentId),status=await getJSON(root+'/pages/deployments/'+encodeURIComponent(j.pagesDeploymentId));
   need(d.sha===attempt.codeSHA&&d.environment==='github-pages'&&j.checkRunId===attempt.checkRunId&&d.payload?.nyra_attempt_id===attempt.id&&d.payload?.github_run_id===attempt.runId&&d.payload?.github_run_attempt===attempt.runAttempt&&d.payload?.check_run_id===attempt.checkRunId&&d.payload?.artifact_id===j.artifactId,'DEPLOYMENT_CORRELATION');
   const now=await deploymentJournal.observeStatus(attempt.id,status.status);return {...j,id:j.deploymentId,status:status.status,completedAt:now.completedAt};
  }
 });
}
export function githubHTTP({tokenSource,fetcher=fetch}){
 const headers=async()=>({Authorization:'Bearer '+await tokenSource(),Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2026-03-10'});
 return Object.freeze({
  async getJSON(url){need(url.startsWith('https://api.github.com/repos/'),'GITHUB_URL');const r=await fetcher(url,{headers:await headers(),redirect:'error',signal:AbortSignal.timeout(15000)});need(r.ok,'GITHUB_UNAVAILABLE');return r.json();},
  async downloadArtifact(url){need(/^https:\/\/api\.github\.com\/repos\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/actions\/artifacts\/[1-9][0-9]*\/zip$/.test(url),'GITHUB_URL');const r=await fetcher(url,{headers:await headers(),redirect:'manual',signal:AbortSignal.timeout(15000)});need(r.status===302,'ARTIFACT_REDIRECT');const target=new URL(r.headers.get('location'));need(target.protocol==='https:'&&(target.hostname.endsWith('.blob.core.windows.net')||target.hostname.endsWith('.actions.githubusercontent.com')),'ARTIFACT_HOST');const archive=await fetcher(target,{redirect:'error',signal:AbortSignal.timeout(30000)});need(archive.ok,'ARTIFACT_DOWNLOAD');return new Uint8Array(await archive.arrayBuffer());}
 });
}

// Reusable-job entry point. No checked-in activation configuration or caller.
// Broker origin/operation/audience are reviewed configuration, never PR inputs.
import {readFile} from 'node:fs/promises';
import {reviewedDeliveryPolicy} from '../../lib/publication/runtime/delivery-policy.mjs';
import {requireDelivery as need} from '../../lib/publication/runtime/materialize.mjs';
export async function requestProtectedJob({privilege,configuration,env=process.env,fetcher=fetch}){
 const p=reviewedDeliveryPolicy(configuration,privilege),url=new URL(configuration.brokerOrigin);
 need(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname==='/','BROKER_ORIGIN');
 need(env.GITHUB_REPOSITORY===p.repository&&env.GITHUB_REF===p.ref&&env.GITHUB_SHA===p.callerSHA&&env.GITHUB_EVENT_NAME==='workflow_dispatch'&&env.RUNNER_ENVIRONMENT==='github-hosted','WORKFLOW_CONTEXT');
 const tokenURL=new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);
 need(tokenURL.protocol==='https:'&&tokenURL.hostname.endsWith('.actions.githubusercontent.com')&&env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,'OIDC_REQUEST');
 tokenURL.searchParams.set('audience',p.audience);
 const response=await fetcher(tokenURL,{redirect:'error',headers:{Authorization:'Bearer '+env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(10000)});
 need(response.ok,'OIDC_REQUEST_FAILED');const {value}=await response.json();need(typeof value==='string'&&value.length<20000,'OIDC_RESPONSE');
 const result=await fetcher(new URL('jobs/'+privilege,url),{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+value,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(60000)});
 need(result.ok,'PROTECTED_JOB_DENIED');
 // Never echo JWTs, returned private payload, inventory, articles or credentials.
 return {privilege,accepted:true};
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 try{
  // Deliberately absent until separately reviewed protected acceptance. No env
  // toggle, workflow input, local inventory or runner secret enables delivery.
  const configuration=JSON.parse(await readFile(new URL('./accepted-configuration.json',import.meta.url),'utf8'));
  console.log(JSON.stringify(await requestProtectedJob({privilege:process.argv[2],configuration})));
 }catch{console.error('NYRA_PROTECTED_JOB_UNCONFIGURED_OR_DENIED');process.exitCode=1;}
}

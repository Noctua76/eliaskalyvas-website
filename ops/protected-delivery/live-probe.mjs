// A missing approved public plan fails BEFORE token acquisition. No credential,
// subject allowlist, production policy or private evidence is stored in the job.
import {readFile} from 'node:fs/promises';
const need=v=>{if(!v)throw Error('ACCEPTANCE_DENIED');};
export async function probeIdentity({privilege,plan,env=process.env,fetcher=fetch}){
 need(['build','inspection','publication'].includes(privilege)&&plan?.purpose==='isolated-live-trust-acceptance'&&plan.publicEvidenceKeyId&&plan.approved===true);
 const origin=new URL(plan.origin);need(origin.protocol==='https:'&&origin.pathname==='/'&&!origin.username&&!origin.password&&!origin.search&&!origin.hash);
 need(env.GITHUB_REPOSITORY==='Noctua76/eliaskalyvas-website'&&env.GITHUB_REPOSITORY_ID==='1389733212'&&env.GITHUB_REPOSITORY_OWNER_ID==='217035723'&&env.GITHUB_REF==='refs/heads/main'&&env.GITHUB_REF_PROTECTED==='true'&&env.GITHUB_EVENT_NAME==='workflow_dispatch'&&env.RUNNER_ENVIRONMENT==='github-hosted');
 const tokenURL=new URL(env.ACTIONS_ID_TOKEN_REQUEST_URL);need(tokenURL.protocol==='https:'&&tokenURL.hostname.endsWith('.actions.githubusercontent.com')&&env.ACTIONS_ID_TOKEN_REQUEST_TOKEN);
 tokenURL.searchParams.set('audience','urn:nyra:acceptance:'+privilege);
 const response=await fetcher(tokenURL,{redirect:'error',headers:{Authorization:'Bearer '+env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(10000)});need(response.ok);const {value}=await response.json();need(typeof value==='string'&&value.length<20000);
 const result=await fetcher(new URL('acceptance/'+privilege,origin),{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+value,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(60000)});need(result.ok);
 const ack=await result.json();need(ack.accepted===true&&ack.keyId===plan.publicEvidenceKeyId&&/^[a-f0-9]{64}$/.test(ack.digest));
 return {privilege,evidenceDigest:ack.digest,authorization:false};
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 try{const plan=JSON.parse(await readFile(new URL('./live-acceptance-plan.json',import.meta.url),'utf8'));console.log(JSON.stringify(await probeIdentity({privilege:process.argv[2],plan})));}
 catch{console.error('NYRA_ACCEPTANCE_UNCONFIGURED_OR_DENIED');process.exitCode=1;}
}

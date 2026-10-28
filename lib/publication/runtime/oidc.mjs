// Private, unmounted verifier. No production token request or endpoint registration.
import {parseContractJSON} from '../contract.mjs';
export const GITHUB_ISSUER='https://token.actions.githubusercontent.com';
export const GITHUB_JWKS=GITHUB_ISSUER+'/.well-known/jwks';
export class TrustError extends Error{constructor(code){super(code);this.code=code;}}
const requireTrust=(ok,code)=>{if(!ok)throw new TrustError(code)};
const decimal=v=>typeof v==='string'&&/^[1-9][0-9]{0,19}$/.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
const decode=s=>{requireTrust(typeof s==='string'&&/^[A-Za-z0-9_-]+$/.test(s),'JWT_ENCODING');const bytes=Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/')),c=>c.charCodeAt(0));return bytes};
const json=s=>parseContractJSON(new TextDecoder('utf-8',{fatal:true}).decode(decode(s)));
export function githubKeySource({fetcher=fetch,now=Date.now,ttl=300000}={}){
 let cached=null,until=0,pending=null;
 return async()=>{
  if(cached&&now()<until)return cached;
  if(!pending)pending=(async()=>{const r=await fetcher(GITHUB_JWKS,{redirect:'error',signal:AbortSignal.timeout(10000)});requireTrust(r.ok,'JWKS_UNAVAILABLE');const text=await r.text();requireTrust(text.length<100000,'JWKS_SIZE');const value=parseContractJSON(text);requireTrust(Array.isArray(value.keys)&&value.keys.length>0&&value.keys.length<=50,'JWKS_SHAPE');cached=value;until=now()+ttl;return value})().finally(()=>{pending=null});
  return pending;
 };
}
// jobFacts MUST be obtained by a trusted server adapter, never request JSON.
// GitHub has no general job-name JWT claim: check_run_id is correlated with
// independently fetched job/run facts, and the reusable workflow pin is checked.
export function createOIDCVerifier({policy,keySource=githubKeySource(),jobFacts,now=Date.now}){
 requireTrust(policy&&policy.issuer===GITHUB_ISSUER&&typeof policy.audience==='string'&&policy.audience.length>0,'TRUST_CONFIG');
 for(const k of ['repositoryId','ownerId'])requireTrust(decimal(policy[k]),'TRUST_CONFIG');
 for(const k of ['repository','ref','subject','environment','workflowRef','jobWorkflowRef','jobName'])requireTrust(typeof policy[k]==='string'&&policy[k].length>0,'TRUST_CONFIG');
 requireTrust(sha(policy.jobWorkflowSHA)&&Array.isArray(policy.events)&&policy.events.length&&typeof jobFacts==='function','TRUST_CONFIG');
 const trust=structuredClone(policy),verified=new WeakSet();
 return Object.freeze({
  async verify(token){try{
   requireTrust(typeof token==='string'&&token.length<20000,'JWT_SIZE');const parts=token.split('.');requireTrust(parts.length===3,'JWT_SHAPE');const [h,p,s]=parts,header=json(h),claims=json(p);
   requireTrust(header.alg==='RS256'&&header.typ==='JWT'&&typeof header.kid==='string'&&header.kid.length<=200&&!header.jku&&!header.x5u&&!header.crit,'JWT_HEADER');
   const jwks=await keySource(),keys=jwks.keys?.filter(k=>k.kid===header.kid);requireTrust(keys?.length===1,'JWKS_KEY');const jwk=keys[0];requireTrust(jwk.kty==='RSA'&&(!jwk.alg||jwk.alg==='RS256')&&(!jwk.use||jwk.use==='sig')&&!jwk.d&&decode(jwk.n).length>=256,'JWKS_KEY');
   const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
   requireTrust(await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,decode(s),new TextEncoder().encode(h+'.'+p)),'JWT_SIGNATURE');
   requireTrust(claims.iss===trust.issuer&&claims.aud===trust.audience&&claims.sub===trust.subject,'JWT_TRUST');
   for(const [claim,expected]of Object.entries({repository_id:trust.repositoryId,repository_owner_id:trust.ownerId,repository:trust.repository,ref:trust.ref,ref_type:'branch',environment:trust.environment,workflow_ref:trust.workflowRef,job_workflow_ref:trust.jobWorkflowRef,job_workflow_sha:trust.jobWorkflowSHA}))requireTrust(claims[claim]===expected,'JWT_IDENTITY_'+claim);
   requireTrust(trust.events.includes(claims.event_name)&&claims.runner_environment==='github-hosted','JWT_CONTEXT');
   for(const k of ['run_id','run_attempt','check_run_id'])requireTrust(decimal(claims[k]),'JWT_RUN');
   requireTrust(sha(claims.sha)&&sha(claims.workflow_sha)&&typeof claims.jti==='string'&&claims.jti.length>=8&&claims.jti.length<=200,'JWT_RUN');
   const clock=Math.floor(now()/1000);requireTrust([claims.iat,claims.nbf,claims.exp].every(Number.isSafeInteger)&&claims.iat<=clock&&claims.nbf<=clock&&claims.exp>clock&&claims.exp>claims.iat&&claims.exp-claims.iat<=600&&clock-claims.iat<=600,'JWT_TIME');
   const facts=await jobFacts(Object.freeze({runId:claims.run_id,runAttempt:claims.run_attempt,checkRunId:claims.check_run_id}));
   requireTrust(facts&&facts.runId===claims.run_id&&facts.runAttempt===claims.run_attempt&&facts.checkRunId===claims.check_run_id&&facts.sha===claims.sha&&facts.workflowSHA===claims.workflow_sha&&facts.jobName===trust.jobName&&facts.environment===trust.environment&&facts.status==='in_progress'&&facts.repositoryId===trust.repositoryId&&facts.ownerId===trust.ownerId,'JWT_JOB_CORRELATION');
   const capability=Object.freeze({runId:claims.run_id,runAttempt:claims.run_attempt,checkRunId:claims.check_run_id,codeSHA:claims.sha,jti:claims.jti,expiresAt:new Date(claims.exp*1000).toISOString()});verified.add(capability);return capability;
  }catch(e){if(e instanceof TrustError)throw e;throw new TrustError('OIDC_UNAVAILABLE')}},
  assert(capability){requireTrust(verified.has(capability)&&Date.parse(capability.expiresAt)>now(),'UNVERIFIED_MACHINE');return capability;}
 });
}

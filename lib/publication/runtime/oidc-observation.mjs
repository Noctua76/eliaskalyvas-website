// Observation only: signature-verified full-subject discovery cannot authorize
// a broker, register production policy or grant editorial/publication authority.
import {createOIDCVerifier,githubKeySource,TrustError,GITHUB_ISSUER} from './oidc.mjs';
import {parseContractJSON,hashJSON} from '../contract.mjs';
import {IMMUTABLE_REPOSITORY_PREFIX} from './delivery-policy.mjs';
const need=(v,c)=>{if(!v)throw new TrustError(c);};
export async function observeGithubOIDC(token,{expected,jobFacts,keySource=githubKeySource(),signEvidence,consumeObservation,now=Date.now}){
 need(expected?.purpose==='identity-observation-only'&&expected.issuer===GITHUB_ISSUER&&expected.repository==='Noctua76/eliaskalyvas-website'&&expected.repositoryId==='1389733212'&&expected.ownerId==='217035723'&&typeof signEvidence==='function'&&typeof consumeObservation==='function','OBSERVATION_PLAN_REQUIRED');
 need(typeof token==='string'&&token.length<20000&&token.split('.').length===3,'JWT_SHAPE');
 let claims,header;try{claims=parseContractJSON(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));header=parseContractJSON(Buffer.from(token.split('.')[0],'base64url').toString('utf8'));}catch{throw new TrustError('JWT_SHAPE');}
 need(typeof claims.sub==='string'&&claims.sub.startsWith(IMMUTABLE_REPOSITORY_PREFIX+':')&&!/[\s*]/.test(claims.sub),'OBSERVATION_SUBJECT');
 // The discovered subject is NOT an authorization allowlist. All independently
 // pinned identity facts still go through the approved cryptographic verifier.
 const candidate={...expected,subject:claims.sub};
 const verifier=createOIDCVerifier({policy:candidate,keySource,jobFacts,now});const capability=await verifier.verify(token);
 need(claims.repository_owner==='Noctua76'&&claims.sha===expected.codeSHA&&claims.workflow_sha===expected.callerSHA,'OBSERVATION_CALLER');
 need(await consumeObservation(capability),'OBSERVATION_REPLAY_OR_REVOKED');
 const fields=['iss','aud','sub','repository','repository_id','repository_owner','repository_owner_id','ref','ref_type','environment','workflow_ref','workflow_sha','job_workflow_ref','job_workflow_sha','run_id','run_attempt','check_run_id','sha','iat','nbf','exp'];
 const record={schema:'nyra.github.identity.observation.v1',purpose:'identity-observation-only',authorization:false,observedAt:new Date(now()).toISOString(),claims:Object.fromEntries(fields.map(k=>[k,claims[k]])),issuerKeyId:header.kid,tokenSHA256:hashJSON(token),planSHA256:hashJSON(expected)};
 return signEvidence(record);
}

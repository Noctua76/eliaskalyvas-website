import {releaseFixture,manifestFixture,eventFixture,uid} from './publication-v1.1.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
export const CLOCK='2026-10-27T12:00:00.000Z';
export function queuedFixture(){
 const baseline={manifest:manifestFixture([]),releases:[]},release=releaseFixture(),event=eventFixture('publish',baseline,{fresh:release});
 const intent={decision_id:uid(7000),decision_authorization_id:event.authorization_id,approved_payload_sha256:release.authorization.approved_payload_sha256,human_approved_at:release.authorization.human_approved_at,publication_authorized_at:release.authorization.publication_authorized_at,event,release,target_snapshot:null};
 return {baseline,history:[],intents:[intent],now:CLOCK};
}
export function receiptFor(candidate,{now=CLOCK,attempt=uid(7100)}={}){
 const m=candidate.dataset.manifest;return {schema_version:'nyra.publication.receipt.v1.1',id:uid(7101),attempt_id:attempt,manifest_id:m.manifest_id,generation:m.generation,manifest_sha256:hashJSON(m),code_sha:'a'.repeat(40),github_run_id:'100',github_run_attempt:1,github_deployment_id:'200',status:'released_verified',deployment_requested_at:now,deployment_completed_at:now,verified_live_at:now,observed_manifest_sha256:hashJSON(m)};
}
export const policy={issuer:'https://token.actions.githubusercontent.com',audience:'urn:nyra:synthetic-export',repositoryId:'123',ownerId:'456',repository:'test/repo',ref:'refs/heads/main',subject:'repo:test/repo:environment:nyra-export',environment:'nyra-export',workflowRef:'test/repo/.github/workflows/future.yml@refs/heads/main',jobWorkflowRef:'test/repo/.github/workflows/future-export.yml@'+'b'.repeat(40),jobWorkflowSHA:'b'.repeat(40),jobName:'export / trusted',events:['workflow_dispatch']};
export async function signedOIDC(){
 const keys=await crypto.subtle.generateKey({name:'RSASSA-PKCS1-v1_5',modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:'SHA-256'},true,['sign','verify']);
 const jwk={...await crypto.subtle.exportKey('jwk',keys.publicKey),kid:'synthetic',alg:'RS256',use:'sig'};
 const seconds=Math.floor(Date.parse(CLOCK)/1000);
 const claims={iss:policy.issuer,aud:policy.audience,sub:policy.subject,repository_id:policy.repositoryId,repository_owner_id:policy.ownerId,repository:policy.repository,ref:policy.ref,ref_type:'branch',environment:policy.environment,workflow_ref:policy.workflowRef,workflow_sha:'a'.repeat(40),job_workflow_ref:policy.jobWorkflowRef,job_workflow_sha:policy.jobWorkflowSHA,event_name:'workflow_dispatch',runner_environment:'github-hosted',run_id:'100',run_attempt:'1',check_run_id:'300',sha:'a'.repeat(40),jti:'synthetic-token-001',iat:seconds,nbf:seconds,exp:seconds+300};
 const encode=v=>Buffer.from(typeof v==='string'?v:JSON.stringify(v)).toString('base64url');
 const sign=async(patch={},header={})=>{const h=encode({alg:'RS256',typ:'JWT',kid:'synthetic',...header}),p=encode({...claims,...patch}),signature=await crypto.subtle.sign('RSASSA-PKCS1-v1_5',keys.privateKey,new TextEncoder().encode(h+'.'+p));return h+'.'+p+'.'+Buffer.from(signature).toString('base64url')};
 const facts={runId:'100',runAttempt:'1',checkRunId:'300',sha:'a'.repeat(40),workflowSHA:'a'.repeat(40),jobName:policy.jobName,environment:policy.environment,status:'in_progress',repositoryId:policy.repositoryId,ownerId:policy.ownerId};
 return {claims,sign,jwk,facts};
}

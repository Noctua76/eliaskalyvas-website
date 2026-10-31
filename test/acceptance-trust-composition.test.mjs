import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash,webcrypto} from 'node:crypto';
import {canonicalize} from '../lib/publication/canonical-json.mjs';
import {composeTrustAcceptance,verifyPinnedObservation} from '../ops/acceptance-bootstrap/compose-trust.mjs';

const origin='https://nyra-5c.eliaskalyvas.gr';
const root='https://api.github.com/repos/Noctua76/eliaskalyvas-website';
const list=root+'/actions/workflows/nyra-live-trust-acceptance.yml/runs?event=workflow_dispatch&branch=main&per_page=100';
const caller='a'.repeat(40),roles=['build','inspection','publication'];
const now=Date.parse('2026-10-31T20:00:00Z');
const starts=new Date(now-30000).toISOString();
const ends=new Date(now+300000).toISOString();
const job=(role,i)=>({id:401+i,run_id:101,run_attempt:1,
 head_sha:caller,name:'exact-'+role,status:'in_progress',
 check_run_url:root+'/check-runs/'+(500+i)});
const githubRun=()=>({id:101,run_attempt:1,
 path:'.github/workflows/nyra-live-trust-acceptance.yml',
 event:'workflow_dispatch',head_branch:'main',head_sha:caller,
 repository:{id:1389733212,full_name:'Noctua76/eliaskalyvas-website',owner:{id:217035723}},
 head_repository:{id:1389733212},
 actor:{id:217035723},triggering_actor:{id:217035723},
 created_at:new Date(now).toISOString(),status:'in_progress',conclusion:null});
async function fixture({enabled=true,signMode='valid'}={}){
 const keys=await webcrypto.subtle.generateKey('Ed25519',true,['sign','verify']);
 let dispatched=false,owner=true,admin=true,persisted=[];
 const policies=Object.fromEntries(roles.map(role=>[role,{
  role,jobName:'exact-'+role,environment:'nyra-'+role,
  repository:'Noctua76/eliaskalyvas-website',ownerId:'217035723',callerSHA:caller
 }]));
 const getJSON=async url=>{
  if(url===list)return {total_count:dispatched?1:0,workflow_runs:dispatched?[githubRun()]:[]};
  if(url===root+'/actions/runs/101')return githubRun();
  if(url===root+'/actions/runs/101/attempts/1/jobs?per_page=100')
   return {total_count:3,jobs:roles.map(job)};
  throw Error('DISALLOWED_API_ROUTE');
 };
 const registrars=Object.fromEntries(roles.map((role,i)=>[role,{
  register:async selector=>({...selector,checkRunId:String(500+i)}),
  revoke:async()=>{}
 }]));
 const observation=async role=>{
  const claims={iss:'https://token.actions.githubusercontent.com',
   repository:'Noctua76/eliaskalyvas-website',repository_id:'1389733212',
   repository_owner_id:'217035723',environment:signMode==='wrong-environment'?'nyra-owner':'nyra-'+role,
   sha:caller,ref:'refs/heads/main',
   run_id:'101',run_attempt:'1',check_run_id:signMode==='wrong-check'?'999':String(500+roles.indexOf(role)),
   exp:Math.floor((now+120000)/1000)};
  const record={schema:'nyra.github.identity.observation.v1',
   purpose:'identity-observation-only',authorization:false,
   observedAt:new Date(signMode==='stale'?now-120000:now).toISOString(),
   claims,issuerKeyId:'github-oidc-kid',tokenSHA256:'b'.repeat(64),
   planSHA256:'c'.repeat(64)};
  const digest=createHash('sha256').update(canonicalize(record),'utf8').digest('hex');
  const signature=Buffer.from(await webcrypto.subtle.sign('Ed25519',
   keys.privateKey,new TextEncoder().encode(digest))).toString('base64url');
  return {record,digest,keyId:'pinned-collector',signature:
   signMode==='tamper'?Buffer.alloc(64,0).toString('base64url'):signature};
 };
 const brokers=Object.fromEntries(roles.map(role=>[role,async()=>observation(role)]));
 const composed=composeTrustAcceptance({
  getJSON,registrars,policies,assertAdministration:async()=>admin,
  assertOwnerDecision:async()=>owner,brokerAcceptors:brokers,
  persistSignedEvidence:async receipt=>{persisted.push(receipt);return true;},
  evidencePublicKey:keys.publicKey,evidenceKeyId:'pinned-collector',
  callerSHA:caller,windowStartsAt:starts,windowEndsAt:ends,
  enabled,now:()=>now
 });
 return {composed,dispatch:()=>{dispatched=true},denyOwner:()=>{owner=false},
  denyAdmin:()=>{admin=false},persisted,keys,observation,policies};
}
const request=()=>new Request(origin+'/acceptance/build',{
 method:'POST',headers:{Authorization:'Bearer signed-test-transport-token'},body:'{}'
});
test('Host trust composition is inactive by default and never starts a public listener',async()=>{
 const f=await fixture({enabled:false});
 assert.equal(f.composed.listenerStarted,false);
 assert.equal(f.composed.dispatchesPerformed,0);
 assert.equal((await f.composed.ingress(request())).status,503);
 assert.equal(f.persisted.length,0);
});
test('Signed observation is accepted only after independent owner/admin gates and exact job readiness',async()=>{
 const f=await fixture();await f.composed.watcher.arm();f.dispatch();
 await f.composed.watcher.scan();
 const response=await f.composed.ingress(request());
 assert.equal(response.status,200);
 const body=await response.json();assert.equal(body.accepted,true);
 assert.equal(body.keyId,'pinned-collector');assert.match(body.digest,/^[a-f0-9]{64}$/);
 assert.equal(f.persisted.length,1);assert.equal(f.persisted[0].role,'build');
 assert.equal(f.persisted[0].coordinates.checkRunId,'500');
 assert.equal(f.persisted[0].envelope.record.authorization,false);
 assert(!JSON.stringify(f.persisted).includes('signed-test-transport-token'));
});
test('Owner denial prevents arming and prevents acceptance with no evidence writes',async()=>{
 const f=await fixture();f.denyOwner();
 await assert.rejects(f.composed.watcher.arm(),/NYRA_COMPOSITION_OWNER_GATE/);
 assert.equal((await f.composed.ingress(request())).status,403);
 assert.equal(f.persisted.length,0);
});
test('Administrative revocation after registration rejects an otherwise correctly signed receipt',async()=>{
 const f=await fixture();await f.composed.watcher.arm();f.dispatch();
 await f.composed.watcher.scan();f.denyAdmin();
 assert.equal((await f.composed.ingress(request())).status,403);
 assert.equal(f.persisted.length,0);
});
for(const signMode of ['tamper','wrong-environment','wrong-check','stale'])
 test('Signed receipt fail-closed: '+signMode,async()=>{
  const f=await fixture({signMode});await f.composed.watcher.arm();
  f.dispatch();await f.composed.watcher.scan();
  assert.equal((await f.composed.ingress(request())).status,403);
  assert.equal(f.persisted.length,0);
 });
test('Rejects unsigned or unbound broker policy wiring',async()=>{
 const f=await fixture();
 const signed=await f.observation('build');
 await assert.rejects(verifyPinnedObservation(signed,{
  publicKey:f.keys.publicKey,keyId:'incorrect-key',
  policy:f.policies.build,now:()=>now
 }),/NYRA_COMPOSITION_ENVELOPE/);
});

test('Reusing the same signed observation is rejected after first persistence',async()=>{
 const f=await fixture();await f.composed.watcher.arm();f.dispatch();
 await f.composed.watcher.scan();
 assert.equal((await f.composed.ingress(request())).status,200);
 assert.equal((await f.composed.ingress(request())).status,403);
 assert.equal(f.persisted.length,1);
});

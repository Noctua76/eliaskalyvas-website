import test from 'node:test';
import assert from 'node:assert/strict';
import {repositoryTrustFixture} from './fixtures/repository-trust.mjs';
import {hashJSON} from '../lib/publication/contract.mjs';
import {createRepositoryTrustGate} from '../lib/publication/runtime/repository-trust.mjs';
import {validateRepositoryTrust} from '../lib/publication/runtime/repository-policy.mjs';
import {readRepositoryAdministration,administrationGate} from '../lib/publication/runtime/administration-evidence.mjs';
import {reviewedIntegrationPolicy} from '../lib/publication/integration/policy.mjs';
import {bindRepositoryControlPlane} from '../runtime/nyra-edge/repository-binding.mjs';
import {evidenceSigner} from '../lib/publication/runtime/acceptance-evidence.mjs';
const root='https://api.github.com/repos/Noctua76/eliaskalyvas-website';
test('Repository scope accepts explicit unknown rights with signed owner/MFA decision; never asserts complete inventory or production acceptance',async()=>{
 const f=await repositoryTrustFixture();for(const role of ['build','inspection','publication'])assert.equal(await f.gate.assert(f.policies[role],'identity'),true);
 assert.equal(f.configuration.repositoryTrust.inventoryComplete,false);assert.equal(f.configuration.repositoryTrust.exclusiveTechnicalOwnerControl,'NOT_PROVEN');assert.equal(f.configuration.repositoryTrust.knownAuthorities[0].permissions.contents,'unknown');
 assert(!Object.hasOwn(f.decision,'applicationsSHA256'));assert.equal((await f.journal.current()).schema,'nyra.owner-repository-risk-decision.v1');
});
for(const [name,change]of [
 ['complete account claim',t=>t.inventoryComplete=true],['unknown omission',t=>t.unknownExternalRights.pop()],['owner-exclusive claim',t=>t.exclusiveTechnicalOwnerControl=true],['missing permission',t=>delete t.knownAuthorities[0].permissions.contents],['caller approval',t=>t.productionAuthorized=true],['wrong repository',t=>t.repositoryId='1']
])test('Repository configuration rejects '+name,async()=>{const f=await repositoryTrustFixture(),c=structuredClone(f.configuration);change(c.repositoryTrust);assert.throws(()=>reviewedIntegrationPolicy(c,'build'));});
for(const [name,change]of [
 ['source pin',c=>c.repositoryTrust.sourceSHA='c'.repeat(40)],['identity pin',c=>c.identities.build.subject+='-wrong'],['configuration bytes',c=>c.repositoryTrust.configurationSHA256='4'.repeat(64)],['known permission',c=>c.repositoryTrust.knownAuthorities[0].permissions.contents='write'],['policy version',c=>c.repositoryTrust.version++]]
)test('Policy digest changes invalidate old authorization: '+name,async()=>{const f=await repositoryTrustFixture(),c=structuredClone(f.configuration);change(c);if(['source pin','identity pin'].includes(name))assert.throws(()=>reviewedIntegrationPolicy(c,'build'));else{const p=reviewedIntegrationPolicy(c,'build');assert.notEqual(hashJSON(p),hashJSON(f.policies.build));await assert.rejects(f.gate.assert(p),'Old receipt must not authorize a different policy');}});
for(const [name,change]of [
 ['admin bypass',d=>d['/branches/main/protection'].enforce_admins.enabled=false],['force push',d=>d['/branches/main/protection'].allow_force_pushes.enabled=true],['deletion',d=>d['/branches/main/protection'].allow_deletions.enabled=true],['check app',d=>d['/branches/main/protection'].required_status_checks.checks[0].app_id=1],['environment secret',d=>d['/environments/nyra-build/secrets?per_page=100']={total_count:1,secrets:[{name:'UNIT_SECRET_MUST_NOT_BE_REPORTED'}]}],['environment tag',d=>d['/environments/nyra-build/deployment-branch-policies?per_page=100'].branch_policies[0].type='tag'],['API unavailable',d=>delete d['/branches/main/protection']],['observed read permissions',d=>d[''].permissions={push:true,admin:true}]
])test('Changed or unavailable repository facts retire old authority: '+name,async()=>{let retired=0;const f=await repositoryTrustFixture({retire:async()=>{retired++;}});await f.gate.assert(f.policies.build);change(f.data);await assert.rejects(f.gate.assert(f.policies.build));assert.equal(retired,1);assert.throws(f.gate.assertActive,/RETIRED/);await assert.rejects(f.gate.assert(f.policies.publication));assert.equal(retired,1);});
for(const [name,change]of [
 ['unsigned',e=>delete e.signature],['old schema',e=>e.record.schema='nyra.owner-risk-decision.receipt.v1'],['wrong owner',e=>e.record.ownerId='1'],['wrong context',e=>e.record.repositoryTrustSHA256='4'.repeat(64)],['wrong role policy',e=>e.record.policySHA256='5'.repeat(64)],['wrong operation',e=>e.record.operation='delivery'],['wrong challenge',e=>e.record.challenge=crypto.randomUUID()],['retired',e=>e.record.state='retired'],['expired',e=>e.record.expiresAt='2000-01-01T00:00:00Z'],['unacknowledged unknown',e=>e.record.riskAcknowledgment.unknownExternalRights=false]
])test('Signed operation-bound owner receipt rejects '+name,async()=>{const f=await repositoryTrustFixture(),gate=createRepositoryTrustGate({...f.args,readOwnerRiskDecision:async a=>{let e=await f.source.receipt(a);change(e);if(name!=='unsigned')e=await f.sign(e.record);return e;}});await assert.rejects(gate.assert(f.policies.build));assert.throws(gate.assertActive);});
test('Owner receipt source denies missing explicit risk acknowledgment, non-owner/MFA, caller SHA and unsupported operation; retirement wins',async()=>{
 const f=await repositoryTrustFixture();await assert.rejects(f.source.authorize({...f.authorization,token:'CALLER_FLAG'}));await assert.rejects(f.source.authorize({...f.authorization,riskAcknowledgment:{write:true,merge:true,workflow:true}}));
 await assert.rejects(f.source.authorize({...f.authorization,repositoryTrustSHA256:'e'.repeat(40)}));
 await assert.rejects(f.source.receipt({decisionId:f.decision.decisionId,challenge:crypto.randomUUID(),policySHA256:hashJSON(f.policies.build),operation:'publish-arbitrary-article'}));
 await f.source.retire({token:'UNIT_OWNER_AAL2',decisionId:f.decision.decisionId});await assert.rejects(f.gate.assert(f.policies.build));
});
test('Unavailable source, replayed receipt, revoked owner session and unconfirmed SQL retirement remain closed',async()=>{
 for(const mode of ['unavailable','replay','revoked','retirement-failed']){const f=await repositoryTrustFixture();let saved;
  const gate=createRepositoryTrustGate({...f.args,readOwnerRiskDecision:async a=>{if(mode==='unavailable')throw Error('OFFLINE');if(mode==='replay'&&saved)return saved;return saved=await f.source.receipt(a);},retire:async()=>{if(mode==='retirement-failed')throw Error('SQL_OFFLINE');}});
  if(mode==='revoked')f.revokeOwner();if(mode==='replay')await gate.assert(f.policies.build);if(mode==='retirement-failed')delete f.data['/branches/main/protection'];await assert.rejects(gate.assert(f.policies.build));assert.throws(gate.assertActive);
 }
});
test('Legacy full-account gate cannot accept a repo-scoped policy, nor can its receipt schema authorize the repository gate',async()=>{
 const f=await repositoryTrustFixture(),legacy=administrationGate({readEvidence:async()=>{throw Error('MUST_NOT_READ');},acceptedApplicationsSHA256:'a'.repeat(64),ownerRiskDecisionId:f.decision.decisionId,readOwnerRiskDecision:f.source.receipt,ownerDecisionPublicKey:f.keys.publicKey,ownerDecisionKeyId:'unit-owner'});
 await assert.rejects(legacy(f.policies.build),/OWNER_RISK_POLICY/);
 const c=structuredClone(f.configuration);c.identities.build.repositoryTrust=c.repositoryTrust;assert.throws(()=>reviewedIntegrationPolicy(c,'build'),/GOVERNANCE_SOURCE/);
});
test('Administration fingerprint ignores ordinary repository activity, detects snapshot inconsistency and never returns secret names',async()=>{
 const f=await repositoryTrustFixture();f.data[''].open_issues_count=123;f.data[''].updated_at=new Date().toISOString();assert.equal((await readRepositoryAdministration({getJSON:f.getJSON,governance:f.configuration.governance})).record.protectionsSHA256,f.administration.record.protectionsSHA256);
 let count=0;await assert.rejects(readRepositoryAdministration({governance:f.configuration.governance,getJSON:async url=>{const v=await f.getJSON(url);if(url.endsWith('/protection')&&++count===2)v.restrictions={users:[],teams:[],apps:[]};return v;}}));
});
test('Concrete binding reads only independent authenticated API, validates signed retirement and invalidates policy state synchronously',async()=>{
 const f=await repositoryTrustFixture(),keys=f.retirementKeys,sign=evidenceSigner({privateKey:keys.privateKey,publicKeyId:'unit-retirement'});let retired=0;
 const binding=bindRepositoryControlPlane({configuration:f.configuration,adminTokenSource:async()=> 'UNIT_ADMIN_READ_ONLY',fetcher:async(url,o)=>{assert.equal(o.method,'GET');assert.equal(o.redirect,'error');assert.equal(o.headers.Authorization,'Bearer UNIT_ADMIN_READ_ONLY');return Response.json(await f.getJSON(url));},readOwnerRiskDecision:f.source.receipt,ownerRiskDecisionId:f.decision.decisionId,ownerDecisionPublicJWK:f.ownerPublicJWK,ownerDecisionKeyId:'unit-owner',readPolicyState:role=>f.states[role],invalidatePolicyState:hashes=>{for(const r of Object.keys(f.states))if(hashes.includes(f.states[r]?.policySHA256))f.states[r]=null;},retirementPublicJWK:f.retirementPublicJWK,retirementKeyId:'unit-retirement',retireRegistrations:async pins=>{retired++;return sign({schema:'nyra.repository.retirement.v1',challenge:pins.challenge,repositoryTrustSHA256:pins.repositoryTrustSHA256,activeRegistrations:0,policiesSHA256:hashJSON(f.policies),observedAt:new Date().toISOString()});}});
 assert.equal(await binding.assertTrustReady(),true);assert(binding.readPolicyState('build'));f.states.build=null;await assert.rejects(binding.assertOperation('build','registration'));assert.equal(retired,1);assert.throws(()=>binding.readPolicyState('publication'),/RETIRED/);
});

test('A shared signer under different key IDs cannot satisfy pinned independent public keys',async()=>{
 const f=await repositoryTrustFixture();assert.throws(()=>bindRepositoryControlPlane({configuration:f.configuration,adminTokenSource:async()=> 'UNIT_ONLY',readOwnerRiskDecision:f.source.receipt,ownerRiskDecisionId:f.decision.decisionId,ownerDecisionPublicJWK:f.ownerPublicJWK,ownerDecisionKeyId:'unit-owner',readPolicyState:role=>f.states[role],invalidatePolicyState:hashes=>{for(const r of Object.keys(f.states))if(hashes.includes(f.states[r]?.policySHA256))f.states[r]=null;},retirementPublicJWK:f.ownerPublicJWK,retirementKeyId:'unit-retirement',retireRegistrations:async()=>{}}),/BINDING/);
});
test('Scoped registrar/broker require the real gate hooks and deny legacy-policy normal inventory consumption',async()=>{
 const {composeJobRegistrar,composeIdentityBroker}=await import('../lib/publication/integration/protected-composition.mjs');const f=await repositoryTrustFixture();
 const args={configuration:f.configuration,privilege:'build',getJSON:f.getJSON,readPolicyState:()=>f.states.build};
 assert.throws(()=>composeJobRegistrar({...args,registrarQuery:async()=>{}}),/REPOSITORY_BINDING/);assert.throws(()=>composeIdentityBroker({...args,brokerQuery:async()=>{},keySource:async()=>{}}),/REPOSITORY_BINDING/);
 const record={schema_version:'nyra.normal.provenance.v1',inventory:{schema_version:'nyra.public.paths.v1',codeSHA:'a'.repeat(40),configurationSHA256:'1'.repeat(64),paths:['index.html']},builder:{privilege:'build',codeSHA:'a'.repeat(40),workflowSHA:'a'.repeat(40),jobWorkflowSHA:'b'.repeat(40),assurance:'protected_oidc',governance:f.configuration.governance,policySHA256:'9'.repeat(64)},files:[{path:'index.html',sha256:'2'.repeat(64),bytes:1}]};
 const broker=composeIdentityBroker({...args,privilege:'publication',readPolicyState:()=>f.states.publication,brokerQuery:async()=>({rows:[{record,digest:hashJSON(record)}]}),keySource:async()=>{},assertTrustActive:f.gate.assertActive,assertAdministration:(p,op)=>f.gate.assert(p,op)});
 assert.throws(()=>broker.inventoryAuthority('2'.repeat(64)),/CONFIGURATION/);const authority=broker.inventoryAuthority('1'.repeat(64));await assert.rejects(authority.forAttempt({codeSHA:'a'.repeat(40)}),/TRUST_POLICY/);
 record.builder.policySHA256=hashJSON(f.policies.build);assert.equal((await authority.forAttempt({codeSHA:'a'.repeat(40)})).codeSHA,'a'.repeat(40));
});


test('Private policy-state retirement atomically closes every matching role, preserves newer policy and refuses symlinks',async()=>{
 const {mkdtemp,writeFile,readFile,rm,symlink}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const {retirePolicyState}=await import('../ops/acceptance-bootstrap/retire-policy-state.mjs');
 const dir=await mkdtemp(join(tmpdir(),'nyra-policy-state-')),path=join(dir,'state.json'),hashes=['1','2','3'].map(x=>x.repeat(64));try{
  await writeFile(path,JSON.stringify({build:{policySHA256:hashes[0]},inspection:{policySHA256:hashes[1]},publication:{policySHA256:'4'.repeat(64)}}),{mode:0o600});
  retirePolicyState({path,policySHA256s:hashes});const state=JSON.parse(await readFile(path));assert.equal(state.build,null);assert.equal(state.inspection,null);assert.equal(state.publication.policySHA256,'4'.repeat(64));
  await symlink(path,join(dir,'alias'));assert.throws(()=>retirePolicyState({path:join(dir,'alias'),policySHA256s:hashes}),/STATE_FILE/);assert.equal(JSON.parse(await readFile(path)).publication.policySHA256,'4'.repeat(64));
 }finally{await rm(dir,{recursive:true,force:true});}
});

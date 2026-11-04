import test from 'node:test';import assert from 'node:assert/strict';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';import {execFileSync,spawnSync} from 'node:child_process';import {tmpdir} from 'node:os';import {join,resolve,dirname} from 'node:path';
import {BASE,OLD,END,HOST,hashJSON,reviewedInventory,migrationPlan,commitReceipt,expiryDecision,recoveryDecision,renderUnits,dbValiditySQL,retireGenerations,proposeConfiguration,sha} from '../ops/acceptance-bootstrap/extension-20261105.mjs';
import {validateReplacementTarget,validateAcceptanceWindow,expiryTimerForTarget,cleanupTargetLineage,validateExtensionReceipt} from '../ops/acceptance-bootstrap/replacement-target.mjs';
import {ownerProcessLifetime} from '../ops/acceptance-bootstrap/owner-source.mjs';
import {createLiveWatcher} from '../ops/acceptance-bootstrap/live-watcher.mjs';
import {cleanupByDigests} from '../ops/acceptance-bootstrap/cleanup.mjs';
import {hashJSON as contractHash} from '../lib/publication/contract.mjs';
import {repositoryTrustFixture} from './fixtures/repository-trust.mjs';
import {reviewedAcceptancePolicies} from '../lib/publication/integration/live-acceptance.mjs';
const now=Date.parse('2026-11-04T19:00:00Z'),hex=n=>String(n).repeat(64),source='e'.repeat(40);
const target=expiresAt=>({schema:'nyra.acceptance.replacement.v1',...HOST,expiresAt,provider:'DigitalOcean',region:'fra1',operatorCIDRs:['203.0.113.10/32'],cpu:4,memoryGiB:8,maximumHours:24,optionalResources:false,reviewedHead:'1dbeb46c4ad7ac39dfc313bf47361bf2868e50ee',authorization:false});
const approval=()=>({newSourceSHA:source,ownerReviewSHA256:hex(3),dbCredentialApprovalSHA256:hex(4)});
const inventory=()=>({schema:'nyra.acceptance.extension.inventory.v1',hostname:HOST.hostname,resourceId:HOST.resourceId,ipv4:HOST.ipv4,observedAt:new Date(now).toISOString(),deadline:OLD,sourceSHA:BASE,sourceClean:true,stagedCount:57,stagedMatch:true,oldTargetSHA256:hashJSON(target(OLD)),newTargetSHA256:hashJSON(target(END)),oldTimer:{active:true,enabled:true,persistent:true,deadline:OLD,nextTrigger:OLD,unitSHA256:hex(1),cleanupSHA256:hex(2)},cleanupStarted:false,runtimeInactive:true,ownerInactive:true,liveRoleContainers:0,policyStateAbsent:true,runtimeArtifactsAbsent:true,extensionAttemptAbsent:true,activeRegistrations:0,databasePreserved:true,databaseRoleAttributesSafe:true,databaseTargetSHA256:hashJSON(target(OLD)),networkTargetSHA256:hashJSON(target(OLD)),networkInternal:true,publicDatabasePorts:0,firewallVerified:true,providerIdentityVerified:true,legacyDestructiveTimersAbsent:true,databaseRoles:{nyra_accept_registrar:OLD,nyra_accept_broker:OLD},immutableInventorySHA256:hex(5)});
const plan=()=>migrationPlan(inventory(),approval(),now);
const proof=e=>({planSHA256:e.digest,generation:2,sourceSHA:source,targetSHA256:e.plan.newTargetSHA256,launchSHA256:hex(6),ownerSourceSHA256:hex(7),reviewedInputSHA256:hex(8),unitPinsSHA256:hex(9),attemptReserved:true,commitAlreadyExists:false,sourceClean:true,stagedCount:57,stagedMatch:true,immutableInventorySHA256:hex(5),oldEnforcementArmed:true,newEnforcementVerified:true,newTimerNextTrigger:END,newTimerPersistent:true,databaseRolesMatch:true,rolesAndOwnerInactive:true,policyStateAbsent:true,activeRegistrations:0,providerIdentityVerified:true,collectorCompatible:true});
const observation=r=>({sourceSHA:r.sourceSHA,targetSHA256:r.targetSHA256,launchSHA256:r.launchSHA256,ownerSourceSHA256:r.ownerSourceSHA256,reviewedInputSHA256:r.reviewedInputSHA256,unitPinsSHA256:r.unitPinsSHA256,newTimerActive:true,newTimerEnabled:true,newTimerPersistent:true,newTimerNextTrigger:END,newUnitPinsMatch:true});

test('recognizes only original and exactly +24h target; unrelated hosts and timestamp rewrites reject',()=>{
 for(const end of [OLD,END])assert.equal(validateReplacementTarget(target(end),{created:true,now:()=>now}).authorization,false);
 for(const patch of [{expiresAt:'2026-11-05T21:05:01Z'},{expiresAt:'2026-11-06T21:05:00Z'},{resourceId:'615221105'},{ipv4:'139.59.136.220'},{bootstrapId:'nyra-other-test'},{hostname:'nyra-other-test'},{createdAt:'2026-11-03T21:06:46Z'},{origin:'https://other.eliaskalyvas.gr'},{maximumHours:72}])assert.throws(()=>validateReplacementTarget({...target(END),...patch},{created:true,now:()=>now}));
 assert.throws(()=>validateReplacementTarget(target(END),{created:true,now:()=>Date.parse(END)}));assert.equal(expiryTimerForTarget(target(OLD)),'nyra-repository-expiry.timer');assert.equal(expiryTimerForTarget(target(END)),'nyra-repository-extension-expiry.timer');
});
test('watcher preserves true creation time and exact-target exception; ordinary 24h limit unchanged',()=>{
 for(const end of [OLD,END])assert.equal(validateAcceptanceWindow({acceptanceTarget:target(end),windowStartsAt:HOST.createdAt,windowEndsAt:end,now:()=>now}).start,Date.parse(HOST.createdAt));
 assert.throws(()=>validateAcceptanceWindow({windowStartsAt:HOST.createdAt,windowEndsAt:END}));assert.throws(()=>validateAcceptanceWindow({acceptanceTarget:target(END),windowStartsAt:'2026-11-04T21:05:00Z',windowEndsAt:END,now:()=>now}));
 const policies=Object.fromEntries(['build','inspection','publication'].map(r=>[r,{jobName:r,repository:'Noctua76/eliaskalyvas-website',ownerId:'217035723',callerSHA:source}])),registrars=Object.fromEntries(Object.keys(policies).map(r=>[r,{register:async()=>{},revoke:async()=>{}}]));
 const w=createLiveWatcher({getJSON:async()=>({total_count:0,workflow_runs:[]}),registrars,policies,assertAdministration:async()=>{},callerSHA:source,windowStartsAt:HOST.createdAt,windowEndsAt:END,acceptanceTarget:target(END),now:()=>now});assert.equal(w.state().authorization,false);
});
test('Owner process stays bounded to 24h; unrelated long windows remain rejected',()=>{
 const c={policy:{windowEndsAt:END},acceptanceTarget:target(END)};assert.equal(ownerProcessLifetime(c,{now:()=>now}),86400000);assert(ownerProcessLifetime(c,{now:()=>Date.parse(END)-3600000})===3600000);
 assert.throws(()=>ownerProcessLifetime({policy:{windowEndsAt:END}},{now:()=>now}));assert.throws(()=>ownerProcessLifetime(c,{now:()=>Date.parse(END)}));
});
test('plan requires fresh verified whole baseline and separate DB approval; partial/replay/cleanup closes',()=>{
 const e=plan();assert.equal(e.executionApproved,false);assert.equal(e.plan.authorization,false);assert.equal(Date.parse(e.plan.deadline)-Date.parse(e.plan.previousDeadline),86400000);
 for(const patch of [{resourceId:'wrong'},{sourceClean:false},{stagedMatch:false},{stagedCount:55},{cleanupStarted:true},{ownerInactive:false},{policyStateAbsent:false},{extensionAttemptAbsent:false},{activeRegistrations:1},{publicDatabasePorts:1},{databaseRoleAttributesSafe:false},{databaseTargetSHA256:hex(1)},{networkTargetSHA256:hex(1)},{providerIdentityVerified:false},{legacyDestructiveTimersAbsent:false},{observedAt:new Date(now-60000).toISOString()}])assert.throws(()=>migrationPlan({...inventory(),...patch},approval(),now));
 assert.throws(()=>migrationPlan(inventory(),{...approval(),dbCredentialApprovalSHA256:null},now));assert.throws(()=>migrationPlan(inventory(),approval(),Date.parse(OLD)-299999));
});
test('mixed generations, changed hashes, unverified replacement timer and replay cannot commit',()=>{
 const e=plan();for(const patch of [{generation:1},{targetSHA256:hex(1)},{sourceSHA:BASE},{immutableInventorySHA256:hex(2)},{oldEnforcementArmed:false},{newEnforcementVerified:false},{newTimerNextTrigger:OLD},{newTimerPersistent:false},{databaseRolesMatch:false},{rolesAndOwnerInactive:false},{collectorCompatible:false},{commitAlreadyExists:true},{attemptReserved:false}])assert.throws(()=>commitReceipt(e,{...proof(e),...patch},now));
 assert.throws(()=>commitReceipt(e,proof(e),Date.parse(OLD)));const bad=structuredClone(e);bad.plan.deadline='2026-11-06T21:05:00Z';assert.throws(()=>commitReceipt(bad,proof(e),now));
});
test('old enforcement remains until coherent commit; partial state retires old/new; reboot catch-up retires at new end',()=>{
 const e=plan(),r=commitReceipt(e,proof(e),now),o=observation(r);
 assert.equal(expiryDecision(e,null,{},now),'KEEP_ORIGINAL_DEADLINE');assert.equal(expiryDecision(e,r,o,Date.parse(OLD)),'NEW_DEADLINE_ENFORCED');
 for(const patch of [{sourceSHA:BASE},{targetSHA256:hex(1)},{launchSHA256:hex(1)},{ownerSourceSHA256:hex(1)},{reviewedInputSHA256:hex(1)},{unitPinsSHA256:hex(1)},{newTimerActive:false},{newTimerNextTrigger:OLD},{newUnitPinsMatch:false}])assert.equal(expiryDecision(e,r,{...o,...patch},Date.parse(OLD)),'RETIRE_BOTH_GENERATIONS');
 assert.equal(expiryDecision(e,null,o,Date.parse(OLD)),'RETIRE_BOTH_GENERATIONS');assert.equal(expiryDecision(e,r,o,Date.parse(END)),'RETIRE_BOTH_GENERATIONS');assert.equal(expiryDecision(e,r,o,Date.parse(END)+86400000),'RETIRE_BOTH_GENERATIONS');
 assert.match(recoveryDecision({oldFilesVerified:true,anyNewGeneration:false,cleanupStarted:false},Date.parse(OLD)),/NO_ROLLBACK/);assert.equal(recoveryDecision({cleanupStarted:true},now),'NO_RESOURCE_PRESERVATION_GUARANTEE');
});
test('fixed Persistent UTC units retain old timer and have no launch, disable, dispatch or renewal',()=>{
 const u=renderUnits({helperSHA256:hex(1),planFileSHA256:hex(2)});assert(u.timer.includes('OnCalendar=2026-11-05 21:05:00 UTC'));assert(u.timer.includes('Persistent=true'));assert(u.timer.includes('RandomizedDelaySec=0'));assert(u.service.includes('--enforce'));assert(!/disable|mask|workflow_dispatch|--apply|--issue/.test(JSON.stringify(u)));
});
test('DB validity proposal is exact two-role transactional change; no password/grant/schema/new database',()=>{
 const sql=dbValiditySQL(plan());assert(sql.includes('pg_advisory_xact_lock(615221104)'));assert(sql.includes(OLD)&&sql.includes(END));assert.equal((sql.match(/alter role /g)||[]).length,2);assert(!/password|create database|drop |grant |delete /i.test(sql));
});
test('retirement stops all old/new containers before any network; scope drift and early teardown reject',async()=>{
 const e=plan(),live=new Map([['old-container',e.plan.oldTargetSHA256],['new-container',e.plan.newTargetSHA256]]),calls=[];
 const execute=a=>{calls.push(a);if(a[0]==='ps'){if(a.includes('--filter')){const d=a.at(-1).split('=').at(-1);return [...live].filter(([,h])=>h===d).map(([n])=>n).join('\n');}return [...live.keys()].join('\n');}if(a[0]==='container')return JSON.stringify([{Config:{Labels:{'com.noctua.nyra.acceptance':live.get(a[2])}}}]);if(a[0]==='rm'){live.delete(a[2]);return '';}if(a[0]==='network'){assert.equal(live.size,0);return '';}return '';};
 const r=await retireGenerations(e,{execute,now:Date.parse(END)});assert.equal(r.providerDestroyed,false);assert.equal(r.removed.length,2);await assert.rejects(retireGenerations(e,{execute,now}));
 cleanupByDigests([e.plan.oldTargetSHA256,e.plan.newTargetSHA256],{execute:()=>'',apply:false});assert.equal(cleanupTargetLineage(target(END)).length,2);
 const fake=a=>a[0]==='ps'?'bad':a[0]==='container'?JSON.stringify([{Config:{Labels:{'com.noctua.nyra.acceptance':'0'.repeat(64)}}}]):'';await assert.rejects(retireGenerations(e,{execute:fake,now:Date.parse(END)}),/CLEANUP_SCOPE/);
});
test('configuration migration is proposed-only; keeps signers, governance, Auth and public configuration',async()=>{
 const f=await repositoryTrustFixture(),c=structuredClone(f.configuration);c.version='nyra.repository.acceptance.v1';c.acceptanceMode='discovery';delete c.acceptance;c.repositoryTrust.sourceSHA=BASE;
 for(const [r,p]of Object.entries(c.identities))Object.assign(p,{role:r,callerSHA:BASE,codeSHA:BASE,purpose:'identity-observation-only',subject:'urn:nyra:unapproved-subject-discovery',workflowRef:'Noctua76/eliaskalyvas-website/.github/workflows/nyra-live-trust-acceptance.yml@refs/heads/main',jobWorkflowSHA:'cefd1a402dcffd0b00f05f7d7539ba381120641e',jobWorkflowRef:'Noctua76/eliaskalyvas-website/.github/workflows/nyra-live-trust-probe.yml@cefd1a402dcffd0b00f05f7d7539ba381120641e',jobName:'acceptance / identity-'+r,audience:'urn:nyra:acceptance:'+r,events:['workflow_dispatch']});
 c.repositoryTrust.identitiesSHA256=hashJSON(c.identities);const pp=reviewedAcceptancePolicies(c),launch={target:target(OLD),configuration:c,policyStates:Object.fromEntries(Object.entries(pp).map(([r,p])=>[r,{mode:'SINGLE_OWNER',policyVersion:c.governance.policyVersion,ownerAuthorizationSHA:c.governance.ownerAuthorizationSHA,policySHA256:hashJSON(p)}]))},ownerSource={auth:{publicApiKey:'public-fixture',ownerAuthUserId:'fixture-auth-user'},policy:{ownerAuthUserId:'fixture-auth-user',windowEndsAt:OLD,repositoryTrust:c.repositoryTrust,allowedPolicySHA256s:Object.values(pp).map(hashJSON)}},input={sourceSHA:BASE,ownerAuth:ownerSource.auth,normalBuild:{vite:{unchanged:'public'}}};
 const original=hashJSON({launch,ownerSource,input});const r=proposeConfiguration({target:target(OLD),launch,ownerSource,input,newSourceSHA:source,inputFileSHA256:sha(Buffer.from(JSON.stringify(input,null,2)+'\n'))},{reviewedAcceptancePolicies});assert.equal(hashJSON({launch,ownerSource,input}),original);assert.equal(r.proposed.target.createdAt,HOST.createdAt);assert.equal(r.proposed.target.expiresAt,END);assert.equal(r.proposed.launch.configuration.repositoryTrust.version,c.repositoryTrust.version+1);assert.deepEqual(r.proposed.ownerSource.auth,ownerSource.auth);assert.equal(r.activePolicyState,false);assert.equal(r.keysGenerated,0);assert.equal(r.proposed.input.previousInputSHA256,sha(Buffer.from(JSON.stringify(input,null,2)+'\n')));
 validateExtensionReceipt(r.proposed.target,r.proposed.launch,{schema:'nyra.acceptance.extension.commit.v1',status:'COMMITTED',generation:2,authorization:false,previousDeadline:OLD,deadline:END,previousTargetSHA256:hashJSON(target(OLD)),targetSHA256:hashJSON(target(END)),launchSHA256:hashJSON(r.proposed.launch),sourceSHA:source,planSHA256:hex(1)});
 assert.equal(hashJSON(r.proposed.launch),contractHash(r.proposed.launch));
});
test('57-file closure is retained; approved personal-repository protection bytes are untouched',async()=>{
 const root=resolve(import.meta.dirname,'..'),seen=new Set();const visit=async p=>{if(seen.has(p))return;seen.add(p);const s=await readFile(root+'/'+p,'utf8');for(const m of s.matchAll(/^(?:import|export)[^;\n]*?from\s*['"]([^'"]+)['"]/gm))if(m[1].startsWith('.'))await visit(resolve(root,dirname(p),m[1]).slice(root.length+1));};
 for(const n of ['repository-db','repository-launch','repository-runtime','replacement-target','live-role-worker','fra1-runtime','fra1-launch'])await visit('ops/acceptance-bootstrap/'+n+'.mjs');await visit('ops/protected-delivery/schema.sql');for(const n of ['shared','release','manifest','event','receipt','dataset'])seen.add('contracts/nyra-publication/v1.1/'+n+'.schema.json');assert.equal(seen.size,57);assert(!seen.has('ops/acceptance-bootstrap/extension-20261105.mjs'));
 assert.equal(sha(await readFile(root+'/lib/publication/runtime/protected-identity.mjs')),'a4dcc7fd2963c4ea4e3f1fab586ddad5dc0baddcc20b55bc0888329cc3151054');
});
test('alignment pair tests execute in an isolated Python fixture; newer reviewed bytes cannot be downgraded',()=>{
 const script=String.raw`
import importlib.util,pathlib,tempfile,hashlib
p=pathlib.Path('ops/acceptance-bootstrap/runtime-align-29a73458.py');spec=importlib.util.spec_from_file_location('align',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with tempfile.TemporaryDirectory() as temp:
 base=pathlib.Path(temp);roots=[base/n for n in ['source','candidate','live']]
 files=['f'+str(i)+'.mjs' for i in range(57)];m.BEFORE={files[0]:m.sha(b'old0'),files[1]:m.sha(b'old1')};m.AFTER={files[0]:m.sha(b'new0'),files[1]:m.sha(b'new1')}
 for root in roots:
  root.mkdir()
  for n,f in enumerate(files):(root/f).write_bytes(('new'+str(n)).encode())
 for n in range(2):(roots[2]/files[n]).write_bytes(('old'+str(n)).encode())
 read=lambda p:p.read_bytes();rows=m.inspect(*roots,files,read=read);assert len(rows)==57
 (roots[2]/files[1]).write_bytes(b'newer-reviewed-extension')
 try:m.inspect(*roots,files,read=read);raise AssertionError('downgrade allowed')
 except RuntimeError as e:assert str(e)=='UNREVIEWED_OR_NEWER_RUNTIME_BYTES_STOP'
 (roots[1]/files[2]).write_bytes(b'candidate-tamper')
 try:m.inspect(*roots,files,read=read);raise AssertionError('candidate tamper')
 except RuntimeError as e:assert str(e)=='CANDIDATE_SOURCE_BYTES'
print('ALIGNMENT_FIXTURE_PASS')`;
 assert.match(execFileSync('python3',['-c',script],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}),/ALIGNMENT_FIXTURE_PASS/);
});
test('operator utility rejects unsupported modes and never dispatches on import',()=>{
 const r=spawnSync(process.execPath,['ops/acceptance-bootstrap/extension-20261105.mjs','--apply'],{encoding:'utf8'});assert.equal(r.status,1);assert.match(r.stderr,/CLOSED_NO_AUTOMATIC_RECOVERY/);
});

test('independent review is pinned to stable inventory and exact provider; observations stay historical',()=>{
 const raw=inventory();raw.providerIdentityVerified=false;raw.legacyDestructiveTimersAbsent=false;
 const {observedAt,...stable}=raw,review={schema:'nyra.acceptance.extension.independent-review.v1',inventoryContextSHA256:hashJSON(stable),ownerReviewSHA256:hex(3),provider:{resourceId:HOST.resourceId,hostname:HOST.hostname,ipv4:HOST.ipv4,authenticatedReadback:true,status:'active',evidenceSHA256:hex(1)},scheduledTasks:{completeReview:true,noEarlierDestructiveJob:true,evidenceSHA256:hex(2)}};
 const verified=reviewedInventory(raw,review,hex(3));assert.equal(verified.providerIdentityVerified,true);assert.equal(raw.providerIdentityVerified,false);
 assert.throws(()=>reviewedInventory({...raw,sourceClean:false},review,hex(3)));assert.throws(()=>reviewedInventory(raw,{...review,provider:{...review.provider,resourceId:'wrong'}},hex(3)));assert.throws(()=>reviewedInventory(raw,review,hex(4)));
});
test('actual two-file handover preserves archives and modes; interruption leaves attempt closed',()=>{
 const script=String.raw`
import importlib.util,pathlib,tempfile,os
from unittest.mock import patch
p=pathlib.Path('ops/acceptance-bootstrap/runtime-align-29a73458.py');spec=importlib.util.spec_from_file_location('align',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
for fail in [False,True]:
 with tempfile.TemporaryDirectory() as temp:
  base=pathlib.Path(temp);m.ROOT=base/'source';m.CAND=base/'candidate';m.LIVE=base/'live';m.ATTEMPT=base/'attempt';files=['f'+str(i)+'.mjs' for i in range(57)]
  m.BEFORE={files[0]:m.sha(b'old0'),files[1]:m.sha(b'old1')};m.AFTER={files[0]:m.sha(b'new0'),files[1]:m.sha(b'new1')}
  for root in [m.ROOT,m.CAND,m.LIVE]:
   root.mkdir()
   for n,f in enumerate(files):(root/f).write_bytes(('new'+str(n)).encode())
  for n in range(2):(m.LIVE/files[n]).write_bytes(('old'+str(n)).encode());(m.LIVE/files[n]).chmod(0o644)
  m.secure=lambda p,mode=None:p.read_bytes();rows=m.inspect(m.ROOT,m.CAND,m.LIVE,files,read=m.secure);context={'rows':rows,'immutable':{}};pin=m.digest(context);m.preflight=lambda:(context,pin,files)
  calls=[0]
  def guard():
   calls[0]+=1
   if fail and calls[0]==2:(m.LIVE/files[1]).write_bytes(b'unexpected-concurrent-source')
  m.guard=guard
  with patch.object(m.os,'readlink',side_effect=lambda p:'self' if 'self' in p else 'host'):
   if fail:
    try:m.apply(context,pin,files);raise AssertionError('partial allowed')
    except RuntimeError as e:assert str(e)=='CONCURRENT_RUNTIME_CHANGE'
    assert (m.ATTEMPT/'00-reserved.json').exists() and not (m.ATTEMPT/'40-complete.json').exists()
    assert (m.LIVE/files[0]).read_bytes()==b'new0' and (m.LIVE/files[1]).read_bytes()==b'unexpected-concurrent-source'
   else:
    result=m.apply(context,pin,files);assert result['credentialsIssued']==0 and result['dispatches']==0
    assert (m.ATTEMPT/'previous-0.mjs').read_bytes()==b'old0' and (m.ATTEMPT/'previous-1.mjs').read_bytes()==b'old1'
    assert all((m.LIVE/f).read_bytes()==(m.ROOT/f).read_bytes() for f in files)
    assert (m.LIVE/files[0]).stat().st_mode & 0o777==0o644
print('ATOMIC_PAIR_FIXTURE_PASS')`;
 assert.match(execFileSync('python3',['-c',script],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}}),/ATOMIC_PAIR_FIXTURE_PASS/);
});

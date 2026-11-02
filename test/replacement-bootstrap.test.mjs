import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {repositoryTrustFixture} from './fixtures/repository-trust.mjs';
import {validateReplacementTarget,assessReplacementHost} from '../ops/acceptance-bootstrap/replacement-target.mjs';
import {renderUbuntuSetup,replacementCaddy,mainAcceptanceBoundary} from '../ops/acceptance-bootstrap/offline-bootstrap.mjs';
import {reviewedAcceptancePolicies} from '../lib/publication/integration/live-acceptance.mjs';
import {reviewedIntegrationPolicy} from '../lib/publication/integration/policy.mjs';
import {replacementRoleArgs,cleanupReplacement} from '../ops/acceptance-bootstrap/repository-launch.mjs';
import {replacementDBCommands} from '../ops/acceptance-bootstrap/repository-db.mjs';
import {createRepositoryRuntime} from '../ops/acceptance-bootstrap/repository-runtime.mjs';
import {hashJSON} from '../lib/publication/contract.mjs';
const target=()=>({schema:'nyra.acceptance.replacement.v1',bootstrapId:'nyra-new-test-only',hostname:'nyra-repository-test',provider:'DigitalOcean',region:'fra1',origin:'https://nyra-acceptance.eliaskalyvas.gr',operatorCIDRs:['203.0.113.10/32'],cpu:4,memoryGiB:8,maximumHours:24,optionalResources:false,reviewedHead:'1dbeb46c4ad7ac39dfc313bf47361bf2868e50ee',resourceId:null,ipv4:null,createdAt:null,expiresAt:null,authorization:false});
const created=()=>({...target(),resourceId:'12345',ipv4:'93.184.216.34',createdAt:new Date(Date.now()-1000).toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString()});
async function scopedProbe(){const f=await repositoryTrustFixture(),c=structuredClone(f.configuration);c.version='nyra.repository.acceptance.v1';c.acceptanceMode='discovery';delete c.acceptance;
 for(const role of ['build','inspection','publication'])Object.assign(c.identities[role],{role,purpose:'identity-observation-only',codeSHA:c.repositoryTrust.sourceSHA,subject:'urn:nyra:unapproved-subject-discovery',workflowRef:'Noctua76/eliaskalyvas-website/.github/workflows/nyra-live-trust-acceptance.yml@refs/heads/main',jobWorkflowSHA:'cefd1a402dcffd0b00f05f7d7539ba381120641e',jobWorkflowRef:'Noctua76/eliaskalyvas-website/.github/workflows/nyra-live-trust-probe.yml@cefd1a402dcffd0b00f05f7d7539ba381120641e',jobName:'acceptance / identity-'+role,audience:'urn:nyra:acceptance:'+role,events:['workflow_dispatch']});
 c.repositoryTrust.identitiesSHA256=hashJSON(c.identities);return {f,c,policies:reviewedAcceptancePolicies(c)};}
test('Replacement planning accepts no preexisting resource and rejects retired host, origin, IP, wildcard SSH, missing pins and extended deadline',()=>{
 assert.equal(validateReplacementTarget(target()).authorization,false);for(const change of [t=>t.hostname='nyra-5c-acceptance',t=>t.origin='https://nyra-5c.eliaskalyvas.gr',t=>t.operatorCIDRs=['0.0.0.0/0'],t=>t.reviewedHead=null,t=>t.resourceId='123']){const t=target();change(t);assert.throws(()=>validateReplacementTarget(t));}
 assert.equal(validateReplacementTarget(created(),{created:true}).created,true);for(const change of [t=>t.ipv4='201.79.94.104',t=>t.ipv4='127.0.0.1',t=>t.expiresAt=new Date(Date.now()+90000000).toISOString(),t=>t.resourceId=null]){const t=created();change(t);assert.throws(()=>validateReplacementTarget(t,{created:true}));}
});
test('Actual replacement preflight denies stale credentials, wrong provider firewall, DNS/TLS, target IDs and prerequisite hash drift',()=>{
 const t=created(),firewall={resourceId:t.resourceId,defaultInbound:'deny',sshCIDRs:t.operatorCIDRs,publicTCP:[80,443],publicUDP:[]},facts={hostname:t.hostname,providerResourceId:t.resourceId,providerRegion:'fra1',publicIPv4:t.ipv4,os:'ubuntu:24.04:amd64',cpu:4,memoryGiB:8,freeDiskGiB:80,dnsAddresses:[t.ipv4],httpsStatus:404,tlsVerified:true,hostFirewall:firewall,providerFirewall:firewall,runningContainers:[],privateFiles:[],verifiedPrerequisitesSHA256:'1'.repeat(64),expectedPrerequisitesSHA256:'1'.repeat(64),timerEnabled:true,timerExpiresAt:t.expiresAt};
 assert.equal(assessReplacementHost(t,facts).hostPrerequisitesPassed,true);assert.equal(assessReplacementHost(t,facts).readyForCredentials,false);
 for(const change of [o=>o.privateFiles=['old-pat.json'],o=>o.providerFirewall={...firewall,sshCIDRs:['0.0.0.0/0']},o=>o.tlsVerified=false,o=>o.dnsAddresses=['201.79.94.104'],o=>o.providerResourceId='999',o=>o.verifiedPrerequisitesSHA256='2'.repeat(64)]){const o=structuredClone(facts);change(o);assert.equal(assessReplacementHost(t,o).hostPrerequisitesPassed,false);}
});
test('No-secret Ubuntu setup has pinned packages/images, no fallback install or billable calls; generated shells parse',async()=>{
 const lock=JSON.parse(await readFile(new URL('../ops/acceptance-bootstrap/prerequisites.lock.json',import.meta.url))),script=renderUbuntuSetup(target(),lock),dir=await mkdtemp(join(tmpdir(),'nyra-shell-'));
 try{const path=join(dir,'setup.sh');await writeFile(path,script);execFileSync('bash',['-n',path]);assert(script.includes('sha256sum --check --strict'));assert(script.includes('apt-get --no-download'));assert(script.includes('NYRA')&&script.includes('nyra-repository-expiry.timer'));assert(script.includes('cp -a runtime'));assert(!/doctl|api.digitalocean.com|github_pat_|sb_secret_|workflow_dispatch|POSTGRES_PASSWORD=/.test(script));for(const p of Object.values(lock))assert(script.includes(p.sha256));assert(script.includes('dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94'));}
 finally{await rm(dir,{recursive:true,force:true});}
});
test('Public ingress is exact target HTTPS with only readiness and three acceptance routes; disabled proxy has no private upstream',()=>{
 const disabled=replacementCaddy(target()),active=replacementCaddy(target(),{acceptance:true});assert(!disabled.includes('reverse_proxy'));assert(active.includes('nyra-acceptance.eliaskalyvas.gr'));assert(!active.includes('nyra-5c.eliaskalyvas.gr'));assert(active.includes('max_size 2B'));assert(!/log|\/owner|\/admin|5432|:3000/.test(active));assert(active.includes('path /acceptance/build /acceptance/inspection /acceptance/publication'));
});
test('Replacement workers have separate private credentials and shared read-only directory policy, no Docker socket or host admin secrets',()=>{
 const t=created();for(const role of ['registrar','broker']){const args=replacementRoleArgs(role,1001,1001,{target:t,policyGroupID:1002}),s=args.join(' ');assert(s.includes('com.noctua.nyra.acceptance='+hashJSON(t)));assert(s.includes('/var/lib/nyra-5c/policy,dst=/run/role/policy,readonly'));assert(!s.includes('/coordinator/')&&!s.includes('/owner/')&&!s.includes('docker.sock')&&!s.includes('--publish'));assert.equal(s.includes('evidence-key.json'),role==='broker');assert(!s.includes(role==='registrar'?'/broker/':'/registrar/'));}
 const args=replacementDBCommands(t);assert(args.network.includes('--internal'));assert(args.database.includes('--env-file'));assert(!args.database.includes('--publish'));
});
test('Replacement cleanup retains exact label and independent absence proof, including after deadline; provider destruction never claimed',()=>{
 const t=created();t.expiresAt=new Date(Date.now()-10).toISOString();const digest=hashJSON(t);let calls=0;
 const execute=args=>{if(args[0]==='container')return JSON.stringify([{Config:{Labels:{'com.noctua.nyra.acceptance':digest}}}]);if(args[0]==='rm')return '';if(args[0]==='ps')return ++calls<=2?'abc':'';return '';};
 assert.throws(()=>cleanupReplacement(t,{apply:true,execute}),/CLEANUP_REMAINS/);const result=cleanupReplacement(t,{execute:()=>'',apply:false});assert(result.manualRequired.some(x=>x.includes('provider Droplet')));assert.equal(result.apply,false);
});
test('Main boundary never equates Draft PR head or old-main discovery with reviewed PR26 acceptance',()=>{
 assert.equal(mainAcceptanceBoundary({bootstrapHead:'a'.repeat(40),mainSHA:'b'.repeat(40),approvedPublicPlan:true}).canAcceptPR26OnMain,false);assert.equal(mainAcceptanceBoundary({bootstrapHead:'a'.repeat(40),mainSHA:'a'.repeat(40)}).canAcceptPR26OnMain,false);assert.equal(mainAcceptanceBoundary({bootstrapHead:'a'.repeat(40),mainSHA:'a'.repeat(40),approvedPublicPlan:true}).dispatchAuthorized,false);
});
test('Discovery probe configuration cannot authorize operational publication or manufacture prior genuine acceptance',async()=>{
 const {c}=await scopedProbe();assert.equal(reviewedAcceptancePolicies(c).build.subject,'urn:nyra:unapproved-subject-discovery');assert.throws(()=>reviewedIntegrationPolicy(c,'build'));for(const change of [x=>x.identities.build.jobName='other',x=>x.identities.build.subject='repo:guessed',x=>x.acceptance={genuineProtectedOIDC:true}]){const bad=structuredClone(c);change(bad);bad.repositoryTrust.identitiesSHA256=hashJSON(bad.identities);assert.throws(()=>reviewedAcceptancePolicies(bad));}
});
test('Actual repository acceptance composition binds new target, independent GET reader and distinct pinned signers, never exposes editorial authorization',async()=>{
 const {f,c,policies}=await scopedProbe(),t=created();let retired=0;const state=Object.fromEntries(Object.entries(policies).map(([r,p])=>[r,{mode:'SINGLE_OWNER',policyVersion:p.governance.policyVersion,ownerAuthorizationSHA:p.governance.ownerAuthorizationSHA,policySHA256:hashJSON(p)}]));
 const runtime=await createRepositoryRuntime({config:{target:t,origin:t.origin,windowStartsAt:t.createdAt,windowEndsAt:t.expiresAt,callerSHA:c.repositoryTrust.sourceSHA,configuration:c,ownerDecisionId:f.decision.decisionId,ownerPublicJWK:f.ownerPublicJWK,ownerKeyId:'unit-owner',evidencePublicJWK:f.retirementPublicJWK,evidencePublicKey:f.retirementKeys.publicKey,evidenceKeyId:'unit-retirement'},ports:{registrar:{call:async()=>{retired++;return {retired:true};}},broker:{call:async()=>{throw Error('MUST_NOT_CALL');}}},buildPort:{call:async()=>{}},adminTokenSource:async()=> 'SYNTHETIC_READ_TEST',fetcher:async(url,o)=>{assert.equal(o.method,'GET');return Response.json(await f.getJSON(url));},readOwnerDecision:async a=>{const old=await f.source.receipt({...a,policySHA256:hashJSON(f.policies.build)});return f.sign({...old.record,repositoryTrustSHA256:hashJSON(c.repositoryTrust),policySHA256:a.policySHA256});},persist:async()=>true,readPolicyState:r=>state[r],invalidatePolicyState:()=>{for(const r of Object.keys(state))state[r]=null;}});
 assert.equal(runtime.composition.listenerStarted,false);assert.equal(await runtime.assertAdministration(policies.build),true);assert.throws(runtime.binding.assertTrustReady,/CANNOT_AUTHORIZE_PUBLICATION/);assert.equal(retired,0);
});
test('Scoped probe broker cannot consume inventory registered under an older trust policy or different build configuration',async()=>{
 const {acceptanceBroker}=await import('../lib/publication/integration/live-acceptance.mjs');const {f,c}=await scopedProbe();c.acceptanceMode='provenance';for(const role of ['build','inspection','publication']){c.identities[role].purpose='registered-provenance-acceptance';c.identities[role].subject=f.configuration.identities[role].subject;delete c.identities[role].codeSHA;}c.repositoryTrust.identitiesSHA256=hashJSON(c.identities);const policies=reviewedAcceptancePolicies(c),p=policies.publication;
 const state={mode:'SINGLE_OWNER',policyVersion:p.governance.policyVersion,ownerAuthorizationSHA:p.governance.ownerAuthorizationSHA,policySHA256:hashJSON(p)};
 const record={builder:{governance:p.governance,policySHA256:'f'.repeat(64)}};
 const broker=acceptanceBroker({policy:p,buildPolicy:policies.build,privilege:'publication',getJSON:f.getJSON,brokerQuery:async()=>({rows:[{record,digest:hashJSON(record)}]}),readPolicyState:()=>state,assertAdministration:async()=>true,keySource:async()=>{}});
 assert.throws(()=>broker.inventoryAuthority('2'.repeat(64)),/INVENTORY_CONSUMER/);await assert.rejects(broker.inventoryAuthority(c.repositoryTrust.configurationSHA256).forAttempt({codeSHA:c.repositoryTrust.sourceSHA}),/INVENTORY_TRUST_POLICY/);
});
test('Target-configurable ingress rejects the retired origin and unexpected routes before any private acceptance',async()=>{
 const {createIngressHandler}=await import('../ops/acceptance-bootstrap/live-ingress.mjs');let accepts=0;const handler=createIngressHandler({origin:target().origin,enabled:true,watcher:{isReady:async()=>false},acceptors:Object.fromEntries(['build','inspection','publication'].map(r=>[r,async()=>{accepts++;}]))});
 assert.equal((await handler(new Request('https://nyra-5c.eliaskalyvas.gr/ready/build/1/1'))).status,404);assert.equal((await handler(new Request(target().origin+'/owner'))).status,404);assert.equal((await handler(new Request(target().origin+'/ready/build/1/1'))).status,200);assert.equal(accepts,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,symlink,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {administrationReader,assessApplications,readAdministrationEvidence,ENVIRONMENT_IDS} from '../lib/publication/runtime/administration-evidence.mjs';
import {observeGithubOIDC} from '../lib/publication/runtime/oidc-observation.mjs';
import {evidenceSigner,verifyEvidence} from '../lib/publication/runtime/acceptance-evidence.mjs';
import {authenticatedFrames} from '../lib/publication/runtime/acceptance-ipc.mjs';
import {acceptanceHandler} from '../lib/publication/runtime/acceptance-collector.mjs';
import {verifySourceManifest} from '../lib/publication/integration/clean-rebuild.mjs';
import {probeIdentity} from '../ops/protected-delivery/live-probe.mjs';
import {integrationAPI,claims,now} from './fixtures/protected-integration.mjs';
import {signedOIDC} from './fixtures/phase4b.mjs';
const root='https://api.github.com/repos/Noctua76/eliaskalyvas-website';
test('Live administration reader scopes GET/credential, rejects redirects/errors/pagination and hides error data',async()=>{
 let sent;const read=administrationReader({tokenSource:async()=> 'private-admin-token',fetcher:async(url,options)=>{sent=options;return Response.json({protected:true});}});
 assert.equal((await read(root+'/branches/main/protection')).protected,true);assert.equal(sent.method,'GET');assert.equal(sent.redirect,'error');assert.equal(sent.headers.Authorization,'Bearer private-admin-token');
 for(const path of ['https://evil.invalid/'+root,root+'/contents/.env',root+'/actions/secrets',root+'/installation',root+'/branches/main/protection?write=true'])await assert.rejects(read(path),/SCOPE/);
 for(const fetcher of [async()=>new Response('private-admin-token',{status:403}),async()=>Response.json({}, {headers:{link:'<next>; rel="next"'}}),async()=>{throw Error('private-admin-token');}])await assert.rejects(administrationReader({tokenSource:async()=> 'private-admin-token',fetcher})(root),e=>!String(e).includes('private-admin-token'));
});
const inventory=()=>({complete:true,repository:'Noctua76/eliaskalyvas-website',repositoryId:'1389733212',ownerId:'217035723',observedAt:new Date(now()).toISOString(),installations:[{appId:'1',installationId:'2',repositoryIds:['1389733212'],permissions:Object.fromEntries(['contents','workflows','pull_requests','administration','actions','checks','deployments','environments'].map(k=>[k,'read']))}]});
test('Live App inventory never equates development write access with owner-exclusive merge control',()=>{
 const i=inventory();Object.assign(i.installations[0].permissions,{contents:'write',workflows:'write'});const r=assessApplications(i,{now:now()});assert.equal(r.apps[0].canPotentiallyMerge,true);assert.equal(r.apps[0].canPotentiallyAlterWorkflows,true);assert.equal(r.exclusiveTechnicalOwnerControl,false);assert.equal(r.requiresExplicitOwnerRiskDecision,true);
 for(const mutate of [x=>x.complete=false,x=>x.ownerId='1',x=>x.observedAt='2000-01-01',x=>delete x.installations[0].permissions.contents,x=>x.installations[0].repositoryIds=[]]){const bad=inventory();mutate(bad);assert.throws(()=>assessApplications(bad,{now:now()}));}
 assert.equal(assessApplications(inventory(),{now:now()}).exclusiveTechnicalOwnerControl,'NOT VERIFIED');
});
test('Live administration evidence requires actual pinned Environment IDs and complete App source',async()=>{
 const f=integrationAPI(),data=f.data;
 for(const [environment,id]of Object.entries(ENVIRONMENT_IDS)){
  data['/environments/'+environment]={...structuredClone(data['/environments/nyra-build']),name:environment,id:Number(id)};
  data['/environments/'+environment+'/deployment-branch-policies?per_page=100']=data['/environments/nyra-build/deployment-branch-policies?per_page=100'];data['/environments/'+environment+'/secrets?per_page=100']={total_count:0,secrets:[]};
 }
 data['/keys?per_page=100']=[];data['/actions/permissions/workflow']={default_workflow_permissions:'read',can_approve_pull_request_reviews:false};
 const args={getJSON:f.getJSON,governance:f.configuration.governance,readApplicationInventory:async()=>inventory(),now};const r=await readAdministrationEvidence(args);assert.equal(r.record.environments.length,3);assert.equal(r.record.authorization,false);
 data['/environments/nyra-build'].id=1;await assert.rejects(readAdministrationEvidence(args));data['/environments/nyra-build'].id=Number(ENVIRONMENT_IDS['nyra-build']);await assert.rejects(readAdministrationEvidence({...args,readApplicationInventory:undefined}),/APP_INVENTORY/);
});
const signed=await signedOIDC(),keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),sign=evidenceSigner({privateKey:keys.privateKey,publicKeyId:'operator-pinned'});
const observation=()=>{const f=integrationAPI(),expected={...f.policy,purpose:'identity-observation-only',codeSHA:'a'.repeat(40),audience:'urn:nyra:acceptance:build'},facts={runId:'100',runAttempt:'1',checkRunId:'300',sha:'a'.repeat(40),workflowSHA:'a'.repeat(40),jobName:expected.jobName,environment:expected.environment,status:'in_progress',repositoryId:expected.repositoryId,ownerId:expected.ownerId};return {f,expected,facts,args:{expected,jobFacts:async()=>facts,keySource:async()=>({keys:[signed.jwk]}),signEvidence:sign,consumeObservation:async()=>true,now}};};
test('Live OIDC observation verifies signature then records complete signed subject without authorizing it',async()=>{
 const f=observation(),token=await signed.sign({...claims(f.f.policy),aud:f.expected.audience,repository_owner:'Noctua76'}),receipt=await observeGithubOIDC(token,f.args),record=await verifyEvidence(receipt,{publicKey:keys.publicKey,keyId:'operator-pinned'});
 assert.equal(record.claims.sub,f.expected.subject);assert.equal(record.authorization,false);assert.equal(record.issuerKeyId,'synthetic');assert(!JSON.stringify(receipt).includes(token));assert(!Object.hasOwn(record.claims,'jti'));
 const tampered=structuredClone(receipt);tampered.record.claims.sub+='tampered';await assert.rejects(verifyEvidence(tampered,{publicKey:keys.publicKey,keyId:'operator-pinned'}));
});
for(const [claim,value]of Object.entries({iss:'https://evil.invalid',aud:'wrong',sub:'repo:Noctua76/eliaskalyvas-website:environment:nyra-build',environment:'github-pages',sha:'d'.repeat(40),workflow_sha:'d'.repeat(40),job_workflow_sha:'d'.repeat(40),repository_owner:'other',run_attempt:'2',exp:0}))test('Live observation signed negative '+claim,async()=>{const f=observation();await assert.rejects(observeGithubOIDC(await signed.sign({...claims(f.f.policy),aud:f.expected.audience,repository_owner:'Noctua76',[claim]:value}),f.args));});
test('Live observation denies forged signature, mismatched job, revoked/replayed token and discovery privilege confusion',async()=>{
 const f=observation(),token=await signed.sign({...claims(f.f.policy),aud:f.expected.audience,repository_owner:'Noctua76'}),other=await signedOIDC();
 await assert.rejects(observeGithubOIDC(token,{...f.args,keySource:async()=>({keys:[other.jwk]})}));await assert.rejects(observeGithubOIDC(token,{...f.args,jobFacts:async()=>({...f.facts,checkRunId:'999'})}));await assert.rejects(observeGithubOIDC(token,{...f.args,consumeObservation:async()=>false}),/REPLAY/);await assert.rejects(observeGithubOIDC(token,{...f.args,expected:{...f.expected,purpose:'publication'}}));
});
test('Live private collector is disabled by default, bounded operation-only and returns no JWT/claims',async()=>{
 let called=0,persisted=0;const args={privilege:'build',acceptToken:async token=>{called++;assert.equal(token,'private-jwt');return {digest:'a'.repeat(64),keyId:'operator-pinned',record:{private:'not public'}};},persistEvidence:async()=>persisted++};
 const request=(body='{}',role='build')=>new Request('https://isolated.invalid/acceptance/'+role,{method:'POST',headers:{Authorization:'Bearer private-jwt'},body});
 assert.equal((await acceptanceHandler(args)(request())).status,503);const active=acceptanceHandler({...args,enabled:true});for(const req of [request('{"mode":"publication"}'),request('{}','publication')])assert.equal((await active(req)).status,403);assert.equal(called,0);
 const response=await active(request());assert.equal(response.status,200);assert.equal(persisted,1);assert(!JSON.stringify(await response.json()).includes('private'));
});
test('Live probe missing plan/untrusted branch stops before any token/network request',async()=>{
 let calls=0;const base={privilege:'build',fetcher:async()=>calls++};await assert.rejects(probeIdentity(base));await assert.rejects(probeIdentity({...base,plan:{purpose:'isolated-live-trust-acceptance',approved:true,origin:'https://isolated.invalid/',publicEvidenceKeyId:'operator-pinned'},env:{GITHUB_REF:'refs/heads/branch'}}));assert.equal(calls,0);
});
test('Live IPC authenticates role, direction, payload and monotonic sequence; rejects replay/substitution',()=>{
 const key=randomBytes(32),sender=authenticatedFrames({key,role:'broker',direction:'response'}),receiver=authenticatedFrames({key,role:'broker',direction:'response'}),frame=sender.encode({digest:'a'.repeat(64)});
 assert.throws(()=>authenticatedFrames({key,role:'registrar',direction:'response'}).decode(frame));assert.throws(()=>authenticatedFrames({key,role:'broker',direction:'request'}).decode(frame));assert.throws(()=>receiver.decode({...frame,body:{digest:'b'.repeat(64)}}));assert.equal(receiver.decode(frame).digest,'a'.repeat(64));assert.throws(()=>receiver.decode(frame));
});
test('Live clean rebuild source manifest rejects byte substitution, symlink, traversal and dotenv',async()=>{
 const root=await mkdtemp(join(tmpdir(),'nyra-source-'));try{const bytes='reviewed';await writeFile(join(root,'source'),bytes);const manifest={source:createHash('sha256').update(bytes).digest('hex')};await verifySourceManifest(root,manifest);await writeFile(join(root,'source'),'changed');await assert.rejects(verifySourceManifest(root,manifest));await assert.rejects(verifySourceManifest(root,{'../source':manifest.source}));await rm(join(root,'source'));await symlink('/etc/passwd',join(root,'source'));await assert.rejects(verifySourceManifest(root,manifest));await rm(join(root,'source'));await writeFile(join(root,'source'),bytes);await writeFile(join(root,'.env'),'PRIVATE');await assert.rejects(verifySourceManifest(root,manifest));}finally{await rm(root,{recursive:true,force:true});}
});
test('Live reusable probe has no automatic trigger, publication credentials, artifacts or dispatch step',async()=>{
 const y=await readFile(new URL('../.github/workflows/nyra-live-trust-probe.yml',import.meta.url),'utf8');assert.match(y,/workflow_call:/);assert.doesNotMatch(y,/pull_request:|push:|pages:|secrets:|upload-artifact|deploy-pages|workflow_dispatch:/);for(const name of Object.keys(ENVIRONMENT_IDS))assert(y.includes('environment: '+name));await assert.rejects(readFile(new URL('../ops/protected-delivery/live-acceptance-plan.json',import.meta.url)));
 const caller=await readFile(new URL('../.github/workflows/nyra-live-trust-acceptance.yml',import.meta.url),'utf8');assert.match(caller,/workflow_dispatch:/);assert.match(caller,/nyra-live-trust-probe\.yml@[a-f0-9]{40}/);assert.doesNotMatch(caller,/pull_request:|push:|pages:|secrets:|upload-artifact|deploy-pages/);
});
test('Live discovery subject never becomes an exact-subject authorization policy',async()=>{
 const {createOIDCVerifier}=await import('../lib/publication/runtime/oidc.mjs');const {DISCOVERY_SUBJECT}=await import('../lib/publication/runtime/acceptance-collector.mjs');
 const f=observation(),sub='repo:Noctua76@217035723/eliaskalyvas-website@1389733212:synthetic-unseen-suffix',token=await signed.sign({...claims(f.f.policy),sub,aud:f.expected.audience,repository_owner:'Noctua76'});
 const r=await observeGithubOIDC(token,{...f.args,expected:{...f.expected,subject:DISCOVERY_SUBJECT}});assert.equal(r.record.claims.sub,sub);assert.equal(r.record.authorization,false);
 const v=createOIDCVerifier({policy:{...f.expected,subject:DISCOVERY_SUBJECT},jobFacts:async()=>f.facts,keySource:f.args.keySource,now});await assert.rejects(v.verify(token),/JWT_TRUST/);
});
test('Live collector requires independent registration and authenticated owner dispatch metadata',async()=>{
 const {registeredObservation,DISCOVERY_SUBJECT}=await import('../lib/publication/runtime/acceptance-collector.mjs');const {createJobRegistrar}=await import('../lib/publication/runtime/job-registrar.mjs');const {readState}=await import('./fixtures/protected-delivery.mjs');
 const f=observation(),p={...f.expected,subject:DISCOVERY_SUBJECT},readPolicyState=readState(p);let registration;const seen=new Set();
 Object.assign(f.f.data['/actions/runs/100'],{actor:{id:217035723},triggering_actor:{id:217035723}});
 await createJobRegistrar({policy:p,privilege:'build',getJSON:f.f.getJSON,requiredChecks:['nyra-required-regression','nyra-required-production-build'],readPolicyState,now,query:async(sql,args)=>{registration=JSON.parse(args[3]);}}).register({runId:'100',runAttempt:'1'});
 const collect=registeredObservation({policy:p,privilege:'build',getJSON:f.f.getJSON,store:{load:async()=>registration,consume:async c=>{if(seen.has(c.jti))return false;seen.add(c.jti);return true;}},readPolicyState,assertAdministration:async()=>{},keySource:f.args.keySource,signEvidence:sign,now});
 const token=await signed.sign({...claims(f.f.policy),aud:p.audience,repository_owner:'Noctua76'});assert.equal((await collect(token)).record.authorization,false);await assert.rejects(collect(token),/REPLAY/);
 f.f.data['/actions/runs/100'].triggering_actor.id=1;await assert.rejects(collect(await signed.sign({...claims(f.f.policy),aud:p.audience,repository_owner:'Noctua76',jti:'synthetic-new-owner-dispatch'})),/OWNER_DISPATCH/);
});
test('Live real-profile adapter keeps exact pins and subject; discovery policy cannot authorize provenance',async()=>{
 const {acceptedProbePolicy,acceptanceRegistrar,acceptanceBroker}=await import('../lib/publication/integration/live-acceptance.mjs');const {readState}=await import('./fixtures/protected-delivery.mjs');
 const f=integrationAPI(),p={...f.policy,purpose:'registered-provenance-acceptance',subject:f.policy.subject,audience:'urn:nyra:acceptance:build',environmentId:ENVIRONMENT_IDS['nyra-build'],workflowRef:'Noctua76/eliaskalyvas-website/.github/workflows/nyra-live-trust-acceptance.yml@refs/heads/main',jobWorkflowRef:'Noctua76/eliaskalyvas-website/.github/workflows/nyra-live-trust-probe.yml@'+'b'.repeat(40)},state=readState(p);let row;
 Object.assign(f.data['/actions/runs/100'],{actor:{id:217035723},triggering_actor:{id:217035723}});f.data['/environments/nyra-build'].id=Number(p.environmentId);f.data['/actions/runs/100'].path='.github/workflows/nyra-live-trust-acceptance.yml';f.data['/actions/runs/100'].referenced_workflows=[{path:p.jobWorkflowRef,sha:p.jobWorkflowSHA}];
 await acceptanceRegistrar({policy:p,privilege:'build',getJSON:f.getJSON,readPolicyState:state,assertAdministration:async()=>{},now,registrarQuery:async(sql,args)=>{row=JSON.parse(args[3]);}}).register({runId:'100',runAttempt:'1'});
 const broker=acceptanceBroker({policy:p,privilege:'build',getJSON:f.getJSON,readPolicyState:state,assertAdministration:async()=>{},now,keySource:async()=>({keys:[signed.jwk]}),brokerQuery:async(sql,args)=>sql.startsWith('select registration')?{rows:[{registration:row,expires_at:new Date(now()+300000),revoked_at:null}]}:{rows:[{jti:args[0]}]}});
 const grant=await broker.authorize(await signed.sign({...claims(p),aud:p.audience,workflow_ref:p.workflowRef,job_workflow_ref:p.jobWorkflowRef}));await broker.revalidate(grant);assert.throws(()=>broker.inventoryAuthority('a'.repeat(64)),/CONSUMER/);
 for(const patch of [{purpose:'identity-observation-only'},{subject:'urn:nyra:unapproved-subject-discovery'},{jobWorkflowRef:p.jobWorkflowRef.replace(/@.*/,'@main')},{environmentId:'700'}])assert.throws(()=>acceptedProbePolicy({...p,...patch},'build'));
});
test('Live probe waits for independent registration before requesting a JWT and returns only receipt digest',async()=>{
 const requests=[],env={GITHUB_REPOSITORY:'Noctua76/eliaskalyvas-website',GITHUB_REPOSITORY_ID:'1389733212',GITHUB_REPOSITORY_OWNER_ID:'217035723',GITHUB_REF:'refs/heads/main',GITHUB_REF_PROTECTED:'true',GITHUB_EVENT_NAME:'workflow_dispatch',RUNNER_ENVIRONMENT:'github-hosted',GITHUB_RUN_ID:'100',GITHUB_RUN_ATTEMPT:'1',ACTIONS_ID_TOKEN_REQUEST_URL:'https://pipelines.actions.githubusercontent.com/token',ACTIONS_ID_TOKEN_REQUEST_TOKEN:'request-secret'},plan={purpose:'isolated-live-trust-acceptance',approved:true,origin:'https://isolated.invalid/',publicEvidenceKeyId:'operator-pinned'};
 const r=await probeIdentity({privilege:'build',plan,env,fetcher:async(url,options)=>{requests.push({url:String(url),options});if(requests.length===1)return Response.json({ready:true});if(requests.length===2)return Response.json({value:'private-jwt'});return Response.json({accepted:true,digest:'a'.repeat(64),keyId:plan.publicEvidenceKeyId});}});
 assert.match(requests[0].url,/ready\/build\/100\/1$/);assert(!requests[0].options.headers.Authorization);assert.equal(requests[2].options.headers.Authorization,'Bearer private-jwt');assert.equal(r.authorization,false);assert(!JSON.stringify(r).includes('private-jwt'));
});
test('Live administration gate binds fresh main/Environment/App evidence to an explicit owner risk decision',async()=>{
 const {administrationGate}=await import('../lib/publication/runtime/administration-evidence.mjs');const {hashJSON}=await import('../lib/publication/contract.mjs');
 const p=integrationAPI().policy,record={schema:'nyra.administration.observation.v1',observedAt:new Date(now()).toISOString(),mainSHA:p.callerSHA,applications:{apps:[{appId:'1',permissions:{contents:'write'}}]},environments:Object.entries(ENVIRONMENT_IDS).map(([environment,environmentId])=>({environment,environmentId,mainSHA:p.callerSHA,governanceMode:'SINGLE_OWNER',policyVersion:1}))};
 const gate=administrationGate({readEvidence:async()=>({record,digest:hashJSON(record)}),acceptedApplicationsSHA256:hashJSON(record.applications.apps),ownerRiskDecisionSHA:'e'.repeat(40),now});await gate(p);
 record.applications.apps[0].permissions.contents='read';await assert.rejects(gate(p),/ADMIN_GATE_CHANGED/);assert.throws(()=>administrationGate({readEvidence:async()=>{},acceptedApplicationsSHA256:'a'.repeat(64)}));
});

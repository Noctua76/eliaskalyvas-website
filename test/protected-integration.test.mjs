import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,readdir} from 'node:fs/promises';
import {configuration,integrationAPI,claims,now} from './fixtures/protected-integration.mjs';
import {signedOIDC} from './fixtures/phase4b.mjs';
import {reviewedDeliveryPolicy,REQUIRED_CHECKS} from '../lib/publication/runtime/delivery-policy.mjs';
import {createJobRegistrar} from '../lib/publication/runtime/job-registrar.mjs';
import {composeIdentityBroker,createProtectedInventoryRegistrar} from '../lib/publication/integration/protected-composition.mjs';
import {requestProtectedJob} from '../ops/protected-delivery/workflow-request.mjs';
import {hashJSON} from '../lib/publication/contract.mjs';
const signed=await signedOIDC();
for(const privilege of ['build','inspection','publication'])test('B2 synthetic immutable exact subject, independent registrar and broker: '+privilege,async()=>{
 const f=integrationAPI(privilege),records=new Map(),used=new Set();let insert=0;
 const registrar=createJobRegistrar({policy:f.policy,privilege,getJSON:f.getJSON,requiredChecks:REQUIRED_CHECKS,now,query:async(sql,args)=>{insert++;records.set(args[2],JSON.parse(args[3]));}});
 assert.deepEqual(await registrar.register({runId:'100',runAttempt:'1'}),{runId:'100',runAttempt:'1',checkRunId:'300'});assert.equal(insert,1);
 const query=async(sql,args)=>sql.startsWith('select registration')?{rows:[{registration:records.get(args[2]),revoked_at:null,expires_at:new Date(now()+300000)}]}:{rows:used.has(args[0])?[]:(used.add(args[0]),[{jti:args[0]}])};
 const broker=composeIdentityBroker({configuration:f.configuration,privilege,getJSON:f.getJSON,brokerQuery:query,keySource:async()=>({keys:[signed.jwk]}),now});
 const token=await signed.sign(claims(f.policy)),grant=await broker.authorize(token);assert.equal(grant.privilege,privilege);await broker.revalidate(grant);await assert.rejects(broker.revalidate({...grant}));await assert.rejects(broker.authorize(token),/REPLAYED/);
 for(const patch of [{sub:'repo:Noctua76/eliaskalyvas-website:environment:nyra-'+privilege},{environment:'github-pages'},{aud:'urn:nyra:other'},{workflow_sha:'d'.repeat(40)},{run_attempt:'2'},{check_run_id:'301'},{job_workflow_sha:'d'.repeat(40)}])await assert.rejects(broker.authorize(await signed.sign({...claims(f.policy),jti:crypto.randomUUID(),...patch})));
 for(const other of ['build','inspection','publication'].filter(x=>x!==privilege))await assert.rejects(broker.authorize(await signed.sign({...claims(f.configuration.identities[other]),jti:crypto.randomUUID()})));
 if(privilege!=='publication')assert.throws(()=>broker.inventoryAuthority('a'.repeat(64)),/CONSUMER/);
 f.data['/branches/main'].commit.sha='d'.repeat(40);await assert.rejects(broker.revalidate(grant),/STALE_MAIN/);
});
const badRegistration={
 'caller SHA':f=>f.data['/actions/runs/100'].head_sha='d'.repeat(40),
 'reusable SHA':f=>f.data['/actions/runs/100'].referenced_workflows[0].sha='d'.repeat(40),
 'missing reusable':f=>delete f.data['/actions/runs/100'].referenced_workflows,
 'duplicate reusable':f=>f.data['/actions/runs/100'].referenced_workflows.push(f.data['/actions/runs/100'].referenced_workflows[0]),
 'ordinary Pages workflow':f=>f.data['/actions/runs/100'].path='.github/workflows/pages.yml',
 'ordinary Pages job':f=>f.data['/actions/runs/100/attempts/1/jobs?per_page=100'].jobs[0].name='deploy',
 'retry':f=>f.data['/actions/runs/100'].run_attempt=2,
 'wrong check app':f=>f.data['/check-runs/300'].app.id=1,
 'unprotected main':f=>f.data['/branches/main'].protected=false,
 'wrong Environment':f=>f.data['/environments/nyra-build'].name='github-pages',
 'outage':f=>delete f.data['/branches/main/protection']
};
for(const [name,mutate] of Object.entries(badRegistration))test('B2 registrar makes zero writes on '+name,async()=>{const f=integrationAPI();mutate(f);let writes=0;const r=createJobRegistrar({policy:f.policy,privilege:'build',getJSON:f.getJSON,requiredChecks:REQUIRED_CHECKS,now,query:async()=>writes++});await assert.rejects(r.register({runId:'100',runAttempt:'1'}));assert.equal(writes,0);});
for(const [name,mutate] of Object.entries({
 'unverified real OIDC':c=>c.acceptance.genuineProtectedOIDC=false,
 'old subject':c=>c.identities.build.subject='repo:Noctua76/eliaskalyvas-website:environment:nyra-build',
 'wildcard':c=>c.identities.build.subject+='*',
 'Pages Environment':c=>c.identities.build.environment='github-pages',
 'mutable workflow':c=>c.identities.build.jobWorkflowRef=c.identities.build.jobWorkflowRef.replace(/@[a-f0-9]{40}$/,'@main'),
 'wrong privilege audience':c=>c.identities.build.audience='urn:nyra:publication',
 'unpinned caller':c=>c.identities.build.callerSHA='main'
}))test('B2 reviewed configuration denies '+name,()=>{const c=configuration();mutate(c);assert.throws(()=>reviewedDeliveryPolicy(c,'build'));});
const recordFor=r=>({schema_version:'nyra.normal.provenance.v1',inventory:{schema_version:'nyra.public.paths.v1',codeSHA:r.codeSHA,configurationSHA256:'f'.repeat(64),paths:['index.html']},builder:{...Object.fromEntries(['privilege','codeSHA','workflowSHA','jobWorkflowSHA','runId','runAttempt','checkRunId'].map(k=>[k,r[k]])),assurance:'unprotected_ci'},files:[{path:'index.html',sha256:'e'.repeat(64),bytes:12}]});
test('B2 protected inventory rebuild uses registered pins and rejects interrupted, revoked or substituted work',async()=>{
 const r={privilege:'build',codeSHA:'a'.repeat(40),workflowSHA:'a'.repeat(40),jobWorkflowSHA:'b'.repeat(40),runId:'100',runAttempt:'1',checkRunId:'300'},cap={...r,registration:r,policySHA256:'d'.repeat(64),expiresAt:new Date(now()+10000).toISOString()};let rows=[],active=true;
 const capture=({mutate=()=>{},query=async(sql,args)=>{rows=args;return {rows:[{digest:args[6]}]};}}={})=>createProtectedInventoryRegistrar({authorizeBuild:async()=>cap,revalidateBuild:async()=>{assert(active,'revoked/stale');},rebuild:async options=>{assert.equal(options.codeSHA,r.codeSHA);const record=recordFor(r);mutate(record);return {record,digest:hashJSON(record)};},registrarQuery:query});
 const result=await capture().capture('opaque');assert.equal(JSON.parse(rows[7]).builder.assurance,'protected_oidc');assert.equal(result.digest,hashJSON(JSON.parse(rows[7])));assert.equal(rows[8],cap.expiresAt);
 for(const mutate of [record=>record.builder.assurance='protected_oidc',record=>record.builder.workflowSHA='c'.repeat(40),record=>record.inventory.paths=['.well-known/nyra-release.json'],record=>record.files[0].sha256='bad'])await assert.rejects(capture({mutate}).capture('opaque'));
 await assert.rejects(capture({query:async()=>({rows:[]})}).capture('opaque'),/INACTIVE/);active=false;await assert.rejects(capture().capture('opaque'),/revoked/);
});
test('B2 absent activation configuration stops before any token/network request',async()=>{let calls=0;await assert.rejects(requestProtectedJob({privilege:'publication',configuration:{},fetcher:async()=>calls++}));assert.equal(calls,0);});
test('B2 reusable jobs are workflow_call-only, isolated Environments, reviewed pins, no deploy privilege/caller',async()=>{
 for(const privilege of ['build','inspection','publication']){const text=await readFile(new URL('../.github/workflows/nyra-'+privilege+'.yml',import.meta.url),'utf8');assert.match(text,/workflow_call:/);assert.match(text,new RegExp('environment: nyra-'+privilege));assert.doesNotMatch(text,/workflow_dispatch:|pull_request:|push:|pages:|secrets:|uses:.*@(?:v\d|main)/);assert.match(text,/persist-credentials: false/);}
 const files=await readdir(new URL('../.github/workflows/',import.meta.url));for(const name of files){const text=await readFile(new URL('../.github/workflows/'+name,import.meta.url),'utf8');assert.doesNotMatch(text,/uses:.*\.github\/workflows\/nyra-(?:build|inspection|publication)\.yml@/);}
 await assert.rejects(readFile(new URL('../ops/protected-delivery/accepted-configuration.json',import.meta.url)));
});

test('B2 broker transport is disabled by default and ignores private/substituted request facts',async()=>{
 const {createProtectedJobHandler}=await import('../lib/publication/runtime/protected-job-handler.mjs');let calls=0;
 const grant=Object.freeze({privilege:'inspection'}),broker={authorize:async token=>{assert.equal(token,'opaque');calls++;return grant;},revalidate:async c=>assert.equal(c,grant)},execute=async c=>assert.equal(c,grant);
 const make=(body='{}',path='inspection')=>new Request('https://broker.invalid/jobs/'+path,{method:'POST',headers:{Authorization:'Bearer opaque'},body});
 assert.equal((await createProtectedJobHandler({broker,privilege:'inspection',execute})(make())).status,503);assert.equal(calls,0);
 const handler=createProtectedJobHandler({broker,privilege:'inspection',execute,enabled:true});
 for(const request of [make('{"environment":"github-pages"}'),make('{}','publication'),make('{}?'),new Request('https://broker.invalid/jobs/inspection')])assert.equal((await handler(request)).status,403);
 assert.equal(calls,0);assert.equal((await handler(make())).status,200);assert.equal(calls,1);
 const wrong=createProtectedJobHandler({broker,privilege:'publication',execute:async()=>assert.fail('cross-privilege'),enabled:true});assert.equal((await wrong(make('{}','publication'))).status,403);
});
test('B2 runner scopes the token audience and transmits no job facts, inventories or token to public output',async()=>{
 const c=configuration(),p=c.identities.inspection,env={GITHUB_REPOSITORY:p.repository,GITHUB_REF:p.ref,GITHUB_SHA:p.callerSHA,GITHUB_EVENT_NAME:'workflow_dispatch',RUNNER_ENVIRONMENT:'github-hosted',ACTIONS_ID_TOKEN_REQUEST_URL:'https://pipelines.actions.githubusercontent.com/token?id=1',ACTIONS_ID_TOKEN_REQUEST_TOKEN:'request-secret'},calls=[];
 const result=await requestProtectedJob({privilege:'inspection',configuration:c,env,fetcher:async(url,options)=>{calls.push({url:String(url),options});return calls.length===1?Response.json({value:'private-jwt'}):Response.json({accepted:true});}});
 assert.deepEqual(result,{privilege:'inspection',accepted:true});assert.equal(new URL(calls[0].url).searchParams.get('audience'),p.audience);assert.equal(calls[1].url,'https://broker.invalid/jobs/inspection');assert.equal(calls[1].options.body,'{}');assert.equal(calls[1].options.headers.Authorization,'Bearer private-jwt');
 for(const patch of [{GITHUB_SHA:'d'.repeat(40)},{GITHUB_REF:'refs/heads/evil'},{GITHUB_EVENT_NAME:'pull_request'},{RUNNER_ENVIRONMENT:'self-hosted'},{ACTIONS_ID_TOKEN_REQUEST_URL:'https://evil.invalid/token'}]){let count=0;await assert.rejects(requestProtectedJob({privilege:'inspection',configuration:c,env:{...env,...patch},fetcher:async()=>count++}));assert.equal(count,0);}
});

test('B2 broker key rollover, registration revocation and capability expiry remain fail closed',async()=>{
 const f=integrationAPI(),next=await signedOIDC();let key=signed.jwk,revoked=false,time=now(),row;
 await createJobRegistrar({policy:f.policy,privilege:'build',getJSON:f.getJSON,requiredChecks:REQUIRED_CHECKS,now,query:async(sql,args)=>{row=JSON.parse(args[3]);}}).register({runId:'100',runAttempt:'1'});
 const broker=composeIdentityBroker({configuration:f.configuration,privilege:'build',getJSON:f.getJSON,keySource:async()=>({keys:[key]}),now:()=>time,brokerQuery:async(sql,args)=>sql.startsWith('select registration')?{rows:[{registration:row,revoked_at:revoked?new Date():null,expires_at:new Date(now()+300000)}]}:{rows:[{jti:args[0]}]}});
 const old=await signed.sign(claims(f.policy));key=next.jwk;await assert.rejects(broker.authorize(old),/SIGNATURE/);
 const token=await next.sign({...claims(f.policy),jti:'synthetic-rotated-001'}),grant=await broker.authorize(token);await broker.revalidate(grant);
 revoked=true;await assert.rejects(broker.revalidate(grant),/INACTIVE/);revoked=false;time+=301000;await assert.rejects(broker.revalidate(grant),/UNVERIFIED/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {authorityFixture,OWNER,SESSION} from './fixtures/publication-authority.mjs';
import {composeEditorialPublication} from '../runtime/nyra-edge/editorial.mjs';
import {createFinalEditorialApplication} from '../runtime/nyra-edge/application.mjs';
import {createPrivateInspectionService} from '../lib/publication/runtime/inspection.mjs';
import {runPrivateAssetInspection} from '../lib/publication/runtime/node-inspection.mjs';
import {acceptFinalLifecycle} from '../ops/publication/lifecycle-acceptance.mjs';
import {stageEdgeRuntime} from '../runtime/nyra-edge/stage.mjs';
import {planPagesCutover} from '../ops/publication/workflow-cutover.mjs';
const codeSHA='a'.repeat(40);
test('Connected owner/inspection/SQL/materialization/static-artifact/receipt lifecycle; Auth/OIDC/GitHub/HTTP observation explicitly simulated',async()=>{
 const f=await authorityFixture();try{
  for(const file of ['20261028142242_nyra_private_delivery_runtime.sql','20261029145714_nyra_protected_delivery_acceptance.sql','20261029194516_nyra_private_asset_inspection.sql','20261031221433_nyra_final_inspection_queue.sql'])await f.pg.exec(await readFile(new URL('../supabase/migrations/'+file,import.meta.url),'utf8'));
  await f.pg.exec(await readFile(new URL('../ops/publication/sql/preflight.sql',import.meta.url),'utf8'));
  await f.pg.exec(await readFile(new URL('../ops/publication/sql/postflight.sql',import.meta.url),'utf8'));
  // PGlite fixture otherwise serializes all JS arrays as JSON, unlike PostgREST's uuid[] binding.
  const originalRPC=f.db.rpc;f.db.rpc=async(name,args)=>{if(name==='nyra_delivery_materialized')args={...args,p_intents:'{'+args.p_intents.join(',')+'}'};await f.pg.exec('set role service_role');try{const r=await originalRPC(name,args);return r;}finally{await f.pg.exec('reset role');}};
  const pending=new Map(),accepted=new Map(),quarantine={put:async(id,b)=>pending.set(id,b),get:async id=>pending.get(id),remove:async id=>pending.delete(id)},storage={put:async(id,b)=>accepted.set(id,b),get:async id=>accepted.get(id)};
  const handler=composeEditorialPublication({db:f.db,env:{ALLOWED_ORIGINS:'https://eliaskalyvas.gr'},quarantine,storage,codeSHA,assertTrustReady:async()=>true,enabled:true,fetcher:async()=>{throw Error('NO_PAID_PROVIDER');}});
  const send=async(path,body,{method='POST'}={})=>{const r=await handler(new Request('https://eliaskalyvas.gr/nyra-api'+path,{method,headers:{Origin:'https://eliaskalyvas.gr',Authorization:'Bearer '+f.good,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},...(method==='GET'?{}:{body:body instanceof FormData?body:JSON.stringify(body)})}));return {status:r.status,data:await r.json()};};
  const verifier={verify:async()=>({codeSHA,runId:'100',runAttempt:'1',checkRunId:'300'}),assert:()=>{}},service=createPrivateInspectionService({db:f.db,quarantine,accepted:storage,verifier,codeSHA});
  const result=await acceptFinalLifecycle({send,createWork:language=>f.work({language}),inspect:operationId=>runPrivateAssetInspection({service,tokenSource:async()=> 'SIMULATED_JOB',operationId}),db:f.db,q:f.pg.query.bind(f.pg),storage,owner:{id:OWNER,session:SESSION,expiresAt:new Date(Date.now()+3600000).toISOString()},codeSHA});assert.equal(result.receipts,5);assert.equal(result.realProtectedOIDC,'NOT TESTED');
 }finally{await f.pg.close();}
});
test('Final server binding requires separate private buckets, immutable code and trusted assertion; default never touches storage',()=>{
 const db={auth:{},from(){},storage:{getBucket(){throw Error('UNAUTHORIZED_STORAGE');}}};
 assert.equal(typeof createFinalEditorialApplication({db,env:{}}),'function');
 const env={NYRA_PRIVATE_ASSET_BUCKET:'nyra-accepted',NYRA_QUARANTINE_BUCKET:'nyra-quarantine'};
 assert.throws(()=>createFinalEditorialApplication({db,env,codeSHA,enabled:true}),/BINDING/);
 assert.throws(()=>createFinalEditorialApplication({db,env:{...env,NYRA_QUARANTINE_BUCKET:'nyra-accepted'},codeSHA,assertTrustReady:async()=>true,enabled:true}),/BINDING/);
 assert.equal(typeof createFinalEditorialApplication({db,env,codeSHA,assertTrustReady:async()=>false,enabled:true}),'function');
});
test('Self-contained staged package resolves editorial and protected machine dependency graphs without website imports or listeners',async()=>{
 const s=await stageEdgeRuntime({offlineDependencies:true});try{
  assert.equal(typeof(await import(s.dir+'/runtime/nyra-edge/application.mjs')).createFinalEditorialApplication,'function');
  assert.equal(typeof(await import(s.dir+'/runtime/nyra-edge/final-delivery.mjs')).composeFinalDelivery,'function');
  const entry=await readFile(s.dir+'/index.ts','utf8');assert(entry.includes('createFinalEditorialApplication'));assert(entry.includes('composeFinalDelivery'));assert(!entry.includes('Deno.serve'));
 }finally{await rm(s.root,{recursive:true,force:true});}
});
test('Pages cutover is one atomic offline replacement and refuses a changed or competing deployment authority',async()=>{
 const pages=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8'),files=new Map([['.github/workflows/pages.yml',pages]]),args={files,approvedPagesSHA256:createHash('sha256').update(pages).digest('hex'),reusableSHA:codeSHA};
 const plan=await planPagesCutover(args);assert.equal(plan.get('.github/workflows/pages.yml'),null);assert(!plan.get('.github/workflows/pages-orchestrator.yml').includes('REVIEW_REQUIRED'));assert.equal((plan.get('.github/workflows/pages-orchestrator.yml').match(new RegExp('@'+codeSHA,'g'))||[]).length,3);
 assert(plan.get('.github/workflows/pages-delivery.yml').includes('npm ci --ignore-scripts --prefix ops/acceptance-bootstrap/runtime'));
 await assert.rejects(planPagesCutover({...args,approvedPagesSHA256:'0'.repeat(64)}));
 await assert.rejects(planPagesCutover({...args,files:new Map([...files,['.github/workflows/other.yml','jobs:\n  malicious:\n    permissions:\n      pages: write\n']])}));
 await assert.rejects(planPagesCutover({...args,files:new Map([...files,['.github/workflows/pages-orchestrator.yml','existing']])}));
 assert.equal(files.get('.github/workflows/pages.yml'),pages);
});

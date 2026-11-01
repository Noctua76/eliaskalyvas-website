import test from 'node:test';
import assert from 'node:assert/strict';
import {adminPreflight,checks} from '../ops/acceptance-bootstrap/admin-preflight.mjs';
import {administrationReader,ENVIRONMENT_IDS,REPOSITORY} from '../lib/publication/runtime/administration-evidence.mjs';

const root='https://api.github.com/repos/'+REPOSITORY;
function fixture(name){
 if(name==='repository')return {id:1389733212,owner:{id:217035723},default_branch:'main'};
 if(name==='main_protection')return {required_status_checks:{checks:[{context:'nyra-required-regression',app_id:15368},{context:'nyra-required-production-build',app_id:15368}]},enforce_admins:{enabled:true},restrictions:null};
 if(name==='collaborators'||name==='deploy_keys')return [];
 if(name==='actions_defaults')return {default_workflow_permissions:'read',can_approve_pull_request_reviews:false};
 if(Object.hasOwn(ENVIRONMENT_IDS,name))return {id:Number(ENVIRONMENT_IDS[name]),name,protection_rules:[],deployment_branch_policy:{protected_branches:true,custom_branch_policies:false}};
 if(name.endsWith('_branch_policies'))return {total_count:0,branch_policies:[]};
 if(name.endsWith('_secret_metadata'))return {total_count:1,secrets:[{name:'PRIVATE_SECRET_NAME_CANARY',created_at:'yesterday'}]};
 throw Error('UNKNOWN_FIXTURE');
}
const names=new Map(checks.map(([n,p])=>[root+p,n]));
test('Read-only operator probe uses the existing strict GitHub allowlist and emits only sanitized metadata, never the private token or secret names',async()=>{
 const requested=[],token='PRIVATE_BEARER_CANARY';
 const reader=administrationReader({tokenSource:async()=>token,fetcher:async(url,options)=>{
  requested.push(url);
  assert.equal(options.method,'GET');assert.equal(options.redirect,'error');
  assert.equal(options.headers.Authorization,'Bearer '+token);
  return Response.json(fixture(names.get(url)));
 }});
 const result=await adminPreflight({getJSON:reader,now:()=>Date.parse('2026-11-01T00:00:00Z')});
 assert.deepEqual(requested,checks.map(([,p])=>root+p));
 assert.equal(result.allReadable,true);
 assert.equal(result.liveAcceptance,false);
 assert.equal(result.independentlySigned,false);
 assert.equal(result.authenticatedApplicationInventory,false);
 assert.equal(result.publicationAuthorized,false);
 const output=JSON.stringify(result);
 assert(!output.includes(token));assert(!output.includes('PRIVATE_SECRET_NAME_CANARY'));
 assert.equal(result.sections.filter(x=>x.name.endsWith('_secret_metadata')).length,3);
});
test('GitHub 403 or incomplete pagination can never become a passing preflight',async()=>{
 const denied=root+'/branches/main/protection';
 const reader=administrationReader({tokenSource:async()=> 'NONPUBLIC',fetcher:async(url)=>url===denied?
  new Response('{}',{status:403}):Response.json(fixture(names.get(url)))});
 const result=await adminPreflight({getJSON:reader});
 assert.equal(result.allReadable,false);
 assert.deepEqual(result.sections.find(x=>x.name==='main_protection'),{name:'main_protection',read:'unavailable'});
 assert.equal(result.liveAcceptance,false);
 const incomplete=administrationReader({tokenSource:async()=> 'NONPUBLIC',fetcher:async(url)=>new Response(JSON.stringify(fixture(names.get(url))),{headers:url.includes('/collaborators?')?{Link:'<https://api.github.com/next>; rel="next"'}:{}})});
 const paged=await adminPreflight({getJSON:incomplete});
 assert.equal(paged.allReadable,false);
 assert.equal(paged.sections.find(x=>x.name==='collaborators').read,'unavailable');
});
test('An Environment ID mismatch fails closed and does not fabricate verified identity',async()=>{
 const result=await adminPreflight({getJSON:async url=>{const name=names.get(url),data=fixture(name);if(name==='nyra-publication')data.id=123;return data;}});
 assert.equal(result.allReadable,false);
 assert.equal(result.sections.find(x=>x.name==='nyra-publication').read,'incomplete');
 assert.equal(result.publicationAuthorized,false);
});

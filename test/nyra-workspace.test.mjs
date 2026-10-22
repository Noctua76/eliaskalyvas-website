import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fixture } from './fixture.mjs';
import { createWorkspaceHandler, advanceState, publicWork } from '../supabase/functions/nyra-api/lib/workspace.mjs';
import { usageCost, stageEstimate } from '../supabase/functions/nyra-api/lib/costs.mjs';
import { validateProposals } from '../supabase/functions/nyra-api/lib/proposals.mjs';
const owner='dad84105-d898-4194-bbe1-721a2636e543', other='cad84105-d898-4194-bbe1-721a2636e543';
const source='https://arxiv.org/abs/2207.05221';
const token='header.'+Buffer.from(JSON.stringify({aal:'aal2'})).toString('base64url')+'.signature';
const assignment={topic:'AI and society',direction:'',language:'gr',format:'signal'};
const env={NYRA_ENABLED:'true',OPENAI_API_KEY:'not-real',NYRA_MODEL:'gpt-6-astra',ALLOWED_ORIGINS:'https://eliaskalyvas.gr'};
const report={id:'research',status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{type:'web_search_call',id:'search',status:'completed',action:{type:'search',sources:[{url:source}]}},{type:'message',content:[{type:'output_text',text:'Source findings',annotations:[{type:'url_citation',url:source}]}]}]};
const article={title:'An article',summary:'Summary',thesis:'Thesis',original_contribution:'Contribution',counterargument:'Counterargument',paragraphs:[{text:'word '.repeat(600).trim(),source_urls:[source],evidence_ids:[]}],uncertainties:[],editor_note:'Note'};
const output=(value,id='output')=>({id,status:'completed',usage:{input_tokens:100,output_tokens:100},output:[{type:'message',content:[{type:'output_text',text:JSON.stringify(value)}]}]});
async function setup(outputs=[]) {
 const f=await fixture();
 await f.pg.exec(await readFile(new URL('../supabase/migrations/20261022073258_nyra_persistent_editorial_workspace.sql',import.meta.url),'utf8'));
 await f.pg.exec(await readFile(new URL('../supabase/migrations/20261022082003_nyra_article_presentation.sql',import.meta.url),'utf8'));
 await f.pg.exec(`insert into auth.users(id) values ('${owner}'),('${other}');insert into website_owners(user_id) values('${owner}'),('${other}');`);
 f.users.set(token,{id:owner});
 const requests=[];
 const handler=createWorkspaceHandler({db:f.db,env,sourceFetcher:async()=>new Response('Source content '.repeat(100),{headers:{'content-type':'text/plain'}}),fetcher:async(url,init)=>{requests.push(JSON.parse(init.body));const r=outputs.shift();if(r instanceof Error)throw r;return r instanceof Response?r:Response.json(r);}});
 const call=async(path,body,headers={})=>{const response=await handler(new Request('https://example.supabase.co/functions/v1/nyra-api'+path,{method:body===undefined?'GET':'POST',headers:{Origin:'https://eliaskalyvas.gr',Authorization:'Bearer '+token,...(body===undefined?{}:{'Content-Type':'application/json'}),...headers},body:body===undefined?undefined:JSON.stringify(body)}));return {status:response.status,data:await response.json()};};
 const create=async(extra={})=>(await call('/work',{...assignment,model:'gpt-6.1-sol',budget:3,auto_repairs:false,...extra})).data;
 return {...f,requests,call,create};
}
test('costs count cached reads/writes, output (already includes reasoning) and tools once',()=>{
 const c=usageCost('gpt-6-astra',{usage:{input_tokens:10000,input_tokens_details:{cached_tokens:2000,cache_write_tokens:3000},output_tokens:1000,output_tokens_details:{reasoning_tokens:400}},output:[{type:'web_search_call'}]});
 assert.equal(c.usd,.1495);assert.equal(c.reasoning_tokens,400);
 assert.equal(usageCost('gpt-6-astra',{}),null);
 assert.ok(stageEstimate('gpt-6-astra','research',{})>stageEstimate('gpt-6.1-sol','research',{}));
});
test('workspace isolates owners, denies old paid endpoints, persists history and validates settings',async()=>{
 const s=await setup();try{
 assert.equal((await s.call('/research',assignment)).status,404);
 assert.equal((await s.call('/work',{...assignment,model:'injected',budget:3,auto_repairs:false})).data.error,'INVALID_MODEL');
 const w=await s.create();assert.ok(w.id);assert.equal(w.state.stage,'research');assert.equal(w.owner_id,undefined);
 assert.equal((await s.call('/work')).data.work.length,1);
 s.users.set(token,{id:other});assert.equal((await s.call('/work/'+w.id)).status,404);
 s.users.set(token,{id:owner});assert.equal((await s.call('/work/'+w.id)).data.title,assignment.topic);
 assert.equal((await s.call('/work',undefined,{Authorization:''})).status,401);
 assert.equal((await s.call('/work',undefined,{Origin:'https://evil.test'})).status,403);
 }finally{await s.pg.close();}
});
test('budget and row locking stop calls before billing, duplicates never charge twice',async()=>{
 const s=await setup([report]);try{
 const low=await s.create({budget:.1,model:'gpt-6-astra'});
 assert.equal((await s.call('/work/'+low.id+'/step',{seq:0})).data.error,'BUDGET_EXCEEDED');assert.equal(s.requests.length,0);
 const w=await s.create();
 assert.equal((await s.db.rpc('nyra_begin_step',{p_id:w.id,p_owner:owner,p_seq:0,p_stage:'research',p_reserve:.5})).data,'OK');
 assert.equal((await s.call('/work/'+w.id+'/step',{seq:0})).data.error,'WORK_BUSY');assert.equal(s.requests.length,0);
 const ready=await s.create();const r=(await s.call('/work/'+ready.id+'/step',{seq:0})).data;
 assert.equal(r.state.stage,'evidence');assert.equal(r.state.research.ticket,undefined);assert.equal(s.requests[0].model,'gpt-6.1-sol');assert.equal(r.steps.length,1);
 const again=(await s.call('/work/'+ready.id+'/step',{seq:0})).data;assert.equal(again.seq,1);assert.equal(s.requests.length,1);
 }finally{await s.pg.close();}
});
test('history contains source captures and drafts; manual repairs pause and model switching works',async()=>{
 const review={checks:{clarity:true,coherence:true,editorial_contribution:true,counterargument:true,evidence:false},needs_research:true,issues:['Missing support'],revision_instructions:'Research source',research_questions:'Find context'};
 const s=await setup([report,output(article,'draft'),output(review,'review')]);try{
 let w=await s.create();for(let i=0;i<4;i++)w=(await s.call('/work/'+w.id+'/step',{seq:w.seq})).data;
 assert.equal(w.state.stage,'paused');assert.equal(w.state.drafts.length,1);assert.ok(w.state.research.source_records[0].excerpts.length);
 const loaded=(await s.call('/work/'+w.id)).data;assert.equal(loaded.state.drafts[0].automatic_review.passed,false);
 w=(await s.call('/work/'+w.id+'/settings',{model:'gpt-6-astra',budget:5,auto_repairs:false,resume:true})).data;
 assert.equal(w.model,'gpt-6-astra');assert.equal(w.state.stage,'research');
 const revised=(await s.call('/work/'+w.id+'/revision',{revision_note:'Make the reasoning clearer',version:0})).data;
 assert.equal(revised.state.stage,'draft');assert.equal(revised.state.revision_of.id,w.id);
 }finally{await s.pg.close();}
});
test('unknown provider charges retain reservations and stop until explicit continuation',async()=>{
 const s=await setup([new Error('network lost')]);try{
 const w=await s.create();const r=(await s.call('/work/'+w.id+'/step',{seq:0})).data;
 assert.equal(r.state.stage,'error');assert.equal(r.steps[0].status,'unknown_cost');assert.ok(Number(r.spent)>0);
 assert.equal((await s.call('/work/'+w.id+'/step',{seq:1})).data.error,'WORK_PAUSED_OR_DONE');assert.equal(s.requests.length,1);
 }finally{await s.pg.close();}
});
test('three current proposals require explicit owner selection before any article call',async()=>{
 const topics=[0,1,2].map(i=>({title:'Topic '+i,sector:['economy','politics','work'][i],why_now:'A dated development',event_date:'2026-10-22',central_question:'Who decides?',provisional_thesis:'A position',original_angle:'A consequence',counterargument:'A challenge',format:'signal',source_urls:[source]}));
 const proposalOutput=output({topics});proposalOutput.output.unshift(report.output[0]);
 const s=await setup([proposalOutput]);try{
 let w=await s.create({kind:'topics'});w=(await s.call('/work/'+w.id+'/step',{seq:0})).data;
 assert.equal((await s.call('/work/'+w.id+'/settings',{model:'gpt-6.1-sol',budget:3,auto_repairs:true,resume:true})).data.error,'WORK_PAUSED_OR_DONE');
 assert.equal(w.state.stage,'selection');assert.equal(w.state.drafts.length,0);assert.equal(s.requests.length,1);
 assert.equal((await s.call('/work/'+w.id+'/step',{seq:1})).data.error,'WORK_PAUSED_OR_DONE');
 const chosen=await s.create({selected_from:w.id,selected_index:1});assert.equal(chosen.title,'Topic 1');assert.equal(chosen.state.approval.index,1);assert.equal(chosen.state.stage,'research');assert.equal(s.requests.length,1);
 assert.throws(()=>validateProposals({topics:topics.map(t=>({...t,source_urls:['https://invented.test']}))},[{url:source}]));
 }finally{await s.pg.close();}
});
test('RLS and grants block all direct client reads and RPC writes',async()=>{
 const s=await setup();try{
 await s.pg.exec('set role anon');await assert.rejects(s.pg.query('select * from nyra_work'));await s.pg.exec('reset role;set role authenticated');await assert.rejects(s.pg.query('select * from nyra_steps'));
 await assert.rejects(s.pg.query(`select nyra_begin_step('${owner}','${owner}',0,'research',1)`));await s.pg.exec('reset role');
 }finally{await s.pg.close();}
});
test('repair cap terminates after two cycles and public history strips nested tickets',()=>{
 const state={cycle:2,drafts:[{article:{},research:{ticket:'secret'}}]};const review={passed:false,issues:['gap']};
 assert.equal(advanceState(state,'review',review,true).stage,'done');
 assert.equal(publicWork({model:'gpt-6.1-sol',state:{stage:'done',...state}}).state.drafts[0].research.ticket,undefined);
});
test('old exports can be imported without billing; fake evidence and executable links are rejected',async()=>{
 const s=await setup();try{
 const draft={assignment,article,sources:[{url:source,title:'Original reference'}],run:{model:'gpt-6-astra'},research:{ticket:'untrusted',report:'Historical report'}};
 const imported=(await s.call('/import',{export:{drafts:[draft]},model:'gpt-6.1-sol',budget:3,auto_repairs:false})).data;
 assert.equal(imported.state.imported,true);assert.equal(imported.state.drafts.length,1);assert.equal(imported.state.drafts[0].research.ticket,undefined);assert.equal(imported.state.drafts[0].automatic_review,null);assert.equal(s.requests.length,0);
 assert.equal((await s.call('/work/'+imported.id+'/revision',{revision_note:'revise',version:0})).data.error,'IMPORTED_RESEARCH_REQUIRES_NEW_ASSIGNMENT');
 const bad=structuredClone(draft);bad.sources=[{url:'javascript:alert(1)'}];bad.article.paragraphs[0].source_urls=['javascript:alert(1)'];
 assert.notEqual((await s.call('/import',{export:{drafts:[bad]},model:'gpt-6.1-sol',budget:3,auto_repairs:false})).status,200);
 }finally{await s.pg.close();}
});
test('changing model after saved research renews its signed packet without rerunning research',async()=>{
 const s=await setup([report,output(article,'new-model-draft')]);try{
 let w=await s.create();w=(await s.call('/work/'+w.id+'/step',{seq:w.seq})).data;
 w=(await s.call('/work/'+w.id+'/settings',{model:'gpt-6-astra',budget:5,auto_repairs:false,resume:false})).data;
 w=(await s.call('/work/'+w.id+'/step',{seq:w.seq})).data;
 w=(await s.call('/work/'+w.id+'/step',{seq:w.seq})).data;
 assert.equal(w.state.stage,'review');assert.equal(w.state.drafts[0].run.model,'gpt-6-astra');assert.equal(s.requests.length,2);
 assert.equal(s.requests[0].model,'gpt-6.1-sol');assert.equal(s.requests[1].model,'gpt-6-astra');
 }finally{await s.pg.close();}
});
test('owner can save presentation without a paid call; metadata persists per selected article version',async()=>{
 const s=await setup([report,output(article,'draft-for-metadata')]);try{
 let w=await s.create();for(let i=0;i<3;i++)w=(await s.call('/work/'+w.id+'/step',{seq:w.seq})).data;
 const beforeCalls=s.requests.length,beforeSpent=w.spent;
 const p={...w.state.drafts[0].presentation,tags:['Οικονομία'],hashtags:['#Οικονομία','#Startups','#ΤεχνητήΝοημοσύνη'],share_text:'A new sharing introduction'};
 w=(await s.call('/work/'+w.id+'/presentation',{version:0,expected_revision:0,presentation:p})).data;
 assert.equal(w.state.drafts[0].presentation.revision,1);assert.equal(w.state.drafts[0].presentation.share_text,p.share_text);assert.equal(s.requests.length,beforeCalls);assert.equal(w.spent,beforeSpent);
 assert.equal((await s.call('/work/'+w.id+'/presentation',{version:0,expected_revision:0,presentation:p})).data.error,'STALE_PRESENTATION');
 assert.equal((await s.call('/work/'+w.id)).data.state.drafts[0].presentation.share_text,p.share_text);
 }finally{await s.pg.close();}
});

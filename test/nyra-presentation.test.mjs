import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fixture} from './fixture.mjs';
import {emptyPresentation,validatePresentation,presentationStatus,imageUrl} from '../supabase/functions/nyra-api/lib/presentation.mjs';
import {seal,unseal} from '../supabase/functions/nyra-api/lib/api.mjs';
import {PROMPT_VERSION,CORE_INSTRUCTIONS} from '../supabase/functions/nyra-api/lib/instructions.mjs';
const owner='dad84105-d898-4194-bbe1-721a2636e543',other='cad84105-d898-4194-bbe1-721a2636e543';
const valid=()=>({...emptyPresentation(),tags:['Οικονομία','Startups'],hashtags:['#Οικονομία','#Startups','#ΤεχνητήΝοημοσύνη'],share_title:'AI and investment',share_description:'A faithful summary',share_text:'A short introduction',image_brief:'Photograph of a real workplace; search: work technology'});
test('presentation separates topical tags from 3–5 hashtags and never requires a fabricated image',()=>{
 const p=validatePresentation(valid(),{generated:true});assert.equal(p.cover.image_url,'');assert.equal(presentationStatus(p).ready_for_owner_review,false);assert.deepEqual(presentationStatus(p).missing,['cover']);
 assert.throws(()=>validatePresentation({...valid(),hashtags:['#AI']},{generated:true}));
 assert.throws(()=>validatePresentation({...valid(),hashtags:['#bad hashtag']}));
 assert.throws(()=>validatePresentation({...valid(),hashtags:Array(6).fill('#Work')}));
 assert.ok(CORE_INSTRUCTIONS.includes('#Οικονομία #Startups #ΤεχνητήΝοημοσύνη'));
 assert.ok(CORE_INSTRUCTIONS.includes('δεν κάνει αυτόνομη αναζήτηση'));
});
test('image records require public HTTPS and complete source/rights details for owner confirmation',()=>{
 for(const url of ['javascript:alert(1)','data:image/svg+xml,x','http://example.com/a.jpg','https://127.0.0.1/','https://[::1]/','https://localhost/a.jpg','https://foo.internal/a.jpg','https://user:pass@example.com/a.jpg'])assert.throws(()=>imageUrl(url));
 const p=valid();p.cover.image_url='https://images.example.com/a.jpg';p.cover.rights_confirmed=true;
 assert.throws(()=>validatePresentation(p));
 Object.assign(p.cover,{source_url:'https://example.com/image-page',creator:'Photographer',license_name:'Permission recorded by owner',alt:'A team reviewing a document'});
 assert.equal(presentationStatus(validatePresentation(p)).ready_for_owner_review,true);
});
test('server-only metadata writes lock out paid stages, preserve version history, detect stale edits and leave costs unchanged',async()=>{
 const f=await fixture();try{
 for(const name of ['20261022073258_nyra_persistent_editorial_workspace.sql','20261022082003_nyra_article_presentation.sql'])await f.pg.exec(await readFile(new URL('../supabase/migrations/'+name,import.meta.url),'utf8'));
 await f.pg.exec(`insert into auth.users(id) values('${owner}'),('${other}')`);
 const state={stage:'done',publication_approval:'stale-approval',drafts:[{article:{title:'Immutable article'}},{article:{title:'Other version'}}]};
 const id=(await f.pg.query(`insert into nyra_work(owner_id,title,kind,model,budget,state) values($1,'Draft','article','gpt-6.1-sol',3,$2) returning id`,[owner,JSON.stringify(state)])).rows[0].id;
 const save=(version,revision,p_owner=owner)=>f.db.rpc('nyra_save_presentation',{p_id:id,p_owner,p_version:version,p_expected_revision:revision,p_presentation:valid()});
 assert.equal((await save(0,0,other)).data,'NOT_FOUND');
 assert.equal((await save(0,0)).data,'OK');assert.equal((await save(0,0)).data,'STALE_PRESENTATION');
 assert.equal((await save(0,1)).data,'OK');assert.equal((await save(5,0)).data,'INVALID_VERSION');
 let row=(await f.pg.query('select * from nyra_work where id=$1',[id])).rows[0];
 assert.equal(row.state.drafts[0].presentation.revision,2);assert.equal(row.state.drafts[0].presentation_history.length,1);assert.equal(row.state.drafts[0].article.title,'Immutable article');assert.equal(row.state.drafts[1].presentation,undefined);assert.equal(row.state.publication_approval,undefined);assert.equal(Number(row.spent),0);assert.equal(row.seq,0);
 await f.pg.query('update nyra_work set active_seq=0 where id=$1',[id]);assert.equal((await save(0,2)).data,'WORK_BUSY');
 await f.pg.exec('set role anon');await assert.rejects(f.pg.query(`select nyra_save_presentation('${id}','${owner}',0,2,'{}')`));await f.pg.exec('reset role');
 }finally{await f.pg.close();}
});
test('only the managed server can renew a stored v0.6 ticket; public unseal remains current-version bound',async()=>{
 const ticket=await seal({owner_id:owner,prompt_version:'nyra-core-0.6',expires_at:100},'test-secret');
 await assert.rejects(unseal(ticket,'test-secret',owner,1));
 assert.equal((await unseal(ticket,'test-secret',owner,0,['nyra-core-0.6'])).prompt_version,'nyra-core-0.6');
 await assert.rejects(unseal(ticket,'test-secret',other,0,['nyra-core-0.6']));
 assert.equal(PROMPT_VERSION,'nyra-core-0.7');
});

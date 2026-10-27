import test from 'node:test';
import assert from 'node:assert/strict';
import {authorityFixture,OWNER,OTHER,SESSION,MIGRATION} from './fixtures/publication-authority.mjs';
import {uid} from './fixtures/publication-v1.1.mjs';
import {validatePublicationSet} from '../lib/publication/contract.mjs';
const using=async fn=>{const f=await authorityFixture();try{await fn(f);}finally{await f.pg.close();}};
const setup=async f=>{const w=await f.work(),asset=await f.asset();assert.equal(asset.status,200,JSON.stringify(asset.body));return {w,asset:asset.body.asset_id};};
const rows=async(f,t)=>(await f.pg.query('select * from '+t)).rows;

test('Phase 2 private preview and one-click approval produce an immutable held release',()=>using(async f=>{
 const {w,asset}=await setup(f),p=await f.prepare(w,asset);assert.equal(p.status,200,JSON.stringify(p.body));assert.equal(p.body.status,'awaiting_owner_action');
 assert(!JSON.stringify(p.body).includes('PRIVATE_'));assert.equal(p.headers.get('cache-control'),'no-store');
 const result=await f.authorize(p);assert.equal(result.status,200,JSON.stringify(result.body));assert.equal(result.body.status,'authorized_held');assert.equal(result.body.publishing,false);assert.equal(result.body.delivered,false);
 const decision=(await rows(f,'nyra_publication_decisions'))[0],release=(await rows(f,'nyra_publication_releases'))[0];
 assert.equal(decision.owner_id,OWNER);assert.equal(decision.session_id,SESSION);assert.equal(decision.approved_payload_sha256,release.snapshot.authorization.approved_payload_sha256);
 assert.equal(new Date(decision.human_approved_at).toISOString(),new Date(decision.publication_authorized_at).toISOString());assert(!JSON.stringify(release.snapshot).includes('PRIVATE_'));
 const catalog=(await rows(f,'nyra_publication_catalog'))[0];assert.equal(catalog.verified_live_manifest,null);validatePublicationSet({manifest:catalog.desired_manifest,releases:[release.snapshot]},{now:new Date().toISOString()});
 assert.equal((await rows(f,'nyra_publication_outbox'))[0].status,'held');assert.equal((await rows(f,'nyra_publication_outbox'))[0].delivered_at,null);
}));
for(const kind of ['anonymous','non-owner','aal1','expired','invalid','missing-session','anonymous-user','wrong-origin','mfa-unenrolled'])test('Phase 2 rejects '+kind,()=>using(async f=>{
 let token=f.good,origin='https://eliaskalyvas.gr';
 if(kind==='anonymous')token=null;
 if(kind==='non-owner')token=f.token({owner:OTHER});
 if(kind==='aal1')token=f.token({aal:'aal1'});
 if(kind==='expired')token=f.token({exp:Math.floor(Date.now()/1000)-1});
 if(kind==='invalid')token=f.token({registered:false,session:uid(987)});
 if(kind==='missing-session')token=f.token({session:uid(986)});
 if(kind==='anonymous-user')token=f.token({anonymous:true});
 if(kind==='wrong-origin')origin='https://attacker.org';
 if(kind==='mfa-unenrolled')f.setLevels({currentLevel:'aal2',nextLevel:'aal1'});
 const w=await f.work(),response=await f.call('/publication/preview',f.input(w,uid(99)),token,origin);assert(response.status>=400,JSON.stringify(response.body));
 assert.equal((await rows(f,'nyra_publication_decisions')).length,0);
}));
test('Phase 2 every route reauthenticates; revoked/expired SQL sessions and cross-owner works fail',()=>using(async f=>{
 const {w,asset}=await setup(f),p=await f.prepare(w,asset);assert.equal(p.status,200);
 await f.pg.query('delete from auth.sessions where id=$1',[SESSION]);assert.equal((await f.authorize(p)).status,409);
 const foreign=await f.work({owner:OTHER});assert.equal((await f.prepare(foreign,asset)).status,409);
 assert.equal((await rows(f,'nyra_publication_decisions')).length,0);
}));
for(const [name,mutate]of [
 ['failed review',w=>w.state.drafts[0].automatic_review.passed=false],['unfinished review',w=>w.state.drafts[0].automatic_review=null],
 ['imported history',w=>w.state.imported=true],['imported prompt',w=>w.state.drafts[0].run.prompt_version='imported'],
 ['needs revision',w=>w.state.drafts[0].article.status='needs_revision'],['incomplete presentation',w=>w.state.drafts[0].presentation.share_title=''],
 ['unconfirmed image rights',w=>w.state.drafts[0].presentation.cover.rights_confirmed=false],['changed rights metadata',w=>w.state.drafts[0].presentation.cover.creator='Unapproved'],
 ['missing evidence',w=>w.state.drafts[0].article.paragraphs[0].evidence_ids=[]],['busy work',w=>w.active_seq=0],
 ['superseded version',w=>w.state.drafts.push(structuredClone(w.state.drafts[0]))],
])test('Phase 2 rejects '+name,()=>using(async f=>{
 const {w,asset}=await setup(f);await f.mutate(w.id,mutate);const p=await f.prepare(w,asset);assert(p.status>=400,JSON.stringify(p.body));assert.equal((await rows(f,'nyra_publication_decisions')).length,0);
}));
test('Phase 2 forged owner/hash/status fields are not accepted as authorization',()=>using(async f=>{
 const {w,asset}=await setup(f);
 for(const field of ['owner_id','approved','published','release_hash']){const request=f.input(w,asset);request[field]=true;assert.equal((await f.call('/publication/preview',request)).status,400);}
 const p=await f.prepare(w,asset);const forged=await f.call('/publication/authorize',{preview_id:p.body.preview_id,request_id:crypto.randomUUID(),approved:true});assert.equal(forged.status,400);
}));
for(const change of ['content','presentation','language','review'])test('Phase 2 exact preview binding rejects stale '+change,()=>using(async f=>{
 const {w,asset}=await setup(f),p=await f.prepare(w,asset);assert.equal(p.status,200);
 await f.mutate(w.id,w=>{if(change==='content')w.state.drafts[0].article.title+=' changed';if(change==='presentation')w.state.drafts[0].presentation.revision++;if(change==='language')w.state.assignment.language='en';if(change==='review')w.state.drafts[0].automatic_review.passed=false;});
 const r=await f.authorize(p);assert.equal(r.status,409,JSON.stringify(r.body));assert.equal((await rows(f,'nyra_publication_decisions')).length,0);
}));
test('Phase 2 duplicate concurrent clicks are idempotent and replay cannot create another authorization',()=>using(async f=>{
 const {w,asset}=await setup(f),p=await f.prepare(w,asset),request=crypto.randomUUID();const results=await Promise.all([f.authorize(p,request),f.authorize(p,request)]);
 assert(results.every(r=>r.status===200),JSON.stringify(results));assert.deepEqual(results[0].body,results[1].body);assert.equal((await rows(f,'nyra_publication_decisions')).length,1);
 const replay=await f.authorize(p);assert.equal(replay.status,409);assert.equal((await rows(f,'nyra_publication_releases')).length,1);
}));
test('Phase 2 two prepared actions cannot overwrite the same manifest generation',()=>using(async f=>{
 const {w,asset}=await setup(f),p1=await f.prepare(w,asset),p2=await f.prepare(w,asset);assert.equal(p1.status,200);assert.equal(p2.status,200);
 const r=await Promise.all([f.authorize(p1),f.authorize(p2)]);assert.equal(r.filter(x=>x.status===200).length,1,JSON.stringify(r));assert.equal((await rows(f,'nyra_publication_decisions')).length,1);
}));
test('Phase 2 private tables and RPCs deny anon/authenticated and immutable records deny service updates',()=>using(async f=>{
 const {w,asset}=await setup(f),p=await f.prepare(w,asset);await f.authorize(p);
 for(const role of ['anon','authenticated']){await f.pg.exec('set role '+role);try{
  for(const table of ['catalog','articles','assets','previews','decisions','releases','manifests','events','outbox'])await assert.rejects(f.pg.query('select * from nyra_publication_'+table));
  await assert.rejects(f.pg.query('select nyra_publication_actor($1,$2,$3)',[OWNER,SESSION,new Date(Date.now()+60000).toISOString()]));
 }finally{await f.pg.exec('reset role');}}
 const procs=(await f.pg.query("select proname,prosecdef from pg_proc where proname like 'nyra_publication_%'")).rows;assert(procs.every(p=>p.prosecdef===false));
 await assert.rejects(f.pg.query("update nyra_publication_releases set snapshot='{}'"),/PUB_IMMUTABLE/);
 await f.pg.exec('set role service_role');try{await assert.rejects(f.pg.query("update nyra_publication_outbox set status='delivered'"));}finally{await f.pg.exec('reset role');}
}));
test('Phase 2 failed transaction leaves no partial decision/release/event/outbox and same request retries safely',()=>using(async f=>{
 const {w,asset}=await setup(f),p=await f.prepare(w,asset),request=crypto.randomUUID();
 await f.pg.exec("create function fail_outbox() returns trigger language plpgsql as $$ begin raise exception 'synthetic failure'; end $$;create trigger fail_outbox before insert on nyra_publication_outbox for each row execute function fail_outbox();");
 assert.equal((await f.authorize(p,request)).status,503);
 for(const t of ['decisions','releases','events','outbox'])assert.equal((await rows(f,'nyra_publication_'+t)).length,0);
 assert.equal((await rows(f,'nyra_publication_catalog'))[0].desired_manifest.generation,1);
 await f.pg.exec('drop trigger fail_outbox on nyra_publication_outbox;drop function fail_outbox();');assert.equal((await f.authorize(p,request)).status,200);
}));

test('Phase 2 publish/replace/withdraw/rollback are explicit, independently authorized and held',()=>using(async f=>{
 const {w,asset}=await setup(f);let p=await f.prepare(w,asset),r=await f.authorize(p);assert.equal(r.status,200);
 const first=(await rows(f,'nyra_publication_releases'))[0].snapshot,article=first.article_id;
 await f.mutate(w.id,w=>{w.state.drafts[0].article.title='Synthetic revised title';});
 p=await f.prepare(w,asset,{action:'replace',article_id:article});assert.equal(p.status,200,JSON.stringify(p.body));r=await f.authorize(p);assert.equal(r.status,200,JSON.stringify(r.body));
 const second=(await rows(f,'nyra_publication_releases')).find(x=>x.snapshot.release.sequence===2).snapshot;
 assert.equal(second.release.first_published_at,first.release.first_published_at);assert.equal(second.release.replaces_release_id,first.release.id);
 p=await f.prepare(w,null,{action:'withdraw',article_id:article});assert.equal(p.status,200);r=await f.authorize(p);assert.equal(r.status,200);assert.equal((await rows(f,'nyra_publication_catalog'))[0].desired_manifest.active_releases.length,0);
 const forbidden=await f.prepare(w,asset);assert.equal(forbidden.status,409);
 p=await f.prepare(w,null,{action:'rollback',article_id:article,restore_release_id:first.release.id});assert.equal(p.status,200,JSON.stringify(p.body));r=await f.authorize(p);assert.equal(r.status,200,JSON.stringify(r.body));
 const third=(await rows(f,'nyra_publication_releases')).find(x=>x.snapshot.release.sequence===3).snapshot;
 assert.equal(third.content.title,first.content.title);assert.equal(third.release.restores_release_id,first.release.id);assert.notEqual(third.release.id,first.release.id);
 assert.equal((await rows(f,'nyra_publication_decisions')).length,4);assert((await rows(f,'nyra_publication_outbox')).every(x=>x.status==='held'&&x.delivered_at===null));
}));
test('Phase 2 GR approval never authorizes EN; EN requires its own owner action',()=>using(async f=>{
 const {w,asset}=await setup(f),en=await f.work({language:'en'}),grPreview=await f.prepare(w,asset),enPreview=await f.prepare(en,asset);
 assert.equal(grPreview.status,200);assert.equal(enPreview.status,200);
 await f.authorize(grPreview);assert.equal((await rows(f,'nyra_publication_catalog'))[0].desired_manifest.active_releases.length,1);
 const stale=await f.authorize(enPreview);assert.equal(stale.status,409);
 const p=await f.prepare(en,asset),r=await f.authorize(p);assert.equal(r.status,200,JSON.stringify(r.body));
 const releases=(await rows(f,'nyra_publication_releases')).map(x=>x.snapshot);assert.deepEqual(releases.map(x=>x.locale).sort(),['el','en']);assert.notEqual(releases[0].authorization.id,releases[1].authorization.id);
}));
test('Phase 2 staged private identities support independent reciprocal translation approvals',()=>using(async f=>{
 const {w,asset}=await setup(f),en=await f.work({language:'en'}),firstGR=await f.prepare(w,asset);assert.equal(firstGR.status,200);
 const grIdentity=(await rows(f,'nyra_publication_articles'))[0];
 const enPreview=await f.prepare(en,asset,{translation_variant_id:grIdentity.variant_id});assert.equal(enPreview.status,200,JSON.stringify(enPreview.body));
 const enIdentity=(await rows(f,'nyra_publication_articles')).find(x=>x.locale==='en');
 const gr=await f.prepare(w,asset,{translation_variant_id:enIdentity.variant_id});assert.equal(gr.status,200,JSON.stringify(gr.body));assert.equal((await f.authorize(gr)).status,200);
 assert.equal((await rows(f,'nyra_publication_releases')).length,1);
 const english=await f.prepare(en,asset,{translation_variant_id:grIdentity.variant_id});assert.equal(english.status,200,JSON.stringify(english.body));assert.equal((await f.authorize(english)).status,200);
}));
test('Phase 2 metadata-owned template requires explicit rights review and exact presentation binding',()=>using(async f=>{
 const w=await f.work(),cover=structuredClone(f.cover);cover.kind='editorial_template';cover.template_id=uid(888);
 const asset=await f.asset(cover);assert.equal(asset.status,200);const p=await f.prepare(w,asset.body.asset_id);assert.equal(p.status,200,JSON.stringify(p.body));assert.equal(p.body.release.presentation.cover.kind,'editorial_template');
 const bad=structuredClone(cover);bad.attribution.rights_confirmed=false;assert.equal((await f.asset(bad)).status,422);
 assert.equal((await f.call('/publication/assets',{cover,rights_note:'yes'})).status,400);
}));
test('Phase 2 changing approved fields blocks a pending private export without exposing current drafts',()=>using(async f=>{
 const {preparedPublicationSet}=await import('../lib/publication/authority.mjs');const {w,asset}=await setup(f),p=await f.prepare(w,asset);await f.authorize(p);
 const context=async()=>(await f.db.rpc('nyra_publication_context',{p_owner:OWNER,p_session:SESSION,p_expires:new Date(Date.now()+60000).toISOString(),p_work:w.id})).data;
 const before=preparedPublicationSet(await context());assert.equal(before.releases.length,1);
 await f.mutate(w.id,w=>w.state.drafts[0].presentation.revision++);
 const ctx=await context();assert.throws(()=>preparedPublicationSet(ctx),/STALE_AUTHORIZATION/);
 assert(!JSON.stringify(before).includes('PRIVATE_'));
}));
test('Phase 2 SQL service role can execute verified operations while preview expiry and idempotency conflicts fail closed',()=>using(async f=>{
 const {w,asset}=await setup(f),p=await f.prepare(w,asset),request=crypto.randomUUID();
 await f.pg.exec('set role service_role');try{assert.equal((await f.authorize(p,request)).status,200);}finally{await f.pg.exec('reset role');}
 const p2=await f.prepare(w,asset,{action:'replace',article_id:p.body.release.article_id});assert.equal(p2.status,200);
 const conflict=await f.authorize(p2,request);assert.equal(conflict.status,409);assert.equal(conflict.body.error,'PUB_IDEMPOTENCY_CONFLICT');
 // Direct timestamp tampering is intentionally prevented even for maintenance updates by immutable triggers.
 await assert.rejects(f.pg.query("update nyra_publication_previews set expires_at=now()-interval '1 second'"),/PUB_IMMUTABLE/);
}));

test('Phase 2 approval/revision interleaving is rejected inside the locked commit, after server assembly',()=>using(async f=>{
 const {w,asset}=await setup(f),p=await f.prepare(w,asset),rpc=f.db.rpc;let changed=false;
 f.db.rpc=async(name,args)=>{if(name==='nyra_publication_commit'&&!changed){changed=true;await f.mutate(w.id,w=>w.state.drafts[0].presentation.revision++);}return rpc(name,args);};
 const r=await f.authorize(p);assert.equal(r.status,409);assert.equal(r.body.error,'PUB_STALE_WORK');assert.equal((await rows(f,'nyra_publication_decisions')).length,0);
}));
test('Phase 2 owner/session revocation between confirmation and commit is rechecked transactionally',()=>using(async f=>{
 const {w,asset}=await setup(f),p=await f.prepare(w,asset),rpc=f.db.rpc;
 f.db.rpc=async(name,args)=>{if(name==='nyra_publication_commit')await f.pg.query('delete from website_owners where user_id=$1',[OWNER]);return rpc(name,args);};
 const r=await f.authorize(p);assert.equal(r.status,409);assert.equal(r.body.error,'PUB_FORBIDDEN');assert.equal((await rows(f,'nyra_publication_decisions')).length,0);
}));
test('Phase 2 expired stored sessions and sessions belonging to another user cannot authorize',()=>using(async f=>{
 const {w,asset}=await setup(f),p=await f.prepare(w,asset);
 await f.pg.query("update auth.sessions set not_after=now()-interval '1 second' where id=$1",[SESSION]);assert.equal((await f.authorize(p)).body.error,'PUB_SESSION_INVALID');
 await f.pg.query('update auth.sessions set user_id=$1,not_after=null where id=$2',[OTHER,SESSION]);assert.equal((await f.authorize(p)).body.error,'PUB_SESSION_INVALID');
}));
test('Phase 2 expired preview fails closed without a partial decision',()=>using(async f=>{
 const {w,asset}=await setup(f),p=await f.prepare(w,asset),expired=crypto.randomUUID();
 await f.pg.query("insert into nyra_publication_previews(id,owner_id,session_id,work_id,version,source_work,preview,expires_at) select $1,owner_id,session_id,work_id,version,source_work,preview,now()-interval '1 second' from nyra_publication_previews where id=$2",[expired,p.body.preview_id]);
 const r=await f.call('/publication/authorize',{preview_id:expired,request_id:crypto.randomUUID()});assert.equal(r.body.error,'PUB_PREVIEW_EXPIRED');assert.equal((await rows(f,'nyra_publication_decisions')).length,0);
}));
test('Phase 2 SQL rejects altered approved payload and unrelated release injection after server assembly',()=>using(async f=>{
 const {w,asset}=await setup(f),p=await f.prepare(w,asset),rpc=f.db.rpc;
 for(const mutate of [c=>c.release=null,c=>c.release.content.title='forged',c=>c.after.releases.push(c.release),c=>c.event.approved_payload_sha256='0'.repeat(64),c=>c.after.manifest.withdrawn_variants.push({event_id:uid(1),withdrawn_at:new Date().toISOString()})]){
  f.db.rpc=async(name,args)=>{if(name==='nyra_publication_commit')mutate(args.p_candidate);return rpc(name,args);};const r=await f.authorize(p);assert.equal(r.status,409,JSON.stringify(r.body));assert.equal(r.body.error,'PUB_PREVIEW_MISMATCH');
 }
 assert.equal((await rows(f,'nyra_publication_decisions')).length,0);
}));
test('Phase 2 private preflight is origin-restricted and preview never exposes operational packets',()=>using(async f=>{
 const r=await f.handler(new Request('https://eliaskalyvas.gr/publication/authorize',{method:'OPTIONS',headers:{Origin:'https://eliaskalyvas.gr','Access-Control-Request-Method':'POST'}}));assert.equal(r.status,204);assert.equal(r.headers.get('access-control-allow-origin'),'https://eliaskalyvas.gr');
 const denied=await f.handler(new Request('https://eliaskalyvas.gr/publication/authorize',{method:'OPTIONS',headers:{Origin:'https://attacker.org'}}));assert.equal(denied.status,403);
 const {w,asset}=await setup(f),p=await f.prepare(w,asset);assert.equal(p.headers.get('access-control-allow-origin'),'https://eliaskalyvas.gr');
 for(const field of ['source_work','history','before','after','owner_id','session_id','ticket','source_records','PRIVATE_'])assert(!JSON.stringify(p.body).includes(field),field);
}));
test('Phase 2 private review component presents exact text, identity and an authorization-only action',async()=>{
 const React=await import('react'),{renderToStaticMarkup}=await import('react-dom/server'),{default:Review}=await import('../src/operations/NyraPublicationReview.mjs'),{releaseFixture}=await import('./fixtures/publication-v1.1.mjs');
 const release=releaseFixture();release.content.title='Exact <approved> title';
 const html=renderToStaticMarkup(React.createElement(Review,{preview:{preview_id:uid(9),action:'publish',release},onAuthorize:()=>{throw Error('must not execute during preview');}}));
 assert(html.includes('Exact &lt;approved&gt; title'));assert(html.includes('AI συντακτική φωνή'));assert(html.includes('<img'));assert(html.includes(release.presentation.cover.sha256));assert(html.includes('referrerPolicy="no-referrer"'));assert(html.includes('μόνο ιδιωτική προετοιμασία'));assert(!html.includes('Exact <approved> title'));
});
test('Phase 2 keeps verified JWT custom metadata outside publication JSON restrictions',()=>using(async f=>{
 const token=f.token({metadata:{fraction:0.5}});
 const r=await f.call('/publication/assets',{cover:f.cover,rights_note:'Explicit owner rights review with ordinary verified JWT metadata.'},token);
 assert.equal(r.status,200,JSON.stringify(r.body));assert.equal((await rows(f,'nyra_publication_assets'))[0].owner_id,OWNER);
}));
test('Phase 2 translation added after GR authorization reserves identity without approving EN',()=>using(async f=>{
 const {w,asset}=await setup(f),first=await f.prepare(w,asset);assert.equal((await f.authorize(first)).status,200);
 const gr=(await rows(f,'nyra_publication_articles'))[0],en=await f.work({language:'en'});
 const input={work_id:en.id,version:0,slug:'synthetic-en',translation_variant_id:gr.variant_id};
 const reserved=await f.call('/publication/identity',input);assert.equal(reserved.status,200,JSON.stringify(reserved.body));assert.equal(reserved.body.status,'identity_reserved');
 assert.equal((await rows(f,'nyra_publication_decisions')).length,1);assert.equal((await rows(f,'nyra_publication_catalog'))[0].desired_manifest.active_releases.length,1);
 const repeated=await f.call('/publication/identity',input);assert.equal(repeated.body.variant_id,reserved.body.variant_id);
 const greek=await f.prepare(w,asset,{action:'replace',article_id:gr.article_id,translation_variant_id:reserved.body.variant_id});assert.equal(greek.status,200,JSON.stringify(greek.body));assert.equal((await f.authorize(greek)).status,200);
 const english=await f.prepare(en,asset,{translation_variant_id:gr.variant_id});assert.equal(english.status,200,JSON.stringify(english.body));assert.equal((await f.authorize(english)).status,200);
 const catalog=(await rows(f,'nyra_publication_catalog'))[0];assert.equal(catalog.desired_manifest.active_releases.length,2);
}));

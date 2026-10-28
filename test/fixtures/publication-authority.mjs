import {readFile} from 'node:fs/promises';
import {fixture} from '../fixture.mjs';
import {releaseFixture,uid} from './publication-v1.1.mjs';
import {createPublicationAuthorityHandler} from '../../lib/publication/authority.mjs';

export const MIGRATION='20261027195057_nyra_private_publication_authority.sql';
export const OWNER=uid(900),OTHER=uid(901),SESSION=uid(902),ORIGIN='https://eliaskalyvas.gr';
export async function authorityFixture({backend=fixture}={}){
 const f=await backend();
 await f.pg.exec(`create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),aal text,not_after timestamptz);grant usage on schema auth to service_role;grant select(id,user_id,aal,not_after) on auth.sessions to service_role;`);
 for(const file of ['20261022073258_nyra_persistent_editorial_workspace.sql','20261022082003_nyra_article_presentation.sql',MIGRATION])await f.pg.exec(await readFile(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 await f.pg.query('insert into auth.users(id) values($1),($2)',[OWNER,OTHER]);
 await f.pg.query('insert into website_owners(user_id) values($1)',[OWNER]);
 await f.pg.query("insert into auth.sessions values($1,$2,'aal2',now()+interval '1 hour')",[SESSION,OWNER]);
 const tokens=new Map(),expiry=()=>Math.floor(Date.now()/1000)+3600;
 function token({owner=OWNER,session=SESSION,aal='aal2',exp=expiry(),registered=true,anonymous=false,metadata={}}={}){
  const t='eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({sub:owner,session_id:session,aal,exp,user_metadata:metadata})).toString('base64url')+'.synthetic-signature';
  if(registered){f.users.set(t,{id:owner,is_anonymous:anonymous});tokens.set(t,{aal});}return t;
 }
 let levels={currentLevel:'aal2',nextLevel:'aal2'};
 f.db.auth.mfa={getAuthenticatorAssuranceLevel:async t=>({data:tokens.has(t)?levels:null,error:tokens.has(t)?null:Error('invalid')})};
 const good=token(),handler=createPublicationAuthorityHandler({db:f.db,env:{ALLOWED_ORIGINS:ORIGIN}});
 const call=async(path,b,t=good,origin=ORIGIN)=>{const r=await handler(new Request(ORIGIN+path,{method:'POST',headers:{Origin:origin,...(t?{Authorization:'Bearer '+t}:{}),'Content-Type':'application/json'},body:JSON.stringify(b)}));return {status:r.status,body:await r.json(),headers:r.headers};};
 const raw=releaseFixture(),cover=raw.presentation.cover;
 const validReview={passed:true,approval:'human_required',needs_research:false,issues:[],revision_instructions:'',research_questions:'',checks:{clarity:true,coherence:true,editorial_contribution:true,counterargument:true,evidence:true,length:true,recorded_source_access:true}};
 async function work({language='gr',owner=OWNER}={}){
  const paragraph={text:Array(500).fill(language==='gr'?'δοκιμή':'synthetic').join(' '),source_urls:['https://www.oecd.org/'],evidence_ids:['receipt-1']};
  const assignment={topic:'Synthetic publication test',direction:'',language,format:'signal'};
  const presentation={tags:['AI','Work'],hashtags:['#AI','#Work','#Technology'],share_title:'Synthetic title',share_description:'Synthetic description',share_text:'Synthetic share text',image_brief:'Internal private image brief',revision:1,cover:{image_url:cover.url,source_url:cover.attribution.source_url,creator:cover.attribution.creator,license_name:cover.attribution.license_name,license_url:'',alt:cover.alt,caption:cover.caption,rights_confirmed:true}};
  const draft={assignment,article:{title:'Synthetic publication',summary:'Synthetic approved summary',thesis:'PRIVATE_THESIS_CANARY',original_contribution:'PRIVATE_CONTRIBUTION_CANARY',counterargument:'PRIVATE_COUNTERARGUMENT_CANARY',uncertainties:[],editor_note:'PRIVATE_EDITOR_NOTE_CANARY',paragraphs:[paragraph],checks:{length:true,citation_provenance:true},word_count:500,status:'pending_review'},presentation,automatic_review:structuredClone(validReview),run:{id:uid(700),prompt_version:'nyra-core-0.7'},sources:[{title:'Synthetic source',url:'https://www.oecd.org/'}],research:{report:'PRIVATE_REPORT_CANARY',ticket:'PRIVATE_TICKET_CANARY',source_records:[{source_url:'https://www.oecd.org/',status:'captured',excerpts:[{id:'receipt-1',text:'PRIVATE_EXCERPT_CANARY'}]}]}};
  const state={assignment,stage:'done',drafts:[draft]};
  return (await f.pg.query("insert into nyra_work(owner_id,title,kind,model,budget,state) values($1,'Synthetic','article','gpt-6.1-sol',3,$2) returning *",[owner,JSON.stringify(state)])).rows[0];
 }
 const asset=async(c=cover)=>call('/publication/assets',{cover:c,rights_note:'Owner reviewed synthetic rights for this local test.'});
 const input=(w,asset_id,{action='publish',article_id=null,restore_release_id=null,translation_variant_id=null}={})=>({action,work_id:w.id,version:0,article_id,restore_release_id,metadata:['publish','replace'].includes(action)?{slug:w.state.assignment.language==='gr'?'synthetic-gr':'synthetic-en',seo_title:null,seo_description:null,topic_ids:['ai','work'],asset_id,translation_variant_id,related_article_ids:[]}:null});
 const prepare=async(w,asset_id,opts={})=>call('/publication/preview',input(w,asset_id,opts));
 const authorize=async(p,request_id=crypto.randomUUID())=>call('/publication/authorize',{preview_id:p.body.preview_id,request_id});
 const mutate=async(id,fn)=>{const row=(await f.pg.query('select * from nyra_work where id=$1',[id])).rows[0];fn(row);await f.pg.query('update nyra_work set state=$2,active_seq=$3,updated_at=clock_timestamp() where id=$1',[id,JSON.stringify(row.state),row.active_seq]);};
 return {...f,handler,token,good,call,work,asset,input,prepare,authorize,mutate,cover,setLevels:v=>levels=v};
}

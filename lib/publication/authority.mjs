// Private Phase 2 application service. Intentionally NOT mounted by an Edge Function or website.
import {randomUUID} from 'node:crypto';
import {createNyraHandler,validateArticle,validateReview} from '../../supabase/functions/nyra-api/lib/api.mjs';
import {hashJSON,canonicalize,parseContractJSON,mapNyraContent,canonicalURL,approvalPayload,releaseReference,validateRelease,validatePublicationSet,validateTransition,ContractError} from './contract.mjs';

export class AuthorityError extends Error {
  constructor(code,status=409){super(code);this.code=code;this.status=status;}
}
const fail=(code,status)=>{throw new AuthorityError(code,status);};
const need=(value,code,status)=>{if(!value)fail(code,status);};
const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
const exact=(value,keys)=>need(value&&typeof value==='object'&&!Array.isArray(value)&&Object.keys(value).length===keys.length&&keys.every(k=>Object.hasOwn(value,k)),'INVALID_FIELDS',400);
const identity='https://eliaskalyvas.gr/#person';
const disclosure={el:'Έρευνα και κείμενο: Nyra, η AI συντακτική φωνή του Signals. Ανθρώπινη συντακτική εποπτεία και τελική έγκριση δημοσίευσης: Ηλίας Καλύβας.',en:'Research and text: Nyra, the AI editorial voice of Signals. Human editorial oversight and final publication approval: Elias Kalyvas.'};
const key=r=>r.article_id+':'+r.locale;
const rpc=async(db,name,args)=>{const r=await db.rpc(name,args);if(r.error){const code=r.error.message?.match(/\b(PUB_[A-Z_]+)\b/)?.[1];fail(code||'STORAGE_UNAVAILABLE',code?409:503);}return r.data;};
const actorArgs=a=>({p_owner:a.owner,p_session:a.session,p_expires:a.expires});

// Private in-process export preparation only. No network route exposes this dataset.
export function preparedPublicationSet(ctx){
 // Immutable authorized snapshots survive later private edits. This prepares a
 // desired dataset only; it is never evidence of delivery or verified-live state.
 need(ctx.authorization_state==='authorized_held'&&ctx.verified_live_manifest===null,'MISSING_AUTHORIZATION_STATE');
 return validatePublicationSet({manifest:ctx.manifest,releases:ctx.active},{now:ctx.now});
}

function eligible(work,version){
 need(work?.kind==='article'&&work.active_seq===null&&work.state.stage==='done'&&!work.state.imported,'EDITORIAL_NOT_ELIGIBLE');
 need(Number.isInteger(version)&&version===work.state.drafts.length-1,'SUPERSEDED_VERSION');
 const d=work.state.drafts[version],review=d?.automatic_review;
 need(d&&d.run?.prompt_version!=='imported'&&d.article.status==='pending_review'&&review?.passed===true&&review.approval==='human_required'&&review.needs_research===false&&Array.isArray(review.issues)&&review.issues.length===0,'REVIEW_REQUIRED');
 const article=validateArticle(structuredClone(d.article),d.sources,d.assignment.format,d.research?.source_records||[]);
 const checked=validateReview(review,article,d.sources,d.assignment.language,d.research?.source_records||[]);
 need(checked.passed&&canonicalize(article.paragraphs)===canonicalize(d.article.paragraphs),'REVIEW_REQUIRED');
 need(d.assignment.language===work.state.assignment.language&&d.assignment.format===work.state.assignment.format,'ASSIGNMENT_MISMATCH');
 need(d.presentation&&Number.isInteger(d.presentation.revision),'PRESENTATION_REQUIRED');
 return d;
}
function bindCover(p,asset){
 need(asset&&p.cover?.rights_confirmed===true,'ASSET_RIGHTS_REQUIRED');
 const c=asset.cover,s=p.cover,a=c.attribution;
 need(s.image_url===c.url&&s.source_url===a.source_url&&s.creator===a.creator&&s.license_name===a.license_name&&(s.license_url||null)===a.license_url&&s.alt===c.alt&&s.caption===c.caption,'ASSET_PRESENTATION_MISMATCH');
 return structuredClone(c);
}
function finalized(preview,now){
 const p=structuredClone(preview),r=p.release;
 if(r){
  r.authorization.human_approved_at=now;r.authorization.publication_authorized_at=now;
  r.release.release_issued_at=now;r.release.modified_at=now;
  if(r.authorization.action==='publish')r.release.first_published_at=now;
  validateRelease(r,{now});p.event.new_release=releaseReference(r);
  p.after.releases=p.after.releases.map(x=>x.release.id===r.release.id?r:x);
 }
 p.event.authorized_at=now;p.after.manifest.issued_at=now;
 p.after.manifest.active_releases=p.after.releases.map(releaseReference);
 if(p.event.action==='withdraw')p.after.manifest.withdrawn_variants=p.after.manifest.withdrawn_variants.map(w=>w.event_id===p.event.id?{...w,withdrawn_at:now}:w);
 validateTransition(p.before,p.after,[p.event],{now,history:p.history});return p;
}

export function assemblePreview(ctx,input){
 exact(input,['action','work_id','version','article_id','restore_release_id','metadata']);
 need(['publish','replace','withdraw','rollback'].includes(input.action)&&uuid(input.work_id)&&Number.isInteger(input.version)&&input.version>=0,'INVALID_FIELDS',400);
 const work=ctx.work;need(work&&work.id===input.work_id,'NOT_FOUND',404);
 const now=ctx.now,action=input.action;
 const before={manifest:ctx.manifest,releases:ctx.active};validatePublicationSet(before,{now});
 let article=ctx.articles.find(a=>a.article_id===input.article_id),fresh=null,newIdentity=null;
 let active=article&&ctx.active.find(r=>r.article_id===article.article_id);
 const prior=article&&ctx.history.filter(r=>r.article_id===article.article_id).sort((a,b)=>b.release.sequence-a.release.sequence)[0];
 const authorizationId=randomUUID(),eventId=randomUUID();
 if(action==='publish'||action==='replace'){
  const d=eligible(work,input.version),m=input.metadata;
  exact(m,['slug','seo_title','seo_description','topic_ids','asset_id','translation_variant_id','related_article_ids']);
  need((m.seo_title===null||typeof m.seo_title==='string')&&(m.seo_description===null||typeof m.seo_description==='string'),'INVALID_FIELDS',400);
  need(uuid(m.asset_id)&&(m.translation_variant_id===null||uuid(m.translation_variant_id)),'INVALID_FIELDS',400);
  const locale=d.assignment.language==='gr'?'el':d.assignment.language==='en'?'en':null;
  need(locale,'INVALID_LANGUAGE');
  const target=m.translation_variant_id&&ctx.articles.find(a=>a.variant_id===m.translation_variant_id);
  need(!m.translation_variant_id||target&&target.locale!==locale,'INVALID_TRANSLATION_TARGET');
  if(action==='publish'){
   need(input.article_id===null&&input.restore_release_id===null,'INVALID_FIELDS',400);
   article=ctx.articles.find(a=>a.work_id===work.id);
   need(!article||!ctx.history.some(r=>r.article_id===article.article_id),'ARTICLE_ALREADY_AUTHORIZED');
   if(!article)newIdentity=article={article_id:randomUUID(),variant_id:randomUUID(),work_id:work.id,locale,slug:m.slug,canonical_url:canonicalURL(locale,m.slug),translation_group_id:target?.translation_group_id||randomUUID()};
  }else{
   need(article&&active&&input.restore_release_id===null,'ACTIVE_RELEASE_REQUIRED');
   need(ctx.associated_article_ids?.includes(article.article_id),'ARTICLE_LINEAGE_REQUIRED');
  }
  need(article.locale===locale&&article.slug===m.slug&&(!target||target.translation_group_id===article.translation_group_id),'IDENTITY_MISMATCH');
  const content=mapNyraContent(d),p=d.presentation,asset=ctx.assets.find(a=>a.id===m.asset_id);
  const presentation={seo_title:m.seo_title??p.share_title,seo_description:m.seo_description??p.share_description,social_title:p.share_title,social_description:p.share_description,share_text:p.share_text,topic_ids:m.topic_ids,hashtags:p.hashtags,cover:bindCover(p,asset),related_article_ids:m.related_article_ids};
  fresh={schema_version:'nyra.publication.v1.1',article_id:article.article_id,variant_id:article.variant_id,locale,format:d.assignment.format,slug:article.slug,canonical_url:article.canonical_url,content_revision:{id:randomUUID(),sha256:hashJSON(content)},presentation_revision:{id:randomUUID(),number:p.revision,sha256:hashJSON(presentation)},content,presentation,identity:{editorial_voice:'Nyra',editorial_voice_type:'AI',human_editor_id:identity,publisher_id:identity,disclosure:disclosure[locale]},translation_group_id:article.translation_group_id,approved_translation_relations:target?[{article_id:target.article_id,variant_id:target.variant_id,locale:target.locale}]:[],authorization:{id:authorizationId,action,approved_by:identity,human_approved_at:now,publication_authorized_at:now,approved_payload_sha256:''},release:{id:randomUUID(),sequence:active?active.release.sequence+1:1,replaces_release_id:active?.release.id||null,restores_release_id:null,release_issued_at:now,first_published_at:active?.release.first_published_at||now,modified_at:now}};
 }else{
  need(input.metadata===null&&article&&prior,'UNKNOWN_ARTICLE');
  need(ctx.associated_article_ids?.includes(article.article_id),'ARTICLE_LINEAGE_REQUIRED');
  need(action!=='withdraw'||active,'ACTIVE_RELEASE_REQUIRED');
  if(action==='withdraw')need(input.restore_release_id===null,'INVALID_FIELDS',400);
  else{
   need(uuid(input.restore_release_id),'INVALID_FIELDS',400);
   const restore=ctx.history.find(r=>r.release.id===input.restore_release_id&&r.article_id===article.article_id);
   need(restore,'UNKNOWN_ROLLBACK_TARGET');
   need(ctx.assets.some(a=>a.cover.sha256===restore.presentation.cover.sha256),'ASSET_RIGHTS_REQUIRED');
   fresh=structuredClone(restore);fresh.authorization={id:authorizationId,action:'rollback',approved_by:identity,human_approved_at:now,publication_authorized_at:now,approved_payload_sha256:''};
   fresh.release={id:randomUUID(),sequence:prior.release.sequence+1,replaces_release_id:prior.release.id,restores_release_id:restore.release.id,release_issued_at:now,first_published_at:prior.release.first_published_at,modified_at:now};
  }
 }
 if(fresh){fresh.authorization.approved_payload_sha256=hashJSON(approvalPayload(fresh));validateRelease(fresh,{now});}
 const event={schema_version:'nyra.publication.event.v1.1',id:eventId,article_id:article.article_id,variant_id:article.variant_id,locale:article.locale,actor_id:identity,authorized_at:now,expected_generation:before.manifest.generation,expected_manifest_sha256:hashJSON(before.manifest),action,authorization_id:authorizationId,target_release_id:action==='publish'?null:(active||prior).release.id};
 if(fresh){event.new_release=releaseReference(fresh);event.approved_payload_sha256=fresh.authorization.approved_payload_sha256;}
 if(action==='rollback')event.restores_release_id=input.restore_release_id;
 const releases=before.releases.filter(r=>r.article_id!==article.article_id);if(fresh)releases.push(fresh);
 const withdrawn=before.manifest.withdrawn_variants.filter(w=>action!=='rollback'||w.article_id!==article.article_id);
 if(action==='withdraw')withdrawn.push({article_id:article.article_id,variant_id:article.variant_id,locale:article.locale,event_id:eventId,withdrawn_at:now,target_release_id:active.release.id});
 const after={manifest:{schema_version:'nyra.publication.manifest.v1.1',authority:'nyra',audience:'https://eliaskalyvas.gr',manifest_id:randomUUID(),generation:before.manifest.generation+1,previous_manifest_sha256:hashJSON(before.manifest),issued_at:now,active_releases:releases.map(releaseReference),withdrawn_variants:withdrawn},releases};
 validateTransition(before,after,[event],{now,history:ctx.history});
 preparedPublicationSet({...ctx,manifest:after.manifest,active:after.releases});
 return {action,version:input.version,release:fresh,event,before,after,history:ctx.history,new_identity:newIdentity,approved_payload_sha256:fresh?.authorization.approved_payload_sha256||hashJSON(active),source_work:work};
}

export function createPublicationAuthorityHandler({db,env,now=Date.now}){
 // The established gate verifies exact JWT, origin, website_owners and aal2. Only GET status is ever invoked.
 const core=createNyraHandler({db,env,fetcher:()=>fail('PROVIDER_FORBIDDEN',500),sourceFetcher:()=>fail('PROVIDER_FORBIDDEN',500),now});
 async function actor(req){
  const url=new URL(req.url);url.pathname='/nyra-api/status';
  const gate=await core(new Request(url,{method:'GET',headers:req.headers}));
  if(!gate.ok)return {gate};
  const token=req.headers.get('authorization')?.slice(7),verified=await db.auth.getUser(token);
  need(!verified.error&&verified.data?.user&&!verified.data.user.is_anonymous,'UNAUTHORIZED',401);
  // Decode only after exact-token Auth verification. JWT custom metadata is not
  // publication-contract JSON (for example it may legitimately contain decimals).
  let claims;try{claims=JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString('utf8'));}catch{fail('UNAUTHORIZED',401);}
  need(claims.sub===verified.data.user.id&&uuid(claims.session_id)&&Number.isSafeInteger(claims.exp)&&claims.exp*1000>now(),'SESSION_INVALID',401);
  const mfa=await db.auth.mfa.getAuthenticatorAssuranceLevel(token);
  need(!mfa.error&&mfa.data?.currentLevel==='aal2'&&mfa.data?.nextLevel==='aal2','MFA_REQUIRED',403);
  return {owner:verified.data.user.id,session:claims.session_id,expires:new Date(claims.exp*1000).toISOString()};
 }
 return async req=>{
  const headers={'Content-Type':'application/json','Cache-Control':'no-store','Referrer-Policy':'no-referrer'};
  const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
  try{
   if(req.method==='OPTIONS'){
    const url=new URL(req.url);url.pathname='/nyra-api/status';
    return core(new Request(url,{method:'OPTIONS',headers:req.headers}));
   }
   const a=await actor(req);if(a.gate)return a.gate;
   headers['Access-Control-Allow-Origin']=req.headers.get('origin');headers.Vary='Origin';
   need(req.method==='POST','METHOD_NOT_ALLOWED',405);
   const text=await req.text();need(Buffer.byteLength(text)<=30000,'PAYLOAD_TOO_LARGE',413);
   const b=parseContractJSON(text),path=new URL(req.url).pathname;
   if(path==='/publication/assets'){
    exact(b,['cover','rights_note']);need(typeof b.rights_note==='string'&&b.rights_note.trim().length>=10&&b.rights_note.length<=2000,'RIGHTS_REVIEW_REQUIRED',400);
    // Reuse the exact Phase 1 cover definition through a synthetic envelope-free schema check.
    const {validateCover}=await import('./authority-validation.mjs');validateCover(b.cover);
    return reply(await rpc(db,'nyra_publication_asset',{...actorArgs(a),p_cover:b.cover,p_note:b.rights_note}));
   }
   if(path==='/publication/identity'){
    exact(b,['work_id','version','slug','translation_variant_id']);
    need(uuid(b.work_id)&&typeof b.slug==='string'&&/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(b.slug)&&b.slug.length<=120&&(b.translation_variant_id===null||uuid(b.translation_variant_id)),'INVALID_FIELDS',400);
    const ctx=await rpc(db,'nyra_publication_context',{...actorArgs(a),p_work:b.work_id}),draft=eligible(ctx.work,b.version);
    const locale=draft.assignment.language==='gr'?'el':draft.assignment.language==='en'?'en':null,target=b.translation_variant_id&&ctx.articles.find(x=>x.variant_id===b.translation_variant_id);
    need(locale,'INVALID_LANGUAGE');
    need(!b.translation_variant_id||target&&target.locale!==locale,'INVALID_TRANSLATION_TARGET');
    const proposed={article_id:randomUUID(),variant_id:randomUUID(),work_id:b.work_id,locale,slug:b.slug,canonical_url:canonicalURL(locale,b.slug),translation_group_id:target?.translation_group_id||randomUUID()};
    return reply(await rpc(db,'nyra_publication_identity',{...actorArgs(a),p_work:b.work_id,p_expected:ctx.work,p_identity:proposed,p_target:b.translation_variant_id}));
   }
   if(path==='/publication/catalog'){
    exact(b,['work_id']);need(uuid(b.work_id),'INVALID_FIELDS',400);
    const ctx=await rpc(db,'nyra_publication_context',{...actorArgs(a),p_work:b.work_id});
    const delivery=await rpc(db,'nyra_publication_delivery_status',{...actorArgs(a),p_work:b.work_id});
    // Private owner-only UI projection. No research tickets, session credentials,
    // machine facts or caller-controlled delivery state escape this boundary.
    return reply({work_id:b.work_id,delivery,assets:ctx.assets,articles:ctx.articles,
     associated_article_ids:ctx.associated_article_ids,
     history:ctx.history.filter(r=>ctx.associated_article_ids.includes(r.article_id)).map(r=>({article_id:r.article_id,locale:r.locale,release_id:r.release.id,sequence:r.release.sequence,title:r.content.title,verified_for_rollback:delivery.verified_restore_release_ids.includes(r.release.id)})),
     desired_manifest:ctx.manifest,verified_live_manifest:ctx.verified_live_manifest,publishing:false});
   }
   if(path==='/publication/preview'){
    need(uuid(b.work_id),'INVALID_FIELDS',400);
    const ctx=await rpc(db,'nyra_publication_context',{...actorArgs(a),p_work:b.work_id});
    const preview=assemblePreview(ctx,b);
    const saved=await rpc(db,'nyra_publication_preview',{...actorArgs(a),p_work:b.work_id,p_version:b.version,p_expected:ctx.work,p_preview:preview});
    return reply({preview_id:saved.id,expires_at:saved.expires_at,action:preview.action,release:preview.release,withdrawal:preview.release?null:{article_id:preview.event.article_id,locale:preview.event.locale,target_release_id:preview.event.target_release_id},approval_hash:preview.approved_payload_sha256,publishing:false,delivered:false,status:'awaiting_owner_action'});
   }
   if(path==='/publication/authorize'){
    exact(b,['preview_id','request_id']);need(uuid(b.preview_id)&&uuid(b.request_id),'INVALID_FIELDS',400);
    const ctx=await rpc(db,'nyra_publication_confirmation',{...actorArgs(a),p_preview:b.preview_id,p_request:b.request_id});
    if(ctx.result)return reply(ctx.result);
    const candidate=finalized(ctx.preview,ctx.now);
    return reply(await rpc(db,'nyra_publication_commit',{...actorArgs(a),p_preview:b.preview_id,p_request:b.request_id,p_candidate:candidate}));
   }
   fail('NOT_FOUND',404);
  }catch(e){
   if(e instanceof AuthorityError)return reply({error:e.code,publishing:false},e.status);
   if(e instanceof ContractError)return reply({error:e.code,publishing:false},422);
   return reply({error:'AUTHORITY_UNAVAILABLE',publishing:false},503);
  }
 };
}

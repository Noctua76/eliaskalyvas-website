// Synthetic, non-public contract fixtures. No provider clients or live editorial records.
import {hashJSON,approvalPayload,releaseReference,mapNyraContent,canonicalURL} from '../../lib/publication/contract.mjs';
export const NOW='2026-10-27T12:00:00.000Z';
export const ISSUED='2026-10-27T10:10:00.000Z';
export const uid=n=>`00000000-0000-4000-8000-${n.toString(16).padStart(12,'0')}`;
export const ASSET_HASH='a'.repeat(64);
export const DISCLOSURE={
 el:'Έρευνα και κείμενο: Nyra, η AI συντακτική φωνή του Signals. Ανθρώπινη συντακτική εποπτεία και τελική έγκριση δημοσίευσης: Ηλίας Καλύβας.',
 en:'Research and text: Nyra, the AI editorial voice of Signals. Human editorial oversight and final publication approval: Elias Kalyvas.',
};
export function internalDraft(){return {
 article:{title:'Συνθετικό άρθρο δοκιμής',summary:'Αποκλειστικά μη δημόσιο fixture δοκιμής.',paragraphs:[{text:'Δοκιμαστική πρώτη παράγραφος.',source_urls:['https://www.oecd.org/'],evidence_ids:['private-evidence-1']},{text:'Δοκιμαστική δεύτερη παράγραφος.',source_urls:[],evidence_ids:[]}],editor_note:'PRIVATE_NOTE_CANARY',thesis:'PRIVATE_THESIS_CANARY',uncertainties:['PRIVATE_UNCERTAINTY_CANARY']},
 sources:[{url:'https://www.oecd.org/',title:'Synthetic source label',access:'private_access_flag'}],
 research:{ticket:'PRIVATE_RESEARCH_TICKET_CANARY',report:'PRIVATE_RESEARCH_REPORT_CANARY',source_records:[{status:'captured',source_url:'https://www.oecd.org/',excerpts:[{id:'private-evidence-1',text:'PRIVATE_EVIDENCE_EXCERPT_CANARY'}]}]},
 unpublished_revision:'PRIVATE_UNPUBLISHED_VERSION_CANARY',api_key:'sk-proj-'+'x'.repeat(24),owner_id:uid(900),
};}
export function sealFixture(r){
 r.content_revision.sha256=hashJSON(r.content);r.presentation_revision.sha256=hashJSON(r.presentation);
 r.authorization.approved_payload_sha256=hashJSON(approvalPayload(r));return r;
}
export function releaseFixture({locale='el',offset=0}={}){
 const r={schema_version:'nyra.publication.v1.1',article_id:uid(1+offset),variant_id:uid(2+offset),locale,format:'signal',slug:locale==='el'?'synthetic-gr':'synthetic-en',canonical_url:canonicalURL(locale,locale==='el'?'synthetic-gr':'synthetic-en'),content_revision:{id:uid(3+offset),sha256:''},presentation_revision:{id:uid(4+offset),number:0,sha256:''},content:mapNyraContent(internalDraft()),presentation:{seo_title:'Synthetic SEO title',seo_description:'Synthetic SEO description.',social_title:'Synthetic social title',social_description:'Synthetic social description.',share_text:'Synthetic share text.',topic_ids:['ai','work'],hashtags:['#AI','#Work','#Technology'],cover:{kind:'final_cover',template_id:null,url:`https://eliaskalyvas.gr/assets/signals/${ASSET_HASH}.webp`,sha256:ASSET_HASH,mime_type:'image/webp',width:1200,height:800,alt:'Synthetic geometric composition',caption:'Synthetic test asset',attribution:{creator:'Synthetic owner',source_url:'https://eliaskalyvas.gr/',license_name:'Synthetic owned asset',license_url:null,rights_basis:'owned',rights_confirmed:true}},related_article_ids:[]},identity:{editorial_voice:'Nyra',editorial_voice_type:'AI',human_editor_id:'https://eliaskalyvas.gr/#person',publisher_id:'https://eliaskalyvas.gr/#person',disclosure:DISCLOSURE[locale]},translation_group_id:null,approved_translation_relations:[],authorization:{id:uid(5+offset),action:'publish',approved_by:'https://eliaskalyvas.gr/#person',human_approved_at:'2026-10-27T10:00:00.000Z',publication_authorized_at:'2026-10-27T10:01:00.000Z',approved_payload_sha256:''},release:{id:uid(6+offset),sequence:1,replaces_release_id:null,restores_release_id:null,release_issued_at:ISSUED,first_published_at:ISSUED,modified_at:ISSUED}};
 if(locale==='en')r.content={...r.content,title:'Synthetic English article',summary:'Independently approved synthetic English fixture.',blocks:r.content.blocks.map((b,i)=>({...b,text:`Synthetic English paragraph ${i+1}.`}))};
 return sealFixture(r);
}
export function manifestFixture(releases=[],{generation=1,previous=null,withdrawn=[]}={}){return {schema_version:'nyra.publication.manifest.v1.1',authority:'nyra',audience:'https://eliaskalyvas.gr',manifest_id:uid(1000+generation),generation,previous_manifest_sha256:previous?hashJSON(previous):null,issued_at:'2026-10-27T11:00:00.000Z',active_releases:releases.map(releaseReference),withdrawn_variants:withdrawn};}
export const dataset=releases=>({manifest:manifestFixture(releases),releases});
export function replacement(prior,{rollback=null,n=100}={}){
 const r=structuredClone(prior);r.authorization={...r.authorization,id:uid(n+5),action:rollback?'rollback':'replace',human_approved_at:'2026-10-27T10:20:00.000Z',publication_authorized_at:'2026-10-27T10:21:00.000Z'};
 r.release={...r.release,id:uid(n+6),sequence:prior.release.sequence+1,replaces_release_id:prior.release.id,restores_release_id:rollback?.release.id||null,release_issued_at:'2026-10-27T10:30:00.000Z',modified_at:'2026-10-27T10:30:00.000Z'};
 if(rollback){r.content=structuredClone(rollback.content);r.presentation=structuredClone(rollback.presentation);r.content_revision=structuredClone(rollback.content_revision);r.presentation_revision=structuredClone(rollback.presentation_revision);}
 else {r.content.blocks[0].text+=' Synthetic approved revision.';r.content_revision.id=uid(n+3);}
 return sealFixture(r);
}
export function eventFixture(action,previous,{fresh=null,target=previous.releases[0],restore=null,n=500}={}){
 const r=fresh||target;const e={schema_version:'nyra.publication.event.v1.1',id:uid(n),article_id:r.article_id,variant_id:r.variant_id,locale:r.locale,actor_id:'https://eliaskalyvas.gr/#person',authorized_at:fresh?.authorization.publication_authorized_at||'2026-10-27T10:40:00.000Z',expected_generation:previous.manifest.generation,expected_manifest_sha256:hashJSON(previous.manifest),action,authorization_id:fresh?.authorization.id||uid(n+1),target_release_id:action==='publish'?null:target.release.id};
 if(action!=='withdraw'){e.new_release=releaseReference(fresh);e.approved_payload_sha256=fresh.authorization.approved_payload_sha256;}
 if(action==='rollback')e.restores_release_id=restore.release.id;return e;
}
export function nextSet(previous,releases,events){
 const withdrawn=previous.manifest.withdrawn_variants.filter(w=>!events.some(e=>e.action==='rollback'&&e.variant_id===w.variant_id));
 for(const e of events)if(e.action==='withdraw')withdrawn.push({article_id:e.article_id,variant_id:e.variant_id,locale:e.locale,event_id:e.id,withdrawn_at:e.authorized_at,target_release_id:e.target_release_id});
 return {manifest:manifestFixture(releases,{generation:previous.manifest.generation+1,previous:previous.manifest,withdrawn}),releases};
}

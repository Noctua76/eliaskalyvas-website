export const TOPIC_LABELS = {
  gr: ['Οικονομία','Startups','Τεχνητή Νοημοσύνη','Τεχνολογία','Επενδύσεις','Κοινωνία','Πολιτική','Εργασία','Καινοτομία','Επιχειρηματικότητα'],
  en: ['Economy','Startups','Artificial Intelligence','Technology','Investment','Society','Politics','Work','Innovation','Entrepreneurship'],
};
export const HASHTAG_LABELS = {
  gr: ['#Οικονομία','#Startups','#ΤεχνητήΝοημοσύνη','#Τεχνολογία','#Επενδύσεις','#Κοινωνία','#Πολιτική','#Εργασία','#Καινοτομία','#Επιχειρηματικότητα'],
  en: ['#Economy','#Startups','#ArtificialIntelligence','#Technology','#Investment','#Society','#Politics','#Work','#Innovation','#Entrepreneurship'],
};
const fields=['tags','hashtags','share_title','share_description','share_text','image_brief'];
export const PRESENTATION_SCHEMA={type:'object',additionalProperties:false,required:fields,properties:{
  tags:{type:'array',items:{type:'string'}},hashtags:{type:'array',items:{type:'string'}},
  ...Object.fromEntries(fields.slice(2).map(k=>[k,{type:'string'}])),
}};
const invalid=()=>{throw new Error('INVALID_PRESENTATION');};
function text(value,max){if(typeof value!=='string'||value.length>max)invalid();return value.normalize('NFC').trim();}
function list(value,max,length){if(!Array.isArray(value)||value.length>max)invalid();return [...new Set(value.map(v=>text(v,length)).filter(Boolean))];}
export function emptyPresentation(article={}){
 return {tags:[],hashtags:[],share_title:article.title||'',share_description:(article.summary||'').slice(0,700),share_text:'',image_brief:'',cover:{image_url:'',source_url:'',creator:'',license_name:'',license_url:'',alt:'',caption:'',rights_confirmed:false},revision:0};
}
export function imageUrl(raw){
 if(!raw)return '';
 let u;try{u=new URL(raw);}catch{invalid();}
 const h=u.hostname.toLowerCase();
 if(u.protocol!=='https:'||u.username||u.password||u.port||!h.includes('.')||h==='localhost'||h.endsWith('.local')||h.endsWith('.localhost')||h.endsWith('.internal')||/^\d+(\.\d+){3}$/.test(h)||h.includes(':'))invalid();
 return u.href;
}
export function validatePresentation(value,{generated=false}={}){
 if(!value||typeof value!=='object'||Array.isArray(value))invalid();
 const tags=list(value.tags,6,60),hashtags=list(value.hashtags,5,80);
 if(hashtags.some(h=>!/^#[\p{L}\p{N}_]+$/u.test(h)))invalid();
 if(generated&&(hashtags.length<3||!tags.length))invalid();
 const result={tags,hashtags,share_title:text(value.share_title,300),share_description:text(value.share_description,700),share_text:text(value.share_text,2000),image_brief:text(value.image_brief,1500)};
 if(generated&&(!result.share_title||!result.share_description||!result.share_text||!result.image_brief))invalid();
 const c=value.cover||emptyPresentation().cover;
 if(typeof c.rights_confirmed!=='boolean')invalid();
 result.cover={image_url:imageUrl(text(c.image_url,2000)),source_url:imageUrl(text(c.source_url,2000)),license_url:imageUrl(text(c.license_url,2000)),creator:text(c.creator,300),license_name:text(c.license_name,500),alt:text(c.alt,500),caption:text(c.caption,1000),rights_confirmed:c.rights_confirmed};
 if(c.rights_basis!==undefined){if(c.rights_basis!==null&&!['licensed','permission','owned','public_domain'].includes(c.rights_basis))invalid();result.cover.rights_basis=c.rights_basis;}
 if(c.rights_confirmed&&(!result.cover.image_url||!result.cover.source_url||!result.cover.creator||!result.cover.license_name||!result.cover.alt))invalid();
 return result;
}
export function presentationStatus(p){
 const missing=[];
 if(p.hashtags.length<3)missing.push('hashtags');
 if(!p.tags.length)missing.push('tags');
 for(const k of ['share_title','share_description','share_text','image_brief'])if(!p[k])missing.push(k);
 if(!p.cover.image_url||!p.cover.rights_confirmed)missing.push('cover');
 return {ready_for_owner_review:missing.length===0,missing,publishing:false};
}

// Existing presentation JSON + revision CAS are the authoritative boundary.
// A changed identity/attribution can never bring its old confirmation along.
const rightsFields=['image_url','source_url','license_url','creator','license_name','alt','caption','rights_basis'];
export function presentationRightsTransition(prior,next,{confirmRights=false}={}){
 const result=structuredClone(next),old=prior?.cover;
 const changed=!old||rightsFields.some(k=>(old[k]??null)!==(result.cover[k]??null));
 if(changed)result.cover.rights_confirmed=false;
 else if(result.cover.rights_confirmed===true&&old.rights_confirmed!==true){
  if(confirmRights!==true||!['licensed','permission','owned','public_domain'].includes(result.cover.rights_basis))throw Error('IMAGE_RIGHTS_RECONFIRMATION_REQUIRED');
 }
 return result;
}
export function confirmedImageMatches(presentation,cover){
 const c=presentation?.cover,a=cover?.attribution;
 return !!(c&&a&&c.rights_confirmed===true&&a.rights_confirmed===true&&c.image_url===cover.url&&c.source_url===a.source_url&&(c.license_url||null)===a.license_url&&c.creator===a.creator&&c.license_name===a.license_name&&c.alt===cover.alt&&c.caption===cover.caption&&c.rights_basis===a.rights_basis);
}

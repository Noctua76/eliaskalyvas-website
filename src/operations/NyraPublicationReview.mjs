// Owner review; mounted only when the server exposes publication preparation.
import React,{useEffect,useRef,useState} from 'react';
const h=React.createElement;
const external=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password?u.href:undefined;}catch{return undefined;}};
function citations(ids,sources){
 return h('span',{'aria-label':'Πηγές'},...(ids||[]).map(id=>{
  const source=sources.find(s=>s.id===id);
  return source?h('a',{key:id,href:external(source.url),rel:'noopener noreferrer',referrerPolicy:'no-referrer'},' ['+id+': '+source.title+']'):h('span',{key:id},' [Άγνωστη πηγή: '+id+']');
 }));
}
function block(b,i,sources){
 const textStyle={whiteSpace:'pre-wrap'};
 if(b.type==='heading')return h('h2',{key:i,style:textStyle},b.text);
 if(b.type==='quote')return h('blockquote',{key:i,style:textStyle},b.text,citations(b.source_ids,sources),b.attribution&&h('cite',null,b.attribution));
 if(b.type==='list')return h('ul',{key:i},...b.items.map((item,n)=>h('li',{key:n,style:textStyle},item.text,citations(item.source_ids,sources))));
 return h('p',{key:i,style:textStyle},b.text,citations(b.source_ids,sources));
}
export default function NyraPublicationReview({preview,onAuthorize,publicationAction=false,imageURL=null}){
 const [status,setStatus]=useState(''),[busy,setBusy]=useState(false),attempt=useRef(null);
 const current=useRef(preview?.preview_id);current.current=preview?.preview_id;
 useEffect(()=>{setStatus('');setBusy(false);attempt.current=null;},[preview?.preview_id]);
 if(!preview)return null;
 const release=preview.release;
 async function approve(){
  if(busy)return;
  if(attempt.current?.preview!==preview.preview_id)attempt.current={preview:preview.preview_id,key:crypto.randomUUID()};
  const selected=preview.preview_id;
  setBusy(true);setStatus('');
  try{const result=await onAuthorize({preview_id:preview.preview_id,request_id:attempt.current.key});
   if(current.current!==selected)return;
   setStatus(publicationAction&&result.status==='authorized_held'&&result.delivered===false&&result.publishing===false?'Η ενέργεια εξουσιοδοτήθηκε. Αναμένεται ανεξάρτητη επιβεβαίωση δημοσίευσης.':result.status==='authorized_held'&&!result.delivered&&!result.publishing?'Η έγκριση καταγράφηκε ιδιωτικά. Η δημοσίευση παραμένει ανενεργή.':'Δεν επιβεβαιώθηκε ιδιωτική εξουσιοδότηση.');
  }catch{if(current.current===selected)setStatus('Η ενέργεια δεν επιβεβαιώθηκε. Η επανάληψη χρησιμοποιεί το ίδιο αναγνωριστικό.');}finally{if(current.current===selected)setBusy(false);}
 }
 return h('section',{'aria-label':'Τελική ιδιωτική συντακτική έγκριση',className:'ops-panel'},
  h('h3',null,'Τελική έγκριση — '+preview.action),
  h('p',null,publicationAction?'Ελέγχεις το ακριβές στιγμιότυπο και τη συγκεκριμένη γλώσσα. Η μία ενέργεια εξουσιοδοτεί την προστατευμένη παράδοση, εφόσον όλοι οι έλεγχοι ασφάλειας περάσουν.':'Ελέγχεις το ακριβές στιγμιότυπο και τη συγκεκριμένη γλώσσα. Η ενέργεια προετοιμάζει μόνο ιδιωτική εξουσιοδότηση· δεν δημοσιεύει.'),
  release?h(React.Fragment,null,h('p',null,release.locale.toUpperCase()),h('h2',null,release.content.title),h('p',null,release.content.summary),
   h('p',null,release.identity.disclosure),
   h('figure',null,h('img',{src:imageURL||release.presentation.cover.url,alt:release.presentation.cover.alt,width:release.presentation.cover.width,height:release.presentation.cover.height,referrerPolicy:'no-referrer',style:{maxWidth:'100%',height:'auto'}}),
    h('figcaption',null,release.presentation.cover.caption,' · ',release.presentation.cover.attribution.creator,' · ',release.presentation.cover.attribution.license_name)),
   ...release.content.blocks.map((b,i)=>block(b,i,release.content.sources)),
   h('ol',{'aria-label':'Εγκεκριμένες δημόσιες πηγές'},...release.content.sources.map(s=>h('li',{key:s.id},h('a',{href:external(s.url),rel:'noopener noreferrer',referrerPolicy:'no-referrer'},s.id+': '+s.title)))),
   h('details',null,h('summary',null,'Πλήρες στιγμιότυπο: εικόνα, δικαιώματα, SEO, πηγές και σχέσεις γλωσσών'),h('pre',null,JSON.stringify(release,null,2)))):
   h('pre',null,JSON.stringify(preview.withdrawal,null,2)),
  h('button',{type:'button',disabled:busy||status.startsWith('Η έγκριση καταγράφηκε')||status.startsWith('Η ενέργεια εξουσιοδοτήθηκε'),onClick:approve},busy?'Καταγραφή…':publicationAction?'Εγκρίνω και εκτελώ: '+preview.action:'Εγκρίνω τη συγκεκριμένη ενέργεια — μόνο ιδιωτική προετοιμασία'),
  h('p',{role:'status'},status));
}

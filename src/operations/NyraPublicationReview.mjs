// Private review component; deliberately not imported or mounted in the live Admin.
import React,{useEffect,useRef,useState} from 'react';
const h=React.createElement;
export default function NyraPublicationReview({preview,onAuthorize}){
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
   setStatus(result.status==='authorized_held'&&!result.delivered&&!result.publishing?'Η έγκριση καταγράφηκε ιδιωτικά. Η δημοσίευση παραμένει ανενεργή.':'Δεν επιβεβαιώθηκε ιδιωτική εξουσιοδότηση.');
  }catch{if(current.current===selected)setStatus('Η ενέργεια δεν επιβεβαιώθηκε. Η επανάληψη χρησιμοποιεί το ίδιο αναγνωριστικό.');}finally{if(current.current===selected)setBusy(false);}
 }
 return h('section',{'aria-label':'Τελική ιδιωτική συντακτική έγκριση',className:'ops-panel'},
  h('h3',null,'Τελική έγκριση — '+preview.action),
  h('p',null,'Ελέγχεις το ακριβές στιγμιότυπο και τη συγκεκριμένη γλώσσα. Η ενέργεια προετοιμάζει μόνο ιδιωτική εξουσιοδότηση· δεν δημοσιεύει.'),
  release?h(React.Fragment,null,h('p',null,release.locale.toUpperCase()),h('h2',null,release.content.title),h('p',null,release.content.summary),
   h('p',null,release.identity.disclosure),
   h('figure',null,h('img',{src:release.presentation.cover.url,alt:release.presentation.cover.alt,width:release.presentation.cover.width,height:release.presentation.cover.height,referrerPolicy:'no-referrer',style:{maxWidth:'100%',height:'auto'}}),
    h('figcaption',null,release.presentation.cover.caption,' · ',release.presentation.cover.attribution.creator,' · ',release.presentation.cover.attribution.license_name)),
   ...release.content.blocks.map((b,i)=>b.type==='heading'?h('h2',{key:i},b.text):b.type==='quote'?h('blockquote',{key:i},b.text,b.attribution&&h('cite',null,b.attribution)):b.type==='list'?h('ul',{key:i},...b.items.map((item,n)=>h('li',{key:n},item.text))):h('p',{key:i,style:{whiteSpace:'pre-wrap'}},b.text)),
   h('ol',null,...release.content.sources.map(s=>h('li',{key:s.id},h('a',{href:s.url,rel:'noreferrer'},s.id+': '+s.title)))),
   h('details',null,h('summary',null,'Πλήρες στιγμιότυπο: εικόνα, δικαιώματα, SEO, πηγές και σχέσεις γλωσσών'),h('pre',null,JSON.stringify(release,null,2)))):
   h('pre',null,JSON.stringify(preview.withdrawal,null,2)),
  h('button',{type:'button',disabled:busy||status.startsWith('Η έγκριση καταγράφηκε'),onClick:approve},busy?'Καταγραφή…':'Εγκρίνω τη συγκεκριμένη ενέργεια — μόνο ιδιωτική προετοιμασία'),
  h('p',{role:'status'},status));
}

import React, {useEffect,useState} from 'react';
import {emptyPresentation as base,imageUrl} from '../../supabase/functions/nyra-api/lib/presentation.mjs';
export default function NyraPresentation({gr,workId,draft,index,busy,status,onSave}){
 const [value,setValue]=useState(()=>({...base(draft.article),...draft.presentation}));
 const [tags,setTags]=useState(value.tags.join(', ')),[hashtags,setHashtags]=useState(value.hashtags.join(' ')),[message,setMessage]=useState(''),[preview,setPreview]=useState(false);
 useEffect(()=>{const next={...base(draft.article),...draft.presentation};setValue(next);setTags(next.tags.join(', '));setHashtags(next.hashtags.join(' '));setPreview(false);},[workId,draft.run.id,draft.presentation?.revision]);
 useEffect(()=>setMessage(''),[workId,draft.run.id]);
 const set=(key,v)=>{setValue(p=>({...p,[key]:v}));setMessage('');};
 const cover=(key,v)=>{setValue(p=>({...p,cover:{...p.cover,[key]:v,...(key==='rights_confirmed'?{}:{rights_confirmed:false})}}));setPreview(false);setMessage('');};
 const tagList=tags.split(',').map(s=>s.trim()).filter(Boolean),hashList=hashtags.split(/[\s,]+/u).filter(Boolean);
 const lang=draft.assignment.language,topics=status?.topic_labels?.[lang]||[],suggestions=status?.hashtag_labels?.[lang]||[];
 function addTag(t){if(!tagList.includes(t))setTags([...tagList,t].join(', '));}
 function addHash(t){if(!hashList.includes(t)&&hashList.length<5)setHashtags([...hashList,t].join(' '));}
 async function save(e){e.preventDefault();setMessage('');try{await onSave({version:index,expected_revision:value.revision||0,confirm_rights:value.cover.rights_confirmed===true&&draft.presentation?.cover?.rights_confirmed!==true,presentation:{...value,tags:tagList,hashtags:hashList}});setMessage(gr?'Αποθηκεύτηκε χωρίς κλήση AI.':'Saved without an AI call.');}catch(e){setMessage(e.message);}}
 async function copy(){try{await navigator.clipboard.writeText([value.share_text,hashList.join(' ')].filter(Boolean).join('\n\n'));setMessage(gr?'Αντιγράφηκε το κείμενο με τα hashtags.':'Text and hashtags copied.');}catch{setMessage(gr?'Δεν επιτράπηκε η αντιγραφή. Επίλεξε και αντέγραψε το κείμενο από το πεδίο.':'Clipboard unavailable. Select and copy the text from the field.');}}
 let safeImage='';try{safeImage=imageUrl(value.cover.image_url);}catch{}
 const textField=(key,label,max,rows=2)=><label>{label}<textarea value={value[key]} maxLength={max} rows={rows} onChange={e=>set(key,e.target.value)} /></label>;
 const imageField=(key,label,max=2000)=><label>{label}<input type={key.endsWith('_url')?'url':'text'} value={value.cover[key]} maxLength={max} onChange={e=>cover(key,e.target.value)} /></label>;
 return <section className="nyra-presentation" aria-label={gr?'Παρουσίαση άρθρου και κοινοποίηση':'Article presentation and sharing'}>
  <h3>{gr?'Παρουσίαση άρθρου και κοινοποίηση':'Article presentation and sharing'}</h3>
  <p>{gr?'Αποθήκευση ανά έκδοση, χωρίς χρέωση AI. Τα νέα άρθρα θα έχουν προτεινόμενα στοιχεία από τη Nyra. Η δημοσίευση και οι δημόσιες κοινοποιήσεις θα ενεργοποιηθούν στη σελίδα Signals.':'Saved per article version, with no AI charge. New articles will include Nyra’s suggestions. Publishing and public sharing will be enabled with the Signals page.'}</p>
  <form onSubmit={save}><fieldset disabled={busy} className="nyra-fields">
   <label>{gr?'Θεματικές ετικέτες (χωρισμένες με κόμμα)':'Topic labels (comma-separated)'}<input value={tags} onChange={e=>setTags(e.target.value)} maxLength={360} /></label>
   <div className="nyra-chips">{topics.map(t=><button type="button" key={t} onClick={()=>addTag(t)}>{t}</button>)}</div>
   <label>{gr?'Hashtags — 3 έως 5':'Hashtags — 3 to 5'}<input value={hashtags} onChange={e=>setHashtags(e.target.value)} maxLength={400} placeholder="#Οικονομία #Startups #ΤεχνητήΝοημοσύνη" /></label>
   <div className="nyra-chips">{suggestions.map(t=><button type="button" key={t} onClick={()=>addHash(t)}>{t}</button>)}</div>
   {textField('share_title',gr?'Τίτλος προεπισκόπησης κοινοποίησης':'Share preview title',300)}
   {textField('share_description',gr?'Σύντομη περιγραφή προεπισκόπησης':'Share preview description',700,3)}
   {textField('share_text',gr?'Κείμενο κοινοποίησης (χωρίς hashtags ή δημόσιο σύνδεσμο)':'Share text (without hashtags or a public link)',2000,4)}
   <button type="button" onClick={copy}>{gr?'Αντιγραφή κειμένου και hashtags':'Copy text and hashtags'}</button>
   {textField('image_brief',gr?'Περιγραφή αντιπροσωπευτικής εικόνας / όροι αναζήτησης':'Representative image brief / search terms',1500,3)}
   <details><summary>{gr?'Εικόνα, πηγή και δικαίωμα χρήσης':'Image, source and permission to use'}</summary>
    <p>{gr?'Στο παρόν στάδιο συμπληρώνεις την εικόνα χειροκίνητα. Δεν γίνεται αυτόματη αναζήτηση, λήψη ή επαλήθευση άδειας. Η επιβεβαίωση παρακάτω καταγράφει τον δικό σου έλεγχο.':'Images are entered manually at this stage. There is no automatic search, download or license verification. The confirmation below records your own review.'}</p>
    <div className="nyra-fields">
     {imageField('image_url',gr?'Σύνδεσμος εικόνας (HTTPS)':'Image URL (HTTPS)')}
     {imageField('source_url',gr?'Αρχική σελίδα πηγής':'Original source page')}
     {imageField('creator',gr?'Δημιουργός / δικαιούχος':'Creator / rights holder',300)}
     {imageField('license_name',gr?'Άδεια χρήσης ή περιγραφή άδειας δημοσίευσης':'License or publication permission',500)}
     {imageField('license_url',gr?'Σύνδεσμος άδειας (αν υπάρχει)':'License URL (if available)')}
     {imageField('alt',gr?'Εναλλακτικό κείμενο εικόνας':'Image alternative text',500)}
     {imageField('caption',gr?'Λεζάντα / απαιτούμενη αναφορά':'Caption / required attribution',1000)}
     <label>{gr?'Βάση δικαιώματος για τη συγκεκριμένη εικόνα':'Rights basis for this exact image'}<select value={value.cover.rights_basis||''} onChange={e=>cover('rights_basis',e.target.value||null)}><option value="">—</option>{['licensed','permission','owned','public_domain'].map(b=><option key={b} value={b}>{b}</option>)}</select></label>
     <label className="nyra-check"><input type="checkbox" checked={value.cover.rights_confirmed} onChange={e=>cover('rights_confirmed',e.target.checked)} />{gr?'Έλεγξα ότι επιτρέπεται η συγκεκριμένη χρήση και ότι έχουν συμπληρωθεί τα στοιχεία αναφοράς.':'I checked that this use is permitted and the required attribution is recorded.'}</label>
     {value.cover.image_url&&<button type="button" onClick={()=>setPreview(p=>!p)}>{gr?'Προεπισκόπηση εξωτερικής εικόνας':'Preview external image'}</button>}
     {preview&&safeImage&&<img className="nyra-cover-preview" src={safeImage} alt={value.cover.alt} referrerPolicy="no-referrer" loading="lazy" />}
    </div>
   </details>
   <div className="nyra-share-preview"><small>{gr?'Προσχέδιο προεπισκόπησης — χωρίς δημόσιο σύνδεσμο':'Draft preview — no public link'}</small><h4>{value.share_title||draft.article.title}</h4><p>{value.share_description}</p><p>{hashList.join(' ')}</p></div>
   <button type="submit">{gr?'Αποθήκευση παρουσίασης — χωρίς χρέωση AI':'Save presentation — no AI charge'}</button>
  </fieldset></form>
  {message&&<p role="status">{message}</p>}
  {value.revision>0&&<p className="nyra-meta">{gr?'Έκδοση παρουσίασης: ':'Presentation revision: '}{value.revision} · {gr?'Απαιτείται τελική έγκριση πριν από μελλοντική δημοσίευση.':'Final approval is required before future publishing.'}</p>}
  {draft.presentation_history?.length>0&&<details><summary>{gr?'Προηγούμενες αποθηκεύσεις παρουσίασης':'Earlier presentation saves'}</summary>{draft.presentation_history.map((h,i)=><div key={i}><p>{new Date(h.saved_at).toLocaleString()} · {h.presentation.share_title}</p><p>{h.presentation.hashtags?.join(' ')}</p><p>{h.presentation.share_text}</p></div>)}</details>}
 </section>;
}

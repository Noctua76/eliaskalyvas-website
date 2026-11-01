import React,{useState,useEffect,useRef} from 'react';
import Review from './NyraPublicationReview.mjs';
import {topics} from '../signals/model.mjs';
// Owner UI only. All data are re-read/validated by the existing server authority.
export default function NyraFinalPublication({work,draft,index,call,onEdited,onSavePresentation,upload,assetPreview,gr}){
 const [content,setContent]=useState(()=>structuredClone(draft.article)),[catalog,setCatalog]=useState(null),[preview,setPreview]=useState(null),[message,setMessage]=useState(''),[busy,setBusy]=useState(false);
 const [action,setAction]=useState('publish'),[slug,setSlug]=useState(''),[articleId,setArticleId]=useState(''),[restore,setRestore]=useState(''),[assetId,setAssetId]=useState(''),[translation,setTranslation]=useState(''),[topicIds,setTopics]=useState(['ai']),[seoTitle,setSeoTitle]=useState(''),[seoDescription,setSeoDescription]=useState(''),[file,setFile]=useState(null),[rights,setRights]=useState(draft.presentation.cover.rights_basis||'licensed'),[note,setNote]=useState('');
 const epoch=useRef(0),active=useRef(false),mounted=useRef(true),privateImage=useRef(null);
 const clearImage=()=>{if(privateImage.current)URL.revokeObjectURL(privateImage.current);privateImage.current=null;};
 useEffect(()=>{epoch.current++;clearImage();setPreview(null);setCatalog(null);setContent(structuredClone(draft.article));setRights(draft.presentation.cover.rights_basis||'licensed');},[work.id,draft.run.id,draft.presentation?.revision]);
 useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;epoch.current++;clearImage();};},[]);
 const run=async fn=>{if(active.current)return;active.current=true;const stamp=epoch.current;setBusy(true);setMessage('');try{const value=await fn();if(stamp===epoch.current&&typeof value==='string')setMessage(value);}catch(e){if(stamp===epoch.current)setMessage(e.message);}finally{active.current=false;setBusy(false);}};
 const load=async()=>{const stamp=epoch.current;const value=await call('/publication/catalog',{work_id:work.id});if(stamp===epoch.current)setCatalog(value);return value;};
 async function edit(){await run(async()=>{const stamp=epoch.current;const value=await call('/work/'+work.id+'/edit',{version:index,expected_run_id:draft.run.id,expected_presentation_revision:draft.presentation.revision,content:{title:content.title,summary:content.summary,paragraphs:content.paragraphs.map(p=>({text:p.text,source_urls:p.source_urls,evidence_ids:p.evidence_ids||[]}))}});if(stamp===epoch.current)onEdited(value);return gr?'Νέα ιδιωτική έκδοση. Απαιτείται νέος αυτόματος έλεγχος πριν την τελική έγκριση.':'New private version. A fresh automatic review is required before final approval.';});}
 async function inspect(){await run(async()=>{
  if(!file||!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>20*1024*1024)throw Error('IMAGE_FILE_REQUIRED');
  const bytes=await file.arrayBuffer(),sha=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join(''),bitmap=await createImageBitmap(file),c=draft.presentation.cover;
  const cover={kind:'final_cover',template_id:null,url:'https://eliaskalyvas.gr/assets/signals/'+sha+'.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[file.type]),sha256:sha,mime_type:file.type,width:bitmap.width,height:bitmap.height,alt:c.alt,caption:c.caption,attribution:{creator:c.creator,source_url:c.source_url,license_name:c.license_name,license_url:c.license_url||null,rights_basis:rights,rights_confirmed:c.rights_confirmed===true}};bitmap.close();
  // Stage a changed identity/basis as UNCONFIRMED. A separate owner action in
  // the presentation editor must confirm the persisted exact metadata first.
  if(c.image_url!==cover.url||c.rights_basis!==rights){
   await onSavePresentation({version:index,expected_revision:draft.presentation.revision,presentation:{...draft.presentation,cover:{...c,image_url:cover.url,rights_basis:rights,rights_confirmed:false}}});
   if(mounted.current)setMessage(gr?'Η νέα εικόνα αποθηκεύτηκε χωρίς επιβεβαίωση δικαιωμάτων. Έλεγξε την εικόνα, πηγή, άδεια, αναφορά και βάση δικαιώματος στην παρουσίαση, επιβεβαίωσε ρητά και αποθήκευσε. Μετά υπέβαλε το ίδιο αρχείο για έλεγχο.':'New image saved without rights confirmation. Review the exact image, source, license, attribution and rights basis in presentation, explicitly confirm and save, then submit the same file.');
   return;
  }
  if(c.rights_confirmed!==true)throw Error(gr?'Επιβεβαίωσε και αποθήκευσε πρώτα τα δικαιώματα της συγκεκριμένης εικόνας.':'Explicitly confirm and save the rights for this exact image first.');
  const form=new FormData();form.set('file',file);form.set('metadata',JSON.stringify({work_id:work.id,version:index,cover,rights_note:note}));
  const r=await upload(form);if(mounted.current)setMessage((gr?'Ιδιωτικός έλεγχος εικόνας σε αναμονή: ':'Private image inspection pending: ')+r.inspection_id);
 });}
 async function prepare(){await run(async()=>{
  const stamp=epoch.current;if(JSON.stringify(content)!==JSON.stringify(draft.article))throw Error(gr?'Αποθήκευσε πρώτα το επεξεργασμένο κείμενο.':'Save the edited text first.');
  const input={action,work_id:work.id,version:index,article_id:action==='publish'?null:articleId,restore_release_id:action==='rollback'?restore:null,metadata:['publish','replace'].includes(action)?{slug,seo_title:seoTitle||null,seo_description:seoDescription||null,topic_ids:topicIds,asset_id:assetId,translation_variant_id:translation||null,related_article_ids:[]}:null};
  const value=await call('/publication/preview',input);let image=null;if(value.release){const cover=value.release.presentation.cover,asset=catalog.assets.find(a=>a.cover.sha256===cover.sha256);if(!asset)throw Error('INSPECTED_PREVIEW_REQUIRED');image=await assetPreview(work.id,asset.id,cover.sha256);}
  if(stamp===epoch.current){clearImage();privateImage.current=image;setPreview(value);}else if(image)URL.revokeObjectURL(image);
 });}
 const invalidate=fn=>e=>{setPreview(null);fn(e.target.value);};
 return <section className="nyra-presentation" aria-label="Owner publication workspace"><h3>{gr?'Τελική έκδοση και δημοσίευση':'Final version and publication'}</h3>
  <p>{gr?'Κάθε γλώσσα εγκρίνεται χωριστά. Η αποθήκευση αλλαγών δεν δημοσιεύει και δεν καλεί AI.':'Each language is approved separately. Saving edits neither publishes nor calls AI.'}</p>
  <fieldset disabled={busy}><details><summary>{gr?'Επεξεργασία κειμένου':'Edit article text'}</summary>
   <label>{gr?'Τίτλος':'Title'}<input value={content.title} maxLength={300} onChange={e=>{setPreview(null);setContent({...content,title:e.target.value});}}/></label>
   <label>{gr?'Περίληψη':'Summary'}<textarea value={content.summary} maxLength={5000} onChange={e=>{setPreview(null);setContent({...content,summary:e.target.value});}}/></label>
   {content.paragraphs.map((p,i)=><label key={i}>{gr?'Παράγραφος ':'Paragraph '}{i+1}<textarea rows={5} maxLength={12000} value={p.text} onChange={e=>{setPreview(null);setContent({...content,paragraphs:content.paragraphs.map((x,n)=>n===i?{...x,text:e.target.value}:x)});}}/></label>)}
   <button type="button" onClick={edit}>{gr?'Αποθήκευση ως νέα ιδιωτική έκδοση':'Save as a new private version'}</button></details>
   <details><summary>{gr?'Αρχείο εικόνας και έλεγχος bytes':'Image file and byte inspection'}</summary><p>{gr?'Συμπλήρωσε πρώτα την πηγή, άδεια και αναφορά στην παρουσίαση. Το αρχείο παραμένει ιδιωτικό μέχρι τον έλεγχο.':'First save source, license and attribution in presentation. The file stays private until inspection.'}</p>
    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e=>{setPreview(null);setFile(e.target.files?.[0]||null);}}/>
    <label>{gr?'Βάση δικαιώματος':'Rights basis'}<select value={rights} onChange={invalidate(setRights)}>{['licensed','permission','owned','public_domain'].map(x=><option key={x}>{x}</option>)}</select></label>
    <label>{gr?'Σημείωμα ελέγχου δικαιωμάτων':'Rights review note'}<textarea value={note} maxLength={2000} onChange={invalidate(setNote)}/></label><button type="button" onClick={inspect}>{gr?'Προετοιμασία εικόνας / υποβολή για ιδιωτικό έλεγχο':'Prepare image / submit for private inspection'}</button></details>
   <button type="button" onClick={()=>run(load)}>{gr?'Ανανέωση εκδόσεων και ελεγμένων εικόνων':'Refresh versions and inspected images'}</button>
   {catalog&&<><label>{gr?'Ενέργεια':'Action'}<select value={action} onChange={invalidate(setAction)}>{['publish','replace','withdraw','rollback'].map(x=><option key={x}>{x}</option>)}</select></label>
    {action!=='publish'&&<label>{gr?'Έκδοση γλώσσας':'Language variant'}<select value={articleId} onChange={invalidate(v=>{setArticleId(v);setSlug(catalog.articles.find(x=>x.article_id===v)?.slug||'');})}><option value="">—</option>{catalog.articles.filter(x=>catalog.associated_article_ids.includes(x.article_id)).map(x=><option key={x.article_id} value={x.article_id}>{x.locale} / {x.slug}</option>)}</select></label>}
    {action==='rollback'&&<label>Restore<select value={restore} onChange={invalidate(setRestore)}><option value="">—</option>{catalog.history.filter(x=>x.article_id===articleId&&x.verified_for_rollback).map(x=><option key={x.release_id} value={x.release_id}>{x.sequence}. {x.title}</option>)}</select></label>}
    {['publish','replace'].includes(action)&&<><label>Slug<input value={slug} maxLength={120} onChange={invalidate(setSlug)}/></label><button type="button" onClick={()=>run(async()=>{await call('/publication/identity',{work_id:work.id,version:index,slug,translation_variant_id:translation||null});await load();return gr?'Κατοχυρώθηκε ιδιωτική ταυτότητα γλώσσας, χωρίς έγκριση δημοσίευσης.':'Private language identity reserved without publication approval.';})}>{gr?'Κατοχύρωση διαδρομής γλώσσας':'Reserve language route'}</button><label>SEO title<input value={seoTitle} maxLength={100} onChange={invalidate(setSeoTitle)}/></label><label>SEO description<textarea value={seoDescription} maxLength={300} onChange={invalidate(setSeoDescription)}/></label>
     <label>{gr?'Ελεγμένη εικόνα':'Inspected image'}<select value={assetId} onChange={invalidate(setAssetId)}><option value="">—</option>{catalog.assets.map(a=><option key={a.id} value={a.id}>{a.cover.alt} / {a.cover.sha256.slice(0,12)}</option>)}</select></label>
     <label>{gr?'Σύνδεση με άλλη γλώσσα (χωριστή έγκριση)':'Link other language (separate approval)'}<select value={translation} onChange={invalidate(setTranslation)}><option value="">—</option>{catalog.articles.filter(x=>x.locale!==(draft.assignment.language==='gr'?'el':'en')).map(x=><option key={x.variant_id} value={x.variant_id}>{x.locale} / {x.slug}</option>)}</select></label>
     <div>{Object.entries(topics).map(([id,label])=><label key={id}><input type="checkbox" checked={topicIds.includes(id)} onChange={()=>{setPreview(null);setTopics(topicIds.includes(id)?topicIds.filter(x=>x!==id):[...topicIds,id]);}}/>{label[gr?'el':'en']}</label>)}</div></>}
    <button type="button" onClick={prepare}>{gr?'Ακριβής προεπισκόπηση':'Exact publication preview'}</button>
    <p>{gr?'Η δημόσια κατάσταση προκύπτει μόνο από ανεξάρτητη παρατήρηση, όχι από το κουμπί έγκρισης.':'Public status comes only from independent observation, not from the approval button.'}</p><p>{gr?'Επαληθευμένη δημόσια γενιά: ':'Verified public generation: '}{catalog.delivery?.receipts?.reduce((generation,r)=>r.status==='released_verified'&&Number.isSafeInteger(r.generation)?Math.max(generation,r.generation):generation,0)||'—'}</p>
    {catalog.delivery?.blocked&&<p role="status">{gr?'Απαιτείται συμφωνία της άγνωστης έκβασης πριν από νέα παράδοση.':'The unknown outcome must be reconciled before another delivery.'}</p>}
    <ul>{catalog.delivery?.receipts.map(r=><li key={r.receipt_id}>{r.status} · {r.generation} · {r.verified_live_at}</li>)}</ul>
   </>}
  </fieldset>
  {preview&&<Review preview={preview} imageURL={privateImage.current} publicationAction onAuthorize={input=>call('/publication/authorize',input)}/>}
  {message&&<p role="status">{message}</p>}
 </section>;
}

import React, { useEffect, useRef, useState } from 'react';
import { operationsConfig } from './config.js';
import './nyra-lab.css';
const MODELS=['gpt-6.1-sol','gpt-6-astra','gpt-6-luna'];
const names={'gpt-6.1-sol':'GPT-6.1 Sol','gpt-6-astra':'GPT-6 Astra','gpt-6-luna':'GPT-6 Luna'};
const usd=n=>'$'+Number(n||0).toFixed(4);
function sourceLink(source, label) {
  return <a href={source.url} target="_blank" rel="noopener noreferrer">{label || source.title || source.url}</a>;
}
// Render provider citations as React text and safe links, never as HTML/Markdown.
export function ResearchText({ text, annotations }) {
  const parts = []; let offset = 0;
  const spans = [...(annotations || [])].filter(a => a.url && Number.isInteger(a.start_index) && Number.isInteger(a.end_index)).sort((a, b) => a.start_index - b.start_index);
  for (const a of spans) {
    if (a.start_index < offset || a.end_index <= a.start_index || a.end_index > text.length) continue;
    parts.push(text.slice(offset, a.start_index));
    parts.push(<React.Fragment key={a.start_index}>{sourceLink(a, '[' + (a.title || 'source') + ']')}</React.Fragment>);
    offset = a.end_index;
  }
  parts.push(text.slice(offset));
  return <div className="nyra-research-text">{parts}</div>;
}
export default function NyraLab({lang,token,onUnauthorized}) {
  const gr=lang==='el',access=useRef({token,onUnauthorized});access.current={token,onUnauthorized};
  const mounted=useRef(true),inFlight=useRef(false),control=useRef(null),stop=useRef(false);
  const [topic,setTopic]=useState(''),[direction,setDirection]=useState(''),[language,setLanguage]=useState(gr?'gr':'en'),[format,setFormat]=useState('signal');
  const [model,setModel]=useState('gpt-6.1-sol'),[budget,setBudget]=useState('3'),[auto,setAuto]=useState(false);
  const [work,setWork]=useState(null),[history,setHistory]=useState([]),[busy,setBusy]=useState(false),[error,setError]=useState(''),[status,setStatus]=useState(null),[version,setVersion]=useState(-1),[revision,setRevision]=useState('');
  const phaseNames={research:gr?'Έρευνα':'Research',evidence:gr?'Ανάκτηση πηγών':'Source retrieval',draft:gr?'Συγγραφή':'Writing',review:gr?'Έλεγχος':'Review',proposals:gr?'Προτάσεις θεμάτων':'Topic proposals',paused:gr?'Αναμονή έγκρισης διόρθωσης':'Awaiting repair approval',done:gr?'Ολοκληρώθηκε':'Completed',selection:gr?'Επιλογή θέματος':'Choose a topic',error:gr?'Διακοπή':'Stopped'};
  const drafts=work?.state.drafts||[],current=version<0?drafts.at(-1):drafts[version],research=work?.state.research;
  const api=operationsConfig.supabaseUrl+'/functions/v1/nyra-api';
  const errors={BUDGET_EXCEEDED:gr?'Η εκτίμηση του επόμενου σταδίου υπερβαίνει τον προϋπολογισμό. Η εργασία αποθηκεύτηκε.':'The next stage estimate exceeds the budget. Your work is saved.',PROVIDER_LIMIT:gr?'Το API επέστρεψε όριο χρήσης ή διαθέσιμου υπολοίπου.':'The API reported a usage or balance limit.',WORK_BUSY:gr?'Η εργασία εκτελείται ήδη. Ανανέωσε το ιστορικό σε λίγο.':'This work is already running. Refresh history shortly.',INTERRUPTED_COST_UNKNOWN:gr?'Η εργασία διακόπηκε και η χρέωση δεν επιβεβαιώθηκε. Διατηρήθηκε η εκτίμηση κόστους.':'The work was interrupted and billing is unconfirmed. Its cost allowance was retained.'};
  async function call(path,payload) {
    const jwt=await access.current.token();
    const response=await fetch(api+path,{method:payload===undefined?'GET':'POST',credentials:'omit',headers:{Authorization:'Bearer '+jwt,Accept:'application/json',...(payload===undefined?{}:{'Content-Type':'application/json'})},body:payload===undefined?undefined:JSON.stringify(payload),signal:AbortSignal.any([control.current?.signal||new AbortController().signal,AbortSignal.timeout(125000)])});
    const data=await response.json();if(!response.ok){if(response.status===401)await access.current.onUnauthorized();throw new Error(data.error||'SERVICE_UNAVAILABLE');}return data;
  }
  function accept(w,loadSettings=false){if(!mounted.current)return;setWork(w);setVersion(-1);if(loadSettings){setModel(w.model);setBudget(String(w.budget));setAuto(w.auto_repairs);}}
  async function refreshHistory(){const h=await call('/work');if(mounted.current)setHistory(h.work);}
  async function action(fn){if(inFlight.current)return;inFlight.current=true;control.current=new AbortController();stop.current=false;setBusy(true);setError('');try{await fn();}catch(e){if(mounted.current)setError(errors[e.message]||e.message);}finally{try{await refreshHistory();}catch{}inFlight.current=false;if(mounted.current)setBusy(false);}}
  useEffect(()=>{mounted.current=true;action(async()=>{const s=await call('/status');if(mounted.current)setStatus(s);});return()=>{mounted.current=false;control.current?.abort();};},[]);
  async function run(w){let next=w;while(!stop.current&&!['done','selection','paused','error'].includes(next.state.stage)){next=await call('/work/'+next.id+'/step',{seq:next.seq});accept(next);if(next.active_seq!==null)break;}if(next.state.error)setError(errors[next.state.error]||next.state.error);}
  async function create(kind,selected){await action(async()=>{const w=await call('/work',{kind,topic,direction,language,format,model,budget:Number(budget),auto_repairs:auto,...selected});accept(w);await run(w);});}
  async function open(id){await action(async()=>accept(await call('/work/'+id),true));}
  async function saveSettings(resume=false){await action(async()=>{const w=await call('/work/'+work.id+'/settings',{model,budget:Number(budget),auto_repairs:auto,resume});accept(w);if(resume)await run(w);});}
  async function revise(e){e.preventDefault();await action(async()=>{const w=await call('/work/'+work.id+'/revision',{revision_note:revision,version});accept(w);setRevision('');await run(w);});}
  async function importHistory(event){const file=event.target.files?.[0];if(!file)return;event.target.value='';await action(async()=>{if(file.size>2000000)throw new Error('PAYLOAD_TOO_LARGE');const content=JSON.parse(await file.text());const w=await call('/import',{export:content,model,budget:Number(budget),auto_repairs:auto});accept(w);});}
  function download(){if(!work)return;const blob=new Blob([JSON.stringify({export_version:2,exported_at:new Date().toISOString(),work,drafts},null,2)],{type:'application/json'});const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='nyra-work-'+work.id+'.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
  const preferences=<div className="nyra-options">
    <label>{gr?'Μοντέλο':'Model'}<select value={model} onChange={e=>setModel(e.target.value)}>{MODELS.map(m=><option key={m} value={m}>{names[m]}</option>)}</select></label>
    <label>{gr?'Προϋπολογισμός ανά ανάθεση (USD)':'Budget per assignment (USD)'}<input type="number" min="0.10" max="100" step="0.10" value={budget} onChange={e=>setBudget(e.target.value)} required /></label>
    <label className="nyra-check"><input type="checkbox" checked={auto} onChange={e=>setAuto(e.target.checked)} />{gr?'Αυτόματες διορθώσεις (έως δύο)':'Automatic repairs (up to two)'}</label>
  </div>;
  return <section className="nyra-lab" aria-labelledby="nyra-title">
    <div className="ops-panel"><p className="ops-eyebrow">NYRA / PRIVATE EDITORIAL LAB</p><h2 id="nyra-title">{gr?'Έρευνα, επιλογή, συντακτική κρίση.':'Research, selection, editorial judgment.'}</h2>
      <p className="nyra-notice">{gr?'Οι εργασίες, οι πηγές και οι εκδόσεις αποθηκεύονται στο ιδιωτικό ιστορικό. Κάθε εκτέλεση μοντέλου χρεώνεται μέσω του API. Η επιλογή θέματος εγκρίνει μόνο την έναρξη συγγραφής. Η δημοσίευση άρθρων δεν είναι ακόμη ενεργή.':'Work, sources and versions are saved in private history. Model calls use the paid API. Topic selection approves writing only. Article publishing is not enabled yet.'}</p>
      {status&&<p>{status.prompt_version} · {gr?'Προεπιλογή: Sol · Τιμές':'Default: Sol · Prices'} {status.price_date}</p>}
      <form onSubmit={e=>{e.preventDefault();create('article');}}><fieldset disabled={busy} className="nyra-fields">
        {preferences}
        <p>{gr?'Ο προϋπολογισμός ελέγχεται πριν από κάθε στάδιο βάσει εκτίμησης. Δεν είναι εγγυημένο πλαφόν χρέωσης OpenAI. Άγνωστες χρεώσεις κρατούν δεσμευμένη την εκτίμηση.':'Budget is checked before each stage using an estimate. It is not a guaranteed OpenAI billing cap. Unknown charges retain their allowance.'}</p>
        <details><summary>{gr?'Τιμές μοντέλων και χρέωση':'Model prices and billing'}</summary><table><thead><tr><th>{gr?'Μοντέλο':'Model'}</th><th>Input / 1M</th><th>Output / 1M</th></tr></thead><tbody>{Object.entries(status?.models||{}).map(([id,p])=><tr key={id}><td>{p.label}</td><td>${p.input}</td><td>${p.output}</td></tr>)}</tbody></table><p>{gr?'Η έξοδος περιλαμβάνει εσωτερική συλλογιστική. Cache και αναζήτηση υπολογίζονται χωριστά. Οι εκτιμήσεις δεν περιλαμβάνουν φόρους ή χρεώσεις φιλοξενίας.':'Output includes reasoning. Cache and search are calculated separately. Estimates exclude taxes and hosting.'}</p></details>
        <label>{gr?'Θέμα ή ερώτημα':'Topic or question'}<textarea value={topic} onChange={e=>setTopic(e.target.value)} rows={3} maxLength={4000} required /></label>
        <label>{gr?'Κατεύθυνση / προαιρετικό υλικό':'Direction / optional material'}<textarea value={direction} onChange={e=>setDirection(e.target.value)} rows={3} maxLength={2000} /></label>
        <div className="nyra-options"><label>{gr?'Γλώσσα':'Language'}<select value={language} onChange={e=>setLanguage(e.target.value)}><option value="gr">Ελληνικά</option><option value="en">English</option></select></label><label>{gr?'Μορφή':'Format'}<select value={format} onChange={e=>setFormat(e.target.value)}><option value="signal">Signal · 500–800</option><option value="essay">Signal Essay · 1.200–1.800</option></select></label></div>
        <button type="submit" className="ops-button">{gr?'Νέα ανάθεση: έρευνα και προσχέδιο':'New assignment: research and draft'}</button>
        <button type="button" onClick={()=>create('topics')}>{gr?'Πρότεινε τρία θέματα από την επικαιρότητα':'Suggest three current topics'}</button>
        <p>{gr?'Οικονομία · τεχνολογία · startups · επενδύσεις · κοινωνία · πολιτική · εργασία, με σύνδεση με AI και τεχνολογία. Η αναζήτηση θεμάτων χρεώνεται.':'Economy · technology · startups · investment · society · politics · work, connected to AI and technology. Topic research is paid.'}</p>
      </fieldset></form>
      {error&&<p role="alert" className="ops-error">{error}</p>}
      {busy&&<p role="status">{phaseNames[work?.state.stage]|| (gr?'Φόρτωση…':'Loading…')}… <button onClick={()=>{stop.current=true;}}>{gr?'Παύση μετά το τρέχον στάδιο':'Pause after this stage'}</button></p>}
    </div>
    <div className="ops-panel"><h3>{gr?'Ιστορικό εργασιών':'Work history'}</h3><button disabled={busy} onClick={()=>action(refreshHistory)}>{gr?'Ανανέωση ιστορικού':'Refresh history'}</button>
      {!history.length&&<p>{gr?'Δεν υπάρχουν αποθηκευμένες εργασίες. Οι παλαιότερες δοκιμές της συνεδρίας δεν μεταφέρονται αυτόματα.':'No saved work yet. Earlier session-only trials are not transferred automatically.'}</p>}
      <label>{gr?'Εισαγωγή παλαιών προσχεδίων (JSON)':'Import earlier drafts (JSON)'}<input type="file" accept="application/json,.json" disabled={busy} onChange={importHistory} /></label>
      <ul>{history.map(h=><li key={h.id}><button disabled={busy} onClick={()=>open(h.id)}>{h.title}</button> · {new Date(h.created_at).toLocaleString(gr?'el-GR':'en-GB')} · {names[h.model]} · {usd(h.spent)}</li>)}</ul>
    </div>
    {work&&<div className="ops-panel"><h3>{work.title}</h3><p role="status">{phaseNames[work.state.stage]} · {names[work.model]} · {gr?'Υπολογισμένο / δεσμευμένο':'Accounted / reserved'} {usd(work.spent)} / {usd(work.budget)}</p>
      <p>{gr?'Εκτίμηση επόμενου σταδίου: ':'Next stage estimate: '}{usd(work.next_estimate)}</p>
      {work.state.imported&&<p>{gr?'Εισαγόμενο ιστορικό. Τα παλιά ποσά και οι αξιολογήσεις δεν πιστοποιούνται από τη νέα καταγραφή. Για νέα επεξεργασία ξεκίνησε ανάθεση με το ίδιο θέμα.':'Imported history. Earlier charges and reviews are not verified by the new ledger. Start a new assignment with the same topic to continue.'}</p>}
      <div className="nyra-actions"><button disabled={busy} onClick={()=>saveSettings(false)}>{gr?'Εφαρμογή μοντέλου και προϋπολογισμού σε αυτή την εργασία':'Apply model and budget to this work'}</button>
      {['paused','error'].includes(work.state.stage)?<button disabled={busy} onClick={()=>saveSettings(true)}>{gr?'Συνέχεια με τις επιλεγμένες ρυθμίσεις (με χρέωση)':'Continue with selected settings (paid)'}</button>:!['done','selection'].includes(work.state.stage)&&<button disabled={busy||work.active_seq!==null} onClick={()=>action(()=>run(work))}>{gr?'Συνέχεια εργασίας':'Continue work'}</button>}
      {work.active_seq!==null&&<button disabled={busy} onClick={()=>action(async()=>accept(await call('/work/'+work.id+'/recover',{})))}>{gr?'Ανάκτηση διακοπής μετά από 5 λεπτά':'Recover interruption after 5 minutes'}</button>}
      <button onClick={download}>{gr?'Λήψη εργασίας και εκδόσεων':'Download work and versions'}</button></div>
      {work.steps?.length>0&&<div className="nyra-table"><table><thead><tr><th>{gr?'Στάδιο':'Stage'}</th><th>{gr?'Μοντέλο':'Model'}</th><th>Input</th><th>Output</th><th>USD</th><th>{gr?'Κατάσταση':'Status'}</th></tr></thead><tbody>{work.steps.map(s=><tr key={s.seq}><td>{s.seq+1}. {phaseNames[s.stage]}</td><td>{names[s.model]}</td><td>{s.usage?.input_tokens??'—'}</td><td>{s.usage?.output_tokens??'—'}</td><td>{usd(s.cost??s.reserved)}{s.cost===null?' *':''}</td><td>{s.status}{s.error?' · '+s.error:''}</td></tr>)}</tbody></table><small>{gr?'* Δεσμευμένη εκτίμηση, χωρίς επιβεβαιωμένη κατανάλωση. Όλα τα ποσά είναι εκτιμήσεις· το Billing του API είναι το οριστικό παραστατικό.':'* Reserved estimate without confirmed usage. All amounts are estimates; API billing is authoritative.'}</small></div>}
      {drafts.length>0&&<label>{gr?'Έκδοση άρθρου':'Article version'}<select value={version} onChange={e=>setVersion(Number(e.target.value))}><option value={-1}>{gr?'Τελευταία':'Latest'}</option>{drafts.map((d,i)=><option key={d.run.id} value={i}>{i+1}. {d.article.title} · {d.run.model}</option>)}</select></label>}
    </div>}
    {work?.state.proposals&&<div className="ops-panel"><h3>{gr?'Τρία προτεινόμενα θέματα':'Three proposed topics'}</h3><p>{gr?'Έρευνα: ':'Researched: '}{new Date(work.state.proposals.created_at).toLocaleString()}</p><div className="nyra-topic-grid">{work.state.proposals.topics.map((t,i)=><article key={i}><p className="ops-eyebrow">{t.sector} · {t.event_date}</p><h3>{t.title}</h3><p><strong>{gr?'Γιατί τώρα: ':'Why now: '}</strong>{t.why_now}</p><p>{t.central_question}</p><p><strong>{gr?'Προσωρινή θέση: ':'Provisional thesis: '}</strong>{t.provisional_thesis}</p><p><strong>{gr?'Οπτική: ':'Angle: '}</strong>{t.original_angle}</p><p><strong>{gr?'Αντίλογος: ':'Counterargument: '}</strong>{t.counterargument}</p><ul>{t.source_urls.map(url=><li key={url}>{sourceLink({url})}</li>)}</ul><p>{t.format==='essay'?'Signal Essay · 1.200–1.800':'Signal · 500–800'}</p><button disabled={busy} onClick={()=>create('article',{selected_from:work.id,selected_index:i})}>{gr?'Εγκρίνω το θέμα — έναρξη συγγραφής με τις επιλεγμένες ρυθμίσεις':'Approve topic — start writing with selected settings'}</button></article>)}</div></div>}
    {current && <article className="ops-panel nyra-article">
      <p className="ops-eyebrow">{gr ? 'ΠΡΟΣΧΕΔΙΟ / ΧΡΕΙΑΖΕΤΑΙ ΣΥΝΤΑΚΤΙΚΟ ΕΛΕΓΧΟ' : 'DRAFT / EDITORIAL REVIEW REQUIRED'}</p>
      <h2>{current.article.title}</h2><p className="nyra-summary">{current.article.summary}</p>
      <p className="nyra-meta">{current.assignment.language.toUpperCase()} · {current.article.word_count} {gr ? 'λέξεις' : 'words'} · {current.run.prompt_version} · {current.run.model}</p>
      {!current.article.checks.length && <p role="status">{gr ? 'Η έκταση είναι εκτός ορίου. Χρειάζεται αναθεώρηση.' : 'Length is outside the requested range. A revision is needed.'}</p>}
      <div role="status">
        <p>{!current.automatic_review ? (gr ? 'Ο αυτόματος συντακτικός έλεγχος δεν έχει ολοκληρωθεί.' : 'Automatic editorial review has not completed.') : current.automatic_review.passed ? (gr ? 'Ο αυτόματος έλεγχος ολοκληρώθηκε χωρίς εκκρεμότητες. Ακολουθεί η δική σου αξιολόγηση.' : 'Automatic review completed without outstanding issues. Your editorial review follows.') : (gr ? 'Παραμένουν εκκρεμότητες μετά τον αυτόματο έλεγχο. Το προσχέδιο χρειάζεται αναθεώρηση.' : 'Issues remain after automatic review. The draft needs revision.')}</p>
        {current.automatic_review?.issues.length > 0 && <ul>{current.automatic_review.issues.map((x, i) => <li key={i}>{x}</li>)}</ul>}
      </div>
      {current.automatic_review && <details><summary>{gr ? 'Αυτόματος συντακτικός έλεγχος' : 'Automatic editorial review'}</summary><p>{gr ? 'Κύκλοι αυτόματης διόρθωσης: ' : 'Automatic repair cycles: '}{current.repair_cycles}/2</p><p>{current.automatic_review.revision_instructions}</p><p>{current.automatic_review.research_questions}</p><p>{gr ? 'Ο αυτοέλεγχος δεν αποτελεί ανεξάρτητη επαλήθευση των γεγονότων ή έγκριση δημοσίευσης.' : 'Self-review is not independent fact verification or publication approval.'}</p></details>}
      {current.article.paragraphs.map((p, i) => <p key={i}>{p.text}{p.source_urls.map(url => <sup key={url}> {sourceLink({ url }, '[' + (current.sources.findIndex(s => s.url === url) + 1) + ']')}</sup>)}</p>)}
      {current.research?.source_records && <details><summary>{gr ? 'Καταγεγραμμένα αποσπάσματα πηγών' : 'Captured source excerpts'}</summary>
        <p>{gr ? 'Επιλεγμένο περιεχόμενο που ανακτήθηκε από την εφαρμογή. Η αντιστοίχιση με τους ισχυρισμούς ελέγχεται χωριστά· δεν πιστοποιείται πλήρης ανάγνωση.' : 'Selected content retrieved by the application. Claim support is reviewed separately; this does not certify full reading.'}</p>
        {current.research.source_records.map(r => <div key={r.source_url}><p>{sourceLink({ url: r.source_url })} · {r.retrieved_at} · {r.status === 'captured' ? (gr ? 'Ανακτήθηκε απόσπασμα' : 'Excerpt captured') : (gr ? 'Δεν ανακτήθηκε: ' : 'Not retrieved: ') + r.limitation}</p>
          {r.excerpts.map(e => <div key={e.id}><small>{e.id} · {gr ? 'Χαρακτήρες' : 'Characters'} {e.start}–{e.end}</small><blockquote>{e.text}</blockquote></div>)}</div>)}
      </details>}
      <details><summary>{gr ? 'Πηγές και πρόσβαση' : 'Sources and access'}</summary><ol>{current.sources.map(s => <li key={s.url}>{sourceLink(s)} <small>· {s.access === 'opened_page' ? (gr ? 'Καταγεγραμμένο άνοιγμα σελίδας' : 'Recorded page open') : (gr ? 'Αποτέλεσμα αναζήτησης / παραπομπή' : 'Search result / citation')}</small></li>)}</ol><p>{gr ? 'Η προέλευση των παραπομπών ελέγχθηκε. Η ακρίβεια και η αντιστοίχιση κάθε ισχυρισμού χρειάζονται συντακτικό έλεγχο.' : 'Citation provenance was checked. Accuracy and claim-level support require editorial review.'}</p></details>
      <details><summary>{gr ? 'Σημείωμα προς τον Ηλία' : 'Editorial note'}</summary>
        <h3>{gr ? 'Κεντρική θέση' : 'Thesis'}</h3><p>{current.article.thesis}</p>
        <h3>{gr ? 'Τι προσθέτει' : 'Original contribution'}</h3><p>{current.article.original_contribution}</p>
        <h3>{gr ? 'Ισχυρότερη αντίρρηση' : 'Strongest counterargument'}</h3><p>{current.article.counterargument}</p>
        <p>{current.article.editor_note}</p><ul>{current.article.uncertainties.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </details>
      <form onSubmit={revise}><label>{gr ? 'Οδηγία αναθεώρησης' : 'Revision instruction'}<textarea value={revision} onChange={e => setRevision(e.target.value)} required maxLength={3000} /></label><button disabled={busy||work.state.imported} type="submit">{gr ? 'Αναθεώρηση με χρέωση' : 'Revise (paid)'}</button></form>
    </article>}
    {research&&<details className="ops-panel"><summary>{gr?'Τελευταία έρευνα':'Latest research'}</summary><ResearchText text={research.report} annotations={research.annotations} /></details>}
  </section>;
}

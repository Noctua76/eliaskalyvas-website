import React, { useEffect, useRef, useState } from 'react';
import { operationsConfig } from './config.js';
import { runEditorialWorkflow } from './nyra-workflow.mjs';
import './nyra-lab.css';

const messages = {
  NYRA_NOT_CONFIGURED: ['Η Nyra περιμένει ενεργοποίηση από τον διαχειριστή.', 'Nyra is awaiting activation.'],
  RATE_LIMITED: ['Έφτασες το όριο δοκιμών. Δοκίμασε ξανά σε 10 λεπτά.', 'The test limit was reached. Try again in 10 minutes.'],
  PROVIDER_LIMIT: ['Το OpenAI API επέστρεψε όριο χρήσης ή διαθέσιμου υπολοίπου.', 'The OpenAI API reported a usage or credit limit.'],
  PROVIDER_CONFIGURATION: ['Χρειάζεται έλεγχος της σύνδεσης με το OpenAI API.', 'The OpenAI API connection needs attention.'],
  PROVIDER_TIMEOUT: ['Η εργασία ξεπέρασε τον διαθέσιμο χρόνο. Δεν έγινε αυτόματη επανάληψη.', 'The operation timed out. It was not retried automatically.'],
  RESEARCH_EXPIRED_OR_INVALID: ['Η έρευνα έληξε ή άλλαξε η διαμόρφωση. Ξεκίνα νέα έρευνα.', 'The research expired or the configuration changed. Start new research.'],
  UNVERIFIED_CITATION: ['Το προσχέδιο περιείχε παραπομπή εκτός της έρευνας και δεν παραδόθηκε.', 'The draft contained a citation outside the research and was withheld.'],
  ARTICLE_WITHOUT_CITATIONS: ['Το προσχέδιο δεν είχε παραπομπές και δεν παραδόθηκε.', 'The draft had no citations and was withheld.'],
  RESEARCH_WITHOUT_SOURCES: ['Δεν επιστράφηκαν ελέγξιμες πηγές. Το άρθρο δεν δημιουργήθηκε.', 'No traceable sources were returned. The article was not generated.'],
  MODEL_INCOMPLETE: ['Η απάντηση του μοντέλου ήταν ελλιπής. Δεν έγινε αυτόματη επανάληψη.', 'The model response was incomplete. It was not retried automatically.'],
  MODEL_REFUSED: ['Το μοντέλο δεν ολοκλήρωσε τη συγκεκριμένη εργασία.', 'The model declined this task.'],
  MFA_REQUIRED: ['Απαιτείται νέα επαλήθευση δύο παραγόντων.', 'Two-factor verification is required again.'],
};
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
export default function NyraLab({ lang, token, onUnauthorized }) {
  const gr = lang === 'el', access = useRef({ token, onUnauthorized });
  access.current = { token, onUnauthorized };
  const controller = useRef(null), inFlight = useRef(false), mounted = useRef(true);
  const [topic, setTopic] = useState(''), [direction, setDirection] = useState('');
  const [language, setLanguage] = useState(gr ? 'gr' : 'en'), [format, setFormat] = useState('signal');
  const [phase, setPhase] = useState('idle'), [error, setError] = useState(''), [status, setStatus] = useState(null);
  const [research, setResearch] = useState(null), [drafts, setDrafts] = useState([]), [revision, setRevision] = useState('');
  const [downloaded, setDownloaded] = useState(false);
  const busy = ['research', 'draft', 'review', 'checking'].includes(phase);
  const apiUrl = operationsConfig.supabaseUrl + '/functions/v1/nyra-api';
  const current = drafts.at(-1);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, []);
  useEffect(() => {
    const protect = event => { if (drafts.length && !downloaded) { event.preventDefault(); event.returnValue = ''; } };
    window.addEventListener('beforeunload', protect);
    return () => window.removeEventListener('beforeunload', protect);
  }, [drafts.length, downloaded]);
  async function call(path, payload) {
    const jwt = await access.current.token();
    const r = await fetch(apiUrl + path, {
      method: payload === undefined ? 'GET' : 'POST', credentials: 'omit',
      headers: { Accept: 'application/json', Authorization: 'Bearer ' + jwt, ...(payload === undefined ? {} : { 'Content-Type': 'application/json' }) },
      body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.any([controller.current.signal, AbortSignal.timeout(125000)]),
    });
    let data; try { data = await r.json(); } catch { throw new Error('SERVICE_UNAVAILABLE'); }
    if (!r.ok || data.error) {
      if (r.status === 401) await access.current.onUnauthorized();
      throw new Error(data.error || 'SERVICE_UNAVAILABLE');
    }
    return data;
  }
  async function action(fn) {
    if (inFlight.current) return;
    inFlight.current = true; controller.current = new AbortController(); setError('');
    try { await fn(); }
    catch (e) {
      if (mounted.current) {
        const code = ['TimeoutError', 'AbortError'].includes(e.name) ? 'PROVIDER_TIMEOUT' : e.message;
        setError(messages[code]?.[gr ? 0 : 1] || (gr ? 'Η εργασία δεν ολοκληρώθηκε. Κωδικός: ' : 'The operation failed. Code: ') + code);
      }
    } finally { inFlight.current = false; if (mounted.current) setPhase('idle'); }
  }
  async function check() { await action(async () => { setPhase('checking'); const s = await call('/status'); if (mounted.current) setStatus(s); }); }
  async function editorial(r, previousArticle, revisionNote = '') {
    return runEditorialWorkflow({ call, research: r, previousArticle, revisionNote,
      onPhase: p => { if (mounted.current) setPhase(p); },
      onResearch: next => { if (mounted.current) setResearch(next); },
      onDraft: d => {
        if (!mounted.current) return;
        setDrafts(previous => previous.some(x => x.run.id === d.run.id) ? previous.map(x => x.run.id === d.run.id ? d : x) : [...previous, d]);
        setDownloaded(false);
      },
    });
  }
  async function write(e) {
    e.preventDefault();
    await action(async () => {
      setPhase('research');
      const r = await call('/research', { topic, direction, language, format });
      if (!mounted.current) return;
      setResearch(r);
      await editorial(r);
      if (mounted.current) setRevision('');
    });
  }
  async function revise(e) {
    e.preventDefault(); if (!current) return;
    await action(async () => {
      setPhase('draft');
      const r = current.research;
      const note = [current.revision_note, revision].filter(Boolean).join('\n').slice(-3000);
      await editorial(r, current.article, note);
      if (mounted.current) setRevision('');
    });
  }
  async function retryDraft() {
    if (!research) return;
    await action(async () => {
      await editorial(research);
    });
  }
  function download() {
    // The signed ticket is temporary session authorization, not part of the export.
    const clean = drafts.map(({ research: r, ...d }) => ({ ...d, research: r ? { ...r, ticket: undefined } : null }));
    const blob = new Blob([JSON.stringify({ export_version: 1, exported_at: new Date().toISOString(), drafts: clean }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob), a = document.createElement('a'); a.href = url;
    a.download = 'nyra-drafts-' + new Date().toISOString().replace(/[:.]/g, '-') + '.json'; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000); setDownloaded(true);
  }
  return <section className="nyra-lab" aria-labelledby="nyra-title">
    <div className="ops-panel">
      <p className="ops-eyebrow">NYRA / PRIVATE EDITORIAL LAB</p>
      <h2 id="nyra-title">{gr ? 'Μια ιδέα. Ένα νέο ερώτημα.' : 'An idea. A new question.'}</h2>
      <p>{gr ? 'Δώσε στη Nyra ένα θέμα. Θα το ερευνήσει και θα γράψει ένα προσχέδιο με τη δική της οπτική.' : 'Give Nyra a topic. She will research it and write a draft with her own perspective.'}</p>
      <p className="nyra-notice">{gr ? 'Δοκιμαστικό περιβάλλον. Τα προσχέδια παραμένουν μόνο σε αυτή τη συνεδρία· κατέβασέ τα πριν αποσυνδεθείς. Η Nyra ερευνά, γράφει, ελέγχει και διορθώνει έως δύο φορές, με πρόσθετη έρευνα όταν χρειάζεται. Κάθε βήμα χρησιμοποιεί το OpenAI API και χρεώνεται. Η δημοσίευση χρειάζεται τη δική σου έγκριση και δεν είναι ακόμη ενεργή.' : 'Test environment. Drafts remain in this session only; download them before signing out. Nyra researches, writes, reviews and repairs up to twice, with further research when needed. Each step uses the paid OpenAI API. Publishing requires your approval and is not enabled yet.'}</p>
      <button type="button" disabled={busy} onClick={check}>{gr ? 'Έλεγχος σύνδεσης' : 'Check connection'}</button>
      {status && <p role="status">{status.enabled ? (gr ? 'Η σύνδεση είναι ρυθμισμένη. Η πρώτη εργασία θα ελέγξει τη λειτουργία του API.' : 'Configuration is present. The first task will verify the API connection.') : (gr ? 'Αναμονή ενεργοποίησης.' : 'Awaiting activation.')} · {status.prompt_version}{status.model ? ' · ' + status.model : ''}</p>}
      <form onSubmit={write}>
        <fieldset disabled={busy} className="nyra-fields">
          <label>{gr ? 'Θέμα ή ερώτημα' : 'Topic or question'}<textarea value={topic} onChange={e => setTopic(e.target.value)} maxLength={4000} rows={4} required placeholder={gr ? 'Πώς επηρεάζει η AI την προσωπική μας κρίση;' : 'How does AI affect our own judgment?'} /></label>
          <label>{gr ? 'Κατεύθυνση ή υλικό αναφοράς (προαιρετικά)' : 'Direction or references (optional)'}<textarea value={direction} onChange={e => setDirection(e.target.value)} maxLength={2000} rows={3} /></label>
          <div className="nyra-options">
            <label>{gr ? 'Γλώσσα άρθρου' : 'Article language'}<select value={language} onChange={e => setLanguage(e.target.value)}><option value="gr">Ελληνικά</option><option value="en">English</option></select></label>
            <label>{gr ? 'Μορφή' : 'Format'}<select value={format} onChange={e => setFormat(e.target.value)}><option value="signal">Signal · 500–800</option><option value="essay">Signal Essay · 1.200–1.800</option></select></label>
          </div>
          <button className="ops-button" type="submit">{gr ? 'Έρευνα και προσχέδιο' : 'Research and draft'} ⟶</button>
        </fieldset>
      </form>
      {busy && <p role="status" aria-live="polite">{phase === 'research' ? (gr ? 'Η Nyra ερευνά το θέμα…' : 'Nyra is researching the topic…') : phase === 'draft' ? (gr ? 'Η Nyra γράφει ή αναθεωρεί το προσχέδιο…' : 'Nyra is writing or revising the draft…') : phase === 'review' ? (gr ? 'Η Nyra ελέγχει σαφήνεια, επιχειρήματα και τεκμηρίωση…' : 'Nyra is reviewing clarity, arguments and evidence…') : (gr ? 'Έλεγχος διαμόρφωσης…' : 'Checking configuration…')}</p>}
      {error && <p className="ops-error" role="alert">{error}</p>}
      {research && !busy && error && <button onClick={retryDraft}>{gr ? 'Νέα προσπάθεια συγγραφής με αυτή την έρευνα' : 'Try writing again with this research'}</button>}
    </div>
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
      <details><summary>{gr ? 'Πηγές και πρόσβαση' : 'Sources and access'}</summary><ol>{current.sources.map(s => <li key={s.url}>{sourceLink(s)} <small>· {s.access === 'opened_page' ? (gr ? 'Καταγεγραμμένο άνοιγμα σελίδας' : 'Recorded page open') : (gr ? 'Αποτέλεσμα αναζήτησης / παραπομπή' : 'Search result / citation')}</small></li>)}</ol><p>{gr ? 'Η προέλευση των παραπομπών ελέγχθηκε. Η ακρίβεια και η αντιστοίχιση κάθε ισχυρισμού χρειάζονται συντακτικό έλεγχο.' : 'Citation provenance was checked. Accuracy and claim-level support require editorial review.'}</p></details>
      <details><summary>{gr ? 'Σημείωμα προς τον Ηλία' : 'Editorial note'}</summary>
        <h3>{gr ? 'Κεντρική θέση' : 'Thesis'}</h3><p>{current.article.thesis}</p>
        <h3>{gr ? 'Τι προσθέτει' : 'Original contribution'}</h3><p>{current.article.original_contribution}</p>
        <h3>{gr ? 'Ισχυρότερη αντίρρηση' : 'Strongest counterargument'}</h3><p>{current.article.counterargument}</p>
        <p>{current.article.editor_note}</p><ul>{current.article.uncertainties.map((x, i) => <li key={i}>{x}</li>)}</ul>
      </details>
      <form onSubmit={revise}><fieldset disabled={busy}><label>{gr ? 'Τι θέλεις να αλλάξει;' : 'What should change?'}<textarea value={revision} onChange={e => setRevision(e.target.value)} maxLength={3000} rows={3} required /></label><button type="submit">{gr ? 'Ζήτησε αναθεώρηση' : 'Request revision'}</button></fieldset></form>
      <p>{gr ? 'Η αναθεώρηση ξεκινά από την τρέχουσα έρευνα, η οποία ισχύει για 30 λεπτά. Αν ο αυτόματος έλεγχος εντοπίσει κενό, θα ακολουθήσει πρόσθετη έρευνα.' : 'Revision starts with the current research, valid for 30 minutes. Evidence gaps found during review trigger further research.'}</p>
      <button type="button" onClick={download}>{gr ? 'Λήψη προσχεδίων και έρευνας' : 'Download drafts and research'}</button>
      <details><summary>{gr ? 'Προηγούμενα προσχέδια αυτής της συνεδρίας' : 'Earlier drafts in this session'}</summary>{drafts.map((d, i) => <p key={i}>{i + 1}. {d.article.title} · {d.run.created_at} · {d.article.word_count} {gr ? 'λέξεις' : 'words'}</p>)}</details>
    </article>}
    {research && <details className="ops-panel"><summary>{gr ? 'Τελευταία έρευνα' : 'Latest research'}</summary><ResearchText text={research.report} annotations={research.annotations} /><ol>{research.sources.map(s => <li key={s.url}>{sourceLink(s)}</li>)}</ol></details>}
  </section>;
}

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { legalDocuments } from './legal-content.js';
import { CONSENT_KEY, readConsent, saveConsent, optionalCategories, legalPath, isPlainClick } from './consent.js';
import LegalModal from './LegalModal.jsx';
import './legal.css';

const copy = {
  el: { title: 'Cookies και απόρρητο', text: 'Χρησιμοποιούμε απαραίτητη τεχνική αποθήκευση και μηχανισμούς ασφάλειας. Δεν υπάρχουν ενεργά analytics ή διαφημιστικοί trackers. Οι μη απαραίτητες κατηγορίες παραμένουν ανενεργές.', accept: 'Αποδοχή όλων', reject: 'Απόρριψη μη απαραίτητων', settings: 'Ρυθμίσεις', preferences: 'Ρυθμίσεις cookies', save: 'Αποθήκευση επιλογών', necessary: 'Απαραίτητα', analytics: 'Analytics', marketing: 'Marketing / Διαφήμιση', necessaryText: 'Πάντα ενεργά: τεχνική λειτουργία, ασφάλεια/Turnstile και αποθήκευση αυτών των επιλογών. Η απόρριψη μη απαραίτητων δεν αποκλείει επικοινωνία ή κράτηση.', inactive: 'Μη ενεργή κατηγορία — δεν έχει εγκατασταθεί υπηρεσία. Δεν επιτρέπεται μελλοντική παρακολούθηση μέσω αυτής της επιλογής.', storage: 'Ο φυλλομετρητής δεν επέτρεψε αποθήκευση. Η επιλογή ισχύει εδώ, αλλά μπορεί να ζητηθεί ξανά στην επόμενη επίσκεψη.' },
  en: { title: 'Cookies and privacy', text: 'We use necessary technical storage and security mechanisms. No analytics or advertising trackers are active. Non-essential categories remain inactive.', accept: 'Accept all', reject: 'Reject non-essential', settings: 'Settings', preferences: 'Cookie Preferences', save: 'Save preferences', necessary: 'Necessary', analytics: 'Analytics', marketing: 'Marketing / Advertising', necessaryText: 'Always active: technical operation, security/Turnstile and storage of these choices. Rejecting non-essential categories does not block enquiries or booking.', inactive: 'Inactive category — no service is installed. This choice does not authorise future tracking.', storage: 'Your browser did not allow storage. The choice applies here, but may be requested again on your next visit.' },
};
function browserStorage() { try { return window.localStorage; } catch { return null; } }

export default function LegalControls({ lang, base }) {
  const t = copy[lang];
  const [consent, setConsent] = useState(() => readConsent(browserStorage()));
  const [modal, setModal] = useState(null);
  const [draft, setDraft] = useState({ analytics: false, marketing: false });
  const [storageError, setStorageError] = useState(false);
  useEffect(() => {
    const sync = event => {
      if (event.type === 'storage' && event.key !== CONSENT_KEY && event.key !== null) return;
      setConsent(readConsent(browserStorage()));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);
  function openCookies() { setDraft({ analytics: consent?.analytics || false, marketing: consent?.marketing || false }); setModal('cookies'); }
  function save(choices) {
    const result = saveConsent(browserStorage(), choices);
    setConsent(result.consent); setStorageError(!result.persisted); setModal(null);
  }
  function openLegal(e, kind) { if (isPlainClick(e)) { e.preventDefault(); setModal(kind); } }
  return <>
    <span className="legal-links">
      {['privacy', 'terms'].map(kind => <a key={kind} href={legalPath(base, lang, kind)} onClick={e => openLegal(e, kind)}>{legalDocuments[lang][kind].title}</a>)}
      <button type="button" onClick={openCookies}>{t.preferences}</button>
    </span>
    {!consent && createPortal(<aside className="cookie-banner" aria-label={t.title}>
      <div><h2>{t.title}</h2><p>{t.text} <a href={legalPath(base, lang, 'privacy')} onClick={e => openLegal(e, 'privacy')}>{legalDocuments[lang].privacy.title}</a></p></div>
      <div className="cookie-actions"><button type="button" onClick={() => save({ analytics: true, marketing: true })}>{t.accept}</button><button type="button" onClick={() => save({ analytics: false, marketing: false })}>{t.reject}</button><button type="button" onClick={openCookies}>{t.settings}</button></div>
    </aside>, document.body)}
    {storageError && <p className="cookie-storage-status" role="status">{t.storage}</p>}
    {modal && <LegalModal key={modal} kind={modal} lang={lang} onClose={() => setModal(null)}>
      <p>{t.text}</p>
      <div className="cookie-category"><label><input type="checkbox" checked disabled />{t.necessary}</label><p>{t.necessaryText}</p></div>
      {['analytics', 'marketing'].map(category => <div className="cookie-category" key={category}><label><input type="checkbox" disabled={!optionalCategories[category]} checked={draft[category]} onChange={e => setDraft(d => ({ ...d, [category]: e.target.checked }))} />{t[category]}</label><p>{t.inactive}</p></div>)}
      <div className="cookie-actions"><button type="button" onClick={() => save(draft)}>{t.save}</button><button type="button" onClick={() => save({ analytics: false, marketing: false })}>{t.reject}</button></div>
      <p><a href={legalPath(base, lang, 'privacy')} onClick={e => openLegal(e, 'privacy')}>{legalDocuments[lang].privacy.title}</a></p>
    </LegalModal>}
  </>;
}

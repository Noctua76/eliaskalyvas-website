import React, { useEffect, useRef, useId } from 'react';
import LegalDocument from './LegalDocument.jsx';

export default function LegalModal({ kind, lang, onClose, children }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close(); document.body.style.overflow = overflow;
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} className="legal-dialog" aria-labelledby={titleId}
    onCancel={e => { e.preventDefault(); onClose(); }}
    onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
    <div className="legal-dialog-surface">
      <button className="legal-close" type="button" autoFocus onClick={onClose} aria-label={lang === 'el' ? 'Κλείσιμο' : 'Close'}>×</button>
      <div className="legal-scroll">{kind === 'cookies' ? <><h1 id={titleId}>{lang === 'el' ? 'Ρυθμίσεις cookies' : 'Cookie Preferences'}</h1>{children}</> : <LegalDocument kind={kind} lang={lang} titleId={titleId} />}</div>
    </div>
  </dialog>;
}

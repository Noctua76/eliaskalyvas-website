import React from 'react';
import { legalDocuments } from './legal-content.js';

export default function LegalDocument({ kind, lang, titleId }) {
  const doc = legalDocuments[lang][kind];
  const gr = lang === 'el';
  return <article className="legal-document">
    <h1 id={titleId}>{doc.title}</h1>
    <p className="legal-meta">{gr ? 'Ισχύει από' : 'Effective'}: <time dateTime={doc.effectiveDate}>{doc.effectiveDate}</time> · {gr ? 'Τελευταία ενημέρωση' : 'Last updated'}: <time dateTime={doc.updatedDate}>{doc.updatedDate}</time> · {gr ? 'Έκδοση' : 'Version'} {doc.version}</p>
    {doc.sections.map((section, i) => <section key={section.heading}>
      <h2>{i + 1}. {section.heading}</h2>
      {section.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
    </section>)}
    <p><a href="mailto:info@eliaskalyvas.gr">info@eliaskalyvas.gr</a>{kind === 'privacy' && <> · <a href="https://www.dpa.gr/" target="_blank" rel="noopener noreferrer">{gr ? 'Αρχή Προστασίας Δεδομένων Προσωπικού Χαρακτήρα' : 'Hellenic Data Protection Authority'}</a></>}</p>
  </article>;
}

import React from 'react';
import { createRoot } from 'react-dom/client';
import LegalDocument from './LegalDocument.jsx';
import LegalControls from './LegalControls.jsx';
import { legalPath } from './consent.js';
import { legalDocuments } from './legal-content.js';
import './legal.css';

const lang = document.documentElement.lang === 'el' ? 'el' : 'en';
const kind = location.pathname.replace(/\/$/, '').endsWith('/terms') ? 'terms' : 'privacy';
const base = import.meta.env.BASE_URL;
const home = `${base}${lang === 'el' ? 'gr' : 'en'}/`;
document.title = `${legalDocuments[lang][kind].title} — Elias Kalyvas`;
createRoot(document.getElementById('root')).render(<div className="legal-page">
  <header><a href={home}>ELIAS KALYVAS</a><nav aria-label={lang === 'el' ? 'Γλώσσα' : 'Language'}><a href={legalPath(base, 'en', kind)} lang="en">EN</a><a href={legalPath(base, 'el', kind)} lang="el">GR</a></nav></header>
  <main><LegalDocument lang={lang} kind={kind} /></main>
  <footer><a href={home}>{lang === 'el' ? 'Επιστροφή στο website' : 'Back to website'} ⟶</a><LegalControls lang={lang} base={base} /></footer>
</div>);

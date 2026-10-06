import { legalDocuments } from './legal-content.js';
import { legalPath } from './consent.js';
const escape = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
// Build-time public text for crawlers and visitors without JS; content is never duplicated by hand.
export function legalStaticMarkup(lang, kind, base) {
  const doc = legalDocuments[lang][kind];
  const gr = lang === 'el';
  const home = `${base}${gr ? 'gr' : 'en'}/`;
  return `<div class="legal-page"><header><a href="${escape(home)}">ELIAS KALYVAS</a></header><main><article class="legal-document"><h1>${escape(doc.title)}</h1><p class="legal-meta">${gr ? 'Ισχύει από' : 'Effective'}: ${doc.effectiveDate} · ${gr ? 'Τελευταία ενημέρωση' : 'Last updated'}: ${doc.updatedDate} · ${gr ? 'Έκδοση' : 'Version'} ${doc.version}</p>${doc.sections.map((s, i) => `<section><h2>${i + 1}. ${escape(s.heading)}</h2>${s.paragraphs.map(p => `<p>${escape(p)}</p>`).join('')}</section>`).join('')}</article></main><footer><a href="${escape(home)}">${gr ? 'Επιστροφή στο website' : 'Back to website'}</a><a href="${escape(legalPath(base, lang, kind === 'privacy' ? 'terms' : 'privacy'))}">${escape(legalDocuments[lang][kind === 'privacy' ? 'terms' : 'privacy'].title)}</a></footer></div>`;
}

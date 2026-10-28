import {demoArticles} from './data.mjs';
export const signalsEntryPaths=['gr/signals/index.html','en/signals/index.html',...demoArticles.map(a=>`${a.lang==='el'?'gr':'en'}/signals/${a.slug}/index.html`)];

export const signalsPreviewEntryPaths=signalsEntryPaths.map(p=>p.replace('/signals/','/signals-preview/'));

import {demoArticles} from './data.mjs';
export const signalsEntryPaths=['gr/signals/index.html','en/signals/index.html',...demoArticles.map(a=>`${a.lang==='el'?'gr':'en'}/signals/${a.slug}/index.html`)];

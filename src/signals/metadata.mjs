// Build-time HTML metadata boundary for a future approved-publication adapter.
const escape=value=>String(value).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const https=value=>{try{return new URL(value).protocol==='https:';}catch{return false;}};
export function signalsMetadata({lang,article=null}){
 const published=article?.status==='published'&&article.publishedAt;
 const title=published?`${article.social.title} — Signals`:'Signals — Elias Kalyvas';
 const description=published?article.social.description:lang==='el'?'Signals: τεχνολογία, αποφάσεις και ανθρώπινες συνέπειες.':'Signals: technology, decisions and human consequences.';
 const tags=[`<title>${escape(title)}</title>`,`<meta name="description" content="${escape(description)}"/>`,`<meta name="robots" content="${published?'index,follow':'noindex,follow'}"/>`];
 if(published&&https(article.social.canonical)){
  tags.push(`<link rel="canonical" href="${escape(article.social.canonical)}"/>`,`<meta property="og:url" content="${escape(article.social.canonical)}"/>`,`<meta property="og:type" content="article"/>`,`<meta property="og:title" content="${escape(article.social.title)}"/>`,`<meta property="og:description" content="${escape(description)}"/>`,`<meta name="twitter:title" content="${escape(article.social.title)}"/>`,`<meta name="twitter:description" content="${escape(description)}"/>`);
  if(https(article.social.image))tags.push(`<meta property="og:image" content="${escape(article.social.image)}"/>`,`<meta name="twitter:image" content="${escape(article.social.image)}"/>`,`<meta name="twitter:card" content="summary_large_image"/>`);
 }
 return tags.join('\n  ');
}

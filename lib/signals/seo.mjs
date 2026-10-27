const esc=v=>String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&apos;');
export const safeJSON=value=>JSON.stringify(value).replaceAll('<','\\u003c').replaceAll('>','\\u003e').replaceAll('&','\\u0026').replaceAll('\u2028','\\u2028').replaceAll('\u2029','\\u2029');
const listingURL=locale=>`https://eliaskalyvas.gr/${locale==='el'?'gr':'en'}/signals/`;
export function counterparts(r,dataset){return r.approved_translation_relations.flatMap(rel=>{const other=dataset.releases.find(x=>x.article_id===rel.article_id&&x.variant_id===rel.variant_id&&x.locale===rel.locale);return other?[other]:[];});}
export function publicationMetadata({locale,release=null,dataset}){
 const active=dataset.releases.some(r=>r.locale===locale),indexable=release||active;
 const title=release?release.presentation.seo_title:active?`Signals — ${locale==='el'?'Ιδέες και τεχνολογία':'Ideas and technology'} — Elias Kalyvas`:'Signals — Elias Kalyvas';
 const description=release?release.presentation.seo_description:locale==='el'?'Signals: τεχνολογία, αποφάσεις και ανθρώπινες συνέπειες.':'Signals: technology, decisions and human consequences.';
 const tags=[`<title>${esc(title)}</title>`,`<meta name="description" content="${esc(description)}"/>`,`<meta name="robots" content="${indexable?'index,follow':'noindex,follow'}"/>`];
 if(!indexable)return tags.join('\n');
 const url=release?.canonical_url||listingURL(locale),og=release?.presentation;
 tags.push(`<link rel="canonical" href="${esc(url)}"/>`,`<meta property="og:url" content="${esc(url)}"/>`,`<meta property="og:type" content="${release?'article':'website'}"/>`,`<meta property="og:locale" content="${locale==='el'?'el_GR':'en_US'}"/>`,`<meta property="og:title" content="${esc(og?.social_title||title)}"/>`,`<meta property="og:description" content="${esc(og?.social_description||description)}"/>`,`<meta name="twitter:title" content="${esc(og?.social_title||title)}"/>`,`<meta name="twitter:description" content="${esc(og?.social_description||description)}"/>`);
 const alternatives=release?[release,...counterparts(release,dataset)]:['el','en'].filter(l=>dataset.releases.some(r=>r.locale===l)).map(locale=>({locale,canonical_url:listingURL(locale)}));
 for(const other of alternatives)tags.push(`<link rel="alternate" hreflang="${other.locale}" href="${esc(other.canonical_url)}"/>`);
 if(release){
  const c=og.cover;
  tags.push(`<meta property="og:image" content="${esc(c.url)}"/>`,`<meta property="og:image:alt" content="${esc(c.alt)}"/>`,`<meta property="og:image:width" content="${c.width}"/>`,`<meta property="og:image:height" content="${c.height}"/>`,`<meta name="twitter:card" content="summary_large_image"/>`,`<meta name="twitter:image" content="${esc(c.url)}"/>`,`<meta name="twitter:image:alt" content="${esc(c.alt)}"/>`,`<meta property="article:published_time" content="${release.release.first_published_at}"/>`,`<meta property="article:modified_time" content="${release.release.modified_at}"/>`);
  // No author Person for an AI voice; editor and publisher identify the human accurately.
  const person={'@type':'Person','@id':release.identity.human_editor_id,name:'Elias Kalyvas'};
  const schema={'@context':'https://schema.org','@type':'BlogPosting','@id':url+'#article',url,mainEntityOfPage:url,headline:release.content.title,description:release.content.summary,inLanguage:locale,datePublished:release.release.first_published_at,dateModified:release.release.modified_at,editor:person,publisher:{...person,'@id':release.identity.publisher_id},creditText:release.identity.disclosure,about:{'@type':'Thing',name:'Nyra',description:'AI editorial voice of Signals'},image:{'@type':'ImageObject',url:c.url,width:c.width,height:c.height,caption:c.caption,creditText:c.attribution.creator,...(c.attribution.license_url?{license:c.attribution.license_url}:{})},citation:release.content.sources.map(s=>({'@type':'CreativeWork',name:s.title,url:s.url}))};
  tags.push(`<script type="application/ld+json">${safeJSON(schema)}</script>`);
 }
 return tags.join('\n');
}
export function publicationSitemap(baseXML,dataset){
 if(!dataset.releases.length)return baseXML;
 // Existing site entries remain byte-equivalent; append only approved active routes.
 if(!baseXML.includes('</urlset>')||baseXML.includes('/signals/'))throw Error('INVALID_BASE_SITEMAP');
 const urls=[];
 for(const locale of ['el','en'])if(dataset.releases.some(r=>r.locale===locale))urls.push(`<url><loc>${esc(listingURL(locale))}</loc></url>`);
 for(const r of dataset.releases){
  const alternatives=[r,...counterparts(r,dataset)];
  urls.push(`<url><loc>${esc(r.canonical_url)}</loc><lastmod>${r.release.modified_at}</lastmod>${alternatives.map(o=>`<xhtml:link rel="alternate" hreflang="${o.locale}" href="${esc(o.canonical_url)}"/>`).join('')}</url>`);
 }
 return baseXML.replace('<urlset ', '<urlset xmlns:xhtml="http://www.w3.org/1999/xhtml" ').replace('</urlset>',urls.join('\n')+'\n</urlset>');
}

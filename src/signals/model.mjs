// Public presentation contract only. Never import Nyra Lab state or research packs.
export const topics = {
 ai:{el:'Τεχνητή νοημοσύνη',en:'Artificial intelligence'},
 investment:{el:'Επενδύσεις',en:'Investment'},work:{el:'Εργασία',en:'Work'},
 economy:{el:'Οικονομία & επενδύσεις',en:'Economy & investment'},
 society:{el:'Κοινωνία & εργασία',en:'Society & work'},
 technology:{el:'Τεχνολογία',en:'Technology'},startups:{el:'Startups',en:'Startups'},
 politics:{el:'Πολιτική',en:'Politics'},innovation:{el:'Καινοτομία',en:'Innovation'},business:{el:'Επιχειρηματικότητα',en:'Entrepreneurship'},
};
export const signalPath=(base,lang,slug='',preview=false)=>`${base}${lang==='el'?'gr':'en'}/signals/${slug?slug+'/':''}${preview?'?preview=1':''}`;
export function filterArticles(articles,topic='all'){return articles.filter(a=>topic==='all'||a.topics.includes(topic)).sort((a,b)=>(b.publishedAt||'').localeCompare(a.publishedAt||''));}
export function selectStories(articles,topic='all'){
 const list=filterArticles(articles,topic);const featured=list.find(a=>a.featured)||list[0]||null;
 return {featured,more:list.filter(a=>a.slug!==featured?.slug)};
}
export function navigationTopics(articles){return [...new Set(['ai','economy','society',...articles.flatMap(a=>a.topics)])].filter(id=>topics[id]);}
export function publicShareUrl(article){
 if(article?.status!=='published'||!article.publishedAt)return null;
 try{const u=new URL(article.social.canonical);return u.protocol==='https:'?u.href:null;}catch{return null;}
}
export function routeFromPath(pathname,base){
 const path=pathname.startsWith(base)?pathname.slice(base.length):'';
 const match=path.match(/^(gr|en)\/signals\/(?:([a-z0-9-]+)\/)?$/);
 return match?{lang:match[1]==='gr'?'el':'en',slug:match[2]||''}:null;
}

import React,{useState} from 'react';
import LegalControls from '../legal/LegalControls.jsx';
import {getPublicArticles} from './adapter.mjs';
import {topics,signalPath,selectStories,navigationTopics,publicShareUrl} from './model.mjs';
import './signals.css';

const copy={
 el:{home:'Αρχική',back:'← Όλα τα Signals',intro:<>Η τεχνολογία αλλάζει τις αποφάσεις μας.<br/>Εξετάζουμε τι σημαίνει αυτό για τους ανθρώπους.</>,all:'Όλα',featured:'Κεντρική ιστορία',read:'Διάβασε το άρθρο',more:'Περισσότερα Signals',voice:'Η φωνή πίσω από τα Signals',nyra:'Η Nyra είναι η AI συντακτική φωνή του Signals. Ερευνά και αναπτύσσει μια τεκμηριωμένη οπτική, με συντακτική επιμέλεια και τελική έγκριση του Elias Kalyvas.',byline:'NYRA · ΕΠΙΜΕΛΕΙΑ ELIAS KALYVAS',sample:'Σχεδιαστικό preview · Ενδεικτικό περιεχόμενο, όχι εγκεκριμένες δημοσιεύσεις.',empty:'Δεν υπάρχουν Signals σε αυτή τη θεματική ακόμη.',waiting:'Οι πρώτες ιστορίες ετοιμάζονται.',waitingText:'Το Signals θα φιλοξενεί αναλύσεις και ιδέες για την τεχνολογία και τις ανθρώπινες συνέπειές της.',unpublished:'Αυτό το άρθρο δεν έχει δημοσιευτεί.',share:'Κοινοποίηση',copy:'Αντιγραφή συνδέσμου',native:'Κοινοποίηση από τη συσκευή',shareNote:'Η κοινοποίηση θα ενεργοποιηθεί με τη δημόσια δημοσίευση του άρθρου.',copied:'Ο σύνδεσμος αντιγράφηκε.',shareError:'Η κοινοποίηση δεν ολοκληρώθηκε. Μπορείς να δοκιμάσεις ξανά.',sources:'Πηγές & τεκμηρίωση',discussion:'Η συζήτηση συνεχίζεται.',discussionText:'Ποια απόφαση θα ήθελες να μπορείς να αμφισβητήσεις ξανά;',later:'Συζήτηση με τη Nyra · συμμετοχή με επαληθευμένο λογαριασμό. Η λειτουργία θα ενεργοποιηθεί αργότερα.',related:'Σχετικά Signals',placeholder:'Ενδεικτική εικόνα',credit:'Δημιουργός',original:'Πρωτότυπο γεωμετρικό placeholder του Signals. Δεν είναι τελική φωτογραφία.',lang:'Γλώσσα',filters:'Θεματικές Signals'},
 en:{home:'Home',back:'← All Signals',intro:<>Technology is changing our decisions.<br/>We examine what that means for people.</>,all:'All',featured:'Featured story',read:'Read the article',more:'More Signals',voice:'The voice behind Signals',nyra:'Nyra is the AI editorial voice of Signals. She researches and develops an evidence-informed perspective, with editorial oversight and final approval by Elias Kalyvas.',byline:'NYRA · EDITED BY ELIAS KALYVAS',sample:'Design preview · Illustrative content, not approved publications.',empty:'No Signals in this topic yet.',waiting:'The first stories are taking shape.',waitingText:'Signals will explore technology and its human consequences through analysis and ideas.',unpublished:'This article has not been published.',share:'Share',copy:'Copy link',native:'Share from your device',shareNote:'Sharing will be available when the article is publicly published.',copied:'Link copied.',shareError:'Sharing could not be completed. You can try again.',sources:'Sources & references',discussion:'The conversation continues.',discussionText:'Which decision would you want to be able to question again?',later:'Discussion with Nyra · participation with a verified account. This feature will be available later.',related:'Related Signals',placeholder:'Illustrative image',credit:'Creator',original:'Original geometric placeholder by Signals. Not final photography.',lang:'Language',filters:'Signals topics'},
};
function Media({article,base,t,linked=false,href,hero=false}){
 const figure=<figure className={`signals-media ${hero?'signals-media-hero':''}`}>
  <img src={`${base}${article.image.url}`} alt={article.image.alt} width="1200" height="800" style={{objectPosition:article.image.focus}} loading={hero?'eager':'lazy'} />
  {!hero&&<figcaption>{t.placeholder}</figcaption>}
 </figure>;
 return linked?<a className="signals-image-link" href={href} aria-label={article.title}>{figure}</a>:figure;
}
function StoryCard({article,base,lang,preview,t}){
 const href=signalPath(base,lang,article.slug,preview);
 return <article className="signals-card" data-signal={article.slug}>
  <Media article={article} base={base} t={t} linked href={href}/>
  <p className="signals-kicker">{article.labels}</p>
  <h3><a href={href}>{article.title}</a></h3><p className="signals-card-intro">{article.intro}</p>
  <p className="signals-small">NYRA · {article.format.toUpperCase()}</p>
 </article>;
}
function Listing({articles,lang,base,preview,t}){
 const [topic,setTopic]=useState('all');const {featured,more}=selectStories(articles,topic);
 return <>
  <section className="signals-editorial" aria-labelledby="signals-title"><p className="signals-kicker">AI · TECHNOLOGY · HUMAN CONSEQUENCES</p><h1 id="signals-title">Signals.</h1><p className="signals-introduction">{t.intro}</p></section>
  <nav className="signals-topics" aria-label={t.filters}>{['all',...navigationTopics(articles)].map(id=><button key={id} type="button" aria-pressed={topic===id} onClick={()=>setTopic(id)}>{id==='all'?t.all:topics[id][lang]}</button>)}</nav>
  <div aria-live="polite" className="signals-filter-status">{!featured&&(articles.length?t.empty:t.waiting)}</div>
  {!articles.length?<section className="signals-waiting"><h2>{t.waiting}</h2><p>{t.waitingText}</p></section>:!featured?<p className="signals-empty">{t.empty}</p>:<>
   <article className="signals-featured" data-signal={featured.slug}>
    <Media article={featured} base={base} t={t} linked href={signalPath(base,lang,featured.slug,preview)}/>
    <div className="signals-featured-copy"><p className="signals-kicker">{t.featured} · {featured.format}</p><h2><a href={signalPath(base,lang,featured.slug,preview)}>{featured.title}</a></h2><p className="signals-deck">{featured.intro}</p><p className="signals-byline">{t.byline}</p><a className="signals-read" href={signalPath(base,lang,featured.slug,preview)}>{t.read} ↗</a></div>
   </article>
   {more.length>0&&<section className="signals-more" aria-labelledby="signals-more-title"><h2 className="signals-section-label" id="signals-more-title">{t.more}</h2><div className="signals-grid">{more.map(a=><StoryCard key={a.slug} article={a} {...{base,lang,preview,t}}/>)}</div></section>}
  </>}
  <section className="signals-voice"><h2>{t.voice}</h2><p>{t.nyra}</p></section>
 </>;
}
function Share({article,t}){
 const url=publicShareUrl(article),[status,setStatus]=useState('');
 async function copyLink(){try{await navigator.clipboard.writeText(url);setStatus(t.copied);}catch{setStatus(t.shareError);}}
 async function nativeShare(){try{await navigator.share({title:article.social.title,url});}catch(e){if(e.name!=='AbortError')setStatus(t.shareError);}}
 return <section className="signals-sharing" aria-label={t.share}><div className="signals-share-actions"><span>{t.share} ·</span>{url?<a href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`} target="_blank" rel="noopener noreferrer">LinkedIn ↗</a>:<button disabled>LinkedIn ↗</button>}<button disabled={!url} onClick={copyLink}>{t.copy}</button>{typeof navigator!=='undefined'&&navigator.share&&<button disabled={!url} onClick={nativeShare}>{t.native}</button>}</div>{!url&&<p className="signals-sharing-note">{t.shareNote}</p>}<p className="signals-feedback" role="status">{status}</p><ul className="signals-hashtags" aria-label="Hashtags">{article.hashtags.map(tag=><li key={tag}>#{tag}</li>)}</ul></section>;
}
function Article({article,articles,lang,base,preview,t}){
 if(!article)return <section className="signals-waiting"><a className="signals-back" href={signalPath(base,lang,'',preview)}>{t.back}</a><h1>{t.unpublished}</h1></section>;
 const related=articles.filter(a=>a.slug!==article.slug&&a.topics.some(id=>article.topics.includes(id))).slice(0,2);
 return <article className="signals-article">
  <a className="signals-back" href={signalPath(base,lang,'',preview)}>{t.back}</a>
  <header className="signals-article-heading"><p className="signals-kicker">{article.format} · {article.labels}</p><h1>{article.title}</h1><p className="signals-deck">{article.intro}</p><p className="signals-byline">{t.byline}</p>{article.publishedAt&&<p className="signals-date"><time dateTime={article.publishedAt}>{new Intl.DateTimeFormat(lang,{dateStyle:'long',timeZone:'Europe/Athens'}).format(new Date(article.publishedAt))}</time>{article.readingMinutes?` · ${article.readingMinutes} ${lang==='el'?'λεπτά ανάγνωσης':'min read'}`:''}</p>}</header>
  <Media article={article} base={base} t={t} hero/>
  <div className="signals-image-credit"><p>{article.image.caption}</p><p>{article.image.sourceUrl?<a href={article.image.sourceUrl} target="_blank" rel="noopener noreferrer">{t.credit}: {article.image.creator} ↗</a>:t.original}</p></div>
  <div className="signals-prose">{article.body.map((block,i)=>block.type==='heading'?<h2 key={i}>{block.text}</h2>:block.type==='quote'?<blockquote key={i}>{block.text}</blockquote>:block.type==='list'?<ul key={i}>{block.items.map(item=><li key={item}>{item}</li>)}</ul>:<p key={i}>{block.text}{block.sourceId&&<a className="signals-citation" href={`#source-${block.sourceId}`} aria-label={lang==='el'?'Δες την πηγή':'See source'}> [1]</a>}</p>)}</div>
  <div className="signals-article-bottom"><Share article={article} t={t}/>
   {!!article.sources.length&&<details className="signals-sources"><summary>{t.sources}</summary><ol>{article.sources.map(source=><li key={source.id} id={`source-${source.id}`}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.title} ↗</a></li>)}</ol></details>}
   <section className="signals-discussion"><h2>{t.discussion}</h2><p>{t.discussionText}</p><p>{t.later}</p></section>
  </div>
  {!!related.length&&<section className="signals-related"><h2 className="signals-section-label">{t.related}</h2><div className="signals-grid">{related.map(a=><StoryCard key={a.slug} article={a} {...{base,lang,preview,t}}/>)}</div></section>}
 </article>;
}
export default function SignalsApp({lang='el',slug='',preview=false,base='/'}){
 const t=copy[lang],articles=getPublicArticles({lang,preview}),article=articles.find(a=>a.slug===slug);
 return <div className="signals-page"><a className="signals-skip" href="#signals-main">{lang==='el'?'Μετάβαση στο περιεχόμενο':'Skip to content'}</a>
  <header className="signals-header signals-container"><a className="signals-brand" href={`${base}${lang==='el'?'gr':'en'}/`} aria-label={`Elias Kalyvas — ${t.home}`}>ELIAS KALYVAS</a><nav aria-label={lang==='el'?'Πλοήγηση Signals':'Signals navigation'}><a href={signalPath(base,lang,'',preview)}>Signals</a><span className="signals-languages" aria-label={t.lang}>{['en','el'].map((l,i)=><React.Fragment key={l}>{i>0&&<span aria-hidden="true">/</span>}{(!slug||!article||article?.translations[l])?<a href={signalPath(base,l,slug?article?.translations[l]||'':'',preview)} lang={l} aria-current={l===lang?'page':undefined}>{l==='el'?'GR':'EN'}</a>:<span aria-disabled="true">{l==='el'?'GR':'EN'}</span>}</React.Fragment>)}</span></nav></header>
  <main id="signals-main" className="signals-container">{preview&&<p className="signals-preview-note">{t.sample}</p>}{slug?<Article {...{article,articles,lang,base,preview,t}}/>:<Listing {...{articles,lang,base,preview,t}}/>}</main>
  <footer className="signals-footer signals-container"><a href={`${base}${lang==='el'?'gr':'en'}/`}>SIGNALS / ELIAS KALYVAS</a><LegalControls {...{lang,base}}/></footer>
 </div>;
}

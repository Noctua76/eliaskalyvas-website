import React, { useLayoutEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import { brainFragments, transitionFragments } from './brainGeometry';
import { runHeroMotion } from './heroMotion';

const el = document.documentElement.lang === 'el';
const base = import.meta.env.BASE_URL;
const copy = el ? {
  home: 'Αρχική', work: 'Έργα', services: 'Τομείς', thinking: 'Σκέψη', about: 'Σχετικά', contact: 'Επικοινωνία', build: 'Ας δημιουργήσουμε',
  eyebrow: 'ΙΔΕΕΣ   /   ΑΝΘΡΩΠΟΙ   /   ΕΠΙΧΕΙΡΗΣΕΙΣ   /   ΤΕΧΝΟΛΟΓΙΑ',
  motto: ['ΣΚΕΦΤΟΜΑΙ.', 'ΣΧΕΔΙΑΖΩ.', 'ΔΗΜΙΟΥΡΓΩ.'],
  sub: 'Για ανθρώπους. Για επιχειρήσεις. Για ιδέες που αξίζει να γίνουν πραγματικότητα.',
  story: 'ΔΕΣ ΤΗ ΔΙΑΔΡΟΜΗ', scroll: 'ΚΥΛΙΣΕ', areas: [
    { title: 'ΑΝΘΡΩΠΟΙ', lines: ['Ηγεσία. Μάθηση.', 'Ανάπτυξη.'], detail: 'Αναπτύσσω τους ανθρώπους που κινούν την επιχείρηση.' },
    { title: 'ΕΠΙΧΕΙΡΗΣΕΙΣ', lines: ['Στρατηγική. Ανάπτυξη.', 'Επιχειρησιακή σαφήνεια.'], detail: 'Μετατρέπω την πολυπλοκότητα σε σαφή κατεύθυνση.' },
    { title: 'AI & ΣΥΣΤΗΜΑΤΑ', lines: ['Αυτοματισμοί. AI assistants.', 'Εξατομικευμένες πλατφόρμες.'], detail: 'Σχεδιάζω αυτό που πραγματικά χρειάζεται η επιχείρηση.' },
    { title: 'MY MENTOR', lines: ['AI mentoring.', 'Προσωπική ανάπτυξη.'], detail: 'Εξατομικευμένη καθοδήγηση για την επόμενη επαγγελματική κίνηση.' },
    { title: 'ΣΚΕΨΗ & ΣΑΦΗΝΕΙΑ', lines: ['Νοημοσύνη. Σύνθεση.', 'Καθαρή κατεύθυνση.'], detail: 'Μετατρέπω την πληροφορία σε καλύτερη σκέψη και αποφάσεις.' },
    { title: 'ΠΛΑΤΦΟΡΜΕΣ', lines: ['Αρχιτεκτονική συστημάτων.', 'Λύσεις με σκοπό.'], detail: 'Σχεδιάζω πλατφόρμες γύρω από πραγματικές επιχειρησιακές ανάγκες.' },
  ],
  storyText: 'Η εμπειρία με ανθρώπους, επιχειρήσεις και λειτουργίες γίνεται η βάση για όσα σχεδιάζω και δημιουργώ σήμερα.',
  close: 'Κλείσιμο',
} : {
  home: 'Home', work: 'Work', services: 'Services', thinking: 'Thinking', about: 'About', contact: 'Contact', build: "Let’s Build",
  eyebrow: 'IDEAS   /   PEOPLE   /   BUSINESS   /   TECHNOLOGY',
  motto: ['I THINK.', 'I DESIGN.', 'I BUILD.'],
  sub: 'For people. For businesses. For ideas worth making real.',
  story: 'WATCH THE STORY', scroll: 'SCROLL', areas: [
    { title: 'PEOPLE', lines: ['Leadership. Learning.', 'Development.'], detail: 'Develop the people who move the business.' },
    { title: 'BUSINESS', lines: ['Strategy. Growth.', 'Operational Clarity.'], detail: 'Turn complexity into clarity.' },
    { title: 'AI & SYSTEMS', lines: ['Automation. AI Assistants.', 'Custom Platforms.'], detail: 'Build what the business actually needs.' },
    { title: 'MY MENTOR', lines: ['AI mentoring.', 'Personalized Development.'], detail: 'Personalized guidance for the next step in your development.' },
    { title: 'THINKING & CLARITY', lines: ['Intelligence. Perspective.', 'Clearer decisions.'], detail: 'Turn information into clearer thinking and stronger decisions.' },
    { title: 'PLATFORMS', lines: ['Architecture. Systems.', 'Designed for real needs.'], detail: 'Design platforms around real operational needs.' },
  ],
  storyText: 'Experience with people, businesses and operations shapes the systems I design and build today.',
  close: 'Close',
};

const networkNodes = [
  [-80,39],[-69,64],[-58,24],[-52,92],[-42,52],[-36,15],[-31,78],[-25,109],[-20,37],[-13,64],
  [-10,12],[-4,96],[2,48],[9,21],[13,78],[21,5],[25,104],[34,52],[45,24],[49,88],
];
const networkLinks = [[0,1],[0,2],[1,3],[1,4],[2,5],[2,4],[3,6],[4,6],[4,8],[5,10],[6,7],
  [6,9],[7,11],[8,9],[8,10],[9,12],[9,14],[10,13],[11,14],[12,13],[12,17],[13,15],[14,16],
  [14,17],[15,18],[16,19],[17,18],[17,19]];
const fieldFacets = [
  '-78,77 -65,72 -59,82 -70,91', '-63,3 -50,8 -53,20 -65,16', '-44,103 -31,96 -23,104 -37,113',
  '-38,31 -26,26 -19,38 -33,45', '-16,73 -5,69 4,78 -4,87', '0,8 12,5 20,17 5,21',
  '12,43 25,38 34,49 24,59 15,55', '34,82 47,74 56,81 51,93 39,96',
];
const cardImages = ['card-01-people-growth.png', 'card-02-business-growth.png', 'card-03-ai-systems.png',
  'card-04-my-mentor.png', 'card-05-thinking-intelligence.png', 'card-06-platform-architecture.png'];

function GeometricWord() {
  const svgRef = useRef(null);
  useLayoutEffect(() => runHeroMotion(svgRef.current), []);
  return <svg ref={svgRef} className="geometric-word" viewBox="-85 0 935 125" aria-hidden="true" preserveAspectRatio="xMinYMid meet">
    <defs>
      <clipPath id="brain-letter-shapes"><text x="0" y="106" className="word-glyph">BRAIN</text></clipPath>
      <clipPath id="transition-letter-shapes"><text x="381" y="106" className="word-glyph">ST</text></clipPath>
    </defs>
    <g className="word-network">
      {networkLinks.map(([a,b],i) => <line className={i % 3 === 0 ? 'minor-network' : ''} key={i}
        x1={networkNodes[a][0]} y1={networkNodes[a][1]} x2={networkNodes[b][0]} y2={networkNodes[b][1]} />)}
      {networkNodes.map(([x,y],i) => <circle className={i % 3 === 0 ? 'minor-network' : ''} key={i} cx={x} cy={y} r={i % 5 === 0 ? 1.55 : .85} />)}
    </g>
    <g className="field-facets">{fieldFacets.map((points,i) => <polygon key={i} points={points} />)}</g>
    <g className="brain-polygons">
      {brainFragments.map((points,i) => <g key={i} className="geometry-piece"><polygon points={points} clipPath="url(#brain-letter-shapes)" className={`facet facet-${i % 7}`} /></g>)}
    </g>
    <g className="word-solid">
      <text x="381" y="106" className="word-glyph word-transition">ST</text>
      <text x="536" y="106" className="word-glyph word-orm">ORM</text>
    </g>
    <g className="transition-polygons">
      {transitionFragments.map((points,i) => <g key={i} className="transition-piece"><polygon points={points} clipPath="url(#transition-letter-shapes)" className={i % 3 === 0 ? 'transition-faint' : ''} /></g>)}
    </g>
    <path className="transition-wire" d="M373 23 399 45 388 82 418 105M406 13 445 35 427 70 459 102M465 20 486 53 477 95 520 108M520 17 499 47 535 70" />
    <g className="transition-nodes"><circle cx="399" cy="45" r="1.3"/><circle cx="427" cy="70" r="1.1"/><circle cx="486" cy="53" r="1.5"/><circle cx="520" cy="108" r="1.1"/></g>
  </svg>;
}

function App() {
  const [selected, setSelected] = useState(null);
  const [story, setStory] = useState(false);
  const [menu, setMenu] = useState(false);
  const areasRef = useRef(null);
  const select = i => {
    setSelected(selected === i ? null : i);
    window.setTimeout(() => areasRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 50);
  };
  return <main id="top">
    <div className="ambient ambient-one" aria-hidden="true"/><div className="ambient ambient-two" aria-hidden="true"/>
    <header className="site-header shell">
      <a className="brand" href="#top" aria-label={el ? 'Ηλίας Καλύβας — Αρχική' : 'Elias Kalyvas — Home'}>
        <img className="brand-mark" src={`${base}assets/brand/ek-mark.png`} alt="" /><span className="brand-name">ELIAS KALYVAS<small>IDEAS INTO REALITY</small></span>
      </a>
      <nav className={menu ? 'main-nav open' : 'main-nav'} aria-label={el ? 'Κύρια πλοήγηση' : 'Main navigation'}>
        <a className="active" href="#top" onClick={() => setMenu(false)}>{copy.home}</a>
        <a href="#areas" onClick={() => setMenu(false)}>{copy.services}</a>
        <span>{copy.work}</span><span>{copy.thinking}</span><span>{copy.about}</span><span>{copy.contact}</span>
      </nav>
      <div className="header-actions"><div className="languages" aria-label="Language"><a className={!el ? 'current' : ''} href={`${base}en/`} lang="en">EN</a><span>|</span><a className={el ? 'current' : ''} href={`${base}gr/`} lang="el">GR</a></div>
        <a className="build-button" href="#areas">{copy.build}<span aria-hidden="true">⟶</span></a></div>
      <button className="menu-button" type="button" onClick={() => setMenu(!menu)} aria-label={menu ? copy.close : 'Menu'} aria-expanded={menu}><span/><span/></button>
    </header>

    <section className="hero shell" aria-labelledby="hero-title">
      <div className="hero-grid" aria-hidden="true" />
      <div className="portrait-halo" aria-hidden="true"/>
      <img className="portrait" src={`${base}portrait.png`} alt="" fetchPriority="high" />
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 id="hero-title" className="hero-title"><span className="visually-hidden">BRAINSTORM</span><GeometricWord /></h1>
      <div className="hero-statement"><p className="motto">{copy.motto.map((part, i) => <span className={i === 2 ? 'emphasis' : ''} key={part}>{part}</span>)}</p><p className="subline">{copy.sub}</p></div>
      <button className="story-button" type="button" onClick={() => setStory(true)}><span className="play-icon" aria-hidden="true">▸</span><span>{copy.story}</span><i/></button>
      <aside className="hero-aside" aria-hidden="true"><span>STRATEGY</span><span>LEADERSHIP</span><span>AI SYSTEMS</span><span>DIGITAL PRODUCTS</span><span>REAL IMPACT</span></aside>
      <span className="scroll-cue" aria-hidden="true">{copy.scroll}<i/></span>
    </section>

    <section className="areas shell" id="areas" ref={areasRef} aria-label={el ? 'Τομείς' : 'Areas of work'}>
      <div className="area-list">{copy.areas.map((area, i) => <button className={`area-card area-${i} ${selected === i ? 'selected' : ''}`} type="button" onClick={() => select(i)} aria-expanded={selected === i} key={i}>
        <img className="area-image" src={`${base}assets/cards/${cardImages[i]}`} alt="" loading="lazy" />
        <span className="area-number">0{i+1}</span><span className="area-title">{area.title}</span><span className="area-arrow" aria-hidden="true">⟶</span><span className="area-lines">{area.lines.map(line => <span key={line}>{line}</span>)}</span>
      </button>)}</div>
      {selected !== null && <div className="area-detail" role="status"><span>0{selected+1} / {copy.areas[selected].title}</span><p>{copy.areas[selected].detail}</p><button onClick={() => setSelected(null)} aria-label={copy.close}>×</button></div>}
    </section>
    <p className="preview-footnote shell">ELIAS KALYVAS <span>—</span> IDEAS INTO REALITY</p>
    {story && <div className="story-backdrop" onClick={() => setStory(false)}><div className="story-dialog" role="dialog" aria-modal="true" aria-label={copy.story} onClick={e => e.stopPropagation()}><button className="dialog-close" onClick={() => setStory(false)} aria-label={copy.close}>×</button><span>ELIAS KALYVAS / THINKING</span><h2>{el ? 'Μετατρέπω την εμπειρία σε συστήματα.' : 'I turn experience into systems.'}</h2><p>{copy.storyText}</p></div></div>}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);

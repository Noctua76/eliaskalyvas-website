import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';

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

const cardImages = ['card-01-people-growth.png', 'card-02-business-growth.png', 'card-03-ai-systems.png',
  'card-04-my-mentor.png', 'card-05-thinking-intelligence.png', 'card-06-platform-architecture.png'];

function CinematicScene() {
  const [motion, setMotion] = useState(() => window.matchMedia('(min-width: 901px) and (prefers-reduced-motion: no-preference)').matches);
  const [phase, setPhase] = useState('intro');
  const introRef = useRef(null);
  const ambientRef = useRef(null);
  useEffect(() => {
    const query = window.matchMedia('(min-width: 901px) and (prefers-reduced-motion: no-preference)');
    const update = () => setMotion(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  useEffect(() => {
    if (motion) introRef.current?.play().catch(() => setMotion(false));
  }, [motion]);
  const finishIntro = () => {
    const ambient = ambientRef.current;
    if (!ambient) return;
    ambient.play().then(() => setPhase('ambient')).catch(() => setMotion(false));
  };
  return <div className="hero-scene" aria-hidden="true">
    <img className="hero-rest-frame" src={`${base}assets/hero/hero-rest.jpg?v=3`} alt="" fetchPriority="high" />
    {motion && <>
      <video ref={introRef} className={`hero-film hero-film-intro ${phase === 'ambient' ? 'finished' : ''}`} src={`${base}assets/hero/hero-intro.mp4?v=3`}
        poster={`${base}assets/hero/hero-first.jpg?v=3`} autoPlay muted playsInline preload="auto" onEnded={finishIntro} onError={() => setMotion(false)} />
      <video ref={ambientRef} className={`hero-film hero-film-ambient ${phase === 'ambient' ? 'playing' : ''}`}
        src={`${base}assets/hero/hero-ambient.mp4?v=3`} muted playsInline loop preload="auto" onError={() => setMotion(false)} />
    </>}
  </div>;
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
      <CinematicScene />
      <div className="portrait-halo" aria-hidden="true"/>
      <img className="portrait" src={`${base}portrait.png`} alt="" fetchPriority="high" />
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 id="hero-title" className="visually-hidden">BRAINSTORM</h1>
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

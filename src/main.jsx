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
  ],
  storyText: 'Experience with people, businesses and operations shapes the systems I design and build today.',
  close: 'Close',
};

function ParticleWord() {
  const boxRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const box = boxRef.current;
    const canvas = canvasRef.current;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reduced.matches) return;
    let frame = 0, visible = true, points = [], start = performance.now();
    const observer = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; }, { threshold: .05 });
    observer.observe(box);

    function resize() {
      const rect = box.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const off = document.createElement('canvas');
      off.width = Math.ceil(rect.width);
      off.height = Math.ceil(rect.height);
      const ctx = off.getContext('2d', { willReadFrequently: true });
      const word = box.querySelector('span');
      const style = getComputedStyle(word);
      ctx.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillStyle = '#fff';
      ctx.fillText('BRAIN', 0, rect.height * .82);
      const pixels = ctx.getImageData(0, 0, off.width, off.height).data;
      const step = rect.width < 450 ? 4 : 5;
      points = [];
      for (let y = 0; y < off.height; y += step) for (let x = 0; x < off.width; x += step) {
        if (pixels[(y * off.width + x) * 4 + 3] > 140) {
          const n = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
          const r = n - Math.floor(n);
          points.push({ x, y, dx: (r - .5) * rect.width * 1.8 - rect.width * .14,
            dy: (Math.sin(n * 5) * .5) * rect.height * 2.3, size: r > .91 ? 1.8 : .85 });
        }
      }
    }
    const ro = new ResizeObserver(resize);
    ro.observe(box);
    resize();

    function render(now) {
      frame = requestAnimationFrame(render);
      if (!visible || !points.length) return;
      const ctx = canvas.getContext('2d');
      const dpr = canvas.width / canvas.clientWidth;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);
      const t = ((now - start) % 10500) / 10500;
      const span = box.querySelector('span');
      if (t < .27 || t > .84) { span.style.opacity = '1'; return; }
      span.style.opacity = '0';
      let progress;
      if (t < .49) progress = (t - .27) / .22;
      else if (t < .59) progress = 1;
      else progress = 1 - (t - .59) / .25;
      progress = Math.max(0, Math.min(1, progress));
      progress = progress * progress * (3 - 2 * progress);
      const width = canvas.clientWidth;
      for (const p of points) {
        const drift = progress * (1 + (1 - p.x / width) * .4);
        const x = p.x + p.dx * drift;
        const y = p.y + p.dy * drift;
        if (x < 0 || x > width || y < 0 || y > canvas.clientHeight) continue;
        ctx.fillStyle = `rgba(218,234,255,${.92 - progress * .3})`;
        ctx.fillRect(x, y, p.size, p.size);
      }
    }
    frame = requestAnimationFrame(render);
    return () => { cancelAnimationFrame(frame); ro.disconnect(); observer.disconnect(); box.querySelector('span').style.opacity = ''; };
  }, []);

  return <span className="brain-word" ref={boxRef}><span>BRAIN</span><canvas aria-hidden="true" ref={canvasRef} /></span>;
}

function AreaArt({ index }) {
  if (index === 0) return <svg className="area-art wave" viewBox="0 0 310 160" aria-hidden="true">
    {Array.from({ length: 19 }, (_, i) => <path key={i} d={`M-20 ${110+i*3} C 65 ${105-i*3}, 78 ${8+i*2}, 150 ${90+i*2} S 238 ${165-i*6}, 330 ${30+i*3}`} />)}
  </svg>;
  if (index === 1) return <svg className="area-art mountain" viewBox="0 0 310 160" aria-hidden="true">
    <defs><linearGradient id="ridge" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#b9d5f3" stopOpacity=".6"/><stop offset="1" stopColor="#16283c" stopOpacity="0"/></linearGradient></defs>
    <path d="M4 153 64 119 109 129 181 28 221 99 264 79 318 152Z" fill="url(#ridge)" opacity=".22" />
    <path d="M4 153 64 119 109 129 181 28 221 99 264 79 318 152M181 28 156 92 198 73 221 99M156 92 109 129M198 73 264 79M64 119 115 153M221 99 195 153" fill="none" stroke="#9eb9d5" strokeOpacity=".5" strokeWidth=".7" />
    {Array.from({ length: 12 }, (_, i) => <path key={i} d={`M${i*29} 154 181 28`} stroke="#8da7c5" strokeOpacity=".08" strokeWidth=".5" />)}
  </svg>;
  return <div className="area-art planet" aria-hidden="true"><span className="planet-globe"/><span className="planet-ring"/></div>;
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
        <span className="brand-mark">EK</span><span className="brand-name">ELIAS KALYVAS<small>IDEAS INTO REALITY</small></span>
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
      <div className="constellation" aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
      <div className="portrait-halo" aria-hidden="true"/>
      <img className="portrait" src={`${base}portrait.png`} alt="" fetchPriority="high" />
      <p className="eyebrow">{copy.eyebrow}</p>
      <h1 id="hero-title" className="hero-title"><ParticleWord/><span>STORM</span></h1>
      <div className="hero-statement"><p className="motto">{copy.motto.map((part, i) => <span className={i === 2 ? 'emphasis' : ''} key={part}>{part}</span>)}</p><p className="subline">{copy.sub}</p></div>
      <button className="story-button" type="button" onClick={() => setStory(true)}><span className="play-icon" aria-hidden="true">▸</span><span>{copy.story}</span><i/></button>
      <aside className="hero-aside" aria-hidden="true"><span>STRATEGY</span><span>LEADERSHIP</span><span>AI SYSTEMS</span><span>DIGITAL PRODUCTS</span><span>REAL IMPACT</span></aside>
      <span className="scroll-cue" aria-hidden="true">{copy.scroll}<i/></span>
    </section>

    <section className="areas shell" id="areas" ref={areasRef} aria-label={el ? 'Τομείς' : 'Areas of work'}>
      <div className="area-list">{copy.areas.map((area, i) => <button className={`area-card area-${i} ${selected === i ? 'selected' : ''}`} type="button" onClick={() => select(i)} aria-expanded={selected === i} key={i}>
        <span className="area-number">0{i+1}</span><span className="area-title">{area.title}</span><span className="area-arrow" aria-hidden="true">⟶</span><span className="area-lines">{area.lines.map(line => <span key={line}>{line}</span>)}</span><AreaArt index={i} />
      </button>)}</div>
      {selected !== null && <div className="area-detail" role="status"><span>0{selected+1} / {copy.areas[selected].title}</span><p>{copy.areas[selected].detail}</p><button onClick={() => setSelected(null)} aria-label={copy.close}>×</button></div>}
    </section>
    <p className="preview-footnote shell">ELIAS KALYVAS <span>—</span> IDEAS INTO REALITY</p>
    {story && <div className="story-backdrop" onClick={() => setStory(false)}><div className="story-dialog" role="dialog" aria-modal="true" aria-label={copy.story} onClick={e => e.stopPropagation()}><button className="dialog-close" onClick={() => setStory(false)} aria-label={copy.close}>×</button><span>ELIAS KALYVAS / THINKING</span><h2>{el ? 'Μετατρέπω την εμπειρία σε συστήματα.' : 'I turn experience into systems.'}</h2><p>{copy.storyText}</p></div></div>}
  </main>;
}

createRoot(document.getElementById('root')).render(<App />);

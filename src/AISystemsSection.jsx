import React, { useEffect, useRef, useState } from 'react';
import SectionSidebar from './SectionSidebar.jsx';
import './ai-systems.css';
import { createPortal } from 'react-dom';
import { bookingPath } from './operations/config.js';

const services = [
  { title: ['Websites &', 'Digital Experiences'], image: 'crystalline-laptop.webp' },
  { title: ['Web Apps &', 'Custom Platforms'], image: 'smartphone-platforms.webp' },
  { title: ['AI Assistants', '& AI Agents'], image: 'ai-globe.webp' },
  { title: ['Business Systems', '& Automation'], image: 'automation-stack.webp' },
];
const translations = {
  en: {
    headline: ['Build what', 'the business', 'actually needs.'],
    paragraph: 'From websites to AI assistants and custom platforms, I design and build intelligent systems that solve real problems and create lasting value.',
    explore: 'EXPLORE AI & SYSTEMS',
    descriptions: ['Distinctive, high-performance websites.', 'Tailored systems for real operational needs.', 'Intelligent tools that work for you.', 'Connect people, data and processes.'],
    metrics: ['Leaders using AI solutions', 'Custom systems delivered', 'Operational value created', 'Many more ideas to build'],
    build: 'Let’s Build Yours',
    outcomes: 'Outcomes',
    enquire: 'Discuss',
  },
  el: {
    headline: ['Δημιουργώ ό,τι', 'η επιχείρηση', 'χρειάζεται', 'πραγματικά.'],
    paragraph: 'Από websites και AI assistants έως εξατομικευμένες πλατφόρμες, σχεδιάζω και δημιουργώ έξυπνα συστήματα που λύνουν πραγματικά προβλήματα και προσφέρουν διαχρονική αξία.',
    explore: 'ΑΝΑΚΑΛΥΨΕ AI & SYSTEMS',
    descriptions: ['Ξεχωριστά websites με υψηλές επιδόσεις.', 'Συστήματα για πραγματικές λειτουργικές ανάγκες.', 'Έξυπνα εργαλεία που δουλεύουν για εσένα.', 'Συνδέω ανθρώπους, δεδομένα και διαδικασίες.'],
    metrics: ['Ηγέτες που αξιοποιούν λύσεις AI', 'Εξατομικευμένα συστήματα', 'Λειτουργική αξία που δημιουργήθηκε', 'Πολλές ακόμη ιδέες για δημιουργία'],
    build: 'Ας δημιουργήσουμε το δικό σου',
    outcomes: 'Αποτελέσματα',
    enquire: 'Συζήτηση για',
  },
};
const clusters = [
  { key: 'ideas', lines: ['IDEAS', 'AUTOMATION', 'EFFICIENCY'] },
  { key: 'integration', lines: ['INTEGRATION', 'SCALABILITY', 'FLEXIBILITY'] },
  { key: 'data', lines: ['DATA', 'INTELLIGENCE', 'BETTER DECISIONS'] },
  { key: 'impact', lines: ['REAL PROBLEMS.', 'REAL SOLUTIONS.', 'REAL IMPACT.'] },
  { key: 'purpose', lines: ['TECHNOLOGY', 'WITH A', 'HUMAN PURPOSE'] },
];

function MainVisual({ base }) {
  return <div className="ai-visual" aria-hidden="true">
    <img className="ai-hub-image" src={`${base}assets/ai-systems/crystalline-hub.webp`} alt="" width="1672" height="941" loading="lazy" decoding="async" />
    <img className="ai-people-cube-repair" src={`${base}assets/ai-systems/people-cube-repair.webp`} alt="" width="1672" height="941" loading="lazy" decoding="async" />
    <svg className="ai-node-glow" viewBox="0 0 1672 941">
      <circle cx="654" cy="307" r="4" />
      <circle cx="796" cy="418" r="4" />
      <circle cx="926" cy="818" r="4" />
    </svg>
    {clusters.map(cluster => <div key={cluster.key} className={`ai-label-cluster ai-label-${cluster.key}`}>
      {cluster.lines.map(line => <span key={line}>{line}</span>)}
      {cluster.key === 'purpose' && <i />}
    </div>)}
    {/* Image coordinates keep each label anchored to its face at every crop/scale. */}
    <svg className="ai-cube-text" viewBox="0 0 1672 941" focusable="false">
      <g className="ai-face ai-face-intelligence" transform="matrix(1 -.22 0 1 908 282)">
        <text className="ai-face-title" y="-18">AI</text>
        <text className="ai-face-caption"><tspan x="0" y="14">IDEAS</tspan><tspan x="0" y="40">TO ACTION</tspan></text>
      </g>
      <g className="ai-face ai-face-automation" transform="matrix(1 .43 .01 1 582 506)">
        <text className="ai-face-title" y="-18">AUTOMATION</text>
        <text className="ai-face-caption"><tspan x="0" y="14">LESS MANUAL.</tspan><tspan x="0" y="40">MORE IMPACT.</tspan></text>
      </g>
      <g className="ai-face ai-face-systems" transform="matrix(1 -.38 -.015 1 1086 522)">
        <text className="ai-face-title" y="-18">SYSTEMS</text>
        <text className="ai-face-caption"><tspan x="0" y="14">BUILT AROUND</tspan><tspan x="0" y="40">YOUR BUSINESS</tspan></text>
      </g>
      <g className="ai-face ai-face-people" transform="matrix(1 -.25 .04 1 863 696)">
        <text className="ai-face-title" y="-18">PEOPLE</text>
        <text className="ai-face-caption"><tspan x="0" y="14">TECHNOLOGY</tspan><tspan x="0" y="40">THAT EMPOWERS</tspan></text>
      </g>
    </svg>
  </div>;
}

function BookingDialog({ base, lang, onClose }) {
  const dialogRef = useRef(null);
  const frameRef = useRef(null);
  const frameKeydown = useRef(null);
  const closeLabel = lang === 'el' ? 'Κλείσιμο' : 'Close';
  const title = lang === 'el' ? 'Κλείσε μια κλήση' : 'Book a call';
  const connectFrame = () => {
    frameKeydown.current?.();
    const frameDocument = frameRef.current?.contentDocument;
    if (!frameDocument) return;
    const escape = event => { if (event.key === 'Escape') { event.preventDefault(); onClose(); } };
    frameDocument.addEventListener('keydown', escape);
    frameKeydown.current = () => frameDocument.removeEventListener('keydown', escape);
  };
  useEffect(() => {
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    const dialog = dialogRef.current;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      frameKeydown.current?.();
      dialog.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  return createPortal(<dialog ref={dialogRef} className="ai-booking-dialog" aria-label={title}
    onCancel={event => { event.preventDefault(); onClose(); }}
    onClick={event => { if (event.target === event.currentTarget) { const rect = event.currentTarget.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) onClose(); } }}>
    <div className="ai-booking-bar"><span>{title}</span><button type="button" autoFocus aria-label={closeLabel} onClick={onClose}>×</button></div>
    <iframe ref={frameRef} src={bookingPath(base, lang)} title={title} onLoad={connectFrame} />
  </dialog>, document.body);
}

export default function AISystemsSection({ lang, base }) {
  const sectionRef = useRef(null);
  const [bookingOpen, setBookingOpen] = useState(false);
  const copy = translations[lang] || translations.en;
  useEffect(() => {
    const section = sectionRef.current;
    // These anchors are created by React after the browser's initial hash lookup.
    if (window.location.hash === '#ai-systems' || window.location.hash === '#ai-services') {
      const target = window.location.hash === '#ai-services' ? section.querySelector('#ai-services') : section;
      target.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
    if (!('IntersectionObserver' in window)) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (!reduced.matches) section.classList.add('is-motion-ready');
    const reveals = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          reveals.unobserve(entry.target);
        }
      });
    }, { threshold: .06 });
    section.querySelectorAll('.ai-reveal').forEach(element => reveals.observe(element));
    const visibility = new IntersectionObserver(([entry]) => {
      section.dataset.inView = String(entry.isIntersecting);
    }, { rootMargin: '80px' });
    visibility.observe(section);
    return () => { reveals.disconnect(); visibility.disconnect(); };
  }, []);

  return <section className="ai-section" id="ai-systems" ref={sectionRef} aria-labelledby="ai-heading" data-in-view="false">
    <SectionSidebar activeIndex={4} />
    <div className="ai-inner">
      <div className="ai-main ai-reveal">
        <div className="ai-content">
          <div className="ai-eyebrow"><span>04</span><i /><span>AI & SYSTEMS</span></div>
          <h2 id="ai-heading">{copy.headline.map((line, index) => <span key={line} className={index >= 2 ? 'ai-headline-accent' : ''}>{line}</span>)}</h2>
          <p className="ai-intro">{copy.paragraph}</p>
          <a href="#ai-services" className="ai-explore"><span className="ai-explore-icon" aria-hidden="true">▸</span><span>{copy.explore}</span><i /></a>
        </div>
        <MainVisual base={base} />
      </div>
      <div className="ai-cards-grid" id="ai-services">
        {services.map((service, index) => <article className="ai-card ai-reveal" key={service.image} style={{ '--reveal-delay': `${index * 55}ms` }}>
          <span className="ai-card-number">0{index + 1}</span>
          <div className="ai-card-visual"><img src={`${base}assets/ai-systems/${service.image}`} alt="" width="1000" height="750" loading="lazy" decoding="async" /></div>
          <div className="ai-card-copy"><h3>{service.title.map(line => <span key={line}>{line}</span>)}</h3><p>{copy.descriptions[index]}</p></div>
          <a className="ai-card-action" href="#contact" aria-label={`${copy.enquire} ${service.title.join(' ')}`}><span aria-hidden="true">→</span></a>
        </article>)}
      </div>
      <div className="ai-bottom ai-reveal">
        <div className="ai-metrics" aria-label={copy.outcomes}>
          {['100+', '25+', '500K+', '∞'].map((value, index) => <div className="ai-metric" key={value}><strong>{value}</strong><p>{copy.metrics[index]}</p></div>)}
        </div>
        <div className="ai-build">
          <a className="ai-build-button" href={bookingPath(base, lang)} aria-haspopup="dialog" onClick={event => { event.preventDefault(); setBookingOpen(true); }}>{copy.build}<span aria-hidden="true">⟶</span></a>
          <span className="ai-build-caption">FROM POSSIBILITY TO PROGRESS</span>
        </div>
      </div>
    </div>
    {bookingOpen && <BookingDialog base={base} lang={lang} onClose={() => setBookingOpen(false)} />}
  </section>;
}

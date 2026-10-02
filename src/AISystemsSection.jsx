import React, { useEffect, useRef } from 'react';
import SectionSidebar from './SectionSidebar.jsx';
import './ai-systems.css';

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
const contactHref = subject => `mailto:info@eliaskalyvas.gr?subject=${encodeURIComponent(subject)}`;

function MainVisual({ base }) {
  return <div className="ai-visual" aria-hidden="true">
    <img className="ai-hub-image" src={`${base}assets/ai-systems/crystalline-hub.webp`} alt="" width="1672" height="941" loading="lazy" decoding="async" />
    <svg className="ai-node-glow" viewBox="0 0 1672 941">
      <circle cx="654" cy="307" r="4" />
      <circle cx="796" cy="418" r="4" />
      <circle cx="926" cy="818" r="4" />
    </svg>
    {clusters.map(cluster => <div key={cluster.key} className={`ai-label-cluster ai-label-${cluster.key}`}>
      {cluster.lines.map(line => <span key={line}>{line}</span>)}
      {cluster.key === 'purpose' && <i />}
    </div>)}
    <div className="ai-face ai-face-intelligence"><strong>AI</strong><span>IDEAS<br />TO ACTION</span></div>
    <div className="ai-face ai-face-automation"><strong>AUTOMATION</strong><span>LESS MANUAL.<br />MORE IMPACT.</span></div>
    <div className="ai-face ai-face-systems"><strong>SYSTEMS</strong><span>BUILT AROUND<br />YOUR BUSINESS</span></div>
    <div className="ai-face ai-face-people"><strong>PEOPLE</strong><span>TECHNOLOGY<br />THAT EMPOWERS</span></div>
  </div>;
}

export default function AISystemsSection({ lang, base }) {
  const sectionRef = useRef(null);
  const copy = translations[lang] || translations.en;
  useEffect(() => {
    const section = sectionRef.current;
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
          <a className="ai-card-action" href={contactHref(`AI & Systems — ${service.title.join(' ')}`)} aria-label={`${copy.enquire} ${service.title.join(' ')}`}><span aria-hidden="true">→</span></a>
        </article>)}
      </div>
      <div className="ai-bottom ai-reveal">
        <div className="ai-metrics" aria-label={copy.outcomes}>
          {['100+', '25+', '500K+', '∞'].map((value, index) => <div className="ai-metric" key={value}><strong>{value}</strong><p>{copy.metrics[index]}</p></div>)}
        </div>
        <div className="ai-build">
          <a className="ai-build-button" href={contactHref('AI & Systems — Let’s Build Yours')}>{copy.build}<span aria-hidden="true">⟶</span></a>
          <span className="ai-build-caption">FROM POSSIBILITY TO PROGRESS</span>
        </div>
      </div>
    </div>
  </section>;
}

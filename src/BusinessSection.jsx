import React, { useEffect, useRef, useState } from 'react';
import './business.css';
import useMobileCards from './useMobileCards.js';
import SectionSidebar from './SectionSidebar.jsx';

const assets = {
  summit: 'summit-route.webp', consulting: 'consulting-compass.webp',
  development: 'development-glass.webp', processes: 'processes-wave.webp', strategy: 'strategy-growth.webp',
};

const translations = {
  en: {
    label: 'BUSINESS', headline: ['Turn', 'complexity'], into: 'into', clarity: 'clarity.',
    paragraph: 'I help businesses define direction, improve operations and create the conditions for sustainable growth.',
    explore: 'EXPLORE BUSINESS SOLUTIONS',
    stages: ['THE RIGHT FOUNDATION', 'CLEAR STRATEGY', 'SCALABLE OPERATIONS', 'SUSTAINABLE GROWTH'],
    anchors: ['STRATEGY', 'PROCESSES', 'GROWTH', 'EFFICIENCY', 'REAL IMPACT'],
    quote: 'Clarity turns challenges into opportunities.', signature: 'BUSINESS WITH PURPOSE',
    close: 'Close', exploreCard: 'Explore',
    cards: [
      { key: 'consulting', title: 'Business Consulting', lines: ['From insight to action.', 'Practical, measurable results.'] },
      { key: 'development', title: 'Business Development', lines: ['New opportunities.', 'Stronger pipeline.', 'Real growth.'] },
      { key: 'processes', title: 'Processes & Systems', lines: ['Simpler. Clearer.', 'More effective.'] },
      { key: 'strategy', title: 'Strategy & Planning', lines: ['A clear path', 'for what’s next.'] },
    ],
    metrics: [
      ['+27%', 'SQLs in 60 days', '(typical result)'],
      ['-18%', 'Sales cycle', '(through clear pipeline stages)'],
      ['100+', 'Leaders supported', 'across industries'],
      ['€500K+', 'Deals supported', '(directly or indirectly)'],
    ],
  },
  el: {
    label: 'ΕΠΙΧΕΙΡΗΣΕΙΣ', headline: ['Μετατρέπω', 'την πολυπλοκότητα'], into: 'σε', clarity: 'σαφήνεια.',
    paragraph: 'Βοηθώ επιχειρήσεις να ορίζουν κατεύθυνση, να βελτιώνουν τη λειτουργία τους και να δημιουργούν τις συνθήκες για βιώσιμη ανάπτυξη.',
    explore: 'ΑΝΑΚΑΛΥΨΕ BUSINESS SOLUTIONS',
    stages: ['ΣΩΣΤΗ ΒΑΣΗ', 'ΚΑΘΑΡΗ ΣΤΡΑΤΗΓΙΚΗ', 'ΚΛΙΜΑΚΩΣΙΜΗ ΛΕΙΤΟΥΡΓΙΑ', 'ΒΙΩΣΙΜΗ ΑΝΑΠΤΥΞΗ'],
    anchors: ['ΣΤΡΑΤΗΓΙΚΗ', 'ΔΙΑΔΙΚΑΣΙΕΣ', 'ΑΝΑΠΤΥΞΗ', 'ΑΠΟΔΟΤΙΚΟΤΗΤΑ', 'ΠΡΑΓΜΑΤΙΚΟΣ ΑΝΤΙΚΤΥΠΟΣ'],
    quote: 'Η σαφήνεια μετατρέπει τις προκλήσεις σε ευκαιρίες.', signature: 'ΕΠΙΧΕΙΡΕΙΝ ΜΕ ΣΚΟΠΟ',
    close: 'Κλείσιμο', exploreCard: 'Εξερεύνηση',
    cards: [
      { key: 'consulting', title: 'Business Consulting', lines: ['Από τη διορατικότητα στην πράξη.', 'Πρακτικά, μετρήσιμα αποτελέσματα.'] },
      { key: 'development', title: 'Business Development', lines: ['Νέες ευκαιρίες.', 'Ισχυρότερο pipeline.', 'Πραγματική ανάπτυξη.'] },
      { key: 'processes', title: 'Processes & Systems', lines: ['Απλούστερα. Καθαρότερα.', 'Πιο αποτελεσματικά.'] },
      { key: 'strategy', title: 'Strategy & Planning', lines: ['Καθαρή πορεία', 'για το επόμενο βήμα.'] },
    ],
    metrics: [
      ['+27%', 'SQLs σε 60 ημέρες', '(τυπικό αποτέλεσμα)'],
      ['-18%', 'Κύκλος πωλήσεων', '(με σαφή στάδια pipeline)'],
      ['100+', 'Ηγέτες που υποστηρίχθηκαν', 'σε διαφορετικούς κλάδους'],
      ['€500K+', 'Συμφωνίες που υποστηρίχθηκαν', '(άμεσα ή έμμεσα)'],
    ],
  },
};

// Native image coordinates: the SVG and photograph share an aspect ratio.
const summitRoute = 'M 585 776 C 644 762 685 745 708 708 C 716 694 717 682 725 673 C 752 640 818 640 872 611 C 906 593 917 555 925 530 C 941 494 1002 479 1024 447 C 1037 428 1041 391 1049 367 C 1061 331 1180 325 1183 277 C 1184 253 1183 215 1183 186 L 1183 126';

function EnergyRoute() {
  return <svg className="business-energy" viewBox="0 0 1672 941" aria-hidden="true">
    <defs>
      <path id="business-summit-route" d={summitRoute} />
      <filter id="business-pulse-glow" x="-200%" y="-200%" width="500%" height="500%"><feGaussianBlur stdDeviation="4" /></filter>
    </defs>
    {[0, 1, 2].map(index => <g key={index} className={`business-energy-pulse business-energy-pulse-${index}`}>
      <circle r="8" fill="#b6dcff" opacity=".42" filter="url(#business-pulse-glow)" /><circle r="2.5" fill="#f1f9ff" />
      <animateMotion dur="12s" begin={`${-index * 4}s`} repeatCount="indefinite" calcMode="paced"><mpath href="#business-summit-route" /></animateMotion>
    </g>)}
  </svg>;
}

function BusinessVisual({ copy, base }) {
  return <div className="business-visual">
    <div className="business-landscape">
      <img src={`${base}assets/business/${assets.summit}`} alt="" width="1672" height="941" loading="lazy" decoding="async" />
      <EnergyRoute />
      {copy.stages.map((label, index) => <span key={label} className={`business-stage business-stage-${index}`}>{label}</span>)}
    </div>
    <div className="business-microtext" aria-hidden="true">{copy.anchors.map(label => <span key={label}>{label}</span>)}<i /></div>
    <blockquote className="business-quote"><span aria-hidden="true">“</span><p>{copy.quote}”</p><cite>ELIAS KALYVAS</cite></blockquote>
  </div>;
}

export default function BusinessSection({ lang, base }) {
  const copy = translations[lang] || translations.en;
  const sectionRef = useRef(null);
  const [selected, setSelected] = useState(null);
  const mobile = useMobileCards();
  const detail = selected !== null && <div className="business-card-detail" id={`business-card-detail-${selected}`} role="region" aria-label={copy.cards[selected].title} style={mobile ? { order: selected * 2 + 1 } : undefined}>
    <div><h3>{copy.cards[selected].title}</h3><p>{copy.cards[selected].lines.join(' ')}</p></div>
    <div className="business-detail-result"><strong>{copy.metrics[selected][0]}</strong><span>{copy.metrics[selected].slice(1).join(' ')}</span></div>
    <button type="button" aria-label={copy.close} onClick={() => { setSelected(null); sectionRef.current.querySelectorAll('.business-card-action')[selected]?.focus(); }}>×</button>
  </div>;
  useEffect(() => {
    const section = sectionRef.current;
    const observer = new IntersectionObserver(([entry]) => {
      section.querySelectorAll('svg').forEach(svg => {
        if (entry.isIntersecting) svg.unpauseAnimations?.(); else svg.pauseAnimations?.();
      });
    }, { rootMargin: '100px' });
    observer.observe(section);
    return () => observer.disconnect();
  }, []);
  return <section ref={sectionRef} className="business-section" id="business" aria-labelledby="business-heading">
    <SectionSidebar activeIndex={3} />
    <div className="business-inner">
      <div className="business-main">
        <div className="business-content">
          <div className="business-eyebrow"><span>03</span><i /><span>{copy.label}</span></div>
          <h2 id="business-heading">{copy.headline.map(line => <span key={line}>{line}</span>)}<span>{copy.into} <em>{copy.clarity}</em></span></h2>
          <p className="business-intro">{copy.paragraph}</p>
          <a href="#business-cards" className="business-explore"><span className="business-explore-icon" aria-hidden="true">▸</span><span>{copy.explore}</span><i /></a>
        </div>
        <BusinessVisual copy={copy} base={base} />
      </div>
      <div className="business-cards-grid" id="business-cards">
        {copy.cards.map((card, index) => <article style={{ order: index * 2 }} key={card.key} className={`business-card ${selected === index ? 'is-selected' : ''}`}>
          <span className="business-card-number">0{index + 1}</span>
          <div className="business-card-visual"><img src={`${base}assets/business/${assets[card.key]}`} alt="" width="1448" height="1086" loading="lazy" decoding="async" /></div>
          <div className="business-card-body"><h3>{card.title}</h3><p>{card.lines.map(line => <span key={line}>{line}</span>)}</p></div>
          <button className="business-card-action" type="button" aria-label={`${copy.exploreCard} ${card.title}`} aria-expanded={selected === index} aria-controls={`business-card-detail-${index}`} onClick={() => setSelected(selected === index ? null : index)}><span aria-hidden="true">→</span></button>
        </article>)}
        {mobile && detail}
      </div>
      {!mobile && detail}
      <div className="business-metrics" aria-label={lang === 'el' ? 'Αποτελέσματα' : 'Results'}>{copy.metrics.map(([value, label, qualifier]) => <div className="business-metric" key={value}><strong>{value}</strong><p>{label}<span>{qualifier}</span></p></div>)}</div>
      <div className="business-signature" aria-hidden="true"><i /><span>{copy.signature}</span></div>
    </div>
  </section>;
}

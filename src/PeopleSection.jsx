import React, { useState } from 'react';
import './people.css';

const images = {
  journey: 'assets/people/people-journey.png',
  leadership: 'assets/people/leadership-development.png',
  learning: 'assets/people/learning-development.png',
  mentoring: 'assets/people/executive-mentoring.png',
  spark: 'assets/people/trainingspark.png',
};

const translations = {
  en: {
    eyebrow: '02 — PEOPLE',
    headline: ['Develop', 'the people', 'who move', 'the business.'],
    paragraph: 'I help individuals and teams build the skills, mindset and capability to adapt, lead and perform in a changing world.',
    explore: 'EXPLORE PEOPLE & LEADERSHIP',
    labels: ['PEOPLE LEARN', 'TEAMS GROW', 'BUSINESSES EVOLVE'],
    sideNote: ['STRONGER PEOPLE', 'BRIGHTER TOMORROW'],
    quote: 'People don’t just work in businesses. They make them possible.',
    cards: [
      { title: 'Leadership Development', description: 'Build the leadership that creates momentum.', detail: 'Leadership capabilities for people who guide teams through change.', image: images.leadership },
      { title: 'Learning & Development', description: 'Turn learning into measurable growth.', detail: 'Learning experiences shaped around people, practice and progress.', image: images.learning },
      { title: 'Executive Mentoring', description: 'Clarity and perspective for the next step.', detail: 'Thoughtful one-to-one mentoring for demanding decisions.', image: images.mentoring },
      { title: 'TrainingSpark', description: 'Activate ideas. Ignite capability.', detail: 'A focused spark that moves knowledge into action.', image: images.spark },
    ],
    close: 'Close details',
  },
  el: {
    eyebrow: '02 — ΑΝΘΡΩΠΟΙ',
    headline: ['Αναπτύσσω', 'τους ανθρώπους', 'που κινούν', 'την επιχείρηση.'],
    paragraph: 'Βοηθώ ανθρώπους και ομάδες να χτίζουν δεξιότητες, νοοτροπία και ικανότητες, ώστε να προσαρμόζονται, να ηγούνται και να αποδίδουν σε έναν κόσμο που αλλάζει.',
    explore: 'ΑΝΑΚΑΛΥΨΕ ΑΝΘΡΩΠΟΥΣ & ΗΓΕΣΙΑ',
    labels: ['PEOPLE LEARN', 'TEAMS GROW', 'BUSINESSES EVOLVE'],
    sideNote: ['STRONGER PEOPLE', 'BRIGHTER TOMORROW'],
    quote: 'Οι άνθρωποι δεν εργάζονται απλώς στις επιχειρήσεις. Τις κάνουν εφικτές.',
    cards: [
      { title: 'Leadership Development', description: 'Ηγεσία που δημιουργεί δυναμική.', detail: 'Ανάπτυξη ηγετικών ικανοτήτων για ανθρώπους που οδηγούν ομάδες μέσα στην αλλαγή.', image: images.leadership },
      { title: 'Learning & Development', description: 'Η μάθηση γίνεται ουσιαστική ανάπτυξη.', detail: 'Εμπειρίες μάθησης σχεδιασμένες γύρω από τον άνθρωπο και την πράξη.', image: images.learning },
      { title: 'Executive Mentoring', description: 'Σαφήνεια και προοπτική για το επόμενο βήμα.', detail: 'Προσωπική καθοδήγηση για απαιτητικές αποφάσεις.', image: images.mentoring },
      { title: 'TrainingSpark', description: 'Οι ιδέες μετατρέπονται σε ικανότητες.', detail: 'Μια στοχευμένη σπίθα που φέρνει τη γνώση στην πράξη.', image: images.spark },
    ],
    close: 'Κλείσιμο λεπτομερειών',
  },
};

const lines = [
  { id: 'near', d: 'M 2 848 C 184 811 333 760 455 729', duration: '6.8s', delay: '-2.2s' },
  { id: 'right', d: 'M 704 1082 C 829 889 1004 714 1175 626 S 1370 537 1307 501', duration: '7.4s', delay: '-4.7s' },
  { id: 'middle', d: 'M 788 747 C 973 723 1105 656 1208 549 S 1310 493 1271 464', duration: '5.9s', delay: '-1.1s' },
  { id: 'portal', d: 'M 802 455 C 927 434 1014 446 1101 465 S 1223 486 1307 458', duration: '5.2s', delay: '-3.4s' },
];

function LineChargeOverlay() {
  return <svg className="people-line-overlay" viewBox="0 0 1448 1086" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <filter id="people-charge-glow" x="-350%" y="-350%" width="800%" height="800%">
        <feGaussianBlur stdDeviation="8" />
      </filter>
    </defs>
    {lines.map(line => <React.Fragment key={line.id}>
      <path id={`people-path-${line.id}`} d={line.d} className="people-traced-line" />
      <g className="people-pulse">
        <circle r="17" fill="#8ccaff" opacity=".7" filter="url(#people-charge-glow)" />
        <circle r="3.4" fill="#e9f8ff" />
        <animateMotion dur={line.duration} begin={line.delay} repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
          <mpath href={`#people-path-${line.id}`} />
        </animateMotion>
      </g>
    </React.Fragment>)}
  </svg>;
}

function PeopleHeroVisual({ copy, base }) {
  return <div className="people-visual">
    <img src={`${base}${images.journey}`} alt="" className="people-journey-image" loading="lazy" decoding="async" />
    <LineChargeOverlay />
    <div className="people-visual-wash" aria-hidden="true" />
    <span className="people-image-label label-learn"><i />{copy.labels[0]}</span>
    <span className="people-image-label label-grow"><i />{copy.labels[1]}</span>
    <span className="people-image-label label-evolve"><i />{copy.labels[2]}</span>
    <span className="people-side-note">{copy.sideNote[0]}<br />{copy.sideNote[1]}</span>
    <blockquote className="people-quote"><p>“{copy.quote}”</p><cite>— ELIAS KALYVAS</cite></blockquote>
  </div>;
}

function InfoCard({ card, index, base, selected, onSelect }) {
  return <article className={`people-card${selected ? ' is-selected' : ''}`}>
    <img src={`${base}${card.image}`} alt="" loading="lazy" decoding="async" />
    <div className="people-card-shade" aria-hidden="true" />
    <span className="people-card-index">0{index + 1}</span>
    <div className="people-card-copy"><h3>{card.title}</h3><p>{card.description}</p></div>
    <button className="people-card-action" type="button" onClick={onSelect} aria-label={`${card.title} — ${selected ? 'close' : 'explore'}`} aria-expanded={selected} aria-controls="people-card-detail"><span aria-hidden="true">→</span></button>
  </article>;
}

function PeopleCardsGrid({ copy, base }) {
  const [selected, setSelected] = useState(null);
  return <div className="people-cards-area" id="people-cards">
    <div className="people-cards-grid">
      {copy.cards.map((card, index) => <InfoCard key={card.title} card={card} index={index} base={base} selected={selected === index} onSelect={() => setSelected(selected === index ? null : index)} />)}
    </div>
    {selected !== null && <div className="people-card-detail" id="people-card-detail" role="status">
      <span>0{selected + 1} / {copy.cards[selected].title}</span>
      <p>{copy.cards[selected].detail}</p>
      <button type="button" onClick={() => setSelected(null)} aria-label={copy.close}>×</button>
    </div>}
  </div>;
}

export default function PeopleSection({ lang, base }) {
  const copy = translations[lang] || translations.en;
  return <section className="people-section" id="people" aria-labelledby="people-heading">
    <div className="people-inner">
      <div className="people-main">
        <div className="people-content">
          <div className="people-eyebrow"><span className="people-eyebrow-rule" />{copy.eyebrow}</div>
          <h2 id="people-heading">{copy.headline.map((line, index) => <span key={line} className={index > 1 ? 'people-headline-accent' : ''}>{line}</span>)}</h2>
          <p className="people-intro-copy">{copy.paragraph}</p>
          <a href="#people-cards" className="people-explore"><span className="people-explore-icon" aria-hidden="true">▸</span><span>{copy.explore}</span><i /></a>
        </div>
        <PeopleHeroVisual copy={copy} base={base} />
      </div>
      <PeopleCardsGrid copy={copy} base={base} />
    </div>
  </section>;
}

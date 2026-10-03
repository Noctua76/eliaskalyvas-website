import React, { useEffect, useRef } from 'react';
import SectionSidebar from './SectionSidebar.jsx';
import './about.css';

const principles = [
  { title: 'People First', image: 'people-first.webp', en: ['Real people.', 'Real challenges.', 'Real progress.'], el: ['Πραγματικοί άνθρωποι.', 'Πραγματικές προκλήσεις.', 'Ουσιαστική πρόοδος.'] },
  { title: 'Systemic Thinking', image: 'systemic-thinking.webp', en: ['Connecting strategy,', 'people and technology.'], el: ['Συνδέω στρατηγική,', 'ανθρώπους και τεχνολογία.'] },
  { title: 'Measurable Impact', image: 'measurable-impact.webp', en: ['From insight', 'to tangible results.'], el: ['Από τη διορατικότητα', 'σε απτά αποτελέσματα.'] },
  { title: 'Continuous Growth', image: 'continuous-growth.webp', en: ['Learning.', 'Building.', 'Always forward.'], el: ['Μαθαίνω.', 'Δημιουργώ.', 'Πάντα μπροστά.'] },
];
const initiatives = [
  { title: 'TrainingSpark', image: 'trainingspark.webp', en: ['Leadership training', 'for modern teams.'], el: ['Εκπαίδευση ηγεσίας', 'για σύγχρονες ομάδες.'] },
  { title: 'My Mentor', image: 'my-mentor.webp', en: ['Personal development', 'in your pocket.'], el: ['Προσωπική ανάπτυξη', 'στην τσέπη σου.'] },
  { title: 'Aegis Link', image: 'aegis-link.webp', en: ['Security operations', 'with real-time visibility.'], el: ['Επιχειρήσεις ασφαλείας', 'με εικόνα σε πραγματικό χρόνο.'] },
  { title: 'Noctua Core', image: 'noctua-core.webp', en: ['AI solutions', 'for real business needs.'], el: ['Λύσεις AI', 'για πραγματικές επιχειρησιακές ανάγκες.'] },
];
const copy = {
  en: {
    headline: ['Experience', 'that connects', 'the dots.'],
    paragraphs: ['A unique combination of military discipline, business acumen, human-centered learning and modern technology.', 'I bring real-world experience, academic depth and a systemic mindset to help people and organizations move forward.'],
    journey: 'My Journey', timelineLabel: 'Experience and education',
    timeline: [
      { date: '2020+', titles: ['Noctua Core Systems'], lines: ['Building digital products and', 'AI-powered solutions.'] },
      { date: '2020+', titles: ['Learning & Development'], lines: ['Consulting, corporate training,', 'executive mentoring.'] },
      { date: '2018 – 2020', titles: ['VIP Club Manager'], lines: ['Operations, teams, high standards.'] },
      { date: '1998 – 2018', titles: ['Hellenic Air Force'], lines: ['20 years of service at the General Staff HQ.', 'HR, finance, administration.'] },
      { date: 'Academic', titles: ['BA/MA History & Philosophy', 'MBA International Business', 'PhD candidate Political Science'], lines: ['Understanding people, systems', 'and the bigger picture.'] },
    ],
    quote: ['Discipline gives structure.', 'People give purpose.', 'Technology gives scale.', 'Together, they create real impact.'],
    closing: ['Different domains.', 'A common purpose.'],
    mountainAlt: 'A luminous path climbs a mountain toward its summit and the light on the horizon',
  },
  el: {
    headline: ['Εμπειρία', 'που ενώνει', 'τις τελείες.'],
    paragraphs: ['Ένας ξεχωριστός συνδυασμός στρατιωτικής πειθαρχίας, επιχειρηματικής αντίληψης, ανθρωποκεντρικής μάθησης και σύγχρονης τεχνολογίας.', 'Συνδυάζω εμπειρία από την πράξη, ακαδημαϊκό βάθος και συστημική σκέψη για να βοηθώ ανθρώπους και οργανισμούς να προχωρούν.'],
    journey: 'Η διαδρομή μου', timelineLabel: 'Εμπειρία και σπουδές',
    timeline: [
      { date: '2020+', titles: ['Noctua Core Systems'], lines: ['Ψηφιακά προϊόντα και', 'λύσεις με τη δύναμη του AI.'] },
      { date: '2020+', titles: ['Learning & Development'], lines: ['Συμβουλευτική, εταιρική εκπαίδευση,', 'executive mentoring.'] },
      { date: '2018 – 2020', titles: ['VIP Club Manager'], lines: ['Λειτουργίες, ομάδες, υψηλά πρότυπα.'] },
      { date: '1998 – 2018', titles: ['Πολεμική Αεροπορία'], lines: ['20 χρόνια υπηρεσίας στο Γενικό Επιτελείο.', 'Ανθρώπινο δυναμικό, οικονομικά, διοίκηση.'] },
      { date: 'Σπουδές', titles: ['BA/MA Ιστορία & Φιλοσοφία', 'MBA International Business', 'Υποψήφιος διδάκτορας Πολιτικής Επιστήμης'], lines: ['Κατανοώντας ανθρώπους, συστήματα', 'και τη μεγαλύτερη εικόνα.'] },
    ],
    quote: ['Η πειθαρχία δίνει δομή.', 'Οι άνθρωποι δίνουν σκοπό.', 'Η τεχνολογία δίνει κλίμακα.', 'Μαζί, δημιουργούν ουσιαστικό αντίκτυπο.'],
    closing: ['Διαφορετικοί τομείς.', 'Ένας κοινός σκοπός.'],
    mountainAlt: 'Μια φωτεινή διαδρομή ανεβαίνει το βουνό προς την κορυφή και το φως στον ορίζοντα',
  },
};

function Lines({ lines }) {
  return lines.map((line, index) => <span key={line}>{line}{index < lines.length - 1 ? ' ' : ''}</span>);
}

export default function AboutSection({ lang, base }) {
  const sectionRef = useRef(null);
  const text = copy[lang] || copy.en;
  useEffect(() => {
    const section = sectionRef.current;
    if (['#thinking', '#about', '#about-journey'].includes(window.location.hash)) {
      const target = window.location.hash === '#about-journey' ? section.querySelector('#about-journey') : section;
      target.scrollIntoView({ behavior: 'instant', block: 'start' });
    }
    if (!('IntersectionObserver' in window)) return;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) section.classList.add('is-motion-ready');
    const reveals = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          reveals.unobserve(entry.target);
        }
      });
    }, { threshold: .04 });
    section.querySelectorAll('.about-reveal').forEach(element => reveals.observe(element));
    const visibility = new IntersectionObserver(([entry]) => { section.dataset.inView = String(entry.isIntersecting); }, { rootMargin: '80px' });
    visibility.observe(section);
    return () => { reveals.disconnect(); visibility.disconnect(); };
  }, []);

  return <section className="about-section" id="thinking" ref={sectionRef} aria-labelledby="about-heading" data-in-view="false">
    <span id="about" className="about-anchor" aria-hidden="true"/>
    <SectionSidebar activeIndex={6}/>
    <span className="about-vertical-label" aria-hidden="true">ABOUT</span>
    <div className="about-inner">
      <div className="about-main">
        <div className="about-intro about-reveal">
          <div className="about-eyebrow"><span>06</span><i/><span>ABOUT</span></div>
          <h2 id="about-heading">{text.headline.map((line, index) => <span className={index === 2 ? 'about-headline-accent' : ''} key={line}>{line}</span>)}</h2>
          <div className="about-positioning">{text.paragraphs.map(paragraph => <p key={paragraph}>{paragraph}</p>)}</div>
          <div className="about-journey-link"><a href="#about-journey">{text.journey}<span aria-hidden="true">⟶</span></a><i aria-hidden="true"/></div>
        </div>
        <div className="about-timeline about-reveal" id="about-journey" aria-label={text.timelineLabel}>
          <ol>{text.timeline.map((entry, index) => <li key={`${entry.date}-${index}`}>
            <span className="about-timeline-date">{entry.date}</span>
            <i className="about-timeline-node" aria-hidden="true"/>
            <div className="about-timeline-content"><h3><Lines lines={entry.titles}/></h3><p><Lines lines={entry.lines}/></p></div>
          </li>)}</ol>
        </div>
        <figure className="about-landscape about-reveal">
          <img src={`${base}assets/about/mountain-journey.webp`} width="1672" height="941" alt={text.mountainAlt} loading="lazy" decoding="async"/>
          <div className="about-landscape-labels" aria-hidden="true"><span>IDEAS</span><span>PEOPLE</span><span>SYSTEMS</span><span>A BRIGHTER<br/>TOMORROW</span></div>
        </figure>
      </div>
      <div className="about-middle">
        <blockquote className="about-quote about-reveal"><span className="about-quote-mark" aria-hidden="true">“</span><p><Lines lines={text.quote}/></p><cite><i aria-hidden="true"/>ELIAS KALYVAS</cite></blockquote>
        <div className="about-principles">
          {principles.map(principle => <article className="about-principle about-reveal" key={principle.title}>
            <img src={`${base}assets/about/${principle.image}`} width="256" height="256" alt="" loading="lazy" decoding="async"/>
            <h3>{principle.title}</h3><p><Lines lines={principle[lang] || principle.en}/></p>
          </article>)}
        </div>
      </div>
      <div className="about-initiatives-strip about-reveal">
        <div className="about-initiatives-label" aria-hidden="true"><span>INITIATIVES</span><span>& PROJECTS</span><i/></div>
        <div className="about-initiatives" aria-label="Initiatives & Projects">
          {initiatives.map(initiative => <article className="about-initiative" key={initiative.title}>
            <img src={`${base}assets/about/${initiative.image}`} width="256" height="256" alt="" loading="lazy" decoding="async"/>
            <div><h3>{initiative.title}</h3><p><Lines lines={initiative[lang] || initiative.en}/></p></div>
          </article>)}
        </div>
        <div className="about-closing"><p><Lines lines={text.closing}/></p><i aria-hidden="true"/></div>
      </div>
      <div className="about-footer about-reveal"><span>PEOPLE <b>/</b> BUSINESS <b>/</b> AI & SYSTEMS</span><span>DRIVEN BY PURPOSE <i aria-hidden="true"/></span></div>
    </div>
  </section>;
}

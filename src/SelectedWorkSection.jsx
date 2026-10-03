import React, { useEffect, useRef } from 'react';
import SectionSidebar from './SectionSidebar.jsx';
import './selected-work.css';

const projects = [
  {
    key: 'aegis', title: 'AEGIS LINK', subtitle: 'SECURITY OPERATIONS PLATFORM',
    description: ['A complete platform for security operations,', 'connecting people, sites and real-time events', 'in one system.'],
    greekDescription: ['Μια ολοκληρωμένη πλατφόρμα επιχειρήσεων ασφαλείας,', 'που συνδέει ανθρώπους, εγκαταστάσεις και συμβάντα', 'σε πραγματικό χρόνο, σε ένα σύστημα.'],
    micro: ['MONITOR', 'COORDINATE', 'RESPOND', 'STAY AHEAD'],
    benefits: ['REAL-TIME VISIBILITY', 'HIGHER ACCOUNTABILITY', 'FASTER RESPONSE', 'SCALABLE SOLUTION'],
    icons: ['shield', 'chart', 'bolt', 'layers'], footer: 'BUILT FOR A SAFER TOMORROW',
    image: 'aegis-platform.webp', width: 1300, height: 893, side: 'aegis-guard.webp', sideWidth: 322, sideHeight: 705,
    href: 'https://aegislink.noctuacore.ai/', alt: 'Aegis Link security operations dashboard on a laptop and mobile phone',
  },
  {
    key: 'mentor', title: 'MY MENTOR', subtitle: 'PERSONAL DEVELOPMENT APP',
    description: ['A practical app for self-awareness,', 'habit building and continuous growth.'],
    greekDescription: ['Μια πρακτική εφαρμογή για αυτογνωσία,', 'καλές συνήθειες και συνεχή ανάπτυξη.'],
    micro: ['REFLECT', 'PLAN', 'IMPROVE', 'MOVE FORWARD'],
    benefits: ['PERSONALIZED GUIDANCE', 'PRACTICAL TOOLS', 'MEASURABLE PROGRESS', 'AI-POWERED SUPPORT'],
    icons: ['person', 'chart', 'target', 'brain'], footer: 'A STRONGER YOU, EVERY DAY',
    image: 'mentor-phones.webp', width: 1300, height: 975, side: 'mentor-journey.webp', sideWidth: 1300, sideHeight: 975,
    href: 'https://play.google.com/store/apps/details?id=space.mymentorapp', alt: 'Three smartphones showing My Mentor personal development tools',
  },
  {
    key: 'noctua', title: 'NOCTUA CORE', subtitle: 'TECHNOLOGY FOR REAL PROBLEMS',
    description: ['Custom systems, AI solutions and digital', 'products designed around your business needs.'],
    greekDescription: ['Εξατομικευμένα συστήματα, λύσεις AI και ψηφιακά', 'προϊόντα για τις ανάγκες της επιχείρησής σου.'],
    micro: ['IDEAS', 'SYSTEMS', 'AUTOMATION', 'REAL IMPACT'],
    benefits: ['CUSTOM SOLUTIONS', 'AI INTEGRATION', 'BUSINESS AUTOMATION', 'LONG-TERM VALUE'],
    icons: ['cube', 'chip', 'gear', 'infinity'], footer: 'TECHNOLOGY WITH A PURPOSE',
    image: 'noctua-platform.webp', width: 1300, height: 732, side: 'noctua-moon.webp', sideWidth: 1300, sideHeight: 975,
    href: 'https://noctuacore.ai/', alt: 'Noctua Core owl identity, custom software and AI tools on laptop and phone',
  },
];

const iconPaths = {
  shield: <><path d="M12 3 4 6v6c0 5 8 9 8 9s8-4 8-9V6Z"/><path d="m8 12 3 3 5-6"/></>,
  chart: <><path d="M3 21h18M5 18v-7h3v7m3 0V7h3v11m3 0V3h3v15"/></>,
  bolt: <path d="m14 2-10 12h7l-1 8 10-13h-7Z"/>,
  layers: <><path d="m12 3-10 5 10 5 10-5Zm-10 9 10 5 10-5M2 16l10 5 10-5"/></>,
  person: <><circle cx="12" cy="7" r="4"/><path d="M3 21c0-5 3-8 9-8s9 3 9 8Z"/></>,
  target: <><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="m12 12 9-9m-1 0h2v2"/></>,
  brain: <><path d="M12 4c-3-4-7 0-6 3-4 0-4 6-2 7-2 4 3 8 6 5 1 4 2 2 2 2Zm0 0c3-4 7 0 6 3 4 0 4 6 2 7 2 4-3 8-6 5-1 4-2 2-2 2Z"/><path d="M7 8c4 0 4 4 1 5m9-5c-4 0-4 4-1 5M7 17l3-2m7 2-3-2"/></>,
  cube: <><path d="m12 2-9 5v10l9 5 9-5V7Zm-9 5 9 5 9-5M12 12v10"/></>,
  chip: <><rect x="6" y="6" width="12" height="12" rx="1"/><path d="M9 2v4m6-4v4M9 18v4m6-4v4M2 9h4m-4 6h4m12-6h4m-4 6h4"/><rect x="9" y="9" width="6" height="6"/></>,
  gear: <><path d="m10 2 4 0 1 3 3 1 3-1 2 4-3 2v3l3 2-2 4-3-1-3 1-1 3h-4l-1-3-3-1-3 1-2-4 3-2v-3L1 9l2-4 3 1 3-1Z"/><circle cx="12" cy="12" r="3"/></>,
  infinity: <path d="M12 12c-3-5-5-6-8-4-5 4-2 11 2 9 4-1 6-9 10-10 5-2 9 6 4 10-3 2-5 0-8-5Z"/>,
};

function FeatureIcon({ name }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{iconPaths[name]}</svg>;
}

export default function SelectedWorkSection({ lang, base }) {
  const sectionRef = useRef(null);
  const greek = lang === 'el';
  useEffect(() => {
    const section = sectionRef.current;
    if (window.location.hash === '#selected-work') section.scrollIntoView({ behavior: 'instant', block: 'start' });
    if (!('IntersectionObserver' in window)) return;
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) section.classList.add('is-motion-ready');
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .04 });
    section.querySelectorAll('.work-reveal').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  return <section id="selected-work" className="work-section" ref={sectionRef} aria-labelledby="work-heading">
    <SectionSidebar activeIndex={5} />
    <span className="work-vertical-label" aria-hidden="true">SELECTED WORK</span>
    <div className="work-inner">
      <div className="work-intro work-reveal">
        <div className="work-intro-copy">
          <div className="work-eyebrow"><span>05</span><i/><span>SELECTED WORK</span></div>
          <h2 id="work-heading"><span>{greek ? 'Ιδέες' : 'Ideas'}</span><span className="work-headline-accent">{greek ? 'σε δράση.' : 'in action.'}</span></h2>
          <p>{greek ? <>Από τη σύλληψη σε πραγματικές λύσεις.<br/>Επιλεγμένα έργα που δημιουργούν<br/>μετρήσιμη αξία.</> : <>From concept to real-world solutions.<br/>A selection of projects that create<br/>measurable value.</>}</p>
        </div>
        <div className="work-earth" aria-hidden="true">
          <img src={`${base}assets/selected-work/earth.webp`} width="1672" height="941" alt="" loading="lazy" decoding="async"/>
          <div className="work-earth-impact"><span>REAL PROBLEMS.</span><span>REAL SOLUTIONS.</span><span>REAL IMPACT.</span></div>
          <div className="work-earth-approach"><span>DIFFERENT</span><span>INDUSTRIES.</span><span>A COMMON</span><span>APPROACH.</span><i/></div>
        </div>
      </div>
      <div className="work-projects">
        {projects.map((project, index) => <article className={`work-project work-project-${project.key} work-reveal`} key={project.key} aria-labelledby={`work-title-${project.key}`}>
          <div className="work-project-copy">
            <span className="work-project-index">0{index + 1}</span>
            <h3 id={`work-title-${project.key}`}>{project.title}</h3>
            <p className="work-project-subtitle">{project.subtitle}</p>
            <div className="work-project-summary">
              <div className="work-project-description">
                <p>{(greek ? project.greekDescription : project.description).map((line, i, lines) => <span key={line}>{line}{i < lines.length - 1 ? ' ' : ''}</span>)}</p>
                <div className="work-project-link"><a href={project.href} target="_blank" rel="noopener noreferrer" aria-label={`${greek ? 'Δες το έργο' : 'View project'} ${project.title} (${greek ? 'νέα καρτέλα' : 'new tab'})`}>{greek ? 'Δες το έργο' : 'View Project'}<span aria-hidden="true">⟶</span></a><i aria-hidden="true"/></div>
              </div>
              <div className="work-project-micro" aria-hidden="true">{project.micro.map(line => <span key={line}>{line}</span>)}</div>
            </div>
          </div>
          <div className="work-project-visual">
            <img src={`${base}assets/selected-work/${project.image}`} width={project.width} height={project.height} alt={project.alt} loading="lazy" decoding="async"/>
          </div>
          <div className="work-project-features">
            <img className="work-side-image" src={`${base}assets/selected-work/${project.side}`} width={project.sideWidth} height={project.sideHeight} alt="" loading="lazy" decoding="async"/>
            <ul>{project.benefits.map((benefit, i) => <li key={benefit}><FeatureIcon name={project.icons[i]}/><span>{benefit}</span></li>)}</ul>
            <p className="work-project-purpose">{project.footer}<i aria-hidden="true"/></p>
          </div>
        </article>)}
      </div>
      <div className="work-footer work-reveal">
        <span>PEOPLE <b>/</b> BUSINESS <b>/</b> AI & SYSTEMS</span>
        <span className="work-footer-purpose"><i aria-hidden="true"/>BUILT TODAY. A BRIGHTER TOMORROW.</span>
        <span className="work-continue">SCROLL TO CONTINUE <span aria-hidden="true">↓</span></span>
      </div>
    </div>
  </section>;
}

import React, { useEffect, useState } from 'react';
import './section-sidebar.css';

const sections = [
  { id: 'hero', label: 'Hero' },
  { id: 'people', label: 'People' },
  { id: 'business', label: 'Business' },
  { id: 'ai-systems', label: 'AI & Systems' },
  { id: 'selected-work', label: 'Selected Work' },
  { id: 'thinking', label: 'About / Thinking' },
  { id: 'contact', label: "Contact / Let’s Build" },
];
const domains = ['IDEAS', 'PEOPLE', 'BUSINESS', 'TECHNOLOGY'];
const sectionDomains = ['IDEAS', 'PEOPLE', 'BUSINESS', 'TECHNOLOGY', 'IDEAS', 'IDEAS', 'IDEAS'];

export function SectionIndexRail({ activeIndex }) {
  const [available, setAvailable] = useState([]);
  useEffect(() => {
    setAvailable(sections.filter(section => document.getElementById(section.id)).map(section => section.id));
  }, []);
  return <nav className="section-index-rail" aria-label="Section index">
    <ol>{sections.map((section, index) => {
      const active = activeIndex === index + 1;
      const number = String(index + 1).padStart(2, '0');
      return <li key={section.id} className={active ? 'is-active' : ''}>
        {available.includes(section.id)
          ? <a href={`#${section.id}`} aria-label={`${number} — ${section.label}`} aria-current={active ? 'location' : undefined}>{number}</a>
          : <span aria-label={`${number} — ${section.label}`}>{number}</span>}
        {active && <i className="section-index-dot" aria-hidden="true" />}
      </li>;
    })}</ol>
  </nav>;
}

export function SideTaxonomy({ activeIndex }) {
  return <div className="side-taxonomy" aria-hidden="true">
    {domains.map(domain => <span key={domain} className={domain === sectionDomains[activeIndex - 1] ? 'is-current' : ''}>{domain}</span>)}
    <i />
  </div>;
}

export default function SectionSidebar({ activeIndex }) {
  return <aside className="section-sidebar">
    <SectionIndexRail activeIndex={activeIndex} />
    <SideTaxonomy activeIndex={activeIndex} />
  </aside>;
}

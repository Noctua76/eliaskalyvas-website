import React, { useEffect, useRef, useState } from 'react';
import SectionSidebar from './SectionSidebar.jsx';
import BrandLockup from './BrandLockup.jsx';
import { contactConfig, contactEmailHref, sendContactMessage } from './contact-config.js';
import './contact.css';

const intents = [
  { value: 'Website', titleLines: ['I need a', 'website'], image: 'website.webp', en: ['I need a website', 'A modern, high-performance site.'], el: ['Χρειάζομαι ένα website', 'Μια σύγχρονη ιστοσελίδα υψηλών επιδόσεων.'] },
  { value: 'AI solution', titleLines: ['I need an', 'AI solution'], image: 'ai-solution.webp', en: ['I need an AI solution', 'Automation, AI agents or custom tools.'], el: ['Χρειάζομαι μια λύση AI', 'Αυτοματισμοί, AI agents ή εργαλεία στα μέτρα μου.'] },
  { value: 'Business system', titleLines: ['I need a', 'business system'], image: 'business-system.webp', en: ['I need a business system', 'Processes, platforms, integration.'], el: ['Χρειάζομαι ένα σύστημα', 'Διαδικασίες, πλατφόρμες, διασύνδεση.'] },
  { value: 'Consulting', titleLines: ['I need', 'consulting'], image: 'consulting.webp', en: ['I need consulting', 'Strategy, growth, operational clarity.'], el: ['Χρειάζομαι συμβουλευτική', 'Στρατηγική, ανάπτυξη, επιχειρησιακή σαφήνεια.'] },
  { value: 'Idea', titleLines: ['I have', 'an idea'], image: 'idea.webp', en: ['I have an idea', 'Let’s discuss it together.'], el: ['Έχω μια ιδέα', 'Ας τη συζητήσουμε μαζί.'] },
];
const copy = {
  en: {
    label: 'LET’S BUILD', headline: ['Have an idea?', 'Let’s build it.'],
    intro: ['Whether you need a strategy, a team development', 'program, an AI solution or a complete digital platform,', 'let’s turn your idea into real impact.'],
    needs: 'What do you need?', needsText: 'Tell me more about your goal, and let’s explore how we can make it happen.',
    formTitle: 'Let’s start the conversation.', formText: 'Send a message and I’ll get back to you soon.',
    name: 'Name', email: 'Email', message: 'Message', namePlaceholder: 'Your name', messagePlaceholder: 'Tell me about your idea, challenge or goal...',
    send: 'Send Message', sending: 'Sending…', trust: ['No spam.', 'Just meaningful conversations.'],
    required: 'Please fill in this field.', success: 'Thank you. Your message has been sent. I’ll be in touch soon.',
    failure: 'Your message couldn’t be sent. Please try again or continue by email.',
    emailFallback: 'Continue by email to send your message. Your details and selected interest are ready in the email draft.', continueEmail: 'Continue by email',
    location: 'Location', city: 'Athens, Greece', remote: 'Available for remote projects worldwide',
    meeting: 'Prefer a meeting?', meetingText: 'Let’s find a time that works for you.', book: 'Book a call',
    quote: ['Every meaningful project', 'starts with a conversation.'],
    nav: ['Home', 'Work', 'Services', 'Thinking', 'About', 'Contact'], footerNav: 'Footer navigation',
    rights: 'All rights reserved.', privacy: 'Privacy Policy', terms: 'Terms', close: 'Close',
    pendingPolicy: 'The full Privacy Policy will be published before the final website launches. For privacy questions, please contact info@eliaskalyvas.gr.',
    pendingTerms: 'The Terms will be published before the final website launches. For questions about a collaboration, please contact info@eliaskalyvas.gr.',
    pendingSocial: 'The official profile will be linked here soon. You can connect with Elias on LinkedIn or by email.',
  },
  el: {
    label: 'ΑΣ ΔΗΜΙΟΥΡΓΗΣΟΥΜΕ', headline: ['Έχεις μια ιδέα;', 'Ας τη χτίσουμε.'],
    intro: ['Είτε χρειάζεσαι στρατηγική, ένα πρόγραμμα ανάπτυξης ομάδας,', 'μια λύση AI ή μια ολοκληρωμένη ψηφιακή πλατφόρμα,', 'ας δώσουμε στην ιδέα σου ουσιαστικό αντίκτυπο.'],
    needs: 'Τι χρειάζεσαι;', needsText: 'Μίλησέ μου για τον στόχο σου, και ας δούμε πώς μπορούμε να τον κάνουμε πράξη.',
    formTitle: 'Ας ξεκινήσουμε τη συζήτηση.', formText: 'Στείλε ένα μήνυμα και θα επικοινωνήσω μαζί σου σύντομα.',
    name: 'Όνομα', email: 'Email', message: 'Μήνυμα', namePlaceholder: 'Το όνομά σου', messagePlaceholder: 'Πες μου για την ιδέα, την πρόκληση ή τον στόχο σου...',
    send: 'Στείλε μήνυμα', sending: 'Αποστολή…', trust: ['Χωρίς spam.', 'Μόνο ουσιαστικές συζητήσεις.'],
    required: 'Συμπλήρωσε αυτό το πεδίο.', success: 'Ευχαριστώ. Το μήνυμά σου στάλθηκε. Θα επικοινωνήσω μαζί σου σύντομα.',
    failure: 'Το μήνυμα δεν στάλθηκε. Δοκίμασε ξανά ή συνέχισε μέσω email.',
    emailFallback: 'Συνέχισε μέσω email για να στείλεις το μήνυμά σου. Τα στοιχεία σου και το ενδιαφέρον που επέλεξες είναι έτοιμα στο προσχέδιο.', continueEmail: 'Συνέχεια μέσω email',
    location: 'Τοποθεσία', city: 'Αθήνα, Ελλάδα', remote: 'Διαθέσιμος για εξ αποστάσεως έργα σε όλο τον κόσμο',
    meeting: 'Προτιμάς μια συνάντηση;', meetingText: 'Ας βρούμε μια ώρα που σε εξυπηρετεί.', book: 'Κλείσε μια κλήση',
    quote: ['Κάθε ουσιαστικό έργο', 'ξεκινά με μια συζήτηση.'],
    nav: ['Αρχική', 'Έργα', 'Τομείς', 'Σκέψη', 'Σχετικά', 'Επικοινωνία'], footerNav: 'Πλοήγηση υποσέλιδου',
    rights: 'Με επιφύλαξη παντός δικαιώματος.', privacy: 'Πολιτική απορρήτου', terms: 'Όροι χρήσης', close: 'Κλείσιμο',
    pendingPolicy: 'Η πλήρης πολιτική απορρήτου θα δημοσιευτεί πριν από την τελική έναρξη λειτουργίας του website. Για ερωτήσεις σχετικά με το απόρρητο, επικοινώνησε στο info@eliaskalyvas.gr.',
    pendingTerms: 'Οι όροι χρήσης θα δημοσιευτούν πριν από την τελική έναρξη λειτουργίας του website. Για ερωτήσεις σχετικά με μια συνεργασία, επικοινώνησε στο info@eliaskalyvas.gr.',
    pendingSocial: 'Το επίσημο προφίλ θα συνδεθεί εδώ σύντομα. Μπορείς να επικοινωνήσεις με τον Ηλία στο LinkedIn ή μέσω email.',
  },
};

function ContactForm({ lang, interest }) {
  const t = copy[lang];
  const [status, setStatus] = useState('idle');
  const [draft, setDraft] = useState(null);
  const busy = useRef(false);
  const submit = async event => {
    event.preventDefault();
    if (busy.current) return;
    const form = event.currentTarget;
    for (const field of [form.elements.name, form.elements.message]) {
      field.setCustomValidity(field.value.trim() ? '' : t.required);
    }
    if (!form.reportValidity()) return;
    const data = new FormData(form);
    const payload = { name: data.get('name').trim(), email: data.get('email').trim(), message: data.get('message').trim(), interest, language: lang };
    setDraft(payload);
    if (!contactConfig.endpoint) { setStatus('email'); return; }
    busy.current = true;
    setStatus('loading');
    try {
      const result = await sendContactMessage(payload);
      setStatus(result.status);
      if (result.status === 'success') form.reset();
    } catch { setStatus('error'); }
    finally { busy.current = false; }
  };
  const edit = event => {
    event.target.setCustomValidity?.('');
    if (status !== 'loading') setStatus('idle');
  };
  return <form className="contact-form contact-reveal" onSubmit={submit} onInput={edit} aria-labelledby="contact-form-title" aria-busy={status === 'loading'}>
    <h3 id="contact-form-title">{t.formTitle}</h3><p className="contact-form-intro">{t.formText}</p>
    <fieldset disabled={status === 'loading'}>
      <input type="hidden" name="interest" value={interest} />
      <label htmlFor="contact-name">{t.name} <span aria-hidden="true">*</span></label>
      <input id="contact-name" name="name" autoComplete="name" placeholder={t.namePlaceholder} required maxLength={120} />
      <label htmlFor="contact-email">{t.email} <span aria-hidden="true">*</span></label>
      <input id="contact-email" name="email" type="email" autoComplete="email" placeholder="your@email.com" required maxLength={254} />
      <label htmlFor="contact-message">{t.message} <span aria-hidden="true">*</span></label>
      <textarea id="contact-message" name="message" placeholder={t.messagePlaceholder} required maxLength={6000} rows={3} />
      <div className="contact-form-actions"><button type="submit" disabled={status === 'loading'}>{status === 'loading' ? t.sending : t.send}<span aria-hidden="true">⟶</span></button><p>{t.trust.map(line => <span key={line}>{line}</span>)}</p></div>
    </fieldset>
    <div className="contact-form-status" role="status" aria-live="polite" aria-atomic="true">
      {status === 'success' && <p>{t.success}</p>}
      {status === 'error' && <p>{t.failure} <a href={contactEmailHref({ ...draft, interest })}>{t.continueEmail} ⟶</a></p>}
      {status === 'email' && <p>{t.emailFallback} <a href={contactEmailHref({ ...draft, interest })}>{t.continueEmail} ⟶</a></p>}
    </div>
  </form>;
}

function SocialIcon({ kind }) {
  return <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    {kind === 'LinkedIn' && <><path d="M4.7 3.4a1.8 1.8 0 1 0 0 3.6 1.8 1.8 0 0 0 0-3.6M3.1 8.5h3.2V21H3.1zM9 8.5h3.1v1.7c.7-1.1 1.9-2 3.7-2 3.2 0 4.2 2.1 4.2 5.2V21h-3.2v-6.7c0-1.6-.3-3-2.1-3s-2.5 1.2-2.5 3V21H9z" /></>}
    {kind === 'YouTube' && <path d="M21.6 7.2a2.7 2.7 0 0 0-1.9-1.9C18 4.8 12 4.8 12 4.8s-6 0-7.7.5a2.7 2.7 0 0 0-1.9 1.9A28 28 0 0 0 2 12a28 28 0 0 0 .4 4.8 2.7 2.7 0 0 0 1.9 1.9c1.7.5 7.7.5 7.7.5s6 0 7.7-.5a2.7 2.7 0 0 0 1.9-1.9A28 28 0 0 0 22 12a28 28 0 0 0-.4-4.8M10 15.5v-7l6 3.5z" />}
    {kind === 'Instagram' && <><rect x="3" y="3" width="18" height="18" rx="5" fill="none" stroke="currentColor" strokeWidth="1.7" /><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" strokeWidth="1.7" /><circle cx="17.5" cy="6.6" r="1" /></>}
  </svg>;
}

function FooterNotice({ notice, close, lang }) {
  const ref = useRef(null); const t = copy[lang];
  useEffect(() => {
    const dialog = ref.current;
    const previousFocus = document.activeElement;
    dialog.showModal();
    return () => { dialog.close(); previousFocus?.focus(); };
  }, []);
  return <dialog className="contact-notice" ref={ref} aria-labelledby="contact-notice-title" onCancel={event => { event.preventDefault(); close(); }} onClick={event => { if (event.target === event.currentTarget) close(); }}>
    <div><button className="contact-notice-close" type="button" onClick={close} aria-label={t.close}>×</button>
      <h2 id="contact-notice-title">{notice.title}</h2><p>{notice.text}</p>
      <a href={notice.social ? contactConfig.linkedInUrl : 'mailto:info@eliaskalyvas.gr'}>{notice.social ? 'LinkedIn' : 'info@eliaskalyvas.gr'} ⟶</a>
    </div>
  </dialog>;
}

function SiteFooter({ lang, base }) {
  const t = copy[lang]; const [notice, setNotice] = useState(null);
  const targets = ['#top', '#selected-work', '#areas', '#thinking', '#thinking', '#contact'];
  const socials = [['LinkedIn', contactConfig.linkedInUrl], ['YouTube', contactConfig.youtubeUrl], ['Instagram', contactConfig.instagramUrl]];
  return <footer className="contact-site-footer" role="contentinfo">
    <div className="contact-footer-main">
      <BrandLockup base={base} lang={lang} />
      <nav aria-label={t.footerNav}>{t.nav.map((label, index) => <a key={label} href={targets[index]}>{label}</a>)}</nav>
      <div className="contact-socials">{socials.map(([label, href]) => href ? <a href={href} key={label} aria-label={label} target="_blank" rel="noopener noreferrer"><SocialIcon kind={label} /></a> : <button key={label} type="button" aria-label={`${label} — ${lang === 'el' ? 'σύντομα' : 'coming soon'}`} onClick={() => setNotice({ title: label, text: t.pendingSocial, social: true })}><SocialIcon kind={label} /></button>)}</div>
      <p className="contact-footer-purpose" aria-hidden="true"><span>BUILDING</span><span>A BRIGHTER</span><span>TOMORROW</span><i /></p>
    </div>
    <div className="contact-footer-baseline"><p className="contact-footer-domains">PEOPLE <b>/</b> BUSINESS <b>/</b> AI &amp; SYSTEMS</p>
      <p className="contact-copyright">© 2026 Elias Kalyvas. {t.rights}</p>
      <div className="contact-legal">{[['privacy', contactConfig.privacyUrl, t.pendingPolicy], ['terms', contactConfig.termsUrl, t.pendingTerms]].map(([key, href, text]) => href ? <a href={href} key={key}>{t[key]}</a> : <button type="button" key={key} onClick={() => setNotice({ title: t[key], text })}>{t[key]}</button>)}</div>
    </div>
    {notice && <FooterNotice notice={notice} lang={lang} close={() => setNotice(null)} />}
  </footer>;
}

export default function ContactSection({ lang, base }) {
  const t = copy[lang]; const ref = useRef(null); const [interest, setInterest] = useState('');
  const image = file => `${base}assets/contact/${file}`;
  useEffect(() => {
    const section = ref.current;
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) { entry.target.classList.add('is-visible'); observer.unobserve(entry.target); }
    }), { threshold: .1 });
    section.querySelectorAll('.contact-reveal').forEach(element => observer.observe(element));
    section.classList.add('is-motion-ready');
    if (window.location.hash === '#contact') section.scrollIntoView({ behavior: 'instant' });
    return () => observer.disconnect();
  }, []);
  return <section className="contact-section" id="contact" ref={ref} aria-labelledby="contact-title">
    <div className="contact-landscape" aria-hidden="true"><img src={image('bay-sunrise.webp')} alt="" loading="lazy" decoding="async" width="1672" height="941" /></div>
    <SectionSidebar activeIndex={7} /><span className="contact-vertical-label" aria-hidden="true">CONTACT</span>
    <div className="contact-inner">
      <div className="contact-main">
        <div className="contact-intro contact-reveal"><div className="contact-eyebrow"><span>07</span><i aria-hidden="true" /><span>{t.label}</span></div>
          <h2 id="contact-title"><span>{t.headline[0]}</span><span>{t.headline[1]}</span></h2>
          <p>{t.intro.map(line => <span key={line}>{line} </span>)}</p>
        </div>
        <div className="contact-image-labels" aria-hidden="true"><p className="contact-tomorrow">{['A', 'BRIGHTER', 'TOMORROW', 'BUILDS', 'TODAY.'].map(line => <span key={line}>{line}</span>)}</p><p className="contact-right-taxonomy">{['IDEAS', 'PEOPLE', 'BUSINESS', 'TECHNOLOGY', 'REAL IMPACT'].map(line => <span key={line}>{line}</span>)}<i /></p></div>
        <div className="contact-intents contact-reveal"><h3 id="contact-needs">{t.needs}</h3><p>{t.needsText}</p>
          <div className="contact-intent-grid" role="group" aria-labelledby="contact-needs">{intents.map(intent => <button type="button" className={`contact-intent${interest === intent.value ? ' is-selected' : ''}`} key={intent.value} aria-pressed={interest === intent.value} onClick={() => setInterest(intent.value)}>
            <img src={image(intent.image)} alt="" loading="lazy" width="160" height="160" />
            <span className="contact-intent-title">{lang === 'en' ? intent.titleLines.map(line => <span key={line}>{line} </span>) : intent[lang][0]}</span><span className="contact-intent-text">{intent[lang][1]}</span>
          </button>)}</div>
        </div>
        <ContactForm lang={lang} interest={interest} />
      </div>
      <div className="contact-information contact-reveal">
        <div className="contact-info-block"><img src={image('email.webp')} alt="" loading="lazy" width="160" height="160" /><div><h3>{t.email}</h3><a href="mailto:info@eliaskalyvas.gr">info@eliaskalyvas.gr</a></div></div>
        <div className="contact-info-block"><img src={image('location.webp')} alt="" loading="lazy" width="160" height="160" /><div><h3>{t.location}</h3><p>{t.city}</p><small>{t.remote}</small></div></div>
        <div className="contact-info-block"><img src={image('icon-calendar.webp')} alt="" loading="lazy" width="160" height="160" /><div><h3>{t.meeting}</h3><p>{t.meetingText}</p><a className="contact-meeting-link" href={contactConfig.meetingUrl} target="_blank" rel="noopener noreferrer">{t.book}<span aria-hidden="true">⟶</span></a></div></div>
        <blockquote className="contact-quote"><span className="contact-quote-mark" aria-hidden="true">“</span><p>{t.quote.map((line, index) => <span key={line}>{line}{index === 1 ? '”' : ' '}</span>)}</p><cite><i aria-hidden="true" />ELIAS KALYVAS</cite></blockquote>
      </div>
      <SiteFooter lang={lang} base={base} />
    </div>
  </section>;
}

import React from 'react';
import './business.css';

const assetNames = {
  architecture: 'assets/business/business-architecture.png',
  consulting: 'assets/business/business-consulting.png',
  development: 'assets/business/business-development.png',
  processes: 'assets/business/processes-systems.png',
  strategy: 'assets/business/strategy-planning.png',
};

const translations = {
  en: {
    eyebrow: '03 — BUSINESS',
    headline: ['Turn', 'complexity', 'into clarity.'],
    paragraph: 'I help businesses define direction, improve operations and create the conditions for sustainable growth.',
    explore: 'EXPLORE BUSINESS SOLUTIONS',
    stages: ['THE RIGHT FOUNDATION', 'SCALABLE OPERATIONS', 'SUSTAINABLE GROWTH'],
    quote: 'Clarity turns challenges into opportunities.',
    cards: [
      {
        key: 'consulting',
        title: 'Business Consulting',
        description: 'From insight to action. Practical, measurable results.',
        metric: '+27%',
        metricLabel: 'SQLs in 60 days',
      },
      {
        key: 'development',
        title: 'Business Development',
        description: 'New opportunities. Stronger pipeline. Real growth.',
        metric: '−18%',
        metricLabel: 'Sales cycle',
      },
      {
        key: 'processes',
        title: 'Processes & Systems',
        description: 'Simpler. Clearer. More effective.',
        metric: '100+',
        metricLabel: 'Leaders supported',
      },
      {
        key: 'strategy',
        title: 'Strategy & Planning',
        description: 'A clear path for what comes next.',
        metric: '€500K+',
        metricLabel: 'Deals supported',
      },
    ],
  },
  el: {
    eyebrow: '03 — ΕΠΙΧΕΙΡΗΣΕΙΣ',
    headline: ['Μετατρέπω', 'την πολυπλοκότητα', 'σε σαφήνεια.'],
    paragraph: 'Βοηθώ επιχειρήσεις να ορίζουν κατεύθυνση, να βελτιώνουν τη λειτουργία τους και να δημιουργούν τις συνθήκες για βιώσιμη ανάπτυξη.',
    explore: 'ΑΝΑΚΑΛΥΨΕ BUSINESS SOLUTIONS',
    stages: ['ΣΩΣΤΗ ΒΑΣΗ', 'ΚΛΙΜΑΚΩΣΙΜΗ ΛΕΙΤΟΥΡΓΙΑ', 'ΒΙΩΣΙΜΗ ΑΝΑΠΤΥΞΗ'],
    quote: 'Η σαφήνεια μετατρέπει τις προκλήσεις σε ευκαιρίες.',
    cards: [
      {
        key: 'consulting',
        title: 'Business Consulting',
        description: 'Από τη διορατικότητα στην πράξη. Πρακτικά, μετρήσιμα αποτελέσματα.',
        metric: '+27%',
        metricLabel: 'SQLs σε 60 ημέρες',
      },
      {
        key: 'development',
        title: 'Business Development',
        description: 'Νέες ευκαιρίες. Ισχυρότερο pipeline. Πραγματική ανάπτυξη.',
        metric: '−18%',
        metricLabel: 'Sales cycle',
      },
      {
        key: 'processes',
        title: 'Processes & Systems',
        description: 'Απλούστερα. Καθαρότερα. Πιο αποτελεσματικά.',
        metric: '100+',
        metricLabel: 'Leaders supported',
      },
      {
        key: 'strategy',
        title: 'Strategy & Planning',
        description: 'Καθαρή πορεία για το επόμενο βήμα.',
        metric: '€500K+',
        metricLabel: 'Deals supported',
      },
    ],
  },
};

function OptionalAsset({ src, className }) {
  return <img
    className={className}
    src={src}
    alt=""
    loading="lazy"
    decoding="async"
    onError={event => { event.currentTarget.style.display = 'none'; }}
  />;
}

function ArchitectureFallback() {
  return <svg className="business-architecture-svg" viewBox="0 0 930 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
    <defs>
      <linearGradient id="businessPath" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#4d6d87" stopOpacity=".12" />
        <stop offset="48%" stopColor="#9bc7e8" stopOpacity=".72" />
        <stop offset="100%" stopColor="#f0f8ff" stopOpacity=".92" />
      </linearGradient>
      <radialGradient id="businessNode" cx=".5" cy=".5" r=".5">
        <stop offset="0%" stopColor="#eaf7ff" stopOpacity=".96" />
        <stop offset="45%" stopColor="#92c8ef" stopOpacity=".54" />
        <stop offset="100%" stopColor="#4d78a0" stopOpacity="0" />
      </radialGradient>
      <filter id="businessGlow" x="-200%" y="-200%" width="500%" height="500%">
        <feGaussianBlur stdDeviation="8" />
      </filter>
    </defs>

    <g className="business-grid-lines">
      {Array.from({ length: 13 }, (_, index) => <line key={`h-${index}`} x1="55" x2="905" y1={115 + index * 42} y2={115 + index * 42} />)}
      {Array.from({ length: 17 }, (_, index) => <line key={`v-${index}`} y1="74" y2="655" x1={60 + index * 54} x2={60 + index * 54} />)}
    </g>

    <g className="business-chaos">
      <path d="M82 505 L148 435 L185 493 L235 383 L286 442 L326 342" />
      <path d="M78 396 L126 359 L169 401 L219 310 L267 354 L307 285" />
      <path d="M108 568 L164 526 L214 566 L257 487 L311 518" />
      {[ [82,505],[148,435],[185,493],[235,383],[286,442],[326,342],[78,396],[169,401],[219,310],[267,354],[307,285],[108,568],[214,566],[311,518] ].map(([cx, cy], i) =>
        <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 4 : 2.5} />
      )}
    </g>

    <g className="business-paths">
      <path id="business-route-a" d="M286 441 C390 405 405 319 498 307 S647 304 712 235 S816 188 874 171" />
      <path id="business-route-b" d="M310 519 C409 510 457 443 526 421 S666 399 736 338 S827 306 880 297" />
      <path id="business-route-c" d="M267 354 C362 331 416 270 514 247 S661 215 723 189" />
      <path className="business-path-soft" d="M214 566 C340 621 487 598 594 531 S761 456 879 441" />
    </g>

    <g className="business-plates">
      <polygon points="446,345 567,302 651,343 529,389" />
      <polygon points="568,280 685,239 767,279 649,323" />
      <polygon points="684,209 790,172 858,204 751,242" />
      <line x1="528" y1="389" x2="528" y2="434" />
      <line x1="650" y1="323" x2="650" y2="369" />
      <line x1="751" y1="242" x2="751" y2="288" />
    </g>

    <g className="business-node-glow">
      {[ [499,307],[526,421],[647,304],[736,338],[712,235],[790,172],[879,441] ].map(([cx, cy], i) =>
        <React.Fragment key={i}>
          <circle cx={cx} cy={cy} r="28" fill="url(#businessNode)" filter="url(#businessGlow)" />
          <circle cx={cx} cy={cy} r="3.2" />
        </React.Fragment>
      )}
    </g>

    <g className="business-pulses">
      <circle r="4"><animateMotion dur="6.8s" repeatCount="indefinite"><mpath href="#business-route-a" /></animateMotion></circle>
      <circle r="3.5"><animateMotion dur="8.4s" begin="-2.8s" repeatCount="indefinite"><mpath href="#business-route-b" /></animateMotion></circle>
      <circle r="3.2"><animateMotion dur="7.5s" begin="-4.2s" repeatCount="indefinite"><mpath href="#business-route-c" /></animateMotion></circle>
    </g>
  </svg>;
}

function BusinessArchitecture({ copy, base }) {
  return <div className="business-architecture">
    <ArchitectureFallback />
    <OptionalAsset src={`${base}${assetNames.architecture}`} className="business-architecture-image" />
    <div className="business-architecture-vignette" aria-hidden="true" />
    <div className="business-stage business-stage-foundation"><i />{copy.stages[0]}</div>
    <div className="business-stage business-stage-operations"><i />{copy.stages[1]}</div>
    <div className="business-stage business-stage-growth"><i />{copy.stages[2]}</div>
    <blockquote className="business-quote"><p>“{copy.quote}”</p><cite>ELIAS KALYVAS</cite></blockquote>
  </div>;
}

function ConsultingArt() {
  return <svg viewBox="0 0 420 230" aria-hidden="true">
    <path d="M18 184 C90 147 131 194 196 133 S305 122 401 42" />
    <path d="M28 55 L91 87 L138 48 L196 91 L252 62 L313 95 L382 60" />
    {[ [28,55],[91,87],[138,48],[196,91],[252,62],[313,95],[382,60],[196,133],[401,42] ].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r={i===8?5:3}/>)}
  </svg>;
}

function DevelopmentArt() {
  return <svg viewBox="0 0 420 230" aria-hidden="true">
    <line x1="22" y1="196" x2="402" y2="196" />
    {[70,122,174,226,278].map((x,i)=><rect key={x} x={x} y={168-i*24} width="24" height={28+i*24} rx="2" />)}
    <path d="M41 173 C111 167 131 149 187 126 S280 94 360 45" />
    {[ [41,173],[187,126],[360,45] ].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r="4"/>)}
  </svg>;
}

function ProcessesArt() {
  return <svg viewBox="0 0 420 230" aria-hidden="true">
    {[53,105,157].map(y=><line key={y} x1="38" y1={y} x2="379" y2={y}/>)}
    {[78,151,224,297,370].map((x,i)=><circle key={x} cx={x} cy={i%2?105:53} r="8"/>)}
    <path d="M78 53 L151 105 L224 53 L297 105 L370 53" />
    <rect x="100" y="180" width="220" height="12" rx="6" />
    <rect x="100" y="180" width="151" height="12" rx="6" className="business-card-progress" />
  </svg>;
}

function StrategyArt() {
  return <svg viewBox="0 0 420 230" aria-hidden="true">
    <path d="M29 184 C88 184 102 125 154 125 S214 77 271 78 S329 45 391 42" />
    {[ [29,184],[154,125],[271,78],[391,42] ].map(([cx,cy],i)=><circle key={i} cx={cx} cy={cy} r={i===3?8:5}/>)}
    <path d="M72 199 L72 166 M199 145 L199 111 M328 95 L328 60" />
  </svg>;
}

const fallbackArts = [ConsultingArt, DevelopmentArt, ProcessesArt, StrategyArt];

function BusinessCard({ card, index, base }) {
  const FallbackArt = fallbackArts[index];
  return <article className={`business-card business-card-${index + 1}`}>
    <div className="business-card-visual">
      <div className="business-card-fallback"><FallbackArt /></div>
      <OptionalAsset src={`${base}${assetNames[card.key]}`} className="business-card-image" />
      <span className="business-card-number">0{index + 1}</span>
    </div>
    <div className="business-card-body">
      <div>
        <h3>{card.title}</h3>
        <p>{card.description}</p>
      </div>
      <div className="business-card-metric"><strong>{card.metric}</strong><span>{card.metricLabel}</span></div>
    </div>
  </article>;
}

export default function BusinessSection({ lang, base }) {
  const copy = translations[lang] || translations.en;
  return <section className="business-section" id="business" aria-labelledby="business-heading">
    <div className="business-inner">
      <div className="business-main">
        <div className="business-content">
          <div className="business-eyebrow"><span />{copy.eyebrow}</div>
          <h2 id="business-heading">
            {copy.headline.map((line, index) => <span key={line} className={index === copy.headline.length - 1 ? 'business-headline-accent' : ''}>{line}</span>)}
          </h2>
          <p className="business-intro">{copy.paragraph}</p>
          <a href="#business-cards" className="business-explore"><span className="business-explore-icon" aria-hidden="true">▸</span><span>{copy.explore}</span><i /></a>
        </div>
        <BusinessArchitecture copy={copy} base={base} />
      </div>

      <div className="business-cards-grid" id="business-cards">
        {copy.cards.map((card, index) => <BusinessCard key={card.key} card={card} index={index} base={base} />)}
      </div>
    </div>
  </section>;
}

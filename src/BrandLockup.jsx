import React from 'react';

export default function BrandLockup({ base, lang }) {
  return <a className="brand" href="#top" aria-label={lang === 'el' ? 'Ηλίας Καλύβας — Αρχική' : 'Elias Kalyvas — Home'}>
    <img className="brand-mark" src={`${base}assets/brand/ek-mark.png`} alt="" />
    <span className="brand-name">ELIAS KALYVAS<small>IDEAS INTO REALITY</small></span>
  </a>;
}

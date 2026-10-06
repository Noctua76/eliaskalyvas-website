import React from 'react';
import {createRoot} from 'react-dom/client';
import Booking from './Booking.jsx';
import Admin from './Admin.jsx';
import '../styles.css';
import './operations.css';
import LegalControls from '../legal/LegalControls.jsx';
const lang=document.documentElement.lang==='el'?'el':'en';
const base=import.meta.env.BASE_URL;
const admin=location.pathname.replace(/\/$/,'').endsWith('/admin');
const home=`${base}${lang==='el'?'gr':'en'}/`;
createRoot(document.getElementById('root')).render(<div className="ops-page">
 <header className="ops-header"><a className="brand" href={home}><img className="brand-mark" src={`${base}assets/brand/ek-mark.png`} alt=""/><span className="brand-name">ELIAS KALYVAS<small>IDEAS INTO REALITY</small></span></a><div><a href={`${base}en/${admin?'admin':'book'}/`}>EN</a><span> / </span><a href={`${base}gr/${admin?'admin':'book'}/`}>GR</a></div></header>
 <main className="ops-main">{admin?<Admin lang={lang}/>:<Booking lang={lang}/>}</main>
 <footer className="ops-footer"><span>© 2026 Elias Kalyvas</span><a href={home+'#contact'}>{lang==='el'?'Επιστροφή στην επικοινωνία':'Back to contact'} ⟶</a><span>PEOPLE / BUSINESS / AI &amp; SYSTEMS</span>{!admin && <LegalControls lang={lang} base={base}/>}</footer>
</div>);

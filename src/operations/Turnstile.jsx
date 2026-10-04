import React,{useEffect,useRef,useState} from 'react';
import {operationsConfig} from './config.js';
let loader;
function load(){if(window.turnstile)return Promise.resolve(window.turnstile);if(!loader)loader=new Promise((resolve,reject)=>{const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.onload=()=>resolve(window.turnstile);script.onerror=()=>{loader=null;reject(new Error('VERIFICATION_UNAVAILABLE'));};document.head.append(script);});return loader;}
export default function Turnstile({action,onToken,reset=0,lang='en'}) {
 const container=useRef(null),callback=useRef(onToken);callback.current=onToken;
 const [error,setError]=useState(false);
 useEffect(()=>{let cancelled=false,id;setError(false);callback.current('');if(operationsConfig.turnstileKey)load().then(api=>{if(cancelled)return;id=api.render(container.current,{sitekey:operationsConfig.turnstileKey,action,theme:'dark',size:'flexible',language:lang==='el'?'el':'en',callback:token=>{setError(false);callback.current(token);},'expired-callback':()=>callback.current(''),'error-callback':()=>{callback.current('');setError(true);}});}).catch(()=>setError(true));return()=>{cancelled=true;if(id!==undefined)window.turnstile?.remove(id);};},[action,reset,lang]);
 if(!operationsConfig.turnstileKey)return <p className="ops-error" role="status">{lang==='el'?'Η προστασία υποβολών δεν έχει συνδεθεί ακόμη.':'Submission protection is awaiting configuration.'}</p>;
 return <div className="ops-verification"><div ref={container}/>{error&&<p role="alert">{lang==='el'?'Η επαλήθευση δεν είναι διαθέσιμη. Δοκίμασε ξανά.':'Verification is unavailable. Please try again.'}</p>}</div>;
}

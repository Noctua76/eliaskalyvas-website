import React from 'react';
import {createRoot} from 'react-dom/client';
import SignalsApp from './SignalsApp.jsx';
import {routeFromPath} from './model.mjs';
const base=import.meta.env.BASE_URL;
const route=routeFromPath(location.pathname,base)||{lang:document.documentElement.lang==='el'?'el':'en',slug:''};
const preview=new URLSearchParams(location.search).get('preview')==='1';
createRoot(document.getElementById('root')).render(<SignalsApp {...route} base={base} preview={preview}/>);

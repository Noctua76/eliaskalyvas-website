import React from 'react';
import {createRoot,hydrateRoot} from 'react-dom/client';
import SignalsApp from './SignalsApp.jsx';
import {routeFromPath} from './model.mjs';
const base=import.meta.env.BASE_URL;
const route=routeFromPath(location.pathname,base)||{lang:document.documentElement.lang==='el'?'el':'en',slug:''};
const preview=new URLSearchParams(location.search).get('preview')==='1';
if(preview){
 document.querySelector('meta[name=robots]')?.setAttribute('content','noindex,follow');
 document.querySelectorAll('link[rel=canonical],link[hreflang],meta[property^="og:"],meta[name^="twitter:"],script[type="application/ld+json"]').forEach(node=>node.remove());
}
const embedded=document.getElementById('signals-public-data');
const publicArticles=embedded?JSON.parse(embedded.textContent):[];
const app=<SignalsApp {...route} base={base} preview={preview} publicArticles={publicArticles}/>;
const root=document.getElementById('root');
if(!preview&&embedded)hydrateRoot(root,app);else createRoot(root).render(app);

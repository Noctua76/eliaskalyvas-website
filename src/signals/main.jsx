import React from 'react';
import {createRoot,hydrateRoot} from 'react-dom/client';
import SignalsApp from './SignalsApp.jsx';
import {routeFromPath} from './model.mjs';
const base=import.meta.env.BASE_URL;
const route=routeFromPath(location.pathname,base)||{lang:document.documentElement.lang==='el'?'el':'en',slug:''};
const preview=route.preview===true;
if(!preview&&new URLSearchParams(location.search).get('preview')==='1'){
 // Legacy query has ordinary public initial HTML. Navigation is client-only.
 const target=new URL(location.href);target.pathname=target.pathname.replace('/signals/','/signals-preview/');target.searchParams.delete('preview');location.replace(target.href);
}
const embedded=document.getElementById('signals-public-data');
const publicArticles=embedded?JSON.parse(embedded.textContent):[];
const app=<SignalsApp {...route} base={base} preview={preview} publicArticles={publicArticles}/>;
const root=document.getElementById('root');
if(!preview&&embedded)hydrateRoot(root,app);else createRoot(root).render(app);

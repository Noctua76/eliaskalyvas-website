// Build-only capability. There is intentionally NO production dataset loader or env switch.
import {readFile,mkdtemp,rm} from 'node:fs/promises';
import {resolve} from 'node:path';
import {tmpdir} from 'node:os';
// Load the React server renderer before Vite adjusts NODE_ENV during programmatic builds.
// This keeps a single matching React/renderer instance in test and CLI processes.
import 'react-dom/server';
import {createServer,build} from 'vite';
import {validatePublicationSet} from '../publication/contract.mjs';
import {packageAssets} from './assets.mjs';
import {publicationMetadata,publicationSitemap,safeJSON} from './seo.mjs';
import {publicViews} from '../../src/signals/public-view.mjs';
import {signalsEntryPaths} from '../../src/signals/entries.mjs';
const root=resolve(import.meta.dirname,'../..'),plans=new WeakSet();
const route=(locale,slug='')=>`${locale==='el'?'gr':'en'}/signals/${slug?slug+'/':''}index.html`;
export async function prepareSyntheticPublication({dataset,assetRoot,rightsDecisions,now}){
 const snapshot=structuredClone(dataset);validatePublicationSet(snapshot,{now});
 for(const r of snapshot.releases)if(signalsEntryPaths.includes(route(r.locale,r.slug)))throw Error('RESERVED_DEMO_ROUTE');
 const files=await packageAssets(snapshot,{assetRoot,rightsDecisions});
 const plan={dataset:snapshot,files};plans.add(plan);return plan;
}
function section(html,name,value,initial){
 const start=`<!-- SIGNALS_${name}_START -->`,end=`<!-- SIGNALS_${name}_END -->`;
 const a=html.indexOf(start),b=html.indexOf(end);
 if(a>=0&&b>a)return html.slice(0,a)+start+value+end+html.slice(b+end.length);
 if(!html.includes(initial))throw Error('MISSING_SIGNALS_TEMPLATE_'+name);
 return html.replace(initial,()=>start+value+end);
}
export function signalsStaticPlugin(){return plugin(null);}
function plugin(plan){
 if(plan&&!plans.has(plan))throw Error('UNTRUSTED_BUILD_PLAN');
 const dataset=plan?.dataset||{releases:[]},views=publicViews(dataset);let render,base='/';
 function fill(html,locale,slug='',preview=false){
  const release=!preview&&dataset.releases.find(r=>r.locale===locale&&r.slug===slug)||null;
  const demo=!!slug&&!release;
  const publicArticles=(demo||preview)?[]:views.filter(a=>a.lang===locale);
  const props={lang:locale,slug,base,preview,publicArticles};
  html=section(html,'HEAD',publicationMetadata({locale,release,dataset:(demo||preview)?{releases:[]}:dataset}),'<!-- SIGNALS_META -->');
  html=section(html,'ROOT',`<div id="root">${render(props)}</div>`,'<div id="root"></div>');
  if(!html.includes('<!-- SIGNALS_DATA_START -->'))html=html.replace('</body>','<!-- SIGNALS_DATA -->\n</body>');
  return section(html,'DATA',`<script id="signals-public-data" type="application/json">${safeJSON(publicArticles)}</script>`,'<!-- SIGNALS_DATA -->');
 }
 return {name:'signals-static-publication',enforce:'post',apply:'build',
  configResolved(config){base=config.base;},
  async buildStart(){
   // Config-free SSR transformer; never starts an HTTP listener or loads fixture data.
   const server=await createServer({root,configFile:false,optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true,hmr:false},appType:'custom'});
   try{({renderSignals:render}=await server.ssrLoadModule('/src/signals/entry-server.jsx'));}finally{await server.close();}
  },
  transformIndexHtml:{order:'pre',handler(html,ctx){const m=ctx.filename.replaceAll('\\','/').match(/\/(gr|en)\/(signals|signals-preview)\/(?:([a-z0-9-]+)\/)?index\.html$/);return m?fill(html,m[1]==='gr'?'el':'en',m[3]||'',m[2]==='signals-preview'):html;}},
  generateBundle:{order:'post',async handler(_options,bundle){
   if(!plan)return;
   for(const r of dataset.releases){const template=bundle[route(r.locale)];if(!template||template.type!=='asset')throw Error('MISSING_SIGNALS_LISTING');this.emitFile({type:'asset',fileName:route(r.locale,r.slug),source:fill(String(template.source),r.locale,r.slug)});}
   for(const [fileName,source]of plan.files)this.emitFile({type:'asset',fileName,source});
   this.emitFile({type:'asset',fileName:'sitemap.xml',source:publicationSitemap(await readFile(resolve(root,'public/sitemap.xml'),'utf8'),dataset)});
  }}
 };
}
// Only callable from local tests. No CLI/env/file input path is wired into npm run build.
export async function buildSyntheticPublication(options){
 const plan=await prepareSyntheticPublication(options);
 // Reconstruct from a validated clone so the caller cannot mutate a plan during build.
 const outDir=await mkdtemp(resolve(tmpdir(),'nyra-synthetic-'));
 const {default:normal}=await import('../../vite.config.js');
 try{
  await build({...normal,root,base:'/',configFile:false,plugins:normal.plugins.filter(p=>p.name!=='signals-static-publication').concat(plugin(plan)),build:{...normal.build,outDir,emptyOutDir:true},logLevel:'error'});
  return outDir;
 }catch(e){await rm(outDir,{recursive:true,force:true});throw e;}
}

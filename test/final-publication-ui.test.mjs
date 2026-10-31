import test from 'node:test';
import assert from 'node:assert/strict';
import React,{act} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {JSDOM} from 'jsdom';
import Review from '../src/operations/NyraPublicationReview.mjs';
import {releaseFixture,uid} from './fixtures/publication-v1.1.mjs';
const require=createRequire(import.meta.url);
async function panel(){const dir=await mkdtemp(join(tmpdir(),'nyra-final-ui-')),file=join(dir,'panel.mjs');const result=await build({entryPoints:[new URL('../src/operations/NyraFinalPublication.jsx',import.meta.url).pathname],bundle:true,platform:'node',format:'esm',write:false,plugins:[{name:'same-react',setup(b){b.onResolve({filter:/^react$/},()=>({path:require.resolve('react'),external:true}));}}]});await writeFile(file,result.outputFiles[0].text);return {Panel:(await import(pathToFileURL(file))).default,close:()=>rm(dir,{recursive:true,force:true})};}
const props=()=>({gr:true,work:{id:uid(1)},draft:{run:{id:uid(2)},assignment:{language:'gr'},article:{title:'Exact <owner> title',summary:'Exact summary',paragraphs:[{text:'Exact text',source_urls:['https://www.oecd.org/'],evidence_ids:[]}]},presentation:{revision:1,cover:{}}},index:0,call:async()=>{},onEdited:()=>{},onSavePresentation:async()=>{},upload:async()=>{},assetPreview:async()=>{throw Error('must remain private');}});
test('Owner UI renders editable exact text and a single final action without executable HTML or credential fields',async()=>{
 const p=await panel();try{const html=renderToStaticMarkup(React.createElement(p.Panel,props()));assert(html.includes('Exact &lt;owner&gt; title'));assert(!html.includes('service_role'));assert(!html.includes('OPENAI_API_KEY'));const release=releaseFixture(),view=renderToStaticMarkup(React.createElement(Review,{preview:{preview_id:uid(4),action:'publish',release},publicationAction:true,imageURL:'blob:unit-private-image',onAuthorize:()=>{throw Error('SSR must not authorize');}}));assert(view.includes('blob:unit-private-image'));assert.equal((view.match(/<button /g)||[]).length,1);assert(!view.includes('released_verified'));}finally{await p.close();}
});
test('Switching work during a delayed preview cannot display or approve the previous work',async()=>{
 const p=await panel(),dom=new JSDOM('<div id="root"></div>',{url:'https://unit.invalid'}),old={window:globalThis.window,document:globalThis.document,IS_REACT_ACT_ENVIRONMENT:globalThis.IS_REACT_ACT_ENVIRONMENT};let root,resolvePreview;
 try{globalThis.window=dom.window;globalThis.document=dom.window.document;globalThis.IS_REACT_ACT_ENVIRONMENT=true;const {createRoot}=await import('react-dom/client');root=createRoot(document.getElementById('root'));const a=props();a.call=async path=>path.endsWith('/catalog')?{assets:[],articles:[],history:[],associated_article_ids:[],verified_live_manifest:null}:new Promise(resolve=>resolvePreview=resolve);
  await act(async()=>root.render(React.createElement(p.Panel,{...a,key:a.work.id})));
  const click=async text=>act(async()=>{[...document.querySelectorAll('button')].find(b=>b.textContent.includes(text)).click();});
  await click('Ανανέωση');await click('Ακριβής προεπισκόπηση');assert(resolvePreview);
  const b=props();b.work={id:uid(8)};b.draft={...b.draft,run:{id:uid(9)}};await act(async()=>root.render(React.createElement(p.Panel,{...b,key:b.work.id})));
  await act(async()=>resolvePreview({preview_id:uid(7),action:'withdraw',release:null,withdrawal:{article_id:uid(1)}}));assert(!document.body.textContent.includes('Τελική έγκριση'));
 }finally{await act(async()=>root?.unmount());Object.assign(globalThis,old);dom.window.close();await p.close();}
});

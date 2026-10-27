// Purely synthetic assets/approvals. Never imported by normal build or client code.
import sharp from 'sharp';
import {mkdir,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {hashJSON} from '../../lib/publication/contract.mjs';
import {releaseFixture,sealFixture,dataset,uid,NOW} from './publication-v1.1.mjs';
export async function staticFixture(){
 const root=await mkdtemp(join(tmpdir(),'signals-assets-'));
 const bytes=await sharp({create:{width:1200,height:800,channels:3,background:{r:25,g:65,b:75}}}).png().toBuffer();
 const sha=createHash('sha256').update(bytes).digest('hex'),assetPath=`assets/signals/${sha}.png`;
 await mkdir(join(root,'assets/signals'),{recursive:true});await writeFile(join(root,assetPath),bytes);
 const make=(locale,offset)=>{
  const r=releaseFixture({locale,offset});r.slug=locale==='el'?'phase3-synthetic-gr':'phase3-synthetic-en';r.canonical_url=`https://eliaskalyvas.gr/${locale==='el'?'gr':'en'}/signals/${r.slug}/`;
  r.content.title=locale==='el'?'SYNTHETIC_PHASE3_PUBLIC_TEST — Άνθρωποι και AI':'SYNTHETIC_PHASE3_PUBLIC_TEST — People and AI';
  r.content.summary='Synthetic public summary for isolated rendering tests only.';
  r.content.sources=[{id:'s1',title:'Synthetic first reference',url:'https://www.oecd.org/?a=1&b=2'},{id:'s2',title:'Synthetic second reference',url:'https://www.unesco.org/'}];
  r.content.blocks=[{type:'paragraph',text:'Exact synthetic paragraph.\nSecond approved line.',source_ids:['s1','s2']},{type:'heading',level:2,text:'Exact synthetic heading'},{type:'quote',text:'Exact synthetic quotation.',attribution:'Synthetic speaker',source_ids:['s2','s1']},{type:'list',ordered:false,items:[{text:'Exact synthetic list item.',source_ids:['s1','s2']},{text:'Repeated item.',source_ids:[]},{text:'Repeated item.',source_ids:['s2']}]},{type:'paragraph',text:'Exact synthetic final paragraph.',source_ids:[]}];
  Object.assign(r.presentation.cover,{url:'https://eliaskalyvas.gr/'+assetPath,sha256:sha,mime_type:'image/png'});
  return sealFixture(r);
 };
 const gr=make('el',0),en=make('en',100);
 const rights=c=>({decision_id:uid(800),asset_sha256:c.sha256,cover_sha256:hashJSON(c),approved_by:'https://eliaskalyvas.gr/#person',approved_at:'2026-10-27T09:00:00.000Z',kind:c.kind,template_id:c.template_id});
 const options=releases=>({dataset:dataset(releases),assetRoot:root,rightsDecisions:releases.map(r=>rights(r.presentation.cover)),now:NOW});
 const pair=()=>{const a=structuredClone(gr),b=structuredClone(en);a.translation_group_id=b.translation_group_id=uid(700);a.approved_translation_relations=[{article_id:b.article_id,variant_id:b.variant_id,locale:b.locale}];b.approved_translation_relations=[{article_id:a.article_id,variant_id:a.variant_id,locale:a.locale}];return [sealFixture(a),sealFixture(b)];};
 return {root,gr,en,bytes,assetPath,rights,options,pair,close:()=>rm(root,{recursive:true,force:true})};
}

// Disposable acceptance only. Real SQL/Sharp/rendering; job identity, GitHub
// deployment and public observation below are explicitly SIMULATED adapters.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {deflateRawSync} from 'node:zlib';
import sharp from 'sharp';
import {hashJSON} from '../../lib/publication/contract.mjs';
import {byteHash} from '../../lib/publication/runtime/adapters.mjs';
import {createPrivateDeliveryHandler} from '../../lib/publication/integration/service.mjs';
import {composePrivateDelivery} from '../../runtime/nyra-edge/integration.mjs';
import {createNormalBuildInventory,buildAuthenticatedArtifact} from '../../lib/publication/integration/build.mjs';
import {createExportReceiver} from '../../lib/publication/integration/transport.mjs';
import {createPublicPathScopeAuthority,WITNESS_PATH} from '../../lib/publication/integration/observer.mjs';
import {sha256} from '../../lib/publication/integration/archive.mjs';
import {supabaseDispatchJournal} from '../../lib/publication/integration/dispatch.mjs';
function zip(tar){
 let crc=0xffffffff;for(const n of tar){crc^=n;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}crc=(crc^0xffffffff)>>>0;
 const packed=deflateRawSync(tar),name=Buffer.from('artifact.tar'),h=Buffer.alloc(30),c=Buffer.alloc(46),e=Buffer.alloc(22);
 h.writeUInt32LE(0x04034b50);h.writeUInt16LE(20,4);h.writeUInt16LE(8,8);h.writeUInt32LE(crc,14);h.writeUInt32LE(packed.length,18);h.writeUInt32LE(tar.length,22);h.writeUInt16LE(name.length,26);
 c.writeUInt32LE(0x02014b50);c.writeUInt16LE(20,4);c.writeUInt16LE(20,6);c.writeUInt16LE(8,10);c.writeUInt32LE(crc,16);c.writeUInt32LE(packed.length,20);c.writeUInt32LE(tar.length,24);c.writeUInt16LE(name.length,28);
 e.writeUInt32LE(0x06054b50);e.writeUInt16LE(1,8);e.writeUInt16LE(1,10);e.writeUInt32LE(c.length+name.length,12);e.writeUInt32LE(h.length+name.length+packed.length,16);
 return Buffer.concat([h,name,packed,c,name,e]);
}
export async function acceptFinalLifecycle({send,createWork,inspect,db,q,storage,owner,codeSHA}){
 const call=async(path,body,options)=>{const r=await send(path,body,options);assert.equal(r.status,200,JSON.stringify(r));return r.data;};
 const bytes=new Uint8Array(await sharp({create:{width:1280,height:720,channels:3,background:'#246879'}}).png().toBuffer()),hash=await byteHash(bytes);
 const cover={kind:'final_cover',template_id:null,url:'https://eliaskalyvas.gr/assets/signals/'+hash+'.png',sha256:hash,mime_type:'image/png',width:1280,height:720,alt:'Acceptance owned image',caption:'Owner-created acceptance illustration',attribution:{creator:'Acceptance owner',source_url:'https://example.com/owned-image',license_name:'Owner permission for this controlled test',license_url:null,rights_basis:'owned',rights_confirmed:true}};
 async function prepare(language){
  const w=await createWork(language),current=await call('/work/'+w.id,null,{method:'GET'}),p=current.state.drafts[0].presentation;
  const c={image_url:cover.url,source_url:cover.attribution.source_url,creator:cover.attribution.creator,license_name:cover.attribution.license_name,license_url:'',alt:cover.alt,caption:cover.caption,rights_basis:'owned',rights_confirmed:true};
  let saved=await call('/work/'+w.id+'/presentation',{version:0,expected_revision:p.revision,confirm_rights:true,presentation:{...p,cover:c}});assert.equal(saved.state.drafts[0].presentation.cover.rights_confirmed,false);
  const staged=saved.state.drafts[0].presentation;
  saved=await call('/work/'+w.id+'/presentation',{version:0,expected_revision:staged.revision,confirm_rights:true,presentation:{...staged,cover:{...staged.cover,rights_confirmed:true}}});
  const form=new FormData();form.set('file',new Blob([bytes],{type:'image/png'}),'owned.png');form.set('metadata',JSON.stringify({work_id:w.id,version:0,cover,rights_note:'Explicit owner confirmation for this isolated acceptance only'}));
  const u=await call('/publication/upload',form);await inspect(u.inspection_id);
  const catalog=await call('/publication/catalog',{work_id:w.id}),asset=catalog.assets.find(a=>a.cover.sha256===hash);assert(asset);
  const privateImage=await storage.get(hash);assert.deepEqual(privateImage,bytes);
  return {w,asset,language};
 }
 const gr=await prepare('gr'),en=await prepare('en');
 const baseline={manifest:(await q('select snapshot from nyra_publication_manifests where generation=1')).rows[0].snapshot,releases:[]};
 const boot=await db.rpc('nyra_delivery_bootstrap',{p_owner:owner.id,p_session:owner.session,p_expires:owner.expiresAt,p_baseline:baseline});assert(!boot.error,boot.error?.message);
 const normal=await createNormalBuildInventory({codeSHA}),pathScopeAuthority=createPublicPathScopeAuthority({configurationSHA256:normal.configurationSHA256,loadApprovedInventory:async()=>normal});
 const baseSitemap=await readFile(new URL('../../public/sitemap.xml',import.meta.url),'utf8'),journal=supabaseDispatchJournal(db);
 let run=1000,files=new Map(),archive,artifactId,stale=false,posts=0,forgedArchive=false;
 const identity=()=>({codeSHA,runId:String(run),runAttempt:'1',checkRunId:String(run+1000),jti:randomUUID(),expiresAt:new Date(Date.now()+60000).toISOString()});
 const verifier={verify:async token=>{assert.equal(token,'SIMULATED_JOB');return identity();},assert:()=>{}};
 const github={artifactFor:async()=>({artifact:{id:Number(artifactId),name:'github-pages',expired:false,digest:'sha256:'+sha256(archive),workflow_run:{id:run,head_sha:codeSHA}},archive:forgedArchive?new Uint8Array([1,2,3]):archive}),runTerminal:async()=>false,
  deploymentFor:async attempt=>{const j=await journal.read(attempt.id);if(!j)return null;const end=await journal.observeStatus(attempt.id,'succeed');return {...j,id:j.deploymentId,status:'succeed',completedAt:end.completedAt};}};
 const publicReader={read:async path=>{const b=stale?null:files.get(path.endsWith('/')?path+'index.html':path);return {status:b?200:404,bytes:b||new Uint8Array()};}};
 const delivery=composePrivateDelivery({db,verifier,pagesVerifier:verifier,storage,github,publicReader,repository:'Noctua76/eliaskalyvas-website',baseSitemap,pathScopeAuthority,enabled:true,fetcher:async(url,options)=>{assert.equal(options.method,'POST');posts++;return Response.json({id:String(posts+9000)});}});
 let rejected=null;
 const checkedService=Object.fromEntries(Object.entries(delivery.service).map(([name,fn])=>[name,async(...args)=>{try{return await fn(...args);}catch(e){rejected={operation:name,message:e.message};throw e;}}]));
 const handler=createPrivateDeliveryHandler({service:checkedService,enabled:true});
 const rpc=async operation=>{rejected=null;const r=await handler(new Request('https://simulated.invalid/delivery/'+operation,{method:'POST',headers:{Authorization:'Bearer SIMULATED_JOB',...(operation==='deploy'?{'X-Pages-OIDC':'SIMULATED_JOB','X-GitHub-Token':'SIMULATED_GITHUB'}:{})},body:'{}'}));return {status:r.status,data:await r.json(),...(rejected?{diagnostic:rejected}:{})};};
 async function deliver({uncertain=false,tamper=false}={}){
  run++;artifactId=String(run+7000);
  const receiver=createExportReceiver({endpoint:'https://simulated.invalid/delivery',audience:'urn:nyra:publication',identity:{codeSHA,runId:String(run),runAttempt:'1'},tokenSource:async()=> 'SIMULATED_JOB',fetcher:async()=>{const r=await rpc('export');assert.equal(r.status,200,JSON.stringify(r));return Response.json(r.data);}}),proof=await receiver.acquire();
  const built=await buildAuthenticatedArtifact({receiver,proof});files=built.files;archive=zip(built.tar);assert(files.has(WITNESS_PATH));
  for(const [path,content]of files)assert(!/PRIVATE_NATIVE_|PRIVATE_TICKET_CANARY|PRIVATE_EXCERPT_CANARY/.test(Buffer.from(content).toString()),path);
  if(tamper){forgedArchive=true;assert.notEqual((await rpc('permit')).status,200);forgedArchive=false;}
  const permit=await rpc('permit');assert.equal(permit.status,200,JSON.stringify(permit));const deployed=await rpc('deploy');assert.equal(deployed.status,200,JSON.stringify(deployed));
  const before=posts;assert.notEqual((await rpc('deploy')).status,200);assert.equal(posts,before,'one-shot permit must not dispatch twice');
  if(uncertain){stale=true;assert.equal((await rpc('observe')).data.status,'unknown');assert.equal((await q('select blocked from nyra_delivery.control')).rows[0].blocked,true);stale=false;}
  const result=uncertain?await delivery.service.reconcilePending():(await rpc('observe')).data;assert.equal(result.status,'released_verified',JSON.stringify(result));
  const receiptCount=Number((await q('select count(*) n from nyra_delivery.receipts')).rows[0].n);assert.equal((await rpc('observe')).data.receipt_id,result.receipt_id);assert.equal(Number((await q('select count(*) n from nyra_delivery.receipts')).rows[0].n),receiptCount);
  return {bundle:receiver.snapshot(proof),files};
 }
 const input=(v,action='publish',article=null,restore=null)=>({action,work_id:v.w.id,version:0,article_id:article,restore_release_id:restore,metadata:['publish','replace'].includes(action)?{slug:'isolated-'+v.language,seo_title:'Exact acceptance SEO '+v.language,seo_description:'Exact independently controlled acceptance description',topic_ids:['ai','work'],asset_id:v.asset.id,translation_variant_id:null,related_article_ids:[]}:null});
 const approve=async v=>{const p=await call('/publication/preview',v);await call('/publication/authorize',{preview_id:p.preview_id,request_id:randomUUID()});return p.release;};
 const first=await approve(input(gr)),published=await deliver({tamper:true});assert.equal(published.bundle.dataset.releases.length,1);const grPath=new URL(first.canonical_url).pathname.slice(1)+'index.html';assert(published.files.has(grPath));
 const html=Buffer.from(published.files.get(grPath)).toString();assert(html.includes('Exact acceptance SEO gr')&&html.includes('application/ld+json')&&html.includes('https://www.oecd.org/'));
 await approve(input(en));let result=await deliver();assert.equal(result.bundle.dataset.releases.length,2);
 const replaced=await approve(input(gr,'replace',first.article_id));assert.equal(replaced.article_id,first.article_id);result=await deliver({uncertain:true});assert.equal(result.bundle.dataset.releases.length,2);
 await approve(input(gr,'withdraw',first.article_id));result=await deliver();assert.equal(result.bundle.dataset.releases.length,1);assert.equal(result.bundle.dataset.releases[0].locale,'en');assert(!result.files.has(grPath));assert(!Buffer.from(result.files.get('sitemap.xml')).toString().includes(first.canonical_url));
 await approve(input(gr,'rollback',first.article_id,first.release.id));result=await deliver();assert.equal(result.bundle.dataset.releases.length,2);assert(result.files.has(grPath));assert(result.bundle.dataset.releases.find(r=>r.locale==='el').content.title===first.content.title);
 const catalog=await call('/publication/catalog',{work_id:gr.w.id});assert.equal(catalog.verified_live_manifest,null,'authorization catalog must not claim observed publication');assert.equal(catalog.delivery.receipts.length,5);assert(catalog.delivery.receipts.some(r=>r.status==='released_verified'&&r.generation===result.bundle.dataset.manifest.generation));assert.equal(catalog.delivery.blocked,false);
 return {lifecycle:['publish-gr','publish-en','replace-gr','withdraw-gr','rollback-gr'],receipts:5,sharp:true,exactStaticBytes:true,seo:true,oneShot:true,unknownRecovery:true,artifactTamperDenied:true,publicationProvider:'SIMULATED',jobIdentity:'SIMULATED',publicObservation:'SIMULATED',realProtectedOIDC:'NOT TESTED',productionChanged:false};
}

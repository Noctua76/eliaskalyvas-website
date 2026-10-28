import test from 'node:test';
import assert from 'node:assert/strict';
import {authorityFixture,ORIGIN,SESSION,OWNER} from './fixtures/publication-authority.mjs';
import {DELIVERY_MIGRATION,deliveryCalls} from './fixtures/delivery.mjs';
import {readFile} from 'node:fs/promises';
import {staticFixture} from './fixtures/signals-publication.mjs';
import {createPrivateAssetRuntime} from '../lib/publication/runtime/assets.mjs';
import {inspectApprovedBytes,preparePrivateBuildPackage} from '../lib/publication/runtime/node-assets.mjs';
import {hashJSON} from '../lib/publication/contract.mjs';
test('P4B exact owner/MFA private upload verifies bytes, reuses Sharp and binds immutable rights',async()=>{
 const f=await authorityFixture(),s=await staticFixture();try{
  await f.pg.exec(await readFile(new URL('../supabase/migrations/'+DELIVERY_MIGRATION,import.meta.url),'utf8'));
  let uploads=0;const stored=new Map(),storage={put:async(h,b)=>{uploads++;stored.set(h,b)},get:async h=>stored.get(h)};
  const runtime=createPrivateAssetRuntime({db:f.db,env:{ALLOWED_ORIGINS:ORIGIN},storage,inspector:inspectApprovedBytes});
  const cover=s.gr.presentation.cover,request=token=>new Request(ORIGIN+'/private-upload',{method:'POST',headers:{Origin:ORIGIN,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({cover,rights_note:'Synthetic owner rights review, not production evidence.'})});
  for(const token of ['not-a-token',f.token({aal:'aal1'})]){const r=await runtime.uploadAndReview({request:request(token),bytes:s.bytes});assert(!r.response.ok);assert.equal(uploads,0)}
  const result=await runtime.uploadAndReview({request:request(f.good),bytes:s.bytes});assert.equal(result.response.status,200);assert.equal(uploads,1);
  const assetResult=await result.response.json();
  const rows=(await f.pg.query('select * from nyra_delivery.asset_links')).rows;assert.equal(rows.length,1);assert.equal(rows[0].cover_sha256,hashJSON(cover));assert.equal(rows[0].object_key,'sha256/'+cover.sha256);
  const work=await f.work();await f.mutate(work.id,row=>{row.state.drafts[0].presentation.cover={image_url:cover.url,source_url:cover.attribution.source_url,creator:cover.attribution.creator,license_name:cover.attribution.license_name,license_url:cover.attribution.license_url||'',alt:cover.alt,caption:cover.caption,rights_confirmed:true}});
  const preview=await f.prepare(work,assetResult.asset_id);assert.equal(preview.status,200);assert.equal((await f.authorize(preview)).status,200);
  const delivery=deliveryCalls(f),baseline={manifest:(await f.pg.query('select snapshot from nyra_publication_manifests where generation=1')).rows[0].snapshot,releases:[]};
  await delivery.call('nyra_delivery_bootstrap',{p_owner:OWNER,p_session:SESSION,p_expires:new Date(Date.now()+60000).toISOString(),p_baseline:baseline});
  const attempt='00000000-0000-4000-8000-000000009999';await delivery.register(attempt);const materialized=await delivery.candidate(attempt);await delivery.machine('export');
  const rights=await delivery.call('nyra_delivery_assets',{p_attempt:attempt,p_fence:materialized.context.fence,p_candidate:materialized.id});assert.equal(rights.length,1);assert(!JSON.stringify(rights).includes('rights_note'));assert(!JSON.stringify(rights).includes('session_id'));
  const publicFiles=await preparePrivateBuildPackage({dataset:materialized.candidate.dataset,storage,rightsDecisions:rights,now:new Date().toISOString()});assert.equal(publicFiles.size,1);assert.deepEqual([...publicFiles.values()][0],s.bytes);
  await f.pg.query('delete from auth.sessions where id=$1',[SESSION]);const revoked=await runtime.uploadAndReview({request:request(f.good),bytes:s.bytes});assert(!revoked.response.ok);assert.equal(uploads,1);
  const packaged=await preparePrivateBuildPackage({dataset:s.options([s.gr]).dataset,storage,rightsDecisions:s.options([s.gr]).rightsDecisions,now:s.options([s.gr]).now});assert.equal(packaged.size,1);assert.deepEqual([...packaged.values()][0],s.bytes);
  await assert.rejects(inspectApprovedBytes({cover:{...cover,width:cover.width+1},bytes:s.bytes,now:new Date().toISOString()}),/ASSET_DIMENSION_MISMATCH/);
  await assert.rejects(createPrivateAssetRuntime({db:f.db,env:{},storage}).uploadAndReview({request:request(f.good),bytes:s.bytes}),/ASSET_INSPECTOR_REQUIRED/);
 }finally{await f.pg.close();await s.close()}
});

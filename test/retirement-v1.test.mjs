import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {retireDocker,validateRetirementManifest} from '../ops/acceptance-bootstrap/retirement-v1.mjs';
const host='nyra-acceptance-20261106-02',machineId='0123456789abcdef0123456789abcdef';
const sha=x=>createHash('sha256').update(x).digest('hex');
const start='2026-11-06T09:00:00.000Z',end='2026-11-20T09:00:00.000Z',now=()=>Date.parse(end)+1000;
const manifest=()=>({schema:'nyra.acceptance.continuation.retirement.v1',bootstrapId:host,hostname:host,machineIdSHA256:sha(machineId),createdAt:start,expiresAt:end,planSHA256:'a'.repeat(64),authorization:false,providerResourceId:'615221105'});
const ctx={hostname:host,machineId,now},label='com.noctua.nyra.acceptance='+'a'.repeat(64);
test('exact future host and expiry required',()=>{assert.equal(validateRetirementManifest(manifest(),ctx).label,label);
 assert.throws(()=>validateRetirementManifest(manifest(),{...ctx,now:()=>Date.parse(end)-1}),/NYRA_RETIRE_NOT_EXPIRED/);});
test('reject old host, old provider ID, changed machine, extended deadline, unknown fields',()=>{for(const change of [x=>x.hostname='nyra-acceptance-20261102-01',x=>x.providerResourceId='615221104',x=>x.machineIdSHA256='b'.repeat(64),x=>x.expiresAt='2026-11-27T09:00:00.000Z',x=>x.extra=1,x=>x.authorization=true]){const m=manifest();change(m);assert.throws(()=>validateRetirementManifest(m,ctx),/NYRA_RETIRE_/);}
 assert.throws(()=>validateRetirementManifest(manifest(),{...ctx,hostname:'other-host'}),/NYRA_RETIRE_HOST_IDENTITY/);});
function docker({removeFails=false,inspectMismatch=false}={}){
 const states={container:new Map([['c123',{Labels:{'com.noctua.nyra.acceptance':'a'.repeat(64)}}]]),network:new Map(),volume:new Map()},calls=[];
 const run=a=>{calls.push(a);const listing=a[0]==='ps'||a[0]==='network'&&a[1]==='ls'||a[0]==='volume'&&a[1]==='ls';
 if(listing){const kind=a[0]==='ps'?'container':a[0],f=a.find(x=>x.startsWith('label='));return [...states[kind]].filter(([id,row])=>!f||f===label&&row.Labels['com.noctua.nyra.acceptance']==='a'.repeat(64)).map(([id])=>id).join('\n');}
 if(a[1]==='inspect'){const row=states[a[0]].get(a[2]);const Labels={...row.Labels};if(inspectMismatch)Labels['com.noctua.nyra.acceptance']='b'.repeat(64);return JSON.stringify([a[0]==='container'?{Config:{Labels}}:{Labels}]);}
 const kind=a[0]==='rm'?'container':a[0];if(!removeFails)states[kind].delete(a.at(-1));return '';};return {run,calls};}
test('only target-labelled resource removed, independent readback, no provider claim',()=>{const d=docker();const r=retireDocker(manifest(),{...ctx,run:d.run});assert.equal(r.removed.length,1);assert.equal(r.retirementComplete,false);assert.equal(r.providerDestroyed,false);assert.deepEqual(d.calls.filter(a=>a[0]==='rm'),[['rm','-f','c123']]);});
test('preflight mismatch fails before removal',()=>{const d=docker({inspectMismatch:true});assert.throws(()=>retireDocker(manifest(),{...ctx,run:d.run}),/NYRA_RETIRE_INSPECT_SCOPE/);assert.equal(d.calls.filter(a=>a[0]==='rm').length,0);});
test('failed removal cannot produce success, no automatic retry',()=>{const d=docker({removeFails:true});assert.throws(()=>retireDocker(manifest(),{...ctx,run:d.run}),/NYRA_RETIRE_RESOURCE_REMAINS/);assert.equal(d.calls.filter(a=>a[0]==='rm').length,1);});

// Authenticated runner acquisition. No API is mounted and no network runs on import.
import {hashJSON,parseContractJSON,validatePublicationSet} from '../contract.mjs';
import {requireDelivery as need} from '../runtime/materialize.mjs';
const exact=(v,keys)=>need(v&&Object.keys(v).sort().join(',')===keys.sort().join(','),'EXPORT_FIELDS');
export function createExportReceiver({endpoint,audience,tokenSource,fetcher=fetch,identity,clock=()=>new Date().toISOString()}){
 const u=new URL(endpoint);need(u.protocol==='https:'&&!u.username&&!u.password&&!u.search&&!u.hash&&u.pathname.endsWith('/delivery'),'EXPORT_ENDPOINT');
 need(typeof audience==='string'&&audience.length>0&&/^[a-f0-9]{40}$/.test(identity.codeSHA)&&/^[1-9][0-9]*$/.test(identity.runId)&&/^[1-9][0-9]*$/.test(identity.runAttempt),'EXPORT_IDENTITY');
 const known=new WeakMap();
 const call=async operation=>{const token=await tokenSource(audience);need(typeof token==='string'&&token.length>0,'MACHINE_TOKEN_REQUIRED');const r=await fetcher(endpoint+'/'+operation,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(60000)});need(r.ok,'TRUSTED_DELIVERY_UNAVAILABLE');const bytes=await r.text();need(bytes.length<=128*1024*1024,'EXPORT_SIZE');return structuredClone(parseContractJSON(bytes));};
 return Object.freeze({
  async acquire(){const v=await call('export');exact(v,['version','dataset','capability','identity','rightsDecisions','assets']);need(v.version==='nyra.delivery.export.v1'&&Object.entries(identity).every(([k,x])=>v.identity[k]===x),'EXPORT_IDENTITY');validatePublicationSet(v.dataset,{now:clock()});
   exact(v.capability,['candidate_id','attempt_id','fence']);need([v.capability.candidate_id,v.capability.attempt_id].every(x=>typeof x==='string'&&/^[0-9a-f-]{36}$/.test(x))&&Number.isSafeInteger(v.capability.fence)&&v.capability.fence>0,'EXPORT_CAPABILITY');
   need(Array.isArray(v.assets)&&Array.isArray(v.rightsDecisions),'EXPORT_ASSETS');const expected=[...new Set(v.dataset.releases.map(r=>new URL(r.presentation.cover.url).pathname.slice(1)))].sort();same(v.assets.map(a=>a.path).sort(),expected,'EXPORT_ASSET_SCOPE');for(const a of v.assets){exact(a,['path','base64']);need(typeof a.base64==='string'&&/^[A-Za-z0-9+/]*={0,2}$/.test(a.base64),'EXPORT_ASSET_BYTES');}
   const proof=Object.freeze({candidateId:v.capability.candidate_id,attemptId:v.capability.attempt_id,fence:v.capability.fence,manifestSHA256:hashJSON(v.dataset.manifest),codeSHA:identity.codeSHA});known.set(proof,structuredClone(v));return proof;
  },
  assert(proof){need(known.has(proof),'UNAUTHENTICATED_EXPORT');return proof;},
  snapshot(proof){need(known.has(proof),'UNAUTHENTICATED_EXPORT');return structuredClone(known.get(proof));},
  permit:()=>call('permit'),start:()=>call('start'),observe:()=>call('observe')
 });
}
function same(a,b,code){need(JSON.stringify(a)===JSON.stringify(b),code);}

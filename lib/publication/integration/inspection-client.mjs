// Job gets private image bytes only after its registered inspection OIDC gate.
// No DB/login, owner token, URL download or caller-selected operation ID.
import {runPrivateAssetInspection} from '../runtime/node-inspection.mjs';
import {parseContractJSON} from '../contract.mjs';
const need=v=>{if(!v)throw Error('PRIVATE_INSPECTION_DENIED');};
export function privateInspectionClient({endpoint,tokenSource,fetcher=fetch}){
 const url=new URL(endpoint);need(url.protocol==='https:'&&!url.username&&!url.password&&!url.search&&!url.hash&&url.pathname.endsWith('/inspection'));
 const call=async(op,body)=>{const token=await tokenSource();const r=await fetcher(endpoint+'/'+op,{method:'POST',redirect:'error',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(60000)});need(r.ok);const raw=await r.text();need(raw.length<=30*1024*1024);return parseContractJSON(raw);};
 return Object.freeze({next:()=>call('next',{}),claim:(_token,id)=>call('claim',{operation_id:id}),read:async(_token,handle)=>{const packet=await call('read',{handle});need(typeof packet.bytes==='string');return {...packet,bytes:new Uint8Array(Buffer.from(packet.bytes,'base64'))};},finish:(_token,handle,report)=>call('finish',{handle,report}),fail:(_token,handle)=>call('fail',{handle})});
}
export async function runPendingInspections({service,max=16}){
 need(Number.isSafeInteger(max)&&max>=1&&max<=16);let inspected=0;
 for(;inspected<max;inspected++){const next=await service.next();if(next.operation_id===null)return {status:'idle',inspected};need(typeof next.operation_id==='string');await runPrivateAssetInspection({service,tokenSource:async()=>undefined,operationId:next.operation_id});}
 return {status:'batch_limit',inspected};
}

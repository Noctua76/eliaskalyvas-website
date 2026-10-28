import {createPublicationAuthorityHandler} from '../authority.mjs';
import {hashJSON,parseContractJSON} from '../contract.mjs';
import {validateCover} from '../authority-validation.mjs';
import {byteHash} from './adapters.mjs';
import {requireDelivery} from './materialize.mjs';
// All owner/MFA/allowlist/origin/session checks are the existing Phase 2 gate.
// inspector must perform the Phase 3 Sharp checks; Edge cannot silently replace
// that inspector with header-only validation. No inspector => fail closed.
export function createPrivateAssetRuntime({db,env,storage,inspector,now=Date.now}){
 return Object.freeze({async uploadAndReview({request,bytes}){
  requireDelivery(typeof inspector==='function','ASSET_INSPECTOR_REQUIRED');
  const body=parseContractJSON(await request.clone().text());validateCover(body.cover);
  const hash=await byteHash(bytes);requireDelivery(hash===body.cover.sha256,'ASSET_HASH_MISMATCH');
  let called=false;
  const gatedDB={...db,auth:db.auth,from:db.from.bind(db),rpc:async(name,args)=>{
   if(name!=='nyra_publication_asset')return db.rpc(name,args);
   called=true;
   const active=await db.rpc('nyra_publication_actor',{p_owner:args.p_owner,p_session:args.p_session,p_expires:args.p_expires});if(active.error)return active;
   await inspector({cover:body.cover,bytes,owner:args.p_owner,now:new Date(now()).toISOString()});
   await storage.put(hash,bytes);
   const result=await db.rpc(name,args);if(result.error)return result;
   const id=result.data?.asset_id;requireDelivery(typeof id==='string','ASSET_RECORD');
   const link=await db.rpc('nyra_delivery_link_asset',{p_owner:args.p_owner,p_session:args.p_session,p_expires:args.p_expires,p_asset:id,p_hash:hash,p_cover_hash:hashJSON(body.cover)});
   if(link.error)throw Error('ASSET_LINK_UNAVAILABLE');return result;
  }};
  const gate=createPublicationAuthorityHandler({db:gatedDB,env,now}),url=new URL(request.url);url.pathname='/publication/assets';
  const response=await gate(new Request(url,{method:request.method,headers:request.headers,body:JSON.stringify(body)}));
  return {response,inspected:called&&response.ok};
 }});
}

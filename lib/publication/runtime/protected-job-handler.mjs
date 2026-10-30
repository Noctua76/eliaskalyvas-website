// Unmounted broker transport. Empty operation requests cannot register facts,
// choose an Environment, upload an inventory or select a publication payload.
import {requireDelivery as need} from './materialize.mjs';
export function createProtectedJobHandler({broker,privilege,execute,enabled=false}){
 need(['build','inspection','publication'].includes(privilege),'BROKER_PRIVILEGE');
 return async request=>{
  if(!enabled)return new Response(null,{status:503});
  try{
   const url=new URL(request.url);need(request.method==='POST'&&url.pathname==='/jobs/'+privilege&&!url.search,'BROKER_OPERATION');
   const reader=request.body?.getReader();need(reader,'BROKER_BODY');let bytes=new Uint8Array();
   try{for(;;){const {done,value}=await reader.read();if(done)break;need(bytes.length+value.length<=2,'BROKER_BODY');const next=new Uint8Array(bytes.length+value.length);next.set(bytes);next.set(value,bytes.length);bytes=next;}}finally{await reader.cancel();}
   need(new TextDecoder().decode(bytes)==='{}','BROKER_BODY');
   const auth=request.headers.get('authorization');need(auth?.startsWith('Bearer '),'BROKER_AUTH');
   const grant=await broker.authorize(auth.slice(7));need(grant.privilege===privilege,'BROKER_PRIVILEGE');
   await broker.revalidate(grant);await execute(grant);
   return Response.json({accepted:true,privilege});
  }catch{return new Response(null,{status:403});}
 };
}

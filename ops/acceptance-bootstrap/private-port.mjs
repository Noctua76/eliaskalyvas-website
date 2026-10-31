// Persistent role/direction/sequence authenticated stdio. No public endpoint.
import {createInterface} from 'node:readline';
import {randomUUID} from 'node:crypto';
import {authenticatedFrames} from '../../lib/publication/runtime/acceptance-ipc.mjs';
export function privatePort({role,key,input,output,side,onCall,onQuery,timeout=30000}){
 const outgoing=authenticatedFrames({role,key,direction:side==='coordinator'?'request':'response'}),incoming=authenticatedFrames({role,key,direction:side==='coordinator'?'response':'request'}),pending=new Map();let closed=false;
 const lines=createInterface({input,crlfDelay:Infinity});
 const stop=()=>{if(closed)return;closed=true;lines.close();for(const p of pending.values()){clearTimeout(p.timer);p.reject(Error('PRIVATE_PORT_CLOSED'));}pending.clear();input.destroy();output.end();};
 const send=b=>{if(closed)throw Error('PRIVATE_PORT_CLOSED');const text=JSON.stringify(outgoing.encode(b));if(Buffer.byteLength(text)>2000000)throw Error('PRIVATE_PORT_SIZE');output.write(text+'\n');};
 const ask=(type,op,args)=>new Promise((resolve,reject)=>{const id=randomUUID(),timer=setTimeout(()=>{pending.delete(id);reject(Error('PRIVATE_PORT_TIMEOUT'));stop();},timeout);pending.set(id,{resolve,reject,timer});try{send({type,id,op,args});}catch{clearTimeout(timer);pending.delete(id);reject(Error('PRIVATE_PORT_CLOSED'));stop();}});
 lines.on('line',line=>{try{
  if(Buffer.byteLength(line)>2000000)throw Error('SIZE');const b=incoming.decode(JSON.parse(line));
  if(typeof b.id!=='string')throw Error('ID');
  if(b.type==='result'||b.type==='reply'){const p=pending.get(b.id);if(!p)throw Error('REPLY');pending.delete(b.id);clearTimeout(p.timer);b.ok?p.resolve(b.result):p.reject(Error('PRIVATE_OPERATION_DENIED'));return;}
  const fn=b.type==='call'&&side==='worker'?onCall:b.type==='query'&&side==='coordinator'?onQuery:null;
  if(typeof fn!=='function')throw Error('OP');
  Promise.resolve().then(()=>fn(b.op,b.args)).then(result=>send({type:b.type==='call'?'result':'reply',id:b.id,ok:true,result:result??null})).catch(()=>{try{send({type:b.type==='call'?'result':'reply',id:b.id,ok:false,result:null});}catch{stop();}});
 }catch{stop();output.end();}});
 input.on('error',stop);input.on('close',stop);output.on('error',stop);
 return Object.freeze({call:(op,args)=>ask('call',op,args),query:(op,args)=>ask('query',op,args),close(){stop();},isClosed:()=>closed});
}

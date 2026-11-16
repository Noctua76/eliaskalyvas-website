// Offline transport contract tests. No real Owner Source/socket or bearer.
import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {EventEmitter} from 'node:events';
import {syncBuiltinESMExports} from 'node:module';
import {ownerRequest} from '../ops/acceptance-bootstrap/owner-request.mjs';
import {sanitizedRenewalFailure} from '../ops/acceptance-bootstrap/repository-db-renewal.mjs';
const canary='SYNTHETIC_PRIVATE_BODY_NEVER_EXPORT';
async function scenario(t,mode,expected){
 let calls=0,body='',authorization='';
 t.mock.method(http,'request',(options,onResponse)=>{
  calls++;assert.equal(options.timeout,15000);assert.equal(options.socketPath,'/SYNTHETIC/unit.sock');
  authorization=options.headers.Authorization;const req=new EventEmitter();
  req.destroy=()=>queueMicrotask(()=>req.emit('error',Object.assign(Error(canary),{code:'ECONNRESET'})));
  req.end=text=>{body=text;queueMicrotask(()=>{
   if(mode==='timeout'){req.emit('timeout');return;}
   if(mode==='absent'||mode==='refused'){req.emit('error',Object.assign(Error(canary),{code:mode==='absent'?'ENOENT':'ECONNREFUSED'}));return;}
   const res=new EventEmitter();res.statusCode=mode==='denied'?403:200;onResponse(res);
   const text=mode==='valid'?'{}':mode==='oversized'?canary.repeat(6000):canary;
   res.emit('data',Buffer.from(text));res.emit('end');
  });};return req;
 });
 syncBuiltinESMExports();
 try{
  const promise=ownerRequest({socket:'/SYNTHETIC/unit.sock',operation:'renew',input:{token:canary,binding:{synthetic:true}}});
  if(expected)await assert.rejects(promise,e=>{assert.equal(e.message,'OWNER_REQUEST_DENIED');assert.equal(e.nyraCode,expected);assert.equal(sanitizedRenewalFailure(e).code,expected);assert(!JSON.stringify(sanitizedRenewalFailure(e)).includes(canary));return true;});
  else assert.deepEqual(await promise,{});
  assert.equal(calls,1,'no automatic retry');assert(!body.includes(canary));assert.equal(authorization,'Bearer '+canary);
 }finally{t.mock.restoreAll();syncBuiltinESMExports();}
}
for(const [mode,code]of [['denied','OWNER_HTTP_DENIED'],['invalid','OWNER_RESPONSE_INVALID'],['oversized','OWNER_RESPONSE_TOO_LARGE'],['absent','OWNER_CHANNEL_ABSENT'],['refused','OWNER_CHANNEL_REFUSED'],['timeout','OWNER_CHANNEL_TIMEOUT'],['valid',null]])test('Owner channel diagnostic: '+mode,t=>scenario(t,mode,code));

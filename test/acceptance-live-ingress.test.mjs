import test from 'node:test';
import assert from 'node:assert/strict';
import {createIngressHandler} from '../ops/acceptance-bootstrap/live-ingress.mjs';
const host='https://nyra-5c.eliaskalyvas.gr';
function fixture(enabled=true){
 const calls=[],watcher={isReady:async selector=>{calls.push(selector);return selector.role==='build';}};
 const acceptors=Object.fromEntries(['build','inspection','publication'].map(role=>[role,async token=>{
  calls.push({role,token});return {accepted:true,digest:'a'.repeat(64),keyId:'pinned-evidence'};
 }]));
 return {handler:createIngressHandler({watcher,acceptors,enabled}),calls};
}
test('Disabled acceptance ingress cannot expose a listener result',async()=>{
 const f=fixture(false);assert.equal((await f.handler(new Request(host+'/ready/build/1/1'))).status,503);
 assert.equal(f.calls.length,0);
});
test('Readiness uses only exact trusted role and GitHub run coordinates',async()=>{
 const f=fixture();
 const r=await f.handler(new Request(host+'/ready/build/123/1'));
 assert.deepEqual(await r.json(),{ready:true,authorization:false});
 assert.equal(f.calls[0].role,'build');
 for(const path of ['/ready/build/0/1','/ready/owner/1/1','/ready/build/1/1?admin=1','/owner','/admin','/ready/build/1/1/extra'])
  assert.notEqual((await f.handler(new Request(host+path))).status,200);
});
test('Acceptance forwards only bearer token to broker; response never leaks it',async()=>{
 const f=fixture(),bearer='secret-jwt-placeholder';
 const ok=await f.handler(new Request(host+'/acceptance/build',{
  method:'POST',headers:{Authorization:'Bearer '+bearer},body:'{}'
 }));
 assert.equal(ok.status,200);const mirror=ok.clone();assert.deepEqual(await ok.json(),{
  accepted:true,digest:'a'.repeat(64),keyId:'pinned-evidence'
 });
 assert.deepEqual(f.calls[0],{role:'build',token:bearer});
 assert(!(await mirror.text()).includes(bearer));
});
test('Ingress rejects wrong method, payload and missing bearer without invoking acceptor',async()=>{
 const f=fixture();
 const rows=[
  new Request(host+'/acceptance/build',{method:'POST',body:'{}'}),
  new Request(host+'/acceptance/build',{method:'POST',headers:{Authorization:'Bearer t'},body:'{"owner":true}'}),
  new Request(host+'/acceptance/build?x=1',{method:'POST',headers:{Authorization:'Bearer t'},body:'{}'}),
  new Request(host+'/acceptance/owner',{method:'POST',headers:{Authorization:'Bearer t'},body:'{}'}),
  new Request(host+'/acceptance/build')
 ];
 for(const r of rows)assert.notEqual((await f.handler(r)).status,200);
 assert.equal(f.calls.length,0);
});

// Shared assertions, executed against real HTTP user workers. No simulated boot.
import assert from 'node:assert/strict';
export async function assertNativeEdge({request,expected,event}){
 for(const variant of ['raw','bundled']){
  const r=await request('/'+variant+'/_diagnostic');assert.equal(r.status,200);const d=JSON.parse(r.body);
  assert.equal(d.coreLoaded,true,d.coreError);assert.equal(d.schemaCount,6);
  for(const [name,digest]of Object.entries(expected))for(const method of ['nodeURL','denoURL','nodeRelative','denoRelative'])assert.equal(d.files[name][method].sha256,digest,variant+':'+name+':'+method);
  const disabled=await request('/'+variant+'/export');assert.equal(disabled.status,503);assert.deepEqual(JSON.parse(disabled.body),{error:'PUBLICATION_DISABLED'});assert.equal(disabled.headers['x-native-private-calls'],'0');
  event('Edge-'+variant,'PASS',{module:d.module,coreLoaded:true,schemaCount:d.schemaCount,files:d.files,status:503});
  for(const [name,options,calls]of [
   ['missing',{method:'POST',body:'{}'},'0'],
   ['invalid',{method:'POST',body:'{}',headers:{Authorization:'Bearer invalid.native.token'}},'1'],
   ['browser',{method:'POST',body:'{}',headers:{Origin:'https://browser.invalid',Authorization:'Bearer invalid.native.token'}},'0'],
   ['anonymous-get',{},'0']
  ]){
   const a=await request('/'+variant+'/_enabled/export',options);assert.equal(a.status,409);assert.deepEqual(JSON.parse(a.body),{error:'DELIVERY_REJECTED'});assert.equal(a.headers['x-native-private-calls'],'0');assert.equal(a.headers['x-native-verifier-calls'],calls);
   event('Edge-'+variant+'-'+name,'PASS',{status:409,privateCalls:0,verifierCalls:Number(calls)});
  }
 }
 for(const name of Object.keys(expected))for(const mode of ['missing','altered']){
  const r=await request('/'+mode+'-'+name+'/_diagnostic');assert.equal(r.status,200);const d=JSON.parse(r.body);assert.equal(d.coreLoaded,false);assert.equal(d.schemaCount,0);
  assert.match(d.coreError,mode==='missing'?/NotFound|ENOENT/:new RegExp('EDGE_SCHEMA_INTEGRITY:'+name));
  event('Edge-'+mode+'-'+name,'PASS',{coreLoaded:false,error:d.coreError});
 }
 for(const mode of ['missing','altered']){
  const r=await request('/bundle-'+mode+'-shared/_diagnostic');assert.equal(r.status,200);const d=JSON.parse(r.body);assert.equal(d.coreLoaded,false);assert.match(d.coreError,mode==='missing'?/NotFound|ENOENT/:/EDGE_SCHEMA_INTEGRITY:shared/);
  event('Edge-bundle-'+mode,'PASS',{coreLoaded:false,error:d.coreError});
 }
}

import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {assessHost} from '../ops/acceptance-bootstrap/host-preflight.mjs';

const target=JSON.parse(await readFile(new URL('../ops/acceptance-bootstrap/host-target.json',import.meta.url),'utf8'));
const good=()=>({
 hostname:'nyra-5c-acceptance',publicAddresses:['201.79.94.104'],
 dnsAddresses:['201.79.94.104'],https:'404:0',cpuCount:4,
 memoryBytes:8*1024**3,freeBytes:152*1024**3,docker:'active',caddy:'active',
 firewall:'Status: active\nDefault: deny (incoming), allow (outgoing), deny (routed)\n22/tcp ALLOW IN Anywhere\n80/tcp ALLOW IN Anywhere\n443/tcp ALLOW IN Anywhere',
 containers:'',roles:Object.fromEntries(['coordinator','registrar','broker','owner'].map(role=>
 [role,{shell:'/usr/sbin/nologin',directoryOwner:'nyra-'+role,directoryMode:'700'}])),
 privateDirectory:'root:700'
});
test('Phase 5C host prerequisites are non-authorizing even when all checks pass',()=>{
 const r=assessHost(target,good());
 assert.equal(r.prerequisitesPassed,true);
 assert.equal(r.readyForCredentials,false);
 assert.equal(r.authorization,false);
 assert.equal(r.dispatchesPerformed,0);
 assert.equal(r.realAcceptance,false);
});
test('Phase 5C host prerequisites fail closed on exposure, isolation or TLS regression',()=>{
 for(const change of [
  {https:'404:60'},{containers:'unsafe-container'},
  {dnsAddresses:['201.79.94.105']},{firewall:'Status: inactive'},
  {privateDirectory:'root:755'},{freeBytes:10*1024**3}
 ]){
  const r=assessHost(target,{...good(),...change});
  assert.equal(r.prerequisitesPassed,false);
  assert(r.failed.length>0);
 }
 const s=good();s.roles.owner.directoryMode='755';
 assert.equal(assessHost(target,s).prerequisitesPassed,false);
});
test('Unapproved host substitution is rejected',()=>{
 for(const change of [
  {ipv4:'127.0.0.1'},{origin:'https://eliaskalyvas.gr'},{authorization:true},
  {region:'nyc1'}
 ])assert.throws(()=>assessHost({...target,...change},good()),/HOST_PREFLIGHT_TARGET/);
});

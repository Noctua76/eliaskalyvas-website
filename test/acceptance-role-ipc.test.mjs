import test from 'node:test';
import assert from 'node:assert/strict';
import {authenticatedFrames} from '../lib/publication/runtime/acceptance-ipc.mjs';
import {roleIPCArgs} from '../ops/acceptance-bootstrap/role-ipc-proof.mjs';
import {readOnlyIdentity,createReadOnlyIPCOperation,expectedGrants} from '../ops/acceptance-bootstrap/role-ipc-worker.mjs';

test('Per-role containers receive only private own login and ephemeral IPC key',()=>{
 for(const role of ['registrar','broker']){
  const key='/var/lib/nyra-5c/'+role+'/.ipc-proof-'+'a'.repeat(16);
  const args=roleIPCArgs(role,998,998,key),line=args.join(' ');
  assert(args.includes('--rm')&&args.includes('-i')&&args.includes('--read-only'));
  assert(args.includes('--cap-drop')&&args.includes('ALL'));
  assert(args.includes('--network')&&args.includes('nyra-5c-db-private'));
  assert(!line.includes('--publish')&&!line.includes('--privileged'));
  assert(line.includes('/var/lib/nyra-5c/'+role+'/pg.json'));
  assert(line.includes(key));
  assert(!line.includes('/var/lib/nyra-5c/'+(role==='registrar'?'broker':'registrar')+'/pg.json'));
  assert(!line.includes('/opt/nyra-5c/private/db.env'));
  assert(!line.includes('docker.sock'));
  assert(!line.includes('GITHUB_TOKEN'));
 }
 assert.throws(()=>roleIPCArgs('owner',998,998,'/tmp/secret'),/NYRA_IPC_ARGS/);
 assert.throws(()=>roleIPCArgs('broker',0,0,'/tmp/key'),/NYRA_IPC_ARGS/);
 assert.throws(()=>roleIPCArgs('registrar',998,998,'/var/lib/nyra-5c/broker/.ipc-proof-'+'a'.repeat(16)),/NYRA_IPC_ARGS/);
});
test('Worker bind graph contains exactly three runtime files, native pg tree and its own two private files',()=>{
 for(const role of ['registrar','broker']){
  const args=roleIPCArgs(role,998,998,'/var/lib/nyra-5c/'+role+'/.ipc-proof-'+'a'.repeat(16));
  const mounts=args.filter((v,i)=>args[i-1]==='--mount');assert.equal(mounts.length,6);
  const destinations=mounts.map(m=>m.split(',').find(p=>p.startsWith('dst=')).slice(4)).sort();
  assert.deepEqual(destinations,['/app/ops/acceptance-bootstrap/role-ipc-worker.mjs','/app/lib/publication/runtime/acceptance-ipc.mjs','/app/lib/publication/canonical-json.mjs','/app/node_modules','/run/role/pg.json','/run/role/ipc.key'].sort());
  assert(mounts.every(m=>m.endsWith(',readonly')));assert(mounts.find(m=>m.includes('dst=/app/node_modules,')).includes('/ops/native-acceptance/node_modules,'));
  assert(!mounts.some(m=>m.includes('src=/opt/nyra-5c/bootstrap/lib/publication,')));
 }
});
test('Digest-pinned container proof uses the real worker graph without website dependencies or database/network reuse',async()=>{
 const {containerCheckArgs}=await import('../ops/acceptance-bootstrap/role-ipc-container-check.mjs');
 const args=containerCheckArgs({role:'registrar',uid:1001,gid:1001,checkout:'/isolated/reviewed',privateDir:'/private/test',name:'test-only'}),line=args.join(' ');
 assert.equal(args[args.indexOf('--network')+1],'none');assert(line.includes('library/node@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94'));
 assert(!line.includes('src=/isolated/reviewed/node_modules,'));assert(!line.includes('src=/isolated/reviewed/lib/publication,'));assert(!line.includes('contract.mjs'));
 assert.deepEqual(args.slice(-4),['node','--test','--test-reporter=tap','/app/test/acceptance-ipc-standalone.test.mjs']);
});
test('Authenticated IPC rejects tampering, replay and role substitution',()=>{
 const key=Buffer.alloc(32,23);
 for(const role of ['registrar','broker']){
  const sender=authenticatedFrames({key,role,direction:'request'});
  const receiver=authenticatedFrames({key,role,direction:'request'});
  const msg=sender.encode({op:'identity'});
  assert.deepEqual(receiver.decode(msg),{op:'identity'});
  assert.throws(()=>receiver.decode(msg),/IPC_AUTH/);
  const fake={...sender.encode({op:'identity'}),body:{op:'register'}};
  assert.throws(()=>receiver.decode(fake),/IPC_AUTH/);
  const other=authenticatedFrames({key,role:role==='registrar'?'broker':'registrar',direction:'request'});
  assert.throws(()=>other.decode(sender.encode({op:'identity'})),/IPC_AUTH/);
 }
});
test('Role-grant read is SQL SELECT only and asserts distinct privileges',async()=>{
 const mk=role=>async sql=>{
  assert.match(sql,/^select current_user/);
  assert(!/^\s*(update|insert|delete|drop|alter)\b/i.test(sql));
  assert(!sql.includes(';'));
  return {rows:[{identity:'nyra_accept_'+role,...expectedGrants(role)}]};
 };
 for(const role of ['registrar','broker']){
  const op=createReadOnlyIPCOperation({role,query:mk(role)});
  const r=await op({op:'identity'});
  assert.equal(r.ok,true);
  assert.equal(r.result.role,role);
  assert.equal(r.result.recordsWritten,0);
  assert.deepEqual(await op({op:'register'}),{ok:false,code:'OPERATION_DENIED'});
  assert.deepEqual(await op({op:'identity',sql:'drop table nyra_trust.jobs'}),
   {ok:false,code:'OPERATION_DENIED'});
 }
});
test('Mismatched SQL identity or grants fail closed without leaking SQL errors',async()=>{
 const bad=async()=>({rows:[{identity:'nyra_accept_broker',jobs:true,tokens:true,inventories:true}]});
 await assert.rejects(readOnlyIdentity({role:'registrar',query:bad}),/ROLE_IPC_DENIED/);
 const op=createReadOnlyIPCOperation({role:'registrar',query:bad});
 assert.deepEqual(await op({op:'identity'}),{ok:false,code:'ROLE_IDENTITY_DENIED'});
});

// node --test test/acceptance-ipc-standalone.test.mjs — built-ins ONLY.
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {mkdtemp,mkdir,copyFile,rm,readFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {canonicalize,ContractError} from '../lib/publication/canonical-json.mjs';
import {authenticatedFrames} from '../lib/publication/runtime/acceptance-ipc.mjs';
import {receiveRoleIPC} from '../ops/acceptance-bootstrap/role-ipc-client.mjs';
import {readOnlyIdentity,createReadOnlyIPCOperation,expectedGrants} from '../ops/acceptance-bootstrap/role-ipc-worker.mjs';
const root=fileURLToPath(new URL('../',import.meta.url));
const key=Buffer.alloc(32,23),frames=(role,direction)=>authenticatedFrames({key,role,direction});
test('Standalone canonical JSON preserves safe-integer ordering, escaping, Unicode and repeated references',()=>{
 assert.equal(canonicalize({z:1,a:{b:true,a:'Ελλάδα'},array:[null,'\n"\\',0]}),'{"a":{"a":"Ελλάδα","b":true},"array":[null,"\\n\\"\\\\",0],"z":1}');
 assert.equal(canonicalize(Object.assign(Object.create(null),{z:2,a:1})),'{"a":1,"z":2}');
 const shared={value:1};assert.equal(canonicalize([shared,shared]),'[{"value":1},{"value":1}]');
 assert.notEqual(canonicalize('é'),canonicalize('e\u0301'));assert.equal(canonicalize('😀'),'"😀"');
 assert.equal(canonicalize([Number.MIN_SAFE_INTEGER,Number.MAX_SAFE_INTEGER]),'[-9007199254740991,9007199254740991]');
 // Preserve the existing array-domain behavior, including ignored non-enumerable extras.
 const a=[1];Object.defineProperty(a,'hidden',{value:2});assert.equal(canonicalize(a),'[1]');
});
test('Standalone canonical JSON retains ContractError class/name/codes and rejects unsupported data',()=>{
 for(const v of [-0,NaN,Infinity,1.1,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>canonicalize(v),e=>e instanceof ContractError&&e.name==='ContractError'&&e.code==='NON_CANONICAL_NUMBER'&&e.message===e.code);
 for(const v of [undefined,()=>{},1n,Symbol('x'),{x:undefined}])assert.throws(()=>canonicalize(v),e=>e.code==='NON_JSON_VALUE');
 for(const v of ['\ud800','\udc00'])assert.throws(()=>canonicalize(v),e=>e.code==='INVALID_UNICODE');
 for(const v of [[,],Object.assign([1],{extra:2})])assert.throws(()=>canonicalize(v),e=>e.code==='NON_JSON_ARRAY');
 for(const v of [new Date(),new Map(),Object.create({inherited:true})])assert.throws(()=>canonicalize(v),e=>e.code==='NON_JSON_OBJECT');
 const cycle={};cycle.self=cycle;assert.throws(()=>canonicalize(cycle),e=>e.code==='CYCLIC_VALUE');
 const getter={};Object.defineProperty(getter,'x',{enumerable:true,get(){throw Error('getter executed');}});assert.throws(()=>canonicalize(getter),e=>e.code==='NON_JSON_OBJECT');
 assert.throws(()=>canonicalize({[Symbol('x')]:1}),e=>e.code==='NON_JSON_VALUE');
});
test('Standalone authenticated IPC accepts valid frames and denies tampering/replay/role/direction substitution',()=>{
 for(const role of ['registrar','broker']){
  const send=frames(role,'request'),receive=frames(role,'request'),first=send.encode({op:'identity'});
  if(role==='registrar')assert.equal(first.mac,'35d2f459522721571526bedbacd1d6d810c702e99d44db64b90d58024ae6f0cd');
  assert.deepEqual(receive.decode(first),{op:'identity'});assert.throws(()=>receive.decode(first),/IPC_AUTH/);
  const next=send.encode({op:'identity'});assert.throws(()=>receive.decode({...next,body:{op:'register'}}),/IPC_AUTH/);assert.deepEqual(receive.decode(next),{op:'identity'});
  assert.throws(()=>frames(role,'response').decode(first),/IPC_AUTH/);
  assert.throws(()=>frames(role==='registrar'?'broker':'registrar','request').decode(first),/IPC_AUTH/);
  assert.throws(()=>frames(role,'request').decode({...first,sequence:2}),/IPC_AUTH/);
 }
});
test('Standalone worker checks exact PostgreSQL current_user and expected least-privilege grants using SELECT only',async()=>{
 for(const role of ['registrar','broker']){
  const good={identity:'nyra_accept_'+role,...expectedGrants(role)};
  const query=async sql=>{assert.match(sql,/^select current_user/);assert(!sql.includes(';'));return {rows:[good]};};
  assert.equal((await readOnlyIdentity({role,query})).recordsWritten,0);
  const op=createReadOnlyIPCOperation({role,query});assert.equal((await op({op:'identity'})).ok,true);assert.equal((await op({op:'register'})).ok,false);
  for(const row of [{...good,identity:'postgres'},{...good,identity:'nyra_accept_'+(role==='broker'?'registrar':'broker')},{...good,tokens:!good.tokens},{...good,jobs:undefined}])await assert.rejects(readOnlyIdentity({role,query:async()=>({rows:[row]})}),/ROLE_IPC_DENIED/);
 }
});
const ipcURL=pathToFileURL(join(root,'lib/publication/runtime/acceptance-ipc.mjs')).href;
function child(mode){return spawn(process.execPath,['--input-type=module','-e',`
 import {authenticatedFrames} from ${JSON.stringify(ipcURL)};
 let input='';for await(const b of process.stdin)input+=b;
 const role='registrar',key=Buffer.alloc(32,23),inbound=authenticatedFrames({key,role,direction:'request'});
 inbound.decode(JSON.parse(input));
 const outbound=authenticatedFrames({key,role:${JSON.stringify(mode==='wrong-role'?'broker':'registrar')},direction:'response'});
 const line=JSON.stringify(outbound.encode({ok:true,result:{role,dbAuthenticated:true,roleGrantsVerified:true,recordsWritten:0}}));
 if(${JSON.stringify(mode)}!=='empty')console.log(line);
 if(${JSON.stringify(mode)}==='double')console.log(line);
 if(${JSON.stringify(mode)}==='hang')setInterval(()=>{},1000);
 else process.exit(${mode==='exit-failure'?1:0});
 `],{stdio:['pipe','pipe','pipe']});}
for(const mode of ['success','empty','exit-failure','double','wrong-role','hang'])test('Standalone coordinator waits for authenticated worker completion: '+mode,async()=>{
 const processChild=child(mode),result=receiveRoleIPC({child:processChild,role:'registrar',request:frames('registrar','request'),response:frames('registrar','response'),timeout:mode==='hang'?1500:5000});
 if(mode==='success')assert.equal((await result).role,'registrar');else await assert.rejects(result,/NYRA_IPC_/);
});
if(process.env.NYRA_IPC_SELF_COPY!=='1')test('Standalone IPC suite executes from a minimal copy with NO website dependencies or contract schemas',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nyra-ipc-no-deps-'));try{
  const files=['lib/publication/canonical-json.mjs','lib/publication/runtime/acceptance-ipc.mjs','ops/acceptance-bootstrap/role-ipc-worker.mjs','ops/acceptance-bootstrap/role-ipc-client.mjs','test/acceptance-ipc-standalone.test.mjs'];
  for(const f of files){await mkdir(dirname(join(dir,f)),{recursive:true});await copyFile(join(root,f),join(dir,f));}
  assert(!existsSync(join(dir,'node_modules'))&&!existsSync(join(dir,'lib/publication/contract.mjs')));
  const r=spawnSync(process.execPath,['--test','test/acceptance-ipc-standalone.test.mjs'],{cwd:dir,env:{PATH:process.env.PATH,NYRA_IPC_SELF_COPY:'1'},encoding:'utf8',timeout:20000});
  assert.equal(r.status,0,(r.stdout+r.stderr).slice(-1800));
 }finally{await rm(dir,{recursive:true,force:true});}
});
if(process.env.NYRA_IPC_PG_RUNTIME==='1')test('Digest-pinned worker image resolves native pg and ONLY the exact isolated worker dependency graph',async()=>{
 assert(!existsSync('/app/lib/publication/contract.mjs'));assert(!existsSync('/app/contracts'));assert(!existsSync('/app/node_modules/ajv'));
 const {default:pg}=await import('/app/node_modules/pg/lib/index.js');
 const cfg=JSON.parse(await readFile('/run/role/pg.json','utf8')),client=new pg.Client(cfg);assert.equal(client.user,cfg.user);assert.equal(client.database,'postgres');
 assert.equal((await readFile('/run/role/ipc.key')).length,32);
 const pkg=JSON.parse(await readFile('/app/node_modules/pg/package.json','utf8'));assert.equal(pkg.version,'8.16.3');
});

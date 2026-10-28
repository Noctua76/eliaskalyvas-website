// Optional REAL PostgreSQL acceptance. Dedicated disposable Unix-socket cluster
// only. This never contacts Supabase cloud and is NOT an actual GoTrue MFA test.
// node test/phase4b-native.acceptance.mjs /absolute/pg/lib/index.js /tmp/nyra-phase4b-.../socket
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {randomUUID} from 'node:crypto';
import {databaseFixture} from './fixture.mjs';
import {deliveryFixture} from './fixtures/delivery.mjs';
import {uid} from './fixtures/publication-v1.1.mjs';
const [modulePath,socket]=process.argv.slice(2);
assert(modulePath?.startsWith('/')&&/^\/tmp\/nyra-phase4b-[^/]+\/socket$/.test(socket||''),'Dedicated disposable native socket required');
const pg=(await import(pathToFileURL(modulePath))).default;const name='nyra_phase4b_'+randomUUID().replaceAll('-','');
const admin=new pg.Client({host:socket,port:6543,user:'postgres',database:'postgres'});await admin.connect();await admin.query('create database '+name);
let client,f,other;
try{
 client=new pg.Client({host:socket,port:6543,user:'postgres',database:name});await client.connect();
 const backend=async()=>databaseFixture({exec:async sql=>client.query(sql),query:(sql,args)=>client.query(sql,args),close:async()=>{}});
 f=await deliveryFixture({backend});await f.register(uid(8000));await f.register(uid(8001),'101','1','301');
 other=new pg.Client({host:socket,port:6543,user:'postgres',database:name});await other.connect();
 await client.query('begin');await f.call('nyra_delivery_claim',{p_id:uid(8000)});
 let settled=false;const competing=other.query('select public.nyra_delivery_claim($1)',[uid(8001)]).then(()=>({ok:true}),e=>({error:e})).finally(()=>{settled=true});
 await new Promise(r=>setTimeout(r,100));assert.equal(settled,false,'Second native transaction must block on catalog/control lock');await client.query('commit');const loser=await competing;assert.match(loser.error?.message||'',/DELIVERY_LEASE_BUSY/);
 await client.query('set role anon');await assert.rejects(client.query('select public.nyra_delivery_enqueue()'),/permission denied/);await client.query('reset role');
 await client.query('set role service_role');assert.equal(await f.call('nyra_delivery_enqueue'),0);await client.query('reset role');
 const funcs=(await client.query("select prosecdef,has_function_privilege('anon',oid,'execute') anon from pg_proc where proname like 'nyra_delivery_%'")).rows;assert(funcs.length===11&&funcs.every(f=>!f.prosecdef&&!f.anon));
 console.log(JSON.stringify({nativePostgres:(await client.query('select version() v')).rows[0].v,parallelLocking:'PASS',invokerPrivileges:'PASS',actualSupabaseJWT:'NOT VERIFIED — GoTrue stack required'}));
}finally{await other?.end();await client?.end();await admin.query('drop database '+name);await admin.end()}

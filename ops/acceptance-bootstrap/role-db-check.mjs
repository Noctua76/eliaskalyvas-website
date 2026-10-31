// Read-only role credential and SQL permission check inside an isolated container.
// No listening sockets, GitHub tokens, DDL, DML, or credential logging.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import pg from '/app/node_modules/pg/lib/index.js';
const role=process.argv[2];
assert(['registrar','broker'].includes(role),'ROLE_DENIED');
const credentials=JSON.parse(await readFile('/run/role/pg.json','utf8'));
assert.equal(credentials.user,'nyra_accept_'+role);
assert.equal(credentials.database,'postgres');
assert.equal(credentials.host,'db');
assert.equal(credentials.port,5432);
const config={...credentials,connectionTimeoutMillis:5000,statement_timeout:5000,
 query_timeout:7000,application_name:'nyra-5c-db-role-'+role,ssl:false};
let client;
try{
 client=new pg.Client(config);await client.connect();
 const identity=(await client.query('select current_user as name, inet_client_addr() is not null as over_tcp')).rows[0];
 assert.equal(identity.name,credentials.user);
 assert.equal(identity.over_tcp,true);
 const permissions=(await client.query(
 "select has_table_privilege(current_user,'nyra_trust.jobs','INSERT') as jobs,"+
 " has_table_privilege(current_user,'nyra_trust.used_tokens','INSERT') as tokens,"+
 " has_table_privilege(current_user,'nyra_trust.inventories','INSERT') as inventories"
 )).rows[0];
 assert.deepEqual(permissions,role==='registrar'?
  {jobs:true,tokens:false,inventories:true}:{jobs:false,tokens:true,inventories:false});
 // A different login MUST reject this role's secret over TCP.
 const wrong=new pg.Client({...config,user:'nyra_accept_'+(role==='registrar'?'broker':'registrar')});
 let accepted=false;
 try{await wrong.connect();accepted=true;}catch(e){assert.equal(e.code,'28P01');}
 finally{await wrong.end().catch(()=>{});}
 assert.equal(accepted,false,'CROSS_ROLE_CREDENTIAL_ACCEPTED');
 console.log(JSON.stringify({role,loginAuthenticated:true,overPrivateTCP:true,
  expectedGrants:true,crossRolePasswordDenied:true,recordsWritten:0}));
}catch(e){
 console.error('NYRA_ROLE_AUTH_FAILED '+String(e.code||e.name||'UNKNOWN').slice(0,60));
 process.exitCode=1;
}finally{if(client)await client.end().catch(()=>{});}

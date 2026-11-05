// Disposable native PostgreSQL 17 mechanical proof, never a real Owner grant.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {IMAGE} from '../ops/acceptance-bootstrap/db-stage.mjs';
import {replacementRenewalWindow,replacementRenewalSQL} from '../ops/acceptance-bootstrap/repository-db.mjs';
const enabled=process.env.NYRA_NATIVE_POSTGRES==='1'&&process.platform==='linux';
const docker=(args,input)=>execFileSync('docker',args,{encoding:'utf8',timeout:90000,
 input,stdio:[input?'pipe':'ignore','pipe','pipe']}).trim();
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
test('native PG17 renewal invalidates old/wrong credentials, enforces expiry and internal-only network',
 {skip:!enabled,timeout:240000},async()=>{
 const id=randomBytes(6).toString('hex'),name='nyra-ci-pg-'+id,net='nyra-ci-pgnet-'+id;
 const secret=()=>randomBytes(24).toString('hex');
 const old={registrar:secret(),broker:secret()},fresh={registrar:secret(),broker:secret()};
 let network=false,container=false;
 const admin=(sql)=>docker(['exec','-i',name,'psql','-X','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-t','-A'],sql);
 const login=(user,password)=>{
  try{return docker(['exec','-e','PGPASSWORD='+password,name,'psql','-X','-h','127.0.0.1','-U',user,'-d','postgres','-t','-A','-c','select current_user']);}
  catch{return null;}
 };
 try{
  docker(['network','create','--internal',net]);network=true;
  docker(['run','-d','--name',name,'--network',net,'--restart','no',
   '--security-opt','no-new-privileges:true','-e','POSTGRES_PASSWORD='+secret(),
   '-e','POSTGRES_DB=postgres',IMAGE]);container=true;
  let ready=false;
  for(let i=0;i<100;i++){
   try{docker(['exec',name,'pg_isready','-U','postgres','-d','postgres']);ready=true;break;}
   catch{await delay(500);}
  }
  assert(ready,'PostgreSQL 17 did not initialize in disposable container');
  const version=Number(admin('show server_version_num;'));
  assert(version>=170000&&version<180000,'Expected PostgreSQL 17');
  assert.equal(docker(['network','inspect','-f','{{.Internal}}',net]),'true');
  assert(['{}','null'].includes(docker(['inspect','-f','{{json .HostConfig.PortBindings}}',name])));
  admin("create role nyra_accept_registrar login password '"+old.registrar+"'; "+
        "create role nyra_accept_broker login password '"+old.broker+"'; "+
        "grant connect on database postgres to nyra_accept_registrar,nyra_accept_broker;");
  assert.equal(login('nyra_accept_registrar',old.registrar),'nyra_accept_registrar');
  assert.equal(login('nyra_accept_broker',old.broker),'nyra_accept_broker');
  const now=Math.floor(Date.now()/1000)*1000,created=new Date(now-1000).toISOString();
  const target={schema:'nyra.acceptance.replacement.v2',
   bootstrapId:'nyra-acceptance-20261106-02',hostname:'nyra-acceptance-20261106-02',
   provider:'DigitalOcean',region:'fra1',origin:'https://nyra-acceptance.eliaskalyvas.gr',
   operatorCIDRs:['203.0.113.10/32'],cpu:4,memoryGiB:8,maximumHours:336,optionalResources:false,
   reviewedHead:'29a73458d4cd941e5ed514db56dc2c553d041bda',
   resourceId:'615221105',ipv4:'93.184.216.34',createdAt:created,
   expiresAt:new Date(now-1000+14*86400000).toISOString(),authorization:false};
  const session={schema:'nyra.acceptance.pg-session.v1',bootstrapId:target.bootstrapId,
   providerResourceId:target.resourceId,sessionId:'d7df28d6-04c1-4b34-a32a-076c6d5be033',
   startsAt:created,endsAt:new Date(now+3600000).toISOString(),authorization:false};
  const lease=replacementRenewalWindow(target,session,{now:()=>now});
  const sql=replacementRenewalSQL(lease,fresh);
  const rows=admin(sql).split('\n').map(x=>x.trim()).filter(x=>x.includes('|'));
  assert.deepEqual(rows,[ 'nyra_accept_broker|'+lease.roleValidUntil,
   'nyra_accept_registrar|'+lease.roleValidUntil]);
  assert.equal(login('nyra_accept_registrar',old.registrar),null,'Old login survived password rotation');
  assert.equal(login('nyra_accept_broker',old.broker),null,'Old broker login survived rotation');
  assert.equal(login('nyra_accept_registrar',fresh.registrar),'nyra_accept_registrar');
  assert.equal(login('nyra_accept_broker',fresh.broker),'nyra_accept_broker');
  assert.equal(login('nyra_accept_registrar',fresh.broker),null,'Broker password accepted as registrar');
  admin("alter role nyra_accept_registrar valid until '2000-01-01 00:00:00 UTC';");
  assert.equal(login('nyra_accept_registrar',fresh.registrar),null,'Expired PostgreSQL login succeeded');
 }finally{
  if(container)try{docker(['rm','-f',name]);}catch{}
  if(network)try{docker(['network','rm',net]);}catch{}
 }
});

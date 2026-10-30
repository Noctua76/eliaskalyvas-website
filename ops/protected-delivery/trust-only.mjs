// Targeted native trust acceptance; reuses approved 5A/5B image locks and 5C-A
// SQL suite. No Auth/Storage/Edge/inspection stack and no production linking.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes} from 'node:crypto';
const command=(name,args)=>execFileSync(name,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000});
if(process.env.NYRA_TRUST_CONTAINER==='1'){
 const {nativeProtectedAcceptance}=await import('./native.mjs');
 const {acceptProtectedIntegration}=await import('./integration-acceptance.mjs');
 const {default:pg}=await import('../native-acceptance/node_modules/pg/lib/index.js');
 const config=JSON.parse(readFileSync('/trust-config.json')),clients=[];
 try{
  await nativeProtectedAcceptance({...config,event:(id,status,detail)=>console.log(JSON.stringify({id,status,detail}))});
  const connect=async()=>{const c=new pg.Client({host:config.dbHost,port:5432,user:'postgres',password:config.password,database:'postgres',statement_timeout:15000,lock_timeout:10000});await c.connect();clients.push(c);return c;};
  const registrar=await connect(),a=await connect(),b=await connect();await registrar.query('set role nyra_trust_registrar');await a.query('set role nyra_trust_broker');await b.query('set role nyra_trust_broker');
  console.log(JSON.stringify({id:'B2-native-composition',status:'PASS',detail:await acceptProtectedIntegration({registrarQuery:registrar.query.bind(registrar),brokerQuery:a.query.bind(a),otherBrokerQuery:b.query.bind(b)})}));
 }finally{await Promise.all(clients.map(c=>c.end()));}
}else{
 assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_ENVIRONMENT==='github-hosted'&&process.env.NYRA_TRUST_CI==='1');
 assert(!process.env.SUPABASE_URL&&!process.env.SUPABASE_SERVICE_ROLE_KEY&&!process.env.SUPABASE_ACCESS_TOKEN);
 const head=command('git',['rev-parse','HEAD']).trim();assert.equal(head,process.env.NYRA_TEST_SHA);command('git',['diff','--exit-code']);
 const images=JSON.parse(readFileSync(new URL('../native-acceptance/images.lock.json',import.meta.url))),root=mkdtempSync(join(tmpdir(),'nyra-b2-trust-'));
 const name='nyra-b2-'+process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT,network=name+'-isolated',password=randomBytes(24).toString('hex');console.log('::add-mask::'+password);
 let bridge,hostRule=false,forwardRule=false;
 try{
  for(const key of ['db','driver'])command('docker',['pull',images[key].image]);
  command('docker',['network','create','--internal',network]);const info=JSON.parse(command('docker',['network','inspect',network]))[0];assert(info.Internal);bridge='br-'+info.Id.slice(0,12);
  command('sudo',['iptables','-I','INPUT','1','-i',bridge,'-m','conntrack','--ctstate','NEW','-j','DROP']);hostRule=true;
  command('sudo',['iptables','-I','DOCKER-USER','1','-i',bridge,'!','-o',bridge,'-j','DROP']);forwardRule=true;
  writeFileSync(join(root,'config.json'),JSON.stringify({dbHost:'db',ports:{db:5432},password,prefix:'B2'}),{mode:0o600});
  writeFileSync(join(root,'db.env'),'POSTGRES_PASSWORD='+password+'\nPOSTGRES_DB=postgres\n',{mode:0o600});
  command('docker',['run','-d','--name',name+'-db','--network',network,'--network-alias','db','--security-opt','no-new-privileges:true','--env-file',join(root,'db.env'),images.db.image]);
  for(let i=0;;i++){try{command('docker',['exec',name+'-db','pg_isready','-h','127.0.0.1','-U','postgres']);break;}catch{if(i===45)throw Error('DB_TIMEOUT');await new Promise(r=>setTimeout(r,1000));}}
  const args=['run','--rm','--name',name+'-driver','--network',network,'--user',String(process.getuid())+':'+String(process.getgid()),'--cap-drop','ALL','--security-opt','no-new-privileges:true','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=32m','-v',resolve('.')+':/work:ro','-v',join(root,'config.json')+':/trust-config.json:ro','-w','/work','-e','NYRA_TRUST_CONTAINER=1',images.driver.image,'node','ops/protected-delivery/trust-only.mjs'];
  const output=command('docker',args);console.log(output);
  console.log(JSON.stringify({id:'B2-exact-head-native-trust',status:'PASS',head,internalNetwork:true,hostAndExternalDenied:true,images:{db:images.db.image,driver:images.driver.image},realProtectedOIDC:'NOT VERIFIED'}));
 }catch(error){
  const safe=String(error.stderr||error.message).replaceAll(password,'[redacted]').replace(/eyJ[A-Za-z0-9_.-]+/g,'[jwt-redacted]');
  console.error('B2_NATIVE_TRUST_FAILED '+safe.slice(-2500));process.exitCode=1;
 }finally{
  for(const resource of [name+'-driver',name+'-db'])try{command('docker',['rm','-f',resource]);}catch{}
  if(hostRule)command('sudo',['iptables','-D','INPUT','-i',bridge,'-m','conntrack','--ctstate','NEW','-j','DROP']);
  if(forwardRule)command('sudo',['iptables','-D','DOCKER-USER','-i',bridge,'!','-o',bridge,'-j','DROP']);
  try{command('docker',['network','rm',network]);}catch{process.exitCode=1;}rmSync(root,{recursive:true,force:true});
 }
}

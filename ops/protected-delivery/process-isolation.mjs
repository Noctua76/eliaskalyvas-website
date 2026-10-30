// Extends the existing disposable native DB only. Separate Docker PID/filesystem
// namespaces, distinct LOGINs, role-bound MAC IPC; credential-free offline build.
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {createInterface} from 'node:readline';
import {join,resolve} from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {authenticatedFrames} from '../../lib/publication/runtime/acceptance-ipc.mjs';
import {isolatedFixture} from './isolated-fixture.mjs';
import {signedOIDC} from '../../test/fixtures/phase4b.mjs';
import {claims} from '../../test/fixtures/protected-integration.mjs';
export function bootstrapAcceptanceLogins(command,container,secrets){
 if(Object.keys(secrets).sort().join(',')!=='broker,registrar'||!['registrar','broker'].every(role=>/^[a-f0-9]{48}$/.test(secrets[role])))throw Error('LOGIN_SECRET_FORMAT');
 const sql=Object.entries(secrets).map(([role,password])=>`create role nyra_accept_${role} login inherit password '${password}' in role nyra_trust_${role};`).join('\n')+'\ngrant connect on database postgres to nyra_accept_registrar,nyra_accept_broker;';
 // execFileSync ignores input when stdio[0] is ignore. Explicitly pipe SQL;
 // no password is passed in argv or printed. These are isolated test logins.
 return command('docker',['exec','-i',container,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'],{input:sql,stdio:['pipe','pipe','pipe']});
}
export async function acceptProcessIsolation({command,images,network,name,root,head}){
 const fixture=isolatedFixture(head,'build'),signed=await signedOIDC(),children=[];
 const receiptKeys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),receiptPublic=await crypto.subtle.exportKey('jwk',receiptKeys.publicKey),receiptPrivate=await crypto.subtle.exportKey('jwk',receiptKeys.privateKey);
 const secrets={registrar:randomBytes(24).toString('hex'),broker:randomBytes(24).toString('hex')};
 for(const secret of Object.values(secrets))console.log('::add-mask::'+secret);
 bootstrapAcceptanceLogins(command,name+'-db',secrets);
 const dir=join(root,'normal');mkdirSync(dir);const builderPath=join(root,'builder.json');
  assert.equal(command('git',['rev-parse','HEAD']).trim(),head);assert.equal(command('git',['status','--porcelain','--untracked-files=all']).trim(),'');
 const sourceManifest=Object.fromEntries(command('git',['ls-files','-z']).split('\0').filter(Boolean).map(path=>[path,createHash('sha256').update(readFileSync(path)).digest('hex')]));
 writeFileSync(builderPath,JSON.stringify({sourceManifest,scope:'synthetic-isolated-acceptance',role:'builder',head,builder:fixture.builder}),{mode:0o600});
 const common=['--user',process.getuid()+':'+process.getgid(),'--cap-drop','ALL','--security-opt','no-new-privileges:true','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=128m','-v',resolve('.')+':/work:ro','-w','/work','-e','NYRA_ISOLATED_WORKER=1'];
 // Git checkout is read-only and belongs to the same uid as the builder. No
 // admin/role configuration, JWT, MAC key, socket or DB network is mounted.
 let normal;
 const connect=role=>{
  const key=randomBytes(32),path=join(root,role+'.json');writeFileSync(path,JSON.stringify({scope:'synthetic-isolated-acceptance',role,head,ipcKey:key.toString('hex'),receiptPublic,...(role==='broker'?{receiptPrivate}:{}),jwk:signed.jwk,db:{host:'db',port:5432,user:'nyra_accept_'+role,password:secrets[role],database:'postgres'}}),{mode:0o600});
  const child=spawn('docker',['run','--rm','-i','--name',name+'-'+role,'--network',network,...common,'-v',path+':/worker.json:ro',...(role==='registrar'?['-v',dir+':/rebuild:ro']:[]),images.driver.image,'node','ops/protected-delivery/isolated-worker.mjs'],{stdio:['pipe','pipe','pipe']});children.push({child,role});
  const requests=authenticatedFrames({key,role,direction:'request'}),responses=authenticatedFrames({key,role,direction:'response'});let waiting,pending=Promise.resolve();
  createInterface({input:child.stdout,crlfDelay:Infinity}).on('line',line=>{try{const value=responses.decode(JSON.parse(line));waiting?.resolve(value);}catch{waiting?.reject(Error('IPC_RESPONSE_DENIED'));}});
  let diagnostic='',oversized=false;const privateValues=[...Object.values(secrets),key.toString('hex'),receiptPrivate.d];
  child.stderr.on('data',b=>{if(oversized)return;if(diagnostic.length+b.length>16000){oversized=true;diagnostic='';}else diagnostic+=String(b);});
  child.on('exit',()=>{let safe=oversized?'STARTUP_DIAGNOSTIC_TOO_LARGE':diagnostic;for(const value of privateValues)if(value)safe=safe.replaceAll(value,'[redacted]');waiting?.reject(Error('WORKER_EXIT '+role+' '+safe.replace(/eyJ[A-Za-z0-9_.-]+/g,'[jwt-redacted]').slice(-1600)));});
  return body=>{const task=pending.then(()=>new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('IPC_TIMEOUT')),30000);waiting={resolve:v=>{clearTimeout(timer);waiting=null;resolve(v);},reject:e=>{clearTimeout(timer);waiting=null;reject(e);}};child.stdin.write(JSON.stringify(requests.encode(body))+'\n');}));pending=task.catch(()=>{});return task;};
 };
 try{
  const registrar=connect('registrar'),broker=connect('broker'),ok=async(p)=>{const r=await p;assert.equal(r.ok,true);return r.result;};
  assert.equal((await ok(registrar({op:'identity'}))).user,'nyra_accept_registrar');assert.equal((await ok(broker({op:'identity'}))).user,'nyra_accept_broker');
  for(const role of ['registrar','broker']){const inspect=JSON.parse(command('docker',['inspect',name+'-'+role]))[0];assert.equal(inspect.HostConfig.Privileged,false);assert.equal(inspect.HostConfig.ReadonlyRootfs,true);assert.equal(inspect.HostConfig.PidMode,'');assert(!inspect.Mounts.some(m=>/docker.sock|trust-config/.test(m.Destination)));assert.deepEqual(inspect.Mounts.filter(m=>m.Type==='bind').map(m=>m.Destination).sort(),(role==='registrar'?['/work','/worker.json','/rebuild']:['/work','/worker.json']).sort());}
  await ok(registrar({op:'register',privilege:'build'}));await ok(registrar({op:'register',privilege:'publication'}));
  const token=privilege=>{const f=isolatedFixture(head,privilege),seconds=Math.floor(Date.now()/1000);return signed.sign({...claims(f.policy),sha:head,run_id:f.selector.runId,check_run_id:f.builder.checkRunId,jti:crypto.randomUUID(),iat:seconds,nbf:seconds,exp:seconds+300});};
  const buildToken=await token('build'),authorized=await ok(broker({op:'authorize',privilege:'build',token:buildToken}));
  command('docker',['run','--rm','--name',name+'-offline-builder','--network','none',...common,'-v',builderPath+':/worker.json:ro','-v',dir+':/evidence:rw',images.driver.image,'node','ops/protected-delivery/isolated-worker.mjs']);
  assert.equal(command('git',['rev-parse','HEAD']).trim(),head);assert.equal(command('git',['status','--porcelain','--untracked-files=all']).trim(),'');
  normal=JSON.parse(readFileSync(join(dir,'normal.json')));assert.equal(normal.record.inventory.codeSHA,head);assert.equal(normal.record.builder.assurance,'unprotected_ci');
  const revalidated=await ok(broker({op:'revalidate',handle:authorized.handle}));
  const tampered=structuredClone(revalidated);tampered.record.handle='forged';assert.equal((await registrar({op:'capture',...authorized,revalidated:tampered})).ok,false);
  const approved=await ok(registrar({op:'capture',...authorized,revalidated}));assert.equal(approved.digest.length,64);
  assert.equal((await broker({op:'authorize',privilege:'build',token:buildToken})).ok,false);
  assert.equal((await broker({op:'consume',token:await token('build'),configurationSHA256:approved.configurationSHA256})).ok,false);
  assert.equal((await ok(broker({op:'consume',token:await token('publication'),configurationSHA256:approved.configurationSHA256}))).publicationIdentity,true);
  assert.equal((await ok(broker({op:'forbidden-write'}))).denied,true);assert.equal((await broker({op:'register',privilege:'build'})).ok,false);
  await ok(registrar({op:'revoke'}));assert.equal((await broker({op:'revalidate',handle:authorized.handle})).ok,false);assert.equal((await broker({op:'authorize',privilege:'build',token:await token('build')})).ok,false);
  return {distinctLoginRoles:true,separateContainers:true,authenticatedSequenceBoundIPC:true,offlineCredentialFreeRebuild:true,normalFiles:normal.record.files.length,byteInventory:true,immutableRegistration:true,publicationOnlyConsumption:true,replayAndRevocation:true,realProtectedGithubOIDC:'NOT VERIFIED'};
 }finally{
  for(const {child} of children)child.stdin.end();
  await Promise.all(children.map(({child,role})=>new Promise(resolve=>{const timer=setTimeout(()=>{try{command('docker',['rm','-f',name+'-'+role]);}catch{}resolve();},5000);child.once('exit',()=>{clearTimeout(timer);resolve();});})));
 }
}

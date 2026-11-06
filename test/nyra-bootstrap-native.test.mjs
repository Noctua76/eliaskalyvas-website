// Real disposable Ubuntu 24.04 pinned installation and PostgreSQL renewal.
// SYNTHETIC provider ID/CIDR: this is NOT DigitalOcean or Owner acceptance.
// No secrets, protected dispatch, production publication, or DNS mutation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,lstat} from 'node:fs/promises';
import {createHash,randomUUID} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {prepareOfflineBootstrap} from '../ops/acceptance-bootstrap/offline-bootstrap.mjs';
import {verifyOffline} from '../ops/acceptance-bootstrap/verify-offline.mjs';
import {validateReplacementTarget} from '../ops/acceptance-bootstrap/replacement-target.mjs';
const enabled=process.env.NYRA_NATIVE_BOOTSTRAP==='1'&&process.platform==='linux';
const command=(file,args,opts={})=>execFileSync(file,args,{encoding:'utf8',timeout:900000,
 stdio:['ignore','pipe','pipe'],...opts}).trim();
const utc=ms=>new Date(Math.floor(ms/1000)*1000).toISOString().replace('.000Z','Z');
const sha=x=>createHash('sha256').update(x).digest('hex');
test('Ubuntu 24.04 pinned installer, isolated PG renewal and interruption recovery',{skip:!enabled,timeout:900000},async()=>{
 assert.equal(process.getuid?.(),0,'Native bootstrap requires isolated disposable root runner');
 const release=await readFile('/etc/os-release','utf8');
 assert.match(release,/^ID=ubuntu$/m);
 assert.match(release,/^VERSION_ID="24.04"$/m);
 const temp=await mkdtemp(join(tmpdir(),'nyra-bootstrap-native-'));
 const originalHost=command('hostname',[]);
 let changedHostname=false;
 try{
  const vendor=join(temp,'vendor');
  const offline=await verifyOffline({vendor,download:true});
  assert.equal(offline.canonicalExpiryManifestPinned,true);
  const planned=JSON.parse(await readFile(new URL('../ops/acceptance-bootstrap/replacement-target.example.json',import.meta.url),'utf8'));
  Object.assign(planned,{schema:'nyra.acceptance.replacement.v2',bootstrapId:'nyra-acceptance-native-bootstrap',hostname:'nyra-acceptance-native-bootstrap',maximumHours:336,reviewedHead:'29a73458d4cd941e5ed514db56dc2c553d041bda',operatorCIDRs:[process.env.NYRA_NATIVE_KEEP_FOR_REBOOT==='1'?'10.0.2.2/32':'203.0.113.10/32']});
  validateReplacementTarget(planned);
  const bundle=join(temp,'bundle');
  const manifest=await prepareOfflineBootstrap({target:planned,vendor,destination:bundle});
  const started=utc(Date.now()-1000);
  const created={...planned,resourceId:'615221105',ipv4:'93.184.216.34',
   createdAt:started,expiresAt:utc(Date.parse(started)+14*86400000)};
  validateReplacementTarget(created,{created:true});
  await writeFile(join(bundle,'target.created.json'),JSON.stringify(created),{flag:'wx',mode:0o600});
  const file=join(bundle,'manifest.json'),hash=sha(await readFile(file));
  assert.equal(hash.length,64);
  command('hostnamectl',['set-hostname',planned.hostname]);
  changedHostname=true;
  assert.equal(command('hostname',[]),planned.hostname);
  const result=command('bash',[join(bundle,'setup.sh'),'--install-host',hash],{cwd:bundle});
  assert.match(result,/HOST_BASE_ONLY_NO_CREDENTIALS_NO_DISPATCH/);
  console.log(result);
  console.log(JSON.stringify({phase:'installer',os:release,architecture:command('uname',['-m']),
   manifestSHA256:hash,prerequisites:JSON.parse(await readFile(new URL('../ops/acceptance-bootstrap/prerequisites.lock.json',import.meta.url),'utf8')),
   installerExecuted:true,dockerServerVersion:command('docker',['version','--format','{{.Server.Version}}']),rebootPerformed:false,realOwnerAuthorization:false}));
  assert.equal(command('systemctl',['is-enabled','nyra-repository-expiry.timer']),'enabled');
  assert.equal(command('systemctl',['is-active','nyra-repository-expiry.timer']),'active');
  assert.equal(command('systemctl',['show','nyra-repository-expiry.timer','--property=Persistent','--value']),'yes');
  const time=command('systemctl',['show','nyra-repository-expiry.timer','--property=NextElapseUSecRealtime','--value']);
  assert(time.endsWith(created.expiresAt.slice(0,19).replace('T',' ')+' UTC'));
  const installed=await readFile('/usr/local/sbin/nyra-repository-expire');
  assert.equal(sha(installed),manifest.files['expire.sh']);
  const rootTarget=await lstat('/etc/nyra-acceptance/target.json');
  assert.equal(rootTarget.uid,0);
  assert.equal(rootTarget.mode&0o777,0o600);
  assert.equal(JSON.parse(await readFile('/etc/nyra-acceptance/target.json','utf8')).resourceId,created.resourceId);
  assert.equal(command('systemctl',['show','nyra-repository-runtime.service','--property=ActiveState','--value']),'inactive');
  // Execute the INSTALLED pinned DB stage and renewal module, not a SQL-only
  // approximation. Authentication below is real SCRAM in Docker. Trust adapters
  // are explicitly synthetic mechanics; CI never fabricates a live Owner grant.
  const installedDir='/opt/nyra-5c/live-runtime/ops/acceptance-bootstrap/';
  command('/usr/local/bin/node',[installedDir+'repository-db.mjs','--apply','/etc/nyra-acceptance/target.json'],
   {env:{...process.env,NYRA_REPOSITORY_DB:'1'}});
  const {applyAuthorizedRenewal}=await import('file://'+installedDir+'repository-db-renewal.mjs');
  const session=()=>({schema:'nyra.acceptance.pg-session.v1',bootstrapId:created.bootstrapId,
   providerResourceId:created.resourceId,sessionId:randomUUID(),startsAt:utc(Date.now()-1000),
   endsAt:new Date(Date.now()+3600000).toISOString(),authorization:false});
  const trust={verified:true,approvalSHA256:'a'.repeat(64),repositoryTrustSHA256:'b'.repeat(64)};
  const journal='/opt/nyra-5c/private/renewal-state.json';
  const a=session(),args={target:created,session:a,assertTrust:async()=>trust,paths:{journal}};
  const first=await applyAuthorizedRenewal(args);
  assert.equal(first.oldLoginRejected,true);assert.equal(first.newLoginVerified,true);
  await assert.rejects(applyAuthorizedRenewal(args),/REPLAY/);
  const b=session();
  const interrupted=spawnSync('/usr/local/bin/node',['--input-type=module','-e',
   `import {applyAuthorizedRenewal} from ${JSON.stringify('file://'+installedDir+'repository-db-renewal.mjs')};
    let checks=0;await applyAuthorizedRenewal({target:${JSON.stringify(created)},session:${JSON.stringify(b)},
    paths:{journal:${JSON.stringify(journal)}},assertTrust:async()=>{
     if(++checks===2)process.kill(process.pid,'SIGKILL');return ${JSON.stringify(trust)};
    }});`],{encoding:'utf8',timeout:120000});
  assert.equal(interrupted.signal,'SIGKILL');
  assert.equal(JSON.parse(await readFile(journal,'utf8')).status,'pending');
  const c=session();
  assert.equal((await applyAuthorizedRenewal({...args,session:c})).status,'POSTGRESQL_RENEWAL_COMMITTED');
  const final=JSON.parse(await readFile(journal,'utf8'));
  assert.deepEqual(final.usedSessionIds,[a.sessionId,b.sessionId,c.sessionId]);
  await assert.rejects(applyAuthorizedRenewal(args),/REPLAY/);
  for(const role of ['registrar','broker']){
   const st=await lstat('/var/lib/nyra-5c/'+role+'/pg.json');
   assert.equal(st.mode&0o777,0o600);assert(st.uid>0);
  }
  const audit=await readFile('/var/lib/nyra-retirement/db-renewal-audit.jsonl','utf8');
  assert(audit.includes('RECOVERY_NEW_SESSION_RESERVED'));
  assert(!/password|PGPASSWORD|privateKey|Bearer/.test(audit));
  console.log(JSON.stringify({phase:'installed-db-renewal',postgres17:true,internalNetwork:true,
   newSCRAMLoginVerified:true,oldLoginRejected:true,replayAAfterCRejected:true,
   actualProcessSIGKILL:true,recoveryWithNewSession:true,credentialsLogged:false,
   realOwnerAuthorization:false,rebootPerformed:false}));
  // Retirement mechanism uses target-labelled resources only. No provider call.
  if(process.env.NYRA_NATIVE_KEEP_FOR_REBOOT==='1'){
   await writeFile('/etc/nyra-acceptance/native-reboot-pending.json',JSON.stringify({
    bootId:(await readFile('/proc/sys/kernel/random/boot_id','utf8')).trim(),target:created,
    expirySHA256:sha(await readFile('/etc/systemd/system/nyra-repository-expiry.timer'))}),{flag:'wx',mode:0o600});
   return;
  }
  const {cleanupReplacement}=await import('file://'+installedDir+'repository-launch.mjs');
  const cleaned=cleanupReplacement(created,{apply:true});
  assert.equal(command('docker',['ps','-aq','--filter','name=^nyra-repository-pg$']),'');
  assert.equal(command('docker',['network','ls','--filter','name=^nyra-repository-db$','--format','{{.Name}}']),'');
  console.log(JSON.stringify({phase:'exact-resource-cleanup',result:cleaned,providerDestruction:false}));

 }finally{
  if(process.env.NYRA_NATIVE_KEEP_FOR_REBOOT!=='1')try{command('systemctl',['disable','--now','nyra-repository-expiry.timer']);}catch{}
  if(process.env.NYRA_NATIVE_KEEP_FOR_REBOOT!=='1')try{command('hostnamectl',['set-hostname',originalHost]);}catch{}
  await rm(temp,{recursive:true,force:true});
 }
});

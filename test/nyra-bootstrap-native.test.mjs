// Real disposable Ubuntu 24.04 host-base installer exercise on a CI runner.
// SYNTHETIC provider ID/CIDR: this is NOT DigitalOcean or Owner acceptance.
// No secrets, protected dispatch, production publication, or DNS mutation.
import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {mkdtemp,readFile,writeFile,rm,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
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
test('Ubuntu 24.04 real pinned host-base installer, no credentials or provider mutation',{skip:!enabled,timeout:900000},async()=>{
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
  Object.assign(planned,{schema:'nyra.acceptance.replacement.v2',bootstrapId:'nyra-acceptance-native-bootstrap',hostname:'nyra-acceptance-native-bootstrap',maximumHours:336,reviewedHead:'29a73458d4cd941e5ed514db56dc2c553d041bda',operatorCIDRs:['203.0.113.10/32']});
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
 }finally{
  try{command('systemctl',['disable','--now','nyra-repository-expiry.timer']);}catch{}
  try{command('hostnamectl',['set-hostname',originalHost]);}catch{}
  await rm(temp,{recursive:true,force:true});
 }
});

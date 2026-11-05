import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {mkdtemp,writeFile,chmod,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomBytes} from 'node:crypto';
import {renderCanonicalExpiryService,renderCanonicalExpiryTimer} from '../ops/acceptance-bootstrap/offline-bootstrap.mjs';
import {validateReplacementTarget} from '../ops/acceptance-bootstrap/replacement-target.mjs';
const start='2026-11-06T09:00:00Z',end='2026-11-20T09:00:00Z';
test('native systemd calendar parser accepts exact v2 UTC retirement, never day-3 goal',{skip:process.platform!=='linux'},()=>{
 let out;
 try{out=execFileSync('systemd-analyze',['calendar','2026-11-20 09:00:00 UTC'],{encoding:'utf8',timeout:10000});}
 catch(e){if(e.code==='ENOENT')return;throw e;}
 assert.match(out,/Normalized form:\s+2026-11-20 09:00:00 UTC/);
 assert.doesNotMatch(out,/2026-11-09 09:00:00/);
 const t={schema:'nyra.acceptance.replacement.v2',bootstrapId:'nyra-acceptance-20261106-02',hostname:'nyra-acceptance-20261106-02',provider:'DigitalOcean',region:'fra1',origin:'https://nyra-acceptance.eliaskalyvas.gr',operatorCIDRs:['203.0.113.10/32'],cpu:4,memoryGiB:8,maximumHours:336,optionalResources:false,reviewedHead:'29a73458d4cd941e5ed514db56dc2c553d041bda',resourceId:'615221105',ipv4:'93.184.216.34',createdAt:start,expiresAt:end,authorization:false};
 assert.equal(validateReplacementTarget(t,{created:true,now:()=>Date.parse(start)+4*86400000}).created,true);
});
test('canonical installer source has one active expiry name and rejects stale alternative',()=>{
 const script=readFileSync(new URL('../ops/acceptance-bootstrap/offline-bootstrap.mjs',import.meta.url),'utf8');
 assert.match(script,/nyra-repository-expiry\.timer/);
 assert.match(script,/nyra-continuation-expiry\.timer/);
 assert.match(script,/os\.path\.lexists\(os\.path\.join\(base,name\)\)/);
 assert.match(script,/AccuracySec=1s/);
});

test('native systemd unit parser validates canonical source-generated expiry service and timer',{skip:process.platform!=='linux',timeout:20000},async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nyra-systemd-native-'));
 try{
  const expiry=join(dir,'retire.sh'),service=join(dir,'nyra-repository-expiry.service'),timer=join(dir,'nyra-repository-expiry.timer');
  await writeFile(expiry,'#!/bin/sh\nexit 0\n');await chmod(expiry,0o700);
  const serviceText=renderCanonicalExpiryService();
  const timerText=renderCanonicalExpiryTimer('2026-11-20 09:00:00 UTC');
  assert.match(serviceText,/^\[Unit\]\n/);
  assert.match(serviceText,/AssertPathExists=\/usr\/local\/sbin\/nyra-repository-expire/);
  assert.match(timerText,/OnCalendar=2026-11-20 09:00:00 UTC/);
  assert.match(timerText,/AccuracySec=1s\nPersistent=true/);
  await writeFile(service,serviceText.replaceAll('/usr/local/sbin/nyra-repository-expire',expiry));
  await writeFile(timer,timerText);
  execFileSync('systemd-analyze',['verify',service,timer],{encoding:'utf8',timeout:15000});
  assert.throws(()=>renderCanonicalExpiryTimer('2026-11-23 09:00:00; shutdown -h now'),/OFFLINE_BOOTSTRAP_EXPIRY_CALENDAR/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('native disposable systemd timer install, restart and effective readback on Ubuntu CI',{skip:process.env.NYRA_NATIVE_SYSTEMD!=='1'||process.platform!=='linux',timeout:60000},async()=>{
 const id='nyra-ci-'+randomBytes(6).toString('hex'),service=id+'.service',timer=id+'.timer';
 const root='/etc/systemd/system',dir=await mkdtemp(join(tmpdir(),id+'-'));
 const servicePath=join(root,service),timerPath=join(root,timer);
 const sudo=args=>execFileSync('sudo',args,{encoding:'utf8',timeout:15000}).trim();
 const date=new Date(Math.ceil(Date.now()/1000)*1000+14*86400000);
 const calendar=date.toISOString().slice(0,19).replace('T',' ')+' UTC';
 try{
  const localService=join(dir,service),localTimer=join(dir,timer);
  await writeFile(localService,renderCanonicalExpiryService().replaceAll('/usr/local/sbin/nyra-repository-expire','/usr/bin/true'));
  await writeFile(localTimer,renderCanonicalExpiryTimer(calendar).replace('Unit=nyra-repository-expiry.service','Unit='+service));
  sudo(['install','-m','0644',localService,servicePath]);
  sudo(['install','-m','0644',localTimer,timerPath]);
  sudo(['systemd-analyze','verify',servicePath,timerPath]);
  sudo(['systemctl','daemon-reload']);
  sudo(['systemctl','enable','--now',timer]);
  assert.equal(sudo(['systemctl','is-enabled',timer]),'enabled');
  assert.equal(sudo(['systemctl','is-active',timer]),'active');
  assert.equal(sudo(['systemctl','show',timer,'--property=Persistent','--value']),'yes');
  let next=sudo(['systemctl','show',timer,'--property=NextElapseUSecRealtime','--value']);
  assert(next.includes(calendar),next);
  sudo(['systemctl','restart',timer]);
  next=sudo(['systemctl','show',timer,'--property=NextElapseUSecRealtime','--value']);
  assert(next.includes(calendar),next);
 }finally{
  try{sudo(['systemctl','disable','--now',timer]);}catch{}
  try{sudo(['rm','-f',servicePath,timerPath]);}catch{}
  try{sudo(['systemctl','daemon-reload']);}catch{}
  await rm(dir,{recursive:true,force:true});
 }
});

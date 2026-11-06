// Run ONLY inside the disposable guest after a real reboot. No owner/provider grant.
import assert from 'node:assert/strict';
import {readFile,lstat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const cmd=(p,a,input)=>execFileSync(p,a,{encoding:'utf8',input,stdio:[input?'pipe':'ignore','pipe','pipe'],timeout:60000}).trim();
const sha=b=>createHash('sha256').update(b).digest('hex');
assert.equal(process.env.NYRA_NATIVE_REBOOT_READBACK,'1');
assert.equal(process.getuid(),0);
const before=JSON.parse(await readFile('/etc/nyra-acceptance/native-reboot-pending.json','utf8'));
const bootId=(await readFile('/proc/sys/kernel/random/boot_id','utf8')).trim();
assert.notEqual(bootId,before.bootId,'Real guest reboot required');
assert.equal(cmd('hostname',[]),before.target.hostname);
for(const [path,user,group] of [['/run/nyra-5c','nyra-coordinator','nyra-ingress'],
 ['/run/nyra-owner-receipts','nyra-owner','nyra-receipts']]){
 const st=await lstat(path);assert(st.isDirectory()&&!st.isSymbolicLink());
 assert.equal(st.mode&0o777,0o750);
 assert.equal(st.uid,Number(cmd('id',['-u',user])));
 assert.equal(st.gid,Number(cmd('getent',['group',group]).split(':')[2]));
}

assert.equal(sha(await readFile('/etc/systemd/system/nyra-repository-expiry.timer')),before.expirySHA256);
assert.equal(cmd('systemctl',['is-enabled','nyra-repository-expiry.timer']),'enabled');
assert.equal(cmd('systemctl',['is-active','nyra-repository-expiry.timer']),'active');
assert(cmd('systemctl',['show','nyra-repository-expiry.timer','--property=NextElapseUSecRealtime','--value']).endsWith(before.target.expiresAt.slice(0,19).replace('T',' ')+' UTC'));
assert.equal(cmd('systemctl',['is-active','docker']),'active');
assert.equal(cmd('docker',['inspect','-f','{{.State.Running}}','nyra-repository-pg']),'true');
assert.equal(cmd('docker',['network','inspect','-f','{{.Internal}}','nyra-repository-db']),'true');
assert(['{}','null'].includes(cmd('docker',['inspect','-f','{{json .HostConfig.PortBindings}}','nyra-repository-pg'])));
for(const role of ['registrar','broker']){
 const c=JSON.parse(await readFile('/var/lib/nyra-5c/'+role+'/pg.json','utf8'));
 assert.equal(cmd('docker',['exec','-i','nyra-repository-pg','sh','-ec',
  'IFS= read -r pw; export PGPASSWORD="$pw"; exec psql -X -h 127.0.0.1 -U "$1" -d postgres -t -A -c "select current_user"','nyra-auth',c.user],c.password+'\n'),c.user);
}
assert.equal(cmd('systemctl',['show','nyra-repository-runtime.service','--property=ActiveState','--value']),'inactive');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
// A deliberately unrelated resource must survive exact target retirement.
const sentinel='nyra-native-unrelated';cmd('docker',['network','create','--internal',sentinel]);
try{
 // Advance ONLY this disposable guest's clock to test the real installed
 // expiry timer/service. This is accelerated expiry, not 14 elapsed days.
 cmd('timedatectl',['set-ntp','false']);
 cmd('timedatectl',['set-time',new Date(Date.parse(before.target.expiresAt)+2000).toISOString()]);
 let retired=false;
 for(let i=0;i<60;i++){
  if(cmd('docker',['ps','-aq','--filter','name=^nyra-repository-pg$'])===''){retired=true;break;}
  await delay(1000);
 }
 assert(retired,'Installed expiry timer did not retire the exact database');
 let completed=false;
 for(let i=0;i<60;i++){
  const state=cmd('systemctl',['show','nyra-repository-expiry.service','--property=ActiveState','--value']);
  if(state==='inactive'){completed=true;break;}
  if(state==='failed')throw Error('INSTALLED_EXPIRY_SERVICE_FAILED');
  await delay(1000);
 }
 assert(completed,'Expiry service did not finish');
 assert.equal(cmd('systemctl',['show','nyra-repository-expiry.service','--property=Result','--value']),'success');
 const audit=await readFile('/var/lib/nyra-retirement/db-renewal-audit.jsonl','utf8');
 assert(audit.includes('CREDENTIALS_VERIFIED'));
 for(const role of ['registrar','broker'])await assert.rejects(readFile('/var/lib/nyra-5c/'+role+'/pg.json'),e=>e.code==='ENOENT');
 assert.equal(cmd('docker',['ps','-aq','--filter','name=^nyra-repository-pg$']),'');
 assert.equal(cmd('docker',['network','ls','--filter','name=^nyra-repository-db$','--format','{{.Name}}']),'');
 assert.equal(cmd('docker',['network','inspect','-f','{{.Name}}',sentinel]),sentinel);
}finally{cmd('docker',['network','rm',sentinel]);}
console.log(JSON.stringify({status:'NATIVE_REBOOT_AND_EXACT_RETIREMENT_PASS',previousBootId:before.bootId,
 currentBootId:bootId,actualReboot:true,expiryTimerPersisted:true,privateIPCDirectoriesRecreated:true,postgres17Persisted:true,
 realSCRAMAfterReboot:true,installedExpiryServiceExecuted:true,acceleratedGuestClock:true,
 auditPreserved:true,unrelatedResourcePreserved:true,providerMutation:false,realOwnerAuthorization:false}));

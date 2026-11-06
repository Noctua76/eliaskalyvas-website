// Run ONLY inside the disposable guest after a real reboot. No owner/provider grant.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
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
const {cleanupReplacement}=await import('file:///opt/nyra-5c/live-runtime/ops/acceptance-bootstrap/repository-launch.mjs');
// A deliberately unrelated resource must survive exact target retirement.
const sentinel='nyra-native-unrelated';cmd('docker',['network','create','--internal',sentinel]);
try{
 cleanupReplacement(before.target,{apply:true});
 assert.equal(cmd('docker',['ps','-aq','--filter','name=^nyra-repository-pg$']),'');
 assert.equal(cmd('docker',['network','ls','--filter','name=^nyra-repository-db$','--format','{{.Name}}']),'');
 assert.equal(cmd('docker',['network','inspect','-f','{{.Name}}',sentinel]),sentinel);
}finally{cmd('docker',['network','rm',sentinel]);}
console.log(JSON.stringify({status:'NATIVE_REBOOT_AND_EXACT_RETIREMENT_PASS',previousBootId:before.bootId,
 currentBootId:bootId,actualReboot:true,expiryTimerPersisted:true,postgres17Persisted:true,
 realSCRAMAfterReboot:true,unrelatedResourcePreserved:true,providerMutation:false,realOwnerAuthorization:false}));

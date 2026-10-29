// Opt-in GitHub-hosted native Edge only. Reuses Phase 5A pinned images/isolation;
// no database/Auth preflight, production access, deployment or paid service.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir,rm,mkdtemp} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {prepare} from './prepare.mjs';
const cmd=(name,args,options={})=>execFileSync(name,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000,...options});
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_ENVIRONMENT==='github-hosted'&&process.env.NYRA_EDGE_CI==='1');assert(process.version.startsWith('v22.'));
for(const name of ['SUPABASE_URL','SUPABASE_ACCESS_TOKEN','SUPABASE_SERVICE_ROLE_KEY','DATABASE_URL'])assert(!process.env[name],'Production environment forbidden');
const source=cmd('git',['rev-parse','HEAD']).trim();assert.equal(source,process.env.NYRA_TEST_SHA);cmd('git',['diff','--exit-code']);
const out=resolve('native-results');await mkdir(out,{recursive:true});
const images=JSON.parse(await readFile(new URL('../native-acceptance/images.lock.json',import.meta.url)));
const project='nyra5b-'+process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT,network=project+'-isolated',container=project+'-edge',driver=project+'-driver',root=await mkdtemp(join(tmpdir(),'nyra5b-'));
const report={source,node:process.version,docker:cmd('docker',['version','--format','{{.Server.Version}}']).trim(),results:[],images:{}};
const event=(id,status,detail)=>{const row={id,status,detail};report.results.push(row);console.log(JSON.stringify(row));};
let bridge,firewallInput=false,firewallForward=false;
try{
 for(const key of ['edge','probe','driver']){const image=images[key];assert(/@sha256:[a-f0-9]{64}$/.test(image.image));cmd('docker',['pull',image.image]);const actual=JSON.parse(cmd('docker',['image','inspect',image.image]))[0].RepoDigests;assert(actual.some(x=>x.split('@')[1]===image.image.split('@')[1]));report.images[key]={...image,actual};}
 report.package=await prepare(root);
 cmd('docker',['network','create','--internal','--opt','com.docker.network.bridge.host_binding_ipv4=127.0.0.1',network]);const n=JSON.parse(cmd('docker',['network','inspect',network]))[0];assert(n.Internal);bridge='br-'+n.Id.slice(0,12);
 cmd('sudo',['iptables','-I','INPUT','1','-i',bridge,'-m','conntrack','--ctstate','NEW','-j','DROP']);firewallInput=true;
 cmd('sudo',['iptables','-I','DOCKER-USER','1','-i',bridge,'!','-o',bridge,'-j','DROP']);firewallForward=true;
 for(const url of ['https://1.1.1.1','http://169.254.169.254','http://'+n.IPAM.Config[0].Gateway+':80'])assert.throws(()=>cmd('docker',['run','--rm','--network',network,images.probe.image,'-fsS','--max-time','3',url],{timeout:10000}));
 event('isolation','PASS',{internal:true,externalMetadataAndHostBlocked:true,publishedPorts:0,productionSecrets:0});
 cmd('docker',['run','-d','--name',container,'--network',network,'--network-alias','edge','--security-opt','no-new-privileges:true','--memory','768m','--cpus','2','--tmpfs','/tmp:rw,nosuid,size=256m','-e','DENO_DIR=/tmp/deno','-e','P5B_PRIVATE_CANARY=not-a-credential','-v',root+':/native:ro','-w','/native',images.edge.image,'start','--main-service','/native/gateway','--event-worker','/native/events']);
 let ready=false;for(let i=0;i<30;i++){try{ready=cmd('docker',['run','--rm','--network',network,images.probe.image,'-fsS','--max-time','2','http://edge:9000/_health'])==='ready';if(ready)break;}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready,'EDGE_GATEWAY_BOOT');
 const config=JSON.parse(cmd('docker',['inspect',container]))[0];assert(!config.HostConfig.Privileged);assert.equal(Object.keys(config.HostConfig.PortBindings||{}).length,0);
 const args=['run','--rm','--name',driver,'--network',network,'--user',process.getuid()+':'+process.getgid(),'--cap-drop','ALL','--security-opt','no-new-privileges:true','--read-only','--tmpfs','/tmp:rw,noexec,nosuid,size=16m','-v',resolve('ops/edge-acceptance/driver.mjs')+':/driver.mjs:ro','-v',out+':/evidence:rw',images.driver.image,'node','/driver.mjs'];
 let output;try{output=cmd('docker',args,{timeout:180000});}catch(e){output=e.stdout||'';report.driverExit=e.status;}
 for(const line of output.split('\n'))if(line.startsWith('EDGE_CASE:')){const row=JSON.parse(line.slice(10));event(row.id,row.status,row.detail);}
 assert(report.results.some(x=>x.id==='sharp-native-compatibility'),'DRIVER_DID_NOT_REPORT');
 // Wait only for bounded worker shutdown/event delivery, never infer limits from
 // an HTTP error alone. Native EventManager reasons must identify each case.
 let logs='',shutdown=[];
 for(let i=0;i<20;i++){
  const r=spawnSync('docker',['logs',container],{encoding:'utf8'});logs=r.stdout+r.stderr;
  shutdown=logs.split('\n').flatMap(line=>{const m=line.match(/EDGE_SHUTDOWN:(\{.*\})/);if(!m)return[];try{return[JSON.parse(m[1])]}catch{return[]}});
  if(['memory','cpu','wall'].every(mode=>shutdown.some(x=>x.metadata?.service_path?.endsWith('/'+mode))))break;
  await new Promise(r=>setTimeout(r,500));
 }
 await writeFile(join(out,'edge-native.log'),logs);report.shutdown=shutdown;
 const state=JSON.parse(cmd('docker',['inspect',container]))[0].State;assert(state.Running&&!state.OOMKilled,'Whole-container failure is infrastructure failure, not worker-limit success');
 for(const [mode,reason]of [['memory','Memory'],['cpu','CPUTime'],['wall','WallClockTime']]){
  const evidence=shutdown.filter(x=>x.metadata?.service_path?.endsWith('/'+mode));
  event('native-limit:'+mode,evidence.some(x=>x.event?.reason===reason)?'PASS':'FAIL',{expectedReason:reason,evidence,containerOOMKilled:state.OOMKilled});
 }
 event('daemon-survival','PASS',{running:state.Running,containerOOMKilled:false});
}catch(e){event('infrastructure-or-harness','FAIL',{message:e.message.slice(0,800)});
}finally{
 try{const r=spawnSync('docker',['logs',container],{encoding:'utf8'});await writeFile(join(out,'edge-native.log'),r.stdout+r.stderr);}catch{}
 for(const name of [driver,container])try{cmd('docker',['rm','-f',name]);}catch{}
 try{if(firewallInput)cmd('sudo',['iptables','-D','INPUT','-i',bridge,'-m','conntrack','--ctstate','NEW','-j','DROP']);if(firewallForward)cmd('sudo',['iptables','-D','DOCKER-USER','-i',bridge,'!','-o',bridge,'-j','DROP']);cmd('docker',['network','rm',network]);}catch{event('cleanup','FAIL','Named network/rule cleanup failed');}
 await rm(root,{recursive:true,force:true});await writeFile(join(out,'phase5b.json'),JSON.stringify(report,null,2));
}
if(report.results.some(x=>x.status==='FAIL'))process.exitCode=1;

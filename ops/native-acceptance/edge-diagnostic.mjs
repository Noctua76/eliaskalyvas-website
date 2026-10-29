// Focused native Edge acceptance; no DB/Auth/Storage/deployment/paid API stages.
import assert from 'node:assert/strict';
import {execFileSync,spawnSync} from 'node:child_process';
import {readFile,writeFile,mkdir,rm,mkdtemp} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {prepareEdgeAcceptance} from './edge-package.mjs';
import {assertNativeEdge} from './edge-assertions.mjs';
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_ENVIRONMENT==='github-hosted');
assert(!process.env.SUPABASE_ACCESS_TOKEN&&!process.env.SUPABASE_URL&&!process.env.SUPABASE_SERVICE_ROLE_KEY);
const cmd=(name,args,options={})=>execFileSync(name,args,{encoding:'utf8',timeout:120000,stdio:['ignore','pipe','pipe'],...options});
const images=JSON.parse(await readFile(new URL('images.lock.json',import.meta.url))),root=await mkdtemp(join(tmpdir(),'nyra-edge-focused-')),out=resolve('native-results');await mkdir(out,{recursive:true});
const project='nyra-edge-'+process.env.GITHUB_RUN_ID+'-'+process.env.GITHUB_RUN_ATTEMPT,network=project+'-isolated',container=project+'-edge';
const source=cmd('git',['rev-parse','HEAD']).trim();assert.equal(source,process.env.NYRA_TEST_SHA);
const result={source,results:[]};
const event=(id,status,detail)=>{const value={id,status,detail};result.results.push(value);console.log(JSON.stringify(value));};
for(const key of ['edge','probe'])cmd('docker',['pull',images[key].image]);
try{
 const prepared=await prepareEdgeAcceptance(root);result.expected=prepared.expected;
 cmd('docker',['network','create','--internal',network]);const n=JSON.parse(cmd('docker',['network','inspect',network]))[0];assert(n.Internal);const bridge='br-'+n.Id.slice(0,12);
 cmd('sudo',['iptables','-I','INPUT','1','-i',bridge,'-m','conntrack','--ctstate','NEW','-j','DROP']);cmd('sudo',['iptables','-I','DOCKER-USER','1','-i',bridge,'!','-o',bridge,'-j','DROP']);
 for(const target of ['http://169.254.169.254','https://1.1.1.1','http://'+n.IPAM.Config[0].Gateway+':80'])assert.throws(()=>cmd('docker',['run','--rm','--network',network,images.probe.image,'-fsS','--max-time','3',target],{timeout:10000}));
 cmd('docker',['run','-d','--name',container,'--network',network,'--network-alias','edge','--security-opt','no-new-privileges:true','-v',root+':/native:ro','--workdir','/native','--tmpfs','/tmp:rw,nosuid,size=256m','--memory','1g','-e','DENO_DIR=/tmp/deno',images.edge.image,'start','--main-service','/native/gateway']);
 const curl=args=>cmd('docker',['run','--rm','--network',network,images.probe.image,...args]);
 let ready=false;for(let i=0;i<20;i++){try{ready=curl(['-fsS','--max-time','2','http://edge:9000/_health'])==='ready';if(ready)break;}catch{}await new Promise(r=>setTimeout(r,500));}assert(ready);
 const request=async(path,{method='GET',body,headers={}}={})=>{
  const args=['-sS','--max-time','40','-i','-X',method];for(const [key,value]of Object.entries(headers))args.push('-H',key+': '+value);if(body!==undefined)args.push('--data-raw',body);args.push('http://edge:9000'+path);
  const text=curl(args),split=text.indexOf('\r\n\r\n');assert(split>=0,text.slice(0,200));const lines=text.slice(0,split).split('\r\n');return {status:Number(lines[0].split(' ')[1]),headers:Object.fromEntries(lines.slice(1).map(l=>{const i=l.indexOf(':');return[l.slice(0,i).toLowerCase(),l.slice(i+1).trim()];})),body:text.slice(split+4)};
 };
 await assertNativeEdge({request,expected:prepared.expected,event});
}catch(e){event('Edge-execution','FAIL',{message:e.message});process.exitCode=1;
}finally{
 try{const log=spawnSync('docker',['logs',container],{encoding:'utf8'});await writeFile(join(out,'edge-focused.log'),log.stdout+log.stderr);}catch{}
 try{cmd('docker',['rm','-f',container]);}catch{}
 try{const n=JSON.parse(cmd('docker',['network','inspect',network]))[0],b='br-'+n.Id.slice(0,12);cmd('sudo',['iptables','-D','INPUT','-i',b,'-m','conntrack','--ctstate','NEW','-j','DROP']);cmd('sudo',['iptables','-D','DOCKER-USER','-i',b,'!','-o',b,'-j','DROP']);cmd('docker',['network','rm',network]);}catch{}
 await writeFile(join(out,'edge-focused.json'),JSON.stringify(result,null,2));await rm(root,{recursive:true,force:true});
}

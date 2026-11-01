// Ordinary CI/offline check only. Downloads PUBLIC pinned bytes when explicitly
// requested. Never installs packages, runs a daemon, listens or provisions.
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {prepareOfflineBootstrap} from './offline-bootstrap.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export async function verifyOffline({vendor,download=false}){
 const lock=JSON.parse(await readFile(new URL('./prerequisites.lock.json',import.meta.url)));
 await mkdir(vendor,{recursive:true,mode:0o700});
 for(const x of Object.values(lock)){
  let bytes;try{bytes=await readFile(join(vendor,x.file));}catch(e){if(e.code!=='ENOENT'||!download)throw e;
   const r=await fetch(x.url,{signal:AbortSignal.timeout(120000),credentials:'omit'});if(!r.ok)throw Error('PUBLIC_PREREQUISITE_UNAVAILABLE');bytes=Buffer.from(await r.arrayBuffer());if(sha(bytes)!==x.sha256)throw Error('PREREQUISITE_CHANGED');await writeFile(join(vendor,x.file),bytes,{flag:'wx',mode:0o600});}
  if(sha(bytes)!==x.sha256)throw Error('PREREQUISITE_CHANGED');
 }
 const temp=await mkdtemp(join(tmpdir(),'nyra-offline-proof-'));
 try{
  const target=JSON.parse(await readFile(new URL('./replacement-target.example.json',import.meta.url)));target.operatorCIDRs=['203.0.113.10/32']; // RFC5737 TEST ONLY; not an operator identity.
  const result=await prepareOfflineBootstrap({target,vendor,destination:join(temp,'bundle')});
  execFileSync('tar',['--no-same-owner','-xzf',join(vendor,lock.caddy.file),'-C',temp,'caddy']);
  execFileSync('tar',['--no-same-owner','-xzf',join(vendor,lock.docker.file),'-C',temp,'docker/docker','docker/dockerd']);
  for(const name of ['Caddyfile.disabled','Caddyfile.acceptance'])execFileSync(join(temp,'caddy'),['adapt','--adapter','caddyfile','--config',join(temp,'bundle',name)],{stdio:['ignore','pipe','pipe']});
  const version=execFileSync(join(temp,'docker/docker'),['--version'],{encoding:'utf8'});if(!version.includes(lock.docker.version))throw Error('DOCKER_VERSION');
  const script=await readFile(join(temp,'bundle/setup.sh'),'utf8');const python=[...script.matchAll(/python3 - <<'PY'\n([\s\S]*?)\nPY/g)].map(x=>x[1]);
  for(const source of python)execFileSync('python3',['-c',"import sys;compile(sys.stdin.read(),'<offline-heredoc>','exec')"],{input:source});
  const timerSource=python.find(x=>x.includes('expiry.timer'));if(!timerSource||timerSource.includes('\\\\n'))throw Error('TIMER_ESCAPING');
  if(sha(await readFile(join(temp,'bundle/runtime/ops/protected-delivery/schema.sql')))!==sha(await readFile(new URL('../protected-delivery/schema.sql',import.meta.url))))throw Error('SQL_ASSET');
  const imported="await import('file://"+join(temp,'bundle/runtime/ops/acceptance-bootstrap/repository-runtime.mjs')+"'); await import('file://"+join(temp,'bundle/runtime/ops/acceptance-bootstrap/repository-launch.mjs')+"'); await import('file://"+join(temp,'bundle/runtime/ops/acceptance-bootstrap/repository-db.mjs')+"');";
  execFileSync(process.execPath,['--input-type=module','-e',imported],{stdio:['ignore','pipe','pipe']});
  return {schema:'nyra.offline.bootstrap.proof.v1',runtimeFiles:Object.keys(result.runtimeFiles).length,prerequisiteHashes:true,actualCaddyAdapt:true,actualDockerVersion:true,shellAndPythonSyntax:true,isolatedRuntimeImports:true,requiredSQLAssets:true,hostInstallation:'NOT EXECUTED',testCIDROnly:true,credentialsGenerated:0,providerResourcesCreated:0,realAcceptance:false};
 }finally{await rm(temp,{recursive:true,force:true});}
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{if(process.argv[2]!=='--verify')throw Error('MODE');console.log(JSON.stringify(await verifyOffline({vendor:process.argv[3],download:process.argv[4]==='--fetch-public-pins'})));}catch{console.error('OFFLINE_BOOTSTRAP_VERIFICATION_FAILED');process.exitCode=1;}}

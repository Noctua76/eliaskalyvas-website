// Ordinary CI/offline check only. Downloads PUBLIC pinned bytes when explicitly
// requested. Never installs packages, runs a daemon, listens or provisions.
import {readFile,writeFile,mkdir,mkdtemp,rm} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {lookup} from 'node:dns/promises';
import {connect} from 'node:tls';
import {promisify} from 'node:util';
import {execFile} from 'node:child_process';
import {prepareOfflineBootstrap,renderCanonicalExpiryTimer,renderCanonicalExpiryService} from './offline-bootstrap.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const execute=promisify(execFile);
const failureCodes=e=>[e?.code,e?.cause?.code,...(e?.cause?.errors??[]).map(x=>x.code)].filter(x=>typeof x==='string'&&/^[A-Z0-9_]{2,50}$/.test(x));
// Public endpoints only; never print proxy URLs, request headers or redirects.
async function diagnosePublicPins(lock,failedArtifact,error){
 console.error(JSON.stringify({marker:'NYRA_PUBLIC_PREREQUISITE_FETCH_FAILED',failedArtifact,url:lock[failedArtifact].url,node:process.version,errorCodes:failureCodes(error),proxyConfigured:!!(process.env.HTTPS_PROXY||process.env.https_proxy),nodeUseEnvProxy:process.env.NODE_USE_ENV_PROXY==='1',extraCAConfigured:!!process.env.NODE_EXTRA_CA_CERTS}));
 await Promise.all(Object.entries(lock).map(async([artifact,x])=>{
  const host=new URL(x.url).hostname,record={marker:'NYRA_PUBLIC_PREREQUISITE_DIAGNOSTIC',artifact,url:x.url};
  try{record.dns=await lookup(host,{all:true});}catch(e){record.dns={codes:failureCodes(e)};}
  record.directTLS=await new Promise(resolve=>{const socket=connect({host,port:443,servername:host,rejectUnauthorized:true});let done=false;const finish=v=>{if(done)return;done=true;clearTimeout(timer);socket.destroy();resolve(v);};const timer=setTimeout(()=>finish({code:'DIRECT_TLS_TIMEOUT'}),4000);socket.once('secureConnect',()=>finish({authorized:socket.authorized,protocol:socket.getProtocol()}));socket.once('error',e=>finish({codes:failureCodes(e)}));});
  try{const r=await fetch(x.url,{method:'HEAD',credentials:'omit',signal:AbortSignal.timeout(15000)});record.nodeHTTP={status:r.status};}catch(e){record.nodeHTTP={codes:failureCodes(e)};}
  try{const {stdout}=await execute('curl',['--disable','--silent','--show-error','--head','--location','--proto','=https','--proto-redir','=https','--connect-timeout','5','--max-time','15','--output','/dev/null','--write-out','%{http_code} %{ssl_verify_result} %{proxy_ssl_verify_result} %{time_appconnect}',x.url],{timeout:17000,maxBuffer:4096});const m=stdout.trim().match(/^(\d{3}) (\d+) (\d+) ([0-9.]+)$/);record.curlHTTP=m?{status:Number(m[1]),tlsVerifyResult:Number(m[2]),proxyTLSVerifyResult:Number(m[3]),tlsSeconds:Number(m[4])}:{code:'CURL_METADATA_UNAVAILABLE'};}catch(e){record.curlHTTP={exitCode:Number.isInteger(e.code)?e.code:null,code:e.code==='ENOENT'?'CURL_UNAVAILABLE':'CURL_NETWORK_FAILED'};}
  console.error(JSON.stringify(record));
 }));
}
export async function verifyOffline({vendor,download=false}){
 const lock=JSON.parse(await readFile(new URL('./prerequisites.lock.json',import.meta.url)));
 await mkdir(vendor,{recursive:true,mode:0o700});
 for(const [artifact,x] of Object.entries(lock)){
  let bytes;try{bytes=await readFile(join(vendor,x.file));}catch(e){if(e.code!=='ENOENT'||!download)throw e;
   let r;try{r=await fetch(x.url,{signal:AbortSignal.timeout(120000),credentials:'omit'});}catch(error){await diagnosePublicPins(lock,artifact,error);throw error;}if(!r.ok)throw Error('PUBLIC_PREREQUISITE_UNAVAILABLE');bytes=Buffer.from(await r.arrayBuffer());if(sha(bytes)!==x.sha256)throw Error('PREREQUISITE_CHANGED');await writeFile(join(vendor,x.file),bytes,{flag:'wx',mode:0o600});}
  if(sha(bytes)!==x.sha256)throw Error('PREREQUISITE_CHANGED');
 }
 const temp=await mkdtemp(join(tmpdir(),'nyra-offline-proof-'));
 try{
  const target=JSON.parse(await readFile(new URL('./replacement-target.example.json',import.meta.url)));target.operatorCIDRs=['203.0.113.10/32']; // RFC5737 TEST ONLY; not an operator identity.
  const result=await prepareOfflineBootstrap({target,vendor,destination:join(temp,'bundle')});
  // Prove the installable canonical timer is an actual manifest-pinned file,
  // not merely inline text observed in a generated setup script.
  const manifest=JSON.parse(await readFile(join(temp,'bundle/manifest.json'),'utf8'));
  const timer=await readFile(join(temp,'bundle/expiry.timer.template'),'utf8');
  const service=await readFile(join(temp,'bundle/expiry.service'),'utf8');
  if(timer!==renderCanonicalExpiryTimer()||service!==renderCanonicalExpiryService()||
     manifest.files?.['expiry.timer.template']!==sha(timer)||
     manifest.files?.['expiry.service']!==sha(service)||
     !/^Persistent=true$/m.test(timer)||!/^AccuracySec=1s$/m.test(timer)||
     !timer.includes('Unit=nyra-repository-expiry.service')||
     !service.includes('AssertPathExists=/usr/local/sbin/nyra-repository-expire'))
    throw Error('CANONICAL_EXPIRY_MANIFEST_PIN');
  execFileSync('tar',['--no-same-owner','-xzf',join(vendor,lock.caddy.file),'-C',temp,'caddy']);
  execFileSync('tar',['--no-same-owner','-xzf',join(vendor,lock.docker.file),'-C',temp,'docker/docker','docker/dockerd']);
  for(const name of ['Caddyfile.disabled','Caddyfile.acceptance'])execFileSync(join(temp,'caddy'),['adapt','--adapter','caddyfile','--config',join(temp,'bundle',name)],{stdio:['ignore','pipe','pipe']});
  const version=execFileSync(join(temp,'docker/docker'),['--version'],{encoding:'utf8'});if(!version.includes(lock.docker.version))throw Error('DOCKER_VERSION');
  const script=await readFile(join(temp,'bundle/setup.sh'),'utf8');const python=[...script.matchAll(/python3 - <<'PY'\n([\s\S]*?)\nPY/g)].map(x=>x[1]);
  for(const source of python)execFileSync('python3',['-c',"import sys;compile(sys.stdin.read(),'<offline-heredoc>','exec')"],{input:source});
  const timerSource=python.find(x=>x.includes('expiry.timer'));if(!timerSource||timerSource.includes('\\\\n'))throw Error('TIMER_ESCAPING');
  if(sha(await readFile(join(temp,'bundle/runtime/ops/protected-delivery/schema.sql')))!==sha(await readFile(new URL('../protected-delivery/schema.sql',import.meta.url))))throw Error('SQL_ASSET');
  const imported="await import('file://"+join(temp,'bundle/runtime/ops/acceptance-bootstrap/repository-runtime.mjs')+"'); await import('file://"+join(temp,'bundle/runtime/ops/acceptance-bootstrap/repository-launch.mjs')+"'); await import('file://"+join(temp,'bundle/runtime/ops/acceptance-bootstrap/repository-db.mjs')+"'); await import('file://"+join(temp,'bundle/runtime/ops/acceptance-bootstrap/repository-db-renewal.mjs')+"'); await import('file://"+join(temp,'bundle/runtime/ops/acceptance-bootstrap/extension-effective.mjs')+"'); await import('file://"+join(temp,'bundle/runtime/ops/acceptance-bootstrap/extension-host.mjs')+"');";
  execFileSync(process.execPath,['--input-type=module','-e',imported],{stdio:['ignore','pipe','pipe']});
  return {schema:'nyra.offline.bootstrap.proof.v1',runtimeFiles:Object.keys(result.runtimeFiles).length,prerequisiteHashes:true,actualCaddyAdapt:true,actualDockerVersion:true,shellAndPythonSyntax:true,isolatedRuntimeImports:true,requiredSQLAssets:true,canonicalExpiryManifestPinned:true,hostInstallation:'NOT EXECUTED',testCIDROnly:true,credentialsGenerated:0,providerResourcesCreated:0,realAcceptance:false};
 }finally{await rm(temp,{recursive:true,force:true});}
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{if(process.argv[2]!=='--verify')throw Error('MODE');console.log(JSON.stringify(await verifyOffline({vendor:process.argv[3],download:process.argv[4]==='--fetch-public-pins'})));}catch(e){const code=typeof e?.code==='string'&&/^[A-Z0-9_]{2,40}$/.test(e.code)?e.code:'UNCLASSIFIED';const reason=String(e?.message??'UNKNOWN').split('\\n')[0].replace(/(?:github_pat_|sb_secret_|sk-proj-)[A-Za-z0-9_-]+/g,'[REDACTED]').slice(0,220);const stderr=String(e?.stderr??'').split('\\n').filter(x=>/SyntaxError|Error:|repository-db|Unexpected token|Invalid regular expression|^ *at /i.test(x)).slice(0,7).join(' | ').replace(/(?:github_pat_|sb_secret_|sk-proj-)[A-Za-z0-9_-]+/g,'[REDACTED]').slice(0,450);console.error('OFFLINE_BOOTSTRAP_VERIFICATION_FAILED',e?.name==='Error'?'ERROR':(e?.name??'UNKNOWN'),code,reason,stderr);process.exitCode=1;}}

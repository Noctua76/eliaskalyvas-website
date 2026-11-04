// Separately reviewed operator utility. NEVER a runtime/staging import root.
// Default preflight is local and read-only. Execution needs independent approval.
import assert from 'node:assert/strict';
import {open,lstat,readFile,readdir,mkdir,rename,link,unlink,realpath} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash,createPrivateKey,sign} from 'node:crypto';
import {execFileSync,spawnSync} from 'node:child_process';
import {hostname} from 'node:os';
import {dirname,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
export const PIN=Object.freeze({source:'29a73458d4cd941e5ed514db56dc2c553d041bda',appId:5594139,installationId:178162814,ownerId:217035723,repoId:1389733212,repo:'Noctua76/eliaskalyvas-website',slug:'nyra-acceptance-read-noctua76',capture:'5eb0c2c03f546214d684b48f15f2f415a2d78141eef874a8db67319595e86cf8',governance:'ec4b711e09bb448c74719e935ac2e3ca1e7675a8e75115526d67b9394d4e4a42',protections:'7bc1012c7309e172fda6a0616e670e9fd6a305f3325ca34eb5655e4f34759d97'});
export const PERMISSIONS=Object.freeze(Object.fromEntries(['actions','administration','checks','contents','environments','metadata','pull_requests'].map(k=>[k,'read'])));
const ROOT='/opt/nyra-5c/bootstrap',STAGE='/opt/nyra-5c/live-runtime',PRIVATE='/opt/nyra-5c/private';
const DIR='/var/lib/nyra-5c/coordinator',CREDENTIAL=DIR+'/admin-read.json',KEYDIR='/root/nyra-github-app',KEY=KEYDIR+'/app-5594139.pem';
const need=(v,c)=>{if(!v)throw Error(c);};
export const digest=b=>createHash('sha256').update(b).digest('hex');
const run=(f,a)=>execFileSync(f,a,{encoding:'utf8',timeout:15000,maxBuffer:10000000,stdio:['ignore','pipe','pipe']}).trim();
const metadata=s=>({dev:s.dev,ino:s.ino,uid:s.uid,gid:s.gid,mode:s.mode,nlink:s.nlink,size:s.size,mtimeMs:String(s.mtimeMs),ctimeMs:String(s.ctimeMs)});
async function privateBytes(path,uid){
 need(await realpath(path)===path,'PRIVATE_PATH_SYMLINK');
 const f=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const s=await f.stat();need(s.isFile()&&s.uid===uid&&s.nlink===1&&(s.mode&0o777)===0o600&&s.size<2000000,'PRIVATE_FILE');const bytes=await f.readFile();need(JSON.stringify(metadata(s))===JSON.stringify(metadata(await f.stat())),'FILE_CHANGED_DURING_READ');return {bytes,meta:metadata(s),sha256:digest(bytes)};}finally{await f.close();}
}
async function privateDirectory(path,uid){const s=await lstat(path);need(await realpath(path)===path&&s.isDirectory()&&s.uid===uid&&(s.mode&0o077)===0,'PRIVATE_DIRECTORY');}
async function syncDir(path){const f=await open(path,'r');try{await f.sync();}finally{await f.close();}}
async function exclusiveJSON(path,value,uid=0,gid=0){const f=await open(path,'wx',0o600);try{await f.writeFile(JSON.stringify(value,null,2)+'\n');await f.chown(uid,gid);await f.sync();}finally{await f.close();}await syncDir(dirname(path));}
export function checkApp(a){need(a.id===PIN.appId&&a.slug===PIN.slug&&a.owner?.id===PIN.ownerId,'APP_IDENTITY');assert.deepEqual(a.permissions,PERMISSIONS);need(Array.isArray(a.events)&&a.events.length===0,'APP_EVENTS');}
export function checkInstallation(i){need(i.id===PIN.installationId&&i.app_id===PIN.appId&&i.account?.id===PIN.ownerId&&i.account?.type==='User'&&i.repository_selection==='selected'&&i.suspended_at===null,'INSTALLATION_IDENTITY');assert.deepEqual(i.permissions,PERMISSIONS);}
export function checkScope(s){need(s.total_count===1&&s.repositories?.length===1&&s.repositories[0].id===PIN.repoId&&s.repositories[0].full_name===PIN.repo,'TOKEN_SCOPE');}
export function checkExpired(c,t,now=Date.now()){
 need(c.bootstrapId===t.bootstrapId&&String(c.appId)===String(PIN.appId)&&String(c.installationId)===String(PIN.installationId)&&String(c.repositoryId)===String(PIN.repoId),'CREDENTIAL_IDENTITY');
 const start=Date.parse(t.createdAt),end=Date.parse(t.expiresAt),issued=Date.parse(c.issuedAt),local=Date.parse(c.expiresAt),issuer=Date.parse(c.issuerExpiresAt);
 need([start,end,issued,local,issuer].every(Number.isFinite)&&start<=issued&&issued<local&&local<=issuer&&local<=end&&issuer<=now,'CREDENTIAL_NOT_EXPIRED_OR_INVALID');
 need(typeof c.token==='string'&&c.token.length>0&&c.token.length<20000&&!/[\u0000-\u0020\u007f]/.test(c.token),'CREDENTIAL_TOKEN');
}
export function issuerTimes(expiry,date,end,now=Date.now()){
 const e=Date.parse(expiry),d=Date.parse(date);
 need(Number.isFinite(e)&&Number.isFinite(d)&&Math.abs(d-now)<60000&&e-d>=3540000&&e-d<=3660000&&e-now>120000&&e<=end,'ISSUER_WINDOW');
 return {issuerExpiresAt:expiry,issuerResponseDate:new Date(d).toISOString(),expiresAt:new Date(e).toISOString()};
}
export async function github(path,token,{method='GET',body,fetcher=fetch,allow401=false}={}){
 const allowed=method==='GET'?['/app','/app/installations/'+PIN.installationId,'/repos/'+PIN.repo+'/installation','/installation/repositories?per_page=100'].includes(path):method==='POST'&&path==='/app/installations/'+PIN.installationId+'/access_tokens';
 need(allowed,'GITHUB_ROUTE');
 const r=await fetcher('https://api.github.com'+path,{method,redirect:'error',headers:{Authorization:'Bearer '+token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','Content-Type':'application/json','User-Agent':'nyra-stage3f-single-renewal'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000)});
 if(allow401&&r.status===401)return {expired:true};
 need(r.ok&&!r.headers.get('link')?.includes('rel="next"'),'GITHUB_RESPONSE');
 const text=await r.text();need(text.length<2000000,'GITHUB_SIZE');return {value:JSON.parse(text),date:r.headers.get('date')};
}
// This is deliberately NOT rename(temp, canonical): that would overwrite a
// concurrent writer. Unexpected moved files and pending credentials are retained.
export async function commitCredential({canonical,pending,archive,expected,uid}){
 try{await lstat(archive);throw Error('ARCHIVE_EXISTS');}catch(e){if(e.code!=='ENOENT')throw e;}
 const current=await privateBytes(canonical,uid);assert.deepEqual(current.meta,expected.meta,'CREDENTIAL_CONCURRENT');need(current.sha256===expected.sha256,'CREDENTIAL_CONCURRENT');
 await rename(canonical,archive);await syncDir(dirname(canonical));await syncDir(dirname(archive));
 const moved=await privateBytes(archive,uid);need(moved.sha256===expected.sha256&&moved.meta.dev===expected.meta.dev&&moved.meta.ino===expected.meta.ino,'DISPLACED_CREDENTIAL_CONCURRENT');
 await link(pending,canonical);await syncDir(dirname(canonical));
 await unlink(pending);await syncDir(dirname(pending));
 return privateBytes(canonical,uid);
}
async function stagedFiles(){
 need(run('git',['-C',ROOT,'rev-parse','HEAD'])===PIN.source&&run('git',['-C',ROOT,'status','--porcelain','--untracked-files=all'])==='','EXACT_CLEAN_SOURCE');
 const roots=['repository-db','repository-launch','repository-runtime','replacement-target','live-role-worker','fra1-runtime','fra1-launch'].map(n=>'ops/acceptance-bootstrap/'+n+'.mjs'),seen=new Set();
 const visit=async p=>{if(seen.has(p))return;need(!p.startsWith('/')&&!p.split('/').includes('..'),'STAGED_PATH');seen.add(p);const text=await readFile(ROOT+'/'+p,'utf8');for(const m of text.matchAll(/^(?:import|export)[^;\n]*?from\s*['"]([^'"]+)['"]/gm))if(m[1].startsWith('.'))await visit(resolve(ROOT,dirname(p),m[1]).slice(ROOT.length+1));};
 for(const p of roots)await visit(p);await visit('ops/protected-delivery/schema.sql');for(const n of ['shared','release','manifest','event','receipt','dataset'])seen.add('contracts/nyra-publication/v1.1/'+n+'.schema.json');
 const files=[...seen].sort();assert.deepEqual(JSON.parse(await readFile(STAGE+'/runtime-files.json','utf8')),files,'STAGED_MANIFEST');need(files.length===57,'STAGED_COUNT');
 const hashes={};for(const p of files){for(const base of [ROOT,STAGE]){const path=base+'/'+p,s=await lstat(path);need(await realpath(path)===path&&s.isFile()&&s.uid===0&&(s.mode&0o022)===0,'CODE_PERMISSIONS');}const a=await readFile(ROOT+'/'+p),b=await readFile(STAGE+'/'+p);need(a.equals(b),'STAGED_BYTES');hashes[p]=digest(b);}
 return hashes;
}
async function dependencies(){
 const root=STAGE+'/node_modules',entries=[];
 const walk=async p=>{const s=await lstat(p);need(s.uid===0&&(s.isSymbolicLink()||(s.mode&0o022)===0),'DEPENDENCY_PERMISSIONS');if(s.isSymbolicLink()){const target=await realpath(p);need(target.startsWith(root+'/'),'DEPENDENCY_SYMLINK');entries.push([p.slice(root.length+1),'link',target.slice(root.length+1)]);}else if(s.isDirectory()){for(const n of (await readdir(p)).sort())await walk(p+'/'+n);}else{need(s.isFile()&&s.nlink===1,'DEPENDENCY_FILE');entries.push([p.slice(root.length+1),digest(await readFile(p))]);}};
 await walk(root);return {files:entries.length,sha256:digest(Buffer.from(JSON.stringify(entries)))};
}
async function preflight(baselinePath,existingAttempt=null){
 need(process.getuid?.()===0,'ROOT_REQUIRED');
 need(baselinePath.startsWith(DIR+'/evidence/')&&dirname(baselinePath)===DIR+'/evidence'&&baselinePath.endsWith('.json'),'HISTORICAL_CAPTURE_PATH');
 const user=run('getent',['passwd','nyra-coordinator']).split(':'),uid=Number(user[2]),gid=Number(user[3]);need(uid>0&&gid>0&&user[6]==='/usr/sbin/nologin','COORDINATOR');
 for(const [path,owner]of [[KEYDIR,0],[DIR,uid],[DIR+'/evidence',uid]])await privateDirectory(path,owner);
 const files=await stagedFiles(),dependencyTree=await dependencies();
 const {hashJSON}=await import(pathToFileURL(STAGE+'/lib/publication/contract.mjs'));
 const {validateReplacementTarget}=await import(pathToFileURL(STAGE+'/ops/acceptance-bootstrap/replacement-target.mjs'));
 const snapshots={};
 for(const [path,owner]of [['/etc/nyra-acceptance/target.json',0],[PRIVATE+'/launch.json',0],[PRIVATE+'/stage3-reviewed-input.json',0],[PRIVATE+'/stage3-provisioning-attempt.json',0],[DIR+'/governance.json',uid],[baselinePath,uid],[CREDENTIAL,uid]]){const f=await privateBytes(path,owner);snapshots[path]={sha256:f.sha256,meta:f.meta};}
 for(const name of (await readdir(KEYDIR)).sort())if(/^renewal-[a-z0-9-]+\.json$/.test(name)){const path=KEYDIR+'/'+name,f=await privateBytes(path,0);snapshots[path]={sha256:f.sha256,meta:f.meta};}
 const json=async p=>JSON.parse((await privateBytes(p,p.startsWith(DIR+'/')?uid:0)).bytes);
 const target=await json('/etc/nyra-acceptance/target.json'),launch=await json(PRIVATE+'/launch.json'),old=await json(CREDENTIAL),governance=await json(DIR+'/governance.json'),baseline=await json(baselinePath);
 if(target.bootstrapId==='nyra-acceptance-20261102-01')need(snapshots[KEYDIR+'/renewal-6afcf035.json'],'HISTORICAL_RENEWAL_MARKER_REQUIRED');
 validateReplacementTarget(target,{created:true});need(target.hostname===hostname()&&Date.parse(target.expiresAt)-Date.now()>3720000,'HOST_OR_ISSUER_WINDOW_TOO_SHORT');checkExpired(old,target);
 need(launch.githubReadCredential===CREDENTIAL&&hashJSON(launch.target)===hashJSON(target)&&launch.configuration?.repositoryTrust?.sourceSHA===PIN.source&&launch.configuration.repositoryTrust.administrationSHA256===PIN.protections,'LAUNCH_PINS');
 need(hashJSON(governance)===PIN.governance&&baseline.digest===PIN.capture&&hashJSON(baseline.record)===PIN.capture&&baseline.record.runtimeAdministration?.record.protectionsSHA256===PIN.protections,'HISTORICAL_PINS');
 const keyStat=await lstat(KEY);need(await realpath(KEY)===KEY&&keyStat.uid===0&&keyStat.nlink===1&&keyStat.isFile()&&(keyStat.mode&0o777)===0o600,'APP_KEY_METADATA');
 const appKeyFile=await privateBytes(KEY,0),appKeySHA256=appKeyFile.sha256;appKeyFile.bytes.fill(0);
 need((await lstat(KEYDIR)).dev===snapshots[CREDENTIAL].meta.dev,'CREDENTIAL_ARCHIVE_REQUIRES_SAME_FILESYSTEM');
 const imports=spawnSync('setpriv',['--reuid='+uid,'--regid='+gid,'--init-groups','--no-new-privs',process.execPath,'--input-type=module','-'],{input:"globalThis.fetch=async()=>{throw Error('NETWORK_DENIED')}; await import('file://"+STAGE+"/ops/acceptance-bootstrap/owner-source.mjs'); await import('file://"+STAGE+"/lib/publication/runtime/administration-evidence.mjs'); await import('file://"+STAGE+"/lib/publication/runtime/governance.mjs');",env:{PATH:process.env.PATH},encoding:'utf8',timeout:15000,maxBuffer:100000,stdio:['pipe','pipe','pipe']});
 need(imports.status===0,'COORDINATOR_IMPORT_PREFLIGHT');
 const privateMetadata={};for(const path of ['/var/lib/nyra-5c/owner/owner-key.json','/var/lib/nyra-5c/broker/evidence-key.json','/var/lib/nyra-5c/registrar/pg.json','/var/lib/nyra-5c/broker/pg.json']){const s=await lstat(path);need(await realpath(path)===path&&s.isFile()&&s.nlink===1&&(s.mode&0o777)===0o600,'IMMUTABLE_PRIVATE_METADATA');privateMetadata[path]=metadata(s);}
 need(run('systemctl',['is-active','nyra-repository-expiry.timer'])==='active','EXPIRY_TIMER');
 const timer=run('systemctl',['show','nyra-repository-expiry.timer','--property=TimersCalendar','--value']);need(timer.includes(target.expiresAt.slice(0,10))&&timer.includes(target.expiresAt.slice(11,19)),'EXPIRY_CALENDAR');
 for(const unit of ['nyra-owner-source.service','nyra-repository-runtime.service']){const r=spawnSync('systemctl',['is-active',unit],{encoding:'utf8'});need(r.status===3&&r.stdout.trim()==='inactive','RUNTIME_MUST_REMAIN_INACTIVE');}
 need(run('docker',['ps','--filter','name=nyra-5c-live-','--format','{{.Names}}'])==='','LIVE_ROLES_MUST_BE_INACTIVE');
 const history={};for(const n of (await readdir(DIR+'/evidence')).sort()){need(!n.includes('/'),'EVIDENCE_NAME');const s=await lstat(DIR+'/evidence/'+n);need(s.isFile()&&!s.isSymbolicLink()&&s.uid===uid&&(s.mode&0o077)===0&&s.nlink===1,'EVIDENCE_FILE');history[n]=digest(await readFile(DIR+'/evidence/'+n));}
 const attempt=KEYDIR+'/stage3f-'+digest(Buffer.from(hashJSON(target))).slice(0,24);if(existingAttempt!==attempt)try{await lstat(attempt);throw Error('ATTEMPT_EXISTS_INDEPENDENT_RECOVERY_REQUIRED');}catch(e){if(e.code!=='ENOENT')throw e;}
 const context={source:PIN.source,files,dependencyTree,snapshots,privateMetadata,appKey:metadata(keyStat),appKeySHA256,history,timer,helperSHA256:digest(await readFile(new URL(import.meta.url))),targetSHA256:hashJSON(target)};
 return {context,contextSHA256:hashJSON(context),uid,gid,target,launch,old,governance,baseline,attempt,baselinePath,hashJSON};
}

export const READBACK=String.raw`
import {readFile,lstat,open} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
import {privateFile} from '/opt/nyra-5c/live-runtime/ops/acceptance-bootstrap/owner-source.mjs';
import {administrationReader,readRepositoryAdministration,ENVIRONMENT_IDS} from '/opt/nyra-5c/live-runtime/lib/publication/runtime/administration-evidence.mjs';
import {verifyMergedChecks} from '/opt/nyra-5c/live-runtime/lib/publication/runtime/governance.mjs';
import {hashJSON} from '/opt/nyra-5c/live-runtime/lib/publication/contract.mjs';
const root='https://api.github.com/repos/Noctua76/eliaskalyvas-website',expected='29a73458d4cd941e5ed514db56dc2c553d041bda';
const need=(v,c)=>{if(!v)throw Error(c);};
const facts=new Map(),started=Date.now();let output,failedRoute=null;
function sanitize(url,v){
 if(url===root)return {id:v.id,full_name:v.full_name,owner:{id:v.owner?.id,type:v.owner?.type},default_branch:v.default_branch,permissions:v.permissions,visibility:v.visibility};
 if(url.includes('/secrets?'))return {total_count:v.total_count,secrets:[]};
 if(url.includes('/check-runs?'))return {total_count:v.total_count,check_runs:v.check_runs?.map(x=>({id:x.id,name:x.name,status:x.status,conclusion:x.conclusion,head_sha:x.head_sha,app:{id:x.app?.id},check_suite:x.check_suite,details_url:x.details_url}))};
 if(url.includes('/keys?'))return Array.isArray(v)?v.map(x=>({id:x.id,read_only:x.read_only})):v;
 return v;
}
try{
 let input='';for await(const b of process.stdin){input+=b;need(input.length<2000000,'INPUT_SIZE');}const {lease,target,baseline,contextSHA256,helperSHA256}=JSON.parse(input);
 need(lease.bootstrapId===target.bootstrapId&&Math.min(Date.parse(lease.expiresAt),Date.parse(lease.issuerExpiresAt))>Date.now()+120000,'CREDENTIAL_EXPIRED_OR_TOO_SHORT');
 const scopeResponse=await fetch('https://api.github.com/installation/repositories?per_page=100',{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+lease.token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(10000)});
 need(scopeResponse.ok&&!scopeResponse.headers.get('link')?.includes('rel="next"'),'AUTHENTICATED_SCOPE_DENIED');
 const scopeText=await scopeResponse.text();need(scopeText.length<=2000000,'SCOPE_SIZE');const scope=JSON.parse(scopeText);
 need(scope.total_count===1&&scope.repositories?.length===1&&scope.repositories[0].id===1389733212&&scope.repositories[0].full_name==='Noctua76/eliaskalyvas-website','REPOSITORY_SCOPE_CHANGED');
 const reader=administrationReader({tokenSource:async()=>{need(Date.parse(lease.expiresAt)>Date.now(),'CREDENTIAL_EXPIRED');return lease.token;}});
 const getJSON=async url=>{failedRoute=url.slice(root.length)||'/';const v=await reader(url),safe=JSON.parse(JSON.stringify(sanitize(url,v)));need(!facts.has(url)||hashJSON(facts.get(url))===hashJSON(safe),'ADMIN_SNAPSHOT_CHANGED');facts.set(url,safe);return v;};
 const repo=await getJSON(root);need(repo.full_name==='Noctua76/eliaskalyvas-website'&&String(repo.id)==='1389733212'&&String(repo.owner?.id)==='217035723'&&repo.owner?.type==='User','REPOSITORY_IDENTITY');
 const branch=await getJSON(root+'/branches/main');need(branch.commit?.sha===expected&&branch.protected===true,'MAIN_CHANGED_OR_UNPROTECTED');
 await getJSON(root+'/branches/main/protection');
 await getJSON(root+'/collaborators?affiliation=all&per_page=100');
 await getJSON(root+'/keys?per_page=100');
 await getJSON(root+'/actions/permissions/workflow');
 for(const [name,id]of Object.entries(ENVIRONMENT_IDS)){
  const env=await getJSON(root+'/environments/'+name);need(String(env.id)===id,'ENVIRONMENT_ID_CHANGED');
  await getJSON(root+'/environments/'+name+'/deployment-branch-policies?per_page=100');
  await getJSON(root+'/environments/'+name+'/secrets?per_page=100');
 }
 await verifyMergedChecks({getJSON,root,mainSHA:expected});
 // Supplemental fixed GETs; do not widen the installed runtime reader's allowlist.
 const extra=async suffix=>{failedRoute=suffix;need(['/actions/permissions','/actions/permissions/selected-actions'].includes(suffix)||/^\/rulesets\?includes_parents=true&per_page=100$|^\/rulesets\/[1-9][0-9]*\?includes_parents=true$|^\/rules\/branches\/main\?per_page=100$/.test(suffix),'RULESET_ROUTE');
  need(Date.parse(lease.expiresAt)>Date.now(),'CREDENTIAL_EXPIRED');
  const r=await fetch(root+suffix,{method:'GET',redirect:'error',headers:{Authorization:'Bearer '+lease.token,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},signal:AbortSignal.timeout(10000)});
  need(r.ok,'RULESET_HTTP_'+r.status);need(!r.headers.get('link')?.includes('rel="next"'),'RULESETS_INCOMPLETE');const t=await r.text();need(t.length<=2000000,'RULESET_SIZE');return JSON.parse(t);};
 const actionsPermissions=await extra('/actions/permissions');
 need(typeof actionsPermissions.enabled==='boolean'&&['all','local_only','selected'].includes(actionsPermissions.allowed_actions),'ACTIONS_SETTINGS_INCOMPLETE');
 const selectedActions=actionsPermissions.allowed_actions==='selected'?await extra('/actions/permissions/selected-actions'):null;
 const list=await extra('/rulesets?includes_parents=true&per_page=100');need(Array.isArray(list)&&list.length<100,'RULESET_SHAPE');
 const details=[];for(const r of list){need(Number.isSafeInteger(r.id)&&r.id>0,'RULESET_ID');details.push(await extra('/rulesets/'+r.id+'?includes_parents=true'));}
 const activeMainRules=await extra('/rules/branches/main?per_page=100');need(Array.isArray(activeMainRules)&&activeMainRules.length<100,'RULESET_SHAPE');
 let runtimeAdministration=null,policyStatus='PENDING';
 try{
  const config=await privateFile('/var/lib/nyra-5c/coordinator/governance.json');
  need(hashJSON(config)==='ec4b711e09bb448c74719e935ac2e3ca1e7675a8e75115526d67b9394d4e4a42','GOVERNANCE_CHANGED');
  runtimeAdministration=await readRepositoryAdministration({getJSON,governance:config});
  need(runtimeAdministration.record.mainSHA===expected&&hashJSON(runtimeAdministration.record)===runtimeAdministration.digest,'RUNTIME_DIGEST_MISMATCH');
  policyStatus='EXISTING_RUNTIME_ADMINISTRATION_CHECKS_PASSED';
 }catch(e){throw e;}
 need(runtimeAdministration.record.protectionsSHA256==='7bc1012c7309e172fda6a0616e670e9fd6a305f3325ca34eb5655e4f34759d97','PROTECTIONS_CHANGED');
 need(hashJSON(actionsPermissions)===hashJSON(baseline.record.actionsSettings.permissions)&&hashJSON(selectedActions)===hashJSON(baseline.record.actionsSettings.selectedActions)&&hashJSON(list)===hashJSON(baseline.record.rulesets.list)&&hashJSON(details)===hashJSON(baseline.record.rulesets.details)&&hashJSON(activeMainRules)===hashJSON(baseline.record.rulesets.activeMainRules),'SUPPLEMENTAL_PROTECTIONS_CHANGED');
 // Re-read every captured fact and supplemental protection, without cache.
 for(const url of [...facts.keys()])await getJSON(url);
 need(hashJSON(await extra('/actions/permissions'))===hashJSON(actionsPermissions),'ACTIONS_CHANGED');
 if(selectedActions)need(hashJSON(await extra('/actions/permissions/selected-actions'))===hashJSON(selectedActions),'ACTIONS_CHANGED');
 need(hashJSON(await extra('/rulesets?includes_parents=true&per_page=100'))===hashJSON(list)&&hashJSON(await extra('/rules/branches/main?per_page=100'))===hashJSON(activeMainRules),'RULESETS_CHANGED');
 for(const detail of details)need(hashJSON(await extra('/rulesets/'+detail.id+'?includes_parents=true'))===hashJSON(detail),'RULESET_CHANGED');
 const end=await getJSON(root+'/branches/main');need(end.commit?.sha===expected,'MAIN_CHANGED_DURING_READBACK');
 need(Date.now()-started<60000,'FRESH_CAPTURE_WINDOW_EXCEEDED');
 const record={renewalProvenance:{contextSHA256,helperSHA256,priorCaptureSHA256:baseline.digest,authorization:false},credentialAuthentication:{method:'GitHub installation token over verified HTTPS',appId:'5594139',installationId:'178162814',identityBinding:'PRIOR_VERIFIED_APP_AND_PRIVATE_CREDENTIAL_METADATA',issuerExpiresAt:lease.issuerExpiresAt,localExpiresAt:lease.expiresAt},evaluatorSourceSHA:'29a73458d4cd941e5ed514db56dc2c553d041bda',schema:'nyra.private.administration.capture.v1',repository:'Noctua76/eliaskalyvas-website',mainSHA:expected,observedAt:new Date(started).toISOString(),completedAt:new Date().toISOString(),actionsSettings:{permissions:actionsPermissions,selectedActions,policyBinding:'SUPPLEMENTAL_NOT_IN_RUNTIME_PROTECTIONS_DIGEST'},facts:[...facts].sort(([a],[b])=>a.localeCompare(b,'en')),rulesets:{list,details,activeMainRules,policyBinding:'SUPPLEMENTAL_NOT_IN_RUNTIME_PROTECTIONS_DIGEST',bypassVisibility:details.every(x=>Array.isArray(x.bypass_actors))?'PRESENT_OR_NO_RULESETS':'UNKNOWN'},runtimeAdministration,policyStatus,authorization:false,realTrustAcceptance:false};
 const envelope={record,digest:hashJSON(record)};
 output={status:'FRESH_ADMINISTRATION_OBSERVED_NOT_AUTHORIZED',envelope,authorization:false};
}catch(e){output={status:'ADMIN_READBACK_DENIED',reason:/^[A-Z][A-Z0-9_]{0,100}$/.test(e?.message??'')?e.message:'READBACK_ERROR',failedRoute,authorization:false};process.exitCode=1;}
console.log(JSON.stringify(output));
`;
export function validateFreshProof(proof,hashJSON,now=Date.now()){
 const r=proof?.record,observed=Date.parse(r?.observedAt),completed=Date.parse(r?.completedAt);
 need(proof?.digest===hashJSON(r)&&r.repository===PIN.repo&&r.mainSHA===PIN.source&&r.evaluatorSourceSHA===PIN.source&&r.authorization===false&&r.realTrustAcceptance===false,'FRESH_PROOF');
 need(Number.isFinite(observed)&&Number.isFinite(completed)&&observed<=completed&&completed<=now&&now-observed<60000,'FRESH_PROOF_STALE');
 need(r.runtimeAdministration?.digest===hashJSON(r.runtimeAdministration?.record)&&r.runtimeAdministration.record.mainSHA===PIN.source&&r.runtimeAdministration.record.protectionsSHA256===PIN.protections,'FRESH_RUNTIME_PROOF');
 return proof;
}
export async function oneAttempt({reserve,authenticate,issue,persist,observe,recheck,commit,complete}){
 // Durable reservation comes first, even before authenticated GETs. Any later
 // exception leaves the attempt closed. No retries, revocation or cleanup here.
 await reserve();await authenticate();const lease=await issue();await persist(lease);
 const proof=await observe(lease);await recheck();await commit(lease,proof);await complete(proof);return proof;
}
async function execute(p,approved){
 need(approved===p.contextSHA256,'APPROVED_CONTEXT_MISMATCH');
 const {uid,gid,target,attempt,baseline,hashJSON}=p;let attemptReserved=false;
 const event=async(name,record={})=>exclusiveJSON(attempt+'/'+name+'.json',{schema:'nyra.stage3f.attempt.v1',contextSHA256:p.contextSHA256,observedAt:new Date().toISOString(),...record,authorization:false});
 let jwt;
 try{return await oneAttempt({
  reserve:async()=>{await mkdir(attempt,{mode:0o700});attemptReserved=true;await syncDir(KEYDIR);await event('00-reserved',{context:p.context,oldCredentialSHA256:p.context.snapshots[CREDENTIAL].sha256,ownerMFAAuthorization:false});},
  authenticate:async()=>{
   const oldStatus=await github('/installation/repositories?per_page=100',p.old.token,{allow401:true});need(oldStatus.expired===true,'OLD_CREDENTIAL_STILL_ACCEPTED');
   const kb=await privateBytes(KEY,0);need(JSON.stringify(kb.meta)===JSON.stringify(p.context.appKey)&&kb.sha256===p.context.appKeySHA256,'APP_KEY_CHANGED');let key;try{key=createPrivateKey(kb.bytes);}finally{kb.bytes.fill(0);}need(key.asymmetricKeyType==='rsa','APP_RSA_REQUIRED');
   const now=Math.floor(Date.now()/1000),enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),body=enc({alg:'RS256',typ:'JWT'})+'.'+enc({iat:now-60,exp:now+300,iss:String(PIN.appId)});
   jwt=body+'.'+sign('RSA-SHA256',Buffer.from(body),key).toString('base64url');
   checkApp((await github('/app',jwt)).value);checkInstallation((await github('/app/installations/'+PIN.installationId,jwt)).value);checkInstallation((await github('/repos/'+PIN.repo+'/installation',jwt)).value);
   need((await preflight(p.baselinePath,attempt)).contextSHA256===p.contextSHA256,'PREFLIGHT_CHANGED');
  },
  issue:async()=>{
   await event('10-issuance-pending',{outcome:'UNCERTAIN_UNTIL_VERIFIED_RESPONSE'});
   const r=await github('/app/installations/'+PIN.installationId+'/access_tokens',jwt,{method:'POST',body:{repository_ids:[PIN.repoId],permissions:PERMISSIONS}}),v=r.value;
   // Save a received token privately BEFORE validating optional response fields;
   // malformed/late responses must still be recoverable without logging secrets.
   need(typeof v.token==='string'&&v.token.length>0&&v.token.length<20000&&!/[\u0000-\u0020\u007f]/.test(v.token),'ISSUER_TOKEN_INVALID');
   await exclusiveJSON(attempt+'/received-token.json',v);
   assert.deepEqual(v.permissions,PERMISSIONS);checkScope({total_count:v.repositories?.length,repositories:v.repositories});
   const times=issuerTimes(v.expires_at,r.date,Date.parse(target.expiresAt));checkScope((await github('/installation/repositories?per_page=100',v.token)).value);
   return {bootstrapId:target.bootstrapId,appId:String(PIN.appId),installationId:String(PIN.installationId),repositoryId:String(PIN.repoId),issuedAt:new Date().toISOString(),issuedAtMeaning:'local-observation-of-issuer-response',...times,token:v.token};
  },
  persist:async lease=>{await exclusiveJSON(attempt+'/pending-admin-read.json',lease,uid,gid);await event('20-issued',{issuerExpiresAt:lease.issuerExpiresAt,scope:'ONE_REPOSITORY_VERIFIED'});},
  observe:async lease=>{
   const r=spawnSync('setpriv',['--reuid='+uid,'--regid='+gid,'--init-groups','--no-new-privs',process.execPath,'--input-type=module','-e',READBACK],{input:JSON.stringify({lease,target,baseline,contextSHA256:p.contextSHA256,helperSHA256:p.context.helperSHA256}),env:{PATH:process.env.PATH},encoding:'utf8',timeout:65000,maxBuffer:4000000,stdio:['pipe','pipe','pipe']});
   let proof;try{proof=JSON.parse(r.stdout);}catch{throw Error('READBACK_CHILD_DENIED');}
   need(r.status===0&&proof.status==='FRESH_ADMINISTRATION_OBSERVED_NOT_AUTHORIZED'&&proof.authorization===false,'FRESH_READBACK_DENIED');
   const e=validateFreshProof(proof.envelope,hashJSON);need(e.record.renewalProvenance.contextSHA256===p.contextSHA256&&e.record.renewalProvenance.helperSHA256===p.context.helperSHA256,'PROOF_PROVENANCE');
   return e;
  },
  recheck:async()=>{
   need((await preflight(p.baselinePath,attempt)).contextSHA256===p.contextSHA256,'IMMUTABLE_STATE_CHANGED');
   checkApp((await github('/app',jwt)).value);checkInstallation((await github('/app/installations/'+PIN.installationId,jwt)).value);checkInstallation((await github('/repos/'+PIN.repo+'/installation',jwt)).value);
  },
  commit:async(lease,proof)=>{
   validateFreshProof(proof,hashJSON);need(Date.parse(lease.expiresAt)-Date.now()>120000&&Date.parse(target.expiresAt)>Date.now(),'COMMIT_STALE');
   await exclusiveJSON(attempt+'/fresh-administration.json',proof);
   await event('30-commit-pending',{credentialInstallation:'UNCERTAIN_UNTIL_40_COMPLETE'});
   const installed=await commitCredential({canonical:CREDENTIAL,pending:attempt+'/pending-admin-read.json',archive:attempt+'/previous-admin-read.json',expected:p.context.snapshots[CREDENTIAL],uid});
   need(JSON.parse(installed.bytes).token===lease.token,'INSTALLED_CREDENTIAL_MISMATCH');
   const evidenceFile=DIR+'/evidence/administration-stage3f-'+proof.digest+'.json';await exclusiveJSON(evidenceFile,proof,uid,gid);
  },
  complete:async proof=>event('40-complete',{status:'CREDENTIAL_RENEWED_ADMINISTRATION_OBSERVED_NOT_AUTHORIZED',administrationCaptureSHA256:proof.digest,sourceSHA:PIN.source})
 });}catch(e){if(attemptReserved)await event('90-stopped',{status:'STOPPED_INDEPENDENT_RECOVERY_REQUIRED'}).catch(()=>{});throw Error('STAGE3F_STOPPED_INDEPENDENT_RECOVERY_REQUIRED');}
}
export async function inventory(path){
 need(process.getuid?.()===0&&/^\/root\/nyra-github-app\/stage3f-[a-f0-9]{24}$/.test(path),'INVENTORY_PATH');await privateDirectory(path,0);
 const entries=[];for(const name of (await readdir(path)).sort()){const f=path+'/'+name,s=await lstat(f);need(s.isFile()&&!s.isSymbolicLink(),'INVENTORY_FILE');entries.push({name,...metadata(s)});}
 let canonical;try{canonical=metadata(await lstat(CREDENTIAL));}catch(e){if(e.code!=='ENOENT')throw e;canonical='ABSENT_FAIL_CLOSED';}
 return {status:'READ_ONLY_RECOVERY_INVENTORY',attemptPath:path,entries,canonical,networkRequests:0,recoveryPerformed:false,authorization:false};
}
async function main(){
 process.umask(0o077);const args=process.argv.slice(2),mode=args[0];
 if(mode==='--recovery-inventory'&&args.length===2){console.log(JSON.stringify(await inventory(args[1]),null,2));return;}
 need((mode==='--preflight'&&args.length===2)||(mode==='--execute-once'&&args.length===4&&args[2]==='--approved-context'&&/^[a-f0-9]{64}$/.test(args[3])),'USAGE');
 const p=await preflight(args[1]);
 if(mode==='--preflight'){console.log(JSON.stringify({status:'LOCAL_READ_ONLY_PREFLIGHT_PASS',contextSHA256:p.contextSHA256,helperSHA256:p.context.helperSHA256,sourceSHA:PIN.source,stagedFiles:57,dependencyTree:p.context.dependencyTree,reviewedInputSHA256:p.context.snapshots[PRIVATE+'/stage3-reviewed-input.json'].sha256,launchSHA256:p.context.snapshots[PRIVATE+'/launch.json'].sha256,provisioningMarkerSHA256:p.context.snapshots[PRIVATE+'/stage3-provisioning-attempt.json'].sha256,governanceSHA256:PIN.governance,historicalCaptureSHA256:PIN.capture,hostExpiresAt:p.target.expiresAt,attemptPath:p.attempt,networkRequests:0,authorization:false},null,2));return;}
 const proof=await execute(p,args[3]);console.log(JSON.stringify({status:'CREDENTIAL_RENEWED_ADMINISTRATION_OBSERVED_NOT_AUTHORIZED',sourceSHA:PIN.source,administrationCaptureSHA256:proof.digest,attemptPath:p.attempt,ownerMFAAuthorization:false,authorization:false},null,2));
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)main().catch(e=>{console.error(JSON.stringify({status:'STAGE3F_CLOSED',reason:/^[A-Z][A-Z0-9_]{0,110}$/.test(e.message)?e.message:'LOCAL_OR_PRIVATE_OPERATION_DENIED',authorization:false}));process.exitCode=1;});

import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readFile,lstat,rename,mkdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {spawnSync} from 'node:child_process';
import {PIN,PERMISSIONS,digest,checkApp,checkInstallation,checkScope,checkExpired,issuerTimes,github,commitCredential,oneAttempt,validateFreshProof,READBACK} from '../ops/acceptance-bootstrap/stage3f-github-readback.mjs';
const app=()=>({id:PIN.appId,slug:PIN.slug,owner:{id:PIN.ownerId},permissions:{...PERMISSIONS},events:[]});
const installation=()=>({id:PIN.installationId,app_id:PIN.appId,account:{id:PIN.ownerId,type:'User'},repository_selection:'selected',suspended_at:null,permissions:{...PERMISSIONS}});
const scope=()=>({total_count:1,repositories:[{id:PIN.repoId,full_name:PIN.repo}]});
const now=Date.parse('2026-11-04T18:00:00Z'),target={bootstrapId:'fixture-host',createdAt:'2026-11-04T12:00:00Z',expiresAt:'2026-11-04T21:05:00Z'};
const credential=()=>({bootstrapId:target.bootstrapId,appId:PIN.appId,installationId:PIN.installationId,repositoryId:PIN.repoId,issuedAt:'2026-11-04T12:01:00Z',expiresAt:'2026-11-04T13:01:00Z',issuerExpiresAt:'2026-11-04T13:01:00Z',token:'synthetic-private-stage3f'});

test('exact App / installation / repository and seven read-only permissions; no widening',()=>{
 checkApp(app());checkInstallation(installation());checkScope(scope());
 for(const mutate of [a=>a.id++,a=>a.owner.id++,a=>a.events.push('push'),a=>a.permissions.administration='write',a=>a.permissions.workflows='read',a=>delete a.permissions.checks]){const a=app();mutate(a);assert.throws(()=>checkApp(a));}
 for(const mutate of [i=>i.id++,i=>i.app_id++,i=>i.account.type='Organization',i=>i.repository_selection='all',i=>i.suspended_at='2026-11-04',i=>i.permissions.contents='write']){const i=installation();mutate(i);assert.throws(()=>checkInstallation(i));}
 for(const mutate of [s=>s.total_count++,s=>s.repositories.push(s.repositories[0]),s=>s.repositories[0].id++,s=>s.repositories[0].full_name='other/repo']){const s=scope();mutate(s);assert.throws(()=>checkScope(s));}
});
test('only expired credential in actual target context; issuer lifetime never exceeds host',()=>{
 checkExpired(credential(),target,now);
 for(const patch of [{bootstrapId:'other'},{issuerExpiresAt:'2026-11-04T19:00:00Z'},{issuedAt:'bad'},{expiresAt:'2026-11-05T00:00:00Z'},{token:'invalid\ntoken'}])assert.throws(()=>checkExpired({...credential(),...patch},target,now));
 assert.equal(issuerTimes('2026-11-04T19:00:00Z',new Date(now).toUTCString(),Date.parse(target.expiresAt),now).expiresAt,'2026-11-04T19:00:00.000Z');
 for(const [expiry,date,end]of [['2026-11-04T22:00:00Z',now,Date.parse(target.expiresAt)],['2026-11-04T19:00:00Z',now-60001,Date.parse(target.expiresAt)],['2026-11-04T18:01:00Z',now,Date.parse(target.expiresAt)],['2026-11-04T19:00:00Z',now,now+3599999]])assert.throws(()=>issuerTimes(expiry,new Date(date).toUTCString(),end,now));
});
test('network route allowlist, no redirects/pagination and no automatic issuance retries',async()=>{
 let calls=0;const fetcher=async(url,o)=>{calls++;assert.equal(o.redirect,'error');assert.equal(o.method,'POST');assert.deepEqual(JSON.parse(o.body),{repository_ids:[PIN.repoId],permissions:PERMISSIONS});throw Error('UNCERTAIN_RESPONSE');};
 await assert.rejects(github('/app/installations/'+PIN.installationId+'/access_tokens','synthetic',{method:'POST',body:{repository_ids:[PIN.repoId],permissions:PERMISSIONS},fetcher}));assert.equal(calls,1);
 for(const [path,method]of [['/installation/token','DELETE'],['/repos/'+PIN.repo+'/dispatches','POST'],['https://other/','GET'],['/app','POST']])await assert.rejects(github(path,'synthetic',{method,fetcher}));assert.equal(calls,1);
 await assert.rejects(github('/app','synthetic',{fetcher:async()=>({ok:true,headers:new Headers({link:'<next>; rel="next"'})})}));
 assert.deepEqual(await github('/installation/repositories?per_page=100','expired',{allow401:true,fetcher:async()=>({status:401})}),{expired:true});
 await assert.rejects(github('/app','synthetic',{fetcher:async()=>({status:403,ok:false,headers:new Headers()})}));
});
test('all partial failures stop exactly once, never invoke later stages or recovery',async()=>{
 const order=['reserve','authenticate','issue','persist','observe','recheck','commit','complete'];
 for(let fail=0;fail<order.length;fail++){const seen=[],hooks=Object.fromEntries(order.map((name,i)=>[name,async()=>{seen.push(name);if(i===fail)throw Error('PRIVATE_SENTINEL');return name;} ]));await assert.rejects(oneAttempt(hooks));assert.deepEqual(seen,order.slice(0,fail+1));}
 const seen=[];await oneAttempt(Object.fromEntries(order.map(name=>[name,async()=>{seen.push(name);return name;}])));assert.deepEqual(seen,order);
});
async function fixture(t){const dir=await mkdtemp(join(tmpdir(),'nyra-stage3f-'));t.after(()=>rm(dir,{recursive:true,force:true}));const canonical=dir+'/canonical.json',pending=dir+'/pending.json',archive=dir+'/archive/previous.json';await mkdir(dirname(archive));await writeFile(canonical,'expired-original',{mode:0o600});await writeFile(pending,'new-private',{mode:0o600});const s=await lstat(canonical);return {canonical,pending,archive,uid:process.getuid(),expected:{sha256:digest(Buffer.from('expired-original')),meta:{dev:s.dev,ino:s.ino,uid:s.uid,gid:s.gid,mode:s.mode,nlink:s.nlink,size:s.size,mtimeMs:String(s.mtimeMs),ctimeMs:String(s.ctimeMs)}}};}
test('successful commit preserves original inode/bytes, installs private credential with nlink=1',async t=>{
 const f=await fixture(t),result=await commitCredential(f);assert.equal(await readFile(f.archive,'utf8'),'expired-original');assert.equal((await lstat(f.archive)).ino,f.expected.meta.ino);assert.equal(result.bytes.toString(),'new-private');assert.equal(result.meta.nlink,1);assert.equal(result.meta.mode&0o777,0o600);assert.equal(await readFile(f.canonical,'utf8'),'new-private');
});
test('concurrent replacement before commit is never overwritten or removed',async t=>{
 const f=await fixture(t);await writeFile(f.canonical+'.other','concurrent-secret',{mode:0o600});await rename(f.canonical+'.other',f.canonical);await assert.rejects(commitCredential(f));assert.equal(await readFile(f.canonical,'utf8'),'concurrent-secret');assert.equal(await readFile(f.pending,'utf8'),'new-private');
});
test('partial commit with missing pending token preserves original in recovery inventory',async t=>{
 const f=await fixture(t);await rename(f.pending,f.pending+'.held');await assert.rejects(commitCredential(f));assert.equal(await readFile(f.archive,'utf8'),'expired-original');await assert.rejects(lstat(f.canonical),{code:'ENOENT'});
});
test('new utility stays outside exact 57-file runtime closure; contracts/workflows unchanged',async()=>{
 const root=resolve(import.meta.dirname,'..'),seen=new Set();const visit=async p=>{if(seen.has(p))return;seen.add(p);const text=await readFile(root+'/'+p,'utf8');for(const m of text.matchAll(/^(?:import|export)[^;\n]*?from\s*['"]([^'"]+)['"]/gm))if(m[1].startsWith('.'))await visit(resolve(root,dirname(p),m[1]).slice(root.length+1));};
 for(const n of ['repository-db','repository-launch','repository-runtime','replacement-target','live-role-worker','fra1-runtime','fra1-launch'])await visit('ops/acceptance-bootstrap/'+n+'.mjs');await visit('ops/protected-delivery/schema.sql');for(const n of ['shared','release','manifest','event','receipt','dataset'])seen.add('contracts/nyra-publication/v1.1/'+n+'.schema.json');
 assert.equal(seen.size,57);assert(!seen.has('ops/acceptance-bootstrap/stage3f-github-readback.mjs'));
 // Fixed fingerprint independently recovered from approved source 29a73458.
 const pairs=[];for(const p of [...seen,'.github/workflows/required-ci.yml','ops/acceptance-bootstrap/stage-live-runtime.mjs'].sort())pairs.push([p,digest(await readFile(root+'/'+p))]);
 assert.equal(digest(Buffer.from(JSON.stringify(pairs))),'410e8b9a64832651a02911d3cb1f6d797f7d4f040e7fc3dfc1901712df49e63f');
});
test('readback reuses staged validators, checks both runtime and supplemental pins, never signs authority',()=>{
 assert(READBACK.includes('/opt/nyra-5c/live-runtime/lib/publication/runtime/administration-evidence.mjs'));assert(READBACK.includes('SUPPLEMENTAL_PROTECTIONS_CHANGED'));assert(READBACK.includes('PROTECTIONS_CHANGED'));assert(READBACK.includes('for(const url of [...facts.keys()])await getJSON(url)'));assert(READBACK.includes('authorization:false,realTrustAcceptance:false'));assert(!READBACK.includes('createPrivateKey'));assert(!READBACK.includes("method:'POST'"));assert(!READBACK.includes('owner-key.json'));
});
test('CLI rejects invalid modes before filesystem/network and never prints private errors',()=>{
 const r=spawnSync(process.execPath,['ops/acceptance-bootstrap/stage3f-github-readback.mjs','--dispatch','PRIVATE_SENTINEL'],{cwd:resolve(import.meta.dirname,'..'),encoding:'utf8'});assert.equal(r.status,1);assert(!r.stderr.includes('PRIVATE_SENTINEL'));assert.deepEqual(JSON.parse(r.stderr),{status:'STAGE3F_CLOSED',reason:'USAGE',authorization:false});
});

test('fresh proof rejects stale, future, changed source / protections / provenance digests',()=>{
 const hashJSON=v=>digest(Buffer.from(JSON.stringify(v))),make=()=>{const runtime={mainSHA:PIN.source,protectionsSHA256:PIN.protections};const record={repository:PIN.repo,mainSHA:PIN.source,evaluatorSourceSHA:PIN.source,authorization:false,realTrustAcceptance:false,observedAt:new Date(now-1000).toISOString(),completedAt:new Date(now).toISOString(),runtimeAdministration:{record:runtime,digest:hashJSON(runtime)}};return {record,digest:hashJSON(record)};};
 validateFreshProof(make(),hashJSON,now);
 for(const patch of [{observedAt:new Date(now-60000).toISOString()},{observedAt:new Date(now+1).toISOString()},{completedAt:new Date(now+1).toISOString()},{observedAt:'bad'},{mainSHA:'other'},{authorization:true},{realTrustAcceptance:true}]){const e=make();Object.assign(e.record,patch);e.digest=hashJSON(e.record);assert.throws(()=>validateFreshProof(e,hashJSON,now));}
 const e=make();e.record.runtimeAdministration.record.protectionsSHA256='changed';e.record.runtimeAdministration.digest=hashJSON(e.record.runtimeAdministration.record);e.digest=hashJSON(e.record);assert.throws(()=>validateFreshProof(e,hashJSON,now));
 const invalid=make();invalid.digest='tampered';assert.throws(()=>validateFreshProof(invalid,hashJSON,now));
});

// CI-only actual container dependency proof. NO DigitalOcean/host connection,
// DB setup, login/grant changes, network, publication, OIDC or persistent service.
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm,readFile,readdir} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {roleIPCArgs} from './role-ipc-proof.mjs';
const ROOT='/opt/nyra-5c/bootstrap/';
const files=['ops/acceptance-bootstrap/role-ipc-worker.mjs','lib/publication/runtime/acceptance-ipc.mjs','lib/publication/canonical-json.mjs','ops/native-acceptance/node_modules'];
export function containerCheckArgs({role,uid,gid,checkout,privateDir,name}){
 const keyPath='/var/lib/nyra-5c/'+role+'/.ipc-proof-'+'a'.repeat(16);
 const args=roleIPCArgs(role,uid,gid,keyPath);
 args[args.indexOf('--network')+1]='none';args[args.indexOf('--name')+1]=name;
 for(let i=0;i<args.length;i++)if(args[i]==='--mount'){
  const mount=args[++i],parts=mount.split(','),src=parts.find(p=>p.startsWith('src=')).slice(4);let replacement;
  if(src.startsWith(ROOT)&&files.includes(src.slice(ROOT.length)))replacement=join(checkout,src.slice(ROOT.length));
  else if(src==='/var/lib/nyra-5c/'+role+'/pg.json')replacement=join(privateDir,'pg.json');
  else if(src===keyPath)replacement=join(privateDir,'ipc.key');
  else throw Error('IPC_CONTAINER_MOUNT');
  args[i]=parts.map(p=>p.startsWith('src=')?'src='+replacement:p).join(',');
 }
 const at=args.indexOf('library/node@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94');assert(at>0);
 args.splice(at,0,'--mount','type=bind,src='+join(checkout,'ops/acceptance-bootstrap/role-ipc-client.mjs')+',dst=/app/ops/acceptance-bootstrap/role-ipc-client.mjs,readonly',
  '--mount','type=bind,src='+join(checkout,'test/acceptance-ipc-standalone.test.mjs')+',dst=/app/test/acceptance-ipc-standalone.test.mjs,readonly',
  '-e','NYRA_IPC_SELF_COPY=1','-e','NYRA_IPC_PG_RUNTIME=1');
 args.splice(args.indexOf('node')+1,2,'--test','--test-reporter=tap','/app/test/acceptance-ipc-standalone.test.mjs');
 return args;
}
export async function checkIPCContainerDependencies({command,images,head}){
 assert(process.env.GITHUB_ACTIONS==='true'&&process.env.RUNNER_ENVIRONMENT==='github-hosted'&&process.env.NYRA_TRUST_CI==='1');
 const checkout=resolve('.'),lock=JSON.parse(await readFile('ops/native-acceptance/package-lock.json','utf8'));
 assert.deepEqual(lock.packages[''].dependencies,{pg:'8.16.3'});
 assert.equal(images.driver.image,'library/node@sha256:dd9d21971ec4395903fa6143c2b9267d048ae01ca6d3ea96f16cb30df6187d94');
 const allowed=new Set(Object.keys(lock.packages).filter(p=>p.startsWith('node_modules/')).map(p=>p.slice('node_modules/'.length)));
 for(const e of await readdir('ops/native-acceptance/node_modules',{withFileTypes:true}))if(!e.name.startsWith('.'))assert(allowed.has(e.name)&&e.isDirectory(),'Unexpected runtime package');
 const root=await mkdtemp(join(tmpdir(),'nyra-ipc-container-')),checks=[];const uid=process.getuid(),gid=process.getgid();
 try{for(const role of ['registrar','broker']){
  const privateDir=join(root,role);await (await import('node:fs/promises')).mkdir(privateDir,{mode:0o700});
  await writeFile(join(privateDir,'pg.json'),JSON.stringify({host:'db',port:5432,database:'postgres',user:'nyra_accept_'+role,password:'synthetic-unused-import-only'}),{mode:0o600});
  await writeFile(join(privateDir,'ipc.key'),Buffer.alloc(32,23),{mode:0o600});
  const name='nyra-ipc-deps-'+process.env.GITHUB_RUN_ID+'-'+role;
  try{
   const output=command('docker',containerCheckArgs({role,uid,gid,checkout,privateDir,name}),{timeout:60000});
   assert(/# fail 0/.test(output)&&/# skipped 0/.test(output)&&/Digest-pinned worker image resolves native pg/.test(output));
   checks.push({role,nodeImage:images.driver.image,exactWorkerMountGraph:true,pgDriver:'8.16.3',websiteDependenciesMounted:false,network:'none',testsPassed:true});
  }finally{try{command('docker',['rm','-f',name]);}catch{}}
 }}finally{await rm(root,{recursive:true,force:true});}
 return {head,checks,databaseInstallationRepeated:false,realDatabaseIdentityRetested:false,publicPorts:0,realAcceptance:false};
}

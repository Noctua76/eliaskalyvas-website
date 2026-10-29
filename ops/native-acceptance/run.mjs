// Explicit opt-in CI only. No production variables, project linking or deployment.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync,writeFileSync,mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {randomBytes,createHmac} from 'node:crypto';
import {runNative} from './suite.mjs';
const out=resolve('native-results');mkdirSync(out,{recursive:true});
const results={schema:'nyra.native.acceptance.v1',source:process.env.GITHUB_SHA,results:[],stacks:[]};
const cmd=(c,args,options={})=>execFileSync(c,args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:120000,...options});
const event=(id,status,detail)=>{const r={id,status,detail};results.results.push(r);writeFileSync(join(out,'results.json'),JSON.stringify(results,null,2));console.log(JSON.stringify(r));};
const token=(role,secret)=>{const e=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),s=e({alg:'HS256',typ:'JWT'})+'.'+e({role,iss:'supabase',iat:Math.floor(Date.now()/1000),exp:Math.floor(Date.now()/1000)+3600});return s+'.'+createHmac('sha256',secret).update(s).digest('base64url');};
assert(process.env.GITHUB_ACTIONS==='true'&&process.env.NYRA_NATIVE_CI==='1','GitHub-hosted opt-in required');
assert(process.env.RUNNER_ENVIRONMENT==='github-hosted','No self-hosted runner');
assert(process.version.startsWith('v22.'));
assert(!process.env.SUPABASE_ACCESS_TOKEN&&!process.env.SUPABASE_URL&&!process.env.SUPABASE_SERVICE_ROLE_KEY,'Production environment forbidden');
const images=JSON.parse(readFileSync(new URL('images.lock.json',import.meta.url)));
for(const x of Object.values(images))assert(/^[a-z0-9/.-]+@sha256:[a-f0-9]{64}$/.test(x.image));
event('docker','PASS',{version:cmd('docker',['version','--format','{{.Server.Version}}']).trim(),node:process.version});
for(const x of Object.values(images))cmd('docker',['pull',x.image]);
let failed=false;const catalogs=[];
for(const letter of ['a','b']){
 const project=`nyra5a-${process.env.GITHUB_RUN_ID}-${process.env.GITHUB_RUN_ATTEMPT}-${letter}`,root=mkdtempSync(join(tmpdir(),'nyra5a-')),network=project+'-isolated';
 const secret=randomBytes(40).toString('hex'),password=randomBytes(24).toString('hex'),anon=token('anon',secret),service=token('service_role',secret);
 // GitHub masking before any failure can surface a value.
 for(const value of [secret,password,anon,service])console.log('::add-mask::'+value);
 const ports={db:55432,auth:55999,rest:55300};
 const compose={services:{db:{image:images.db.image,environment:{POSTGRES_PASSWORD:password,POSTGRES_DB:'postgres',JWT_SECRET:secret,JWT_EXP:'3600'},ports:[`127.0.0.1:${ports.db}:5432`],volumes:[`${root}/roles.sql:/docker-entrypoint-initdb.d/init-scripts/99-roles.sql:ro`],security_opt:['no-new-privileges:true']},auth:{image:images.auth.image,environment:{GOTRUE_API_HOST:'0.0.0.0',GOTRUE_API_PORT:'9999',API_EXTERNAL_URL:`http://127.0.0.1:${ports.auth}`,GOTRUE_DB_DRIVER:'postgres',GOTRUE_DB_DATABASE_URL:`postgres://supabase_auth_admin:${password}@db:5432/postgres`,GOTRUE_SITE_URL:'http://127.0.0.1:55111',GOTRUE_JWT_SECRET:secret,GOTRUE_JWT_AUD:'authenticated',GOTRUE_JWT_ADMIN_ROLES:'service_role',GOTRUE_JWT_DEFAULT_GROUP_NAME:'authenticated',GOTRUE_JWT_EXP:'300',GOTRUE_EXTERNAL_EMAIL_ENABLED:'true',GOTRUE_EXTERNAL_ANONYMOUS_USERS_ENABLED:'true',GOTRUE_MAILER_AUTOCONFIRM:'true',GOTRUE_MFA_TOTP_ENROLL_ENABLED:'true',GOTRUE_MFA_TOTP_VERIFY_ENABLED:'true',GOTRUE_EXTERNAL_PHONE_ENABLED:'false',GOTRUE_RATE_LIMIT_TOKEN_REFRESH:'10000'},ports:[`127.0.0.1:${ports.auth}:9999`],security_opt:['no-new-privileges:true']},rest:{image:images.rest.image,environment:{PGRST_DB_URI:`postgres://authenticator:${password}@db:5432/postgres`,PGRST_DB_SCHEMAS:'public',PGRST_DB_ANON_ROLE:'anon',PGRST_JWT_SECRET:secret},ports:[`127.0.0.1:${ports.rest}:3000`],security_opt:['no-new-privileges:true']}},networks:{default:{external:true,name:network}}};
 writeFileSync(join(root,'compose.json'),JSON.stringify(compose),{mode:0o600});
 // Same native bootstrap used by upstream Supabase docker/volumes/db/roles.sql.
 writeFileSync(join(root,'roles.sql'),`ALTER USER authenticator WITH PASSWORD '${password}'; ALTER USER supabase_auth_admin WITH PASSWORD '${password}'; ALTER USER supabase_storage_admin WITH PASSWORD '${password}';`);
 const dc=(...args)=>cmd('docker',['compose','-p',project,'-f',join(root,'compose.json'),...args]);
 try{
  cmd('docker',['network','create','--internal','--opt','com.docker.network.bridge.host_binding_ipv4=127.0.0.1',network]);
  const n=JSON.parse(cmd('docker',['network','inspect',network]))[0];assert(n.Internal);
  // Deny container-initiated access to runner host as well as external forwarding.
  const bridge='br-'+n.Id.slice(0,12);
  cmd('sudo',['iptables','-I','INPUT','1','-i',bridge,'-m','conntrack','--ctstate','NEW','-j','DROP']);
  cmd('sudo',['iptables','-I','DOCKER-USER','1','-i',bridge,'!','-o',bridge,'-j','DROP']);
  for(const target of ['https://1.1.1.1','http://169.254.169.254','http://'+n.IPAM.Config[0].Gateway+':80']){
   let blocked=false;try{cmd('docker',['run','--rm','--network',network,images.probe.image,'--connect-timeout','2','--max-time','3','-fsS',target],{timeout:10000});}catch{blocked=true;}assert(blocked,'Outbound isolation failed');
  }
  event(letter+':isolation','PASS',{internal:n.Internal,iptables:true,blockedExternalAndMetadata:true});
  dc('up','-d','db');
  for(let i=0;;i++){try{dc('exec','-T','db','pg_isready','-h','127.0.0.1','-U','postgres');break;}catch{if(i===45)throw Error('DB_HEALTH_TIMEOUT');await new Promise(r=>setTimeout(r,1000));}}
  dc('up','-d','auth','rest');
  for(let i=0;;i++){try{const r=await fetch(`http://127.0.0.1:${ports.auth}/health`);assert(r.ok);break;}catch{if(i===60)throw Error('AUTH_HEALTH_TIMEOUT');await new Promise(r=>setTimeout(r,1000));}}
  const state=JSON.parse(dc('ps','--format','json').trim().split('\n').map(x=>x.trim()).filter(Boolean).join(',').replace(/^/,'[').replace(/$/,']'));
  for(const s of state){const ins=JSON.parse(cmd('docker',['inspect',s.ID]))[0];assert.equal(ins.HostConfig.Privileged,false);for(const binds of Object.values(ins.HostConfig.PortBindings||{}))for(const b of binds||[])assert.equal(b.HostIp,'127.0.0.1');}
  const actual=Object.fromEntries(['db','auth','rest'].map(k=>[k,JSON.parse(cmd('docker',['image','inspect',images[k].image]))[0].RepoDigests]));results.stacks.push({project,images:actual});
  const catalog=await runNative({ports,password,anon,service,dc,event,prefix:letter,out});catalogs.push(catalog);
 }catch(e){failed=true;event(letter+':execution','FAIL',{name:e.name,code:e.code||null,message:String(e.message).replaceAll(password,'[redacted]').replaceAll(secret,'[redacted]').slice(0,650)});}
 finally{
  try{dc('down','--volumes','--remove-orphans');}catch{event(letter+':cleanup','FAIL','container cleanup failed');failed=true;}
  try{const n=JSON.parse(cmd('docker',['network','inspect',network]))[0],b='br-'+n.Id.slice(0,12);cmd('sudo',['iptables','-D','INPUT','-i',b,'-m','conntrack','--ctstate','NEW','-j','DROP']);cmd('sudo',['iptables','-D','DOCKER-USER','-i',b,'!','-o',b,'-j','DROP']);cmd('docker',['network','rm',network]);}catch{event(letter+':cleanup-network','FAIL','network cleanup failed');failed=true;}
  rmSync(root,{recursive:true,force:true});
 }
 // On a reproduced application defect, no dependent cases or code corrections.
 if(failed)break;
}
if(catalogs.length===2){assert.deepEqual(catalogs[0],catalogs[1]);event('two-clean-stacks','PASS','Normalized catalogs identical');}
for(const id of ['C01','C02','C03','C04','C05','C06','C07','C08','C09','C10','C11','C12','C13','C14','Edge','Storage'])if(!results.results.some(x=>x.id.endsWith(':'+id)))event(id,'NOT VERIFIED','Not reached or not implemented; no synthetic result substituted');
writeFileSync(join(out,'results.json'),JSON.stringify(results,null,2));if(failed)process.exitCode=1;

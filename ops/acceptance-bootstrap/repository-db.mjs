// Fresh replacement-host DB only. No production connection or published port.
import {execFileSync} from 'node:child_process';
import {readFile,writeFile,chown,lstat} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import {privateFile} from './owner-source.mjs';
import {validateReplacementTarget} from './replacement-target.mjs';
import {cleanupReplacement} from './repository-launch.mjs';
import {loginsSQL,IMAGE} from './db-stage.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
const run=(args,input)=>execFileSync('docker',args,{encoding:'utf8',input,stdio:[input?'pipe':'ignore','pipe','pipe'],timeout:120000}).trim();
export function replacementDBCommands(target){validateReplacementTarget(target,{created:true});const label='com.noctua.nyra.acceptance='+hashJSON(target);return {network:['network','create','--internal','--label',label,'nyra-repository-db'],database:['run','-d','--name','nyra-repository-pg','--label',label,'--network','nyra-repository-db','--network-alias','db','--restart','no','--memory','1g','--security-opt','no-new-privileges:true','--env-file','/opt/nyra-5c/private/repository-db.env',IMAGE]};}
async function main(){
 if(process.env.NYRA_REPOSITORY_DB!=='1'||process.getuid?.()!==0||process.argv[2]!=='--apply')throw Error('DISABLED');
 const t=await privateFile(process.argv[3]);validateReplacementTarget(t,{created:true});
 const command=(f,a)=>execFileSync(f,a,{encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();
 if(command('hostname',[])!==t.hostname||command('systemctl',['is-active','nyra-repository-expiry.timer'])!=='active')throw Error('HOST_OR_TIMER');
 if(run(['ps','-aq'])!==''||run(['network','ls','--filter','name=^nyra-repository-db$','--format','{{.Name}}'])!=='')throw Error('NOT_FRESH');
 const passwords={registrar:randomBytes(24).toString('hex'),broker:randomBytes(24).toString('hex')};
 const secret=async(path,text,uid=0,gid=0)=>{const parent=await lstat(path.slice(0,path.lastIndexOf('/')));if(!parent.isDirectory()||parent.isSymbolicLink()||(parent.mode&0o007))throw Error('PRIVATE_DIRECTORY');await writeFile(path,text,{flag:'wx',mode:0o600});await chown(path,uid,gid);};
 try{
  await secret('/opt/nyra-5c/private/repository-db.env','POSTGRES_PASSWORD='+randomBytes(32).toString('hex')+'\nPOSTGRES_DB=postgres\n');
  for(const role of ['registrar','broker']){const u=command('getent',['passwd','nyra-'+role]).split(':');await secret('/var/lib/nyra-5c/'+role+'/pg.json',JSON.stringify({host:'db',database:'postgres',port:5432,user:'nyra_accept_'+role,password:passwords[role]}),Number(u[2]),Number(u[3]));}
  const args=replacementDBCommands(t);run(args.network);run(args.database);
  const net=JSON.parse(run(['network','inspect','nyra-repository-db']))[0],bridge='br-'+net.Id.slice(0,12);
  command('iptables',['-I','INPUT','-i',bridge,'-m','conntrack','--ctstate','NEW','-j','DROP']);command('iptables',['-I','DOCKER-USER','-i',bridge,'!','-o',bridge,'-j','DROP']);
  let ready=false;for(let n=0;n<60;n++){try{run(['exec','nyra-repository-pg','pg_isready','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,1000));}}if(!ready)throw Error('DB_NOT_READY');
  const psql=['exec','-i','nyra-repository-pg','psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1'];
  run(psql,await readFile(new URL('../protected-delivery/schema.sql',import.meta.url),'utf8'));
  run(psql,loginsSQL(passwords.registrar,passwords.broker));
  for(const role of ['registrar','broker'])run(psql,"alter role nyra_accept_"+role+" valid until '"+new Date(t.expiresAt).toISOString()+"';");
  console.log(JSON.stringify({postgres17:true,internalNetwork:true,publicPorts:0,liveAcceptance:false}));
 }catch{cleanupReplacement(t,{apply:true});throw Error('REPLACEMENT_DB_CLOSED');}
}
if(process.argv[1]===new URL(import.meta.url).pathname)main().catch(()=>{console.error('NYRA_REPLACEMENT_DB_DENIED');process.exitCode=1;});

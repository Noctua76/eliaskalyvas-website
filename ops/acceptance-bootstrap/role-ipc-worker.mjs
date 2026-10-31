// Disposable registrar/broker process. Authenticated stdio IPC + private DB.
// This is NOT a GitHub job registration, broker JWT endpoint, or authority.
import {readFile,lstat} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {authenticatedFrames} from '../../lib/publication/runtime/acceptance-ipc.mjs';
const ROLES=['registrar','broker'];
const role=process.argv[2];
const need=(v)=>{if(!v)throw Error('ROLE_IPC_DENIED');};
export function expectedGrants(role){
 need(ROLES.includes(role));
 return role==='registrar'?{jobs:true,tokens:false,inventories:true}:
  {jobs:false,tokens:true,inventories:false};
}
export async function readOnlyIdentity({query,role}){
 need(typeof query==='function'&&ROLES.includes(role));
 const result=await query("select current_user as identity, "+
  "has_table_privilege(current_user,'nyra_trust.jobs','INSERT') as jobs, "+
  "has_table_privilege(current_user,'nyra_trust.used_tokens','INSERT') as tokens, "+
  "has_table_privilege(current_user,'nyra_trust.inventories','INSERT') as inventories");
 need(result.rows?.length===1&&result.rows[0].identity==='nyra_accept_'+role);
 const {jobs,tokens,inventories}=result.rows[0];
 const expected=expectedGrants(role);
 need(jobs===expected.jobs&&tokens===expected.tokens&&inventories===expected.inventories);
 return {role,dbAuthenticated:true,roleGrantsVerified:true,
  roleCanWriteJobs:jobs,roleCanWriteTokens:tokens,roleCanWriteInventories:inventories,recordsWritten:0};
}
export function createReadOnlyIPCOperation({role,query}){
 need(ROLES.includes(role)&&typeof query==='function');
 return async body=>{
  if(body?.op!=='identity'||Object.keys(body).length!==1)
   return {ok:false,code:'OPERATION_DENIED'};
  try{return {ok:true,result:await readOnlyIdentity({role,query})};}
  catch{return {ok:false,code:'ROLE_IDENTITY_DENIED'};}
 };
}
async function main(){
 need(process.env.NYRA_5C_ROLE_IPC_PROOF==='1'&&ROLES.includes(role));
 need(process.getuid?.()!==0);
 const keyStat=await lstat('/run/role/ipc.key');
 const cfgStat=await lstat('/run/role/pg.json');
 need([keyStat,cfgStat].every(s=>s.isFile()&&!s.isSymbolicLink()&&
   s.uid===process.getuid()&&(s.mode&0o077)===0));
 const [key,cfgText]=await Promise.all([
  readFile('/run/role/ipc.key'),readFile('/run/role/pg.json','utf8')
 ]);
 need(key.length===32);
 const cfg=JSON.parse(cfgText);
 need(cfg.host==='db'&&cfg.database==='postgres'&&cfg.port===5432&&
   cfg.user==='nyra_accept_'+role&&typeof cfg.password==='string');
 const {default:pg}=await import('/app/node_modules/pg/lib/index.js');
 const db=new pg.Client({...cfg,ssl:false,connectionTimeoutMillis:5000,
  statement_timeout:5000,query_timeout:6000});
 const inbound=authenticatedFrames({key,role,direction:'request'});
 const outbound=authenticatedFrames({key,role,direction:'response'});
 try{
  await db.connect();
  const operation=createReadOnlyIPCOperation({role,query:db.query.bind(db)});
  // At most one command per short-lived process; no permanent listener.
  const lines=createInterface({input:process.stdin,crlfDelay:Infinity});
  let received=false;
  for await(const line of lines){
   need(!received&&Buffer.byteLength(line)<=4096);received=true;
   let result;
   try{result=await operation(inbound.decode(JSON.parse(line)));}
   catch{result={ok:false,code:'IPC_AUTH_DENIED'};process.exitCode=1;}
   process.stdout.write(JSON.stringify(outbound.encode(result))+'\n');
   break;
  }
  need(received);
 }finally{await db.end().catch(()=>{});}
}
if(process.argv[1]===new URL(import.meta.url).pathname){
 main().catch(()=>{console.error('NYRA_ROLE_IPC_DISABLED');process.exitCode=1;});
}

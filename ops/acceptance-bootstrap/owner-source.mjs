// PRIVATE UNIX socket only. This process is NOT started by import/CI/workflows.
// All keys/config are owner-provisioned AFTER explicit infrastructure approval.
import {createServer} from 'node:http';
import {open,readFile,lstat,chmod} from 'node:fs/promises';
import {constants} from 'node:fs';
import {dirname,resolve} from 'node:path';
import {existingOwnerMFA,createOwnerRiskSource,signedDecisionJournal} from '../../lib/publication/runtime/owner-risk-source.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
import {evidenceSigner} from '../../lib/publication/runtime/acceptance-evidence.mjs';
export async function privateFile(path){const stat=await lstat(path);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||(stat.mode&0o077)||stat.uid!==process.getuid())throw Error('PRIVATE_FILE');return JSON.parse(await readFile(path,'utf8'));}
export async function startOwnerSource(config){
 if(process.env.NYRA_ACCEPTANCE_OWNER_SOURCE!=='1')throw Error('OWNER_SOURCE_DISABLED');
 const end=Date.parse(config.policy.windowEndsAt)-Date.now();if(!(end>0&&end<=86400000))throw Error('OWNER_SOURCE_WINDOW');
 const dir=await lstat(dirname(config.socket));if(!dir.isDirectory()||(dir.mode&0o077)||dir.uid!==process.getuid()||dirname(config.socket)!==dirname(config.journal))throw Error('PRIVATE_DIRECTORY');
 const signing=await privateFile(config.signingKey),privateKey=await crypto.subtle.importKey('jwk',signing.privateKey,'Ed25519',false,['sign']),publicKey=await crypto.subtle.importKey('jwk',signing.publicKey,'Ed25519',false,['verify']);
 if(signing.keyId!==config.keyId||hashJSON(signing.publicKey)!==config.publicKeySHA256)throw Error('OWNER_KEY_PIN');
 const sign=evidenceSigner({privateKey,publicKeyId:signing.keyId});
 // Refuse an existing socket. Never unlink an arbitrary operator path.
 const records={async read(){try{const s=await lstat(config.journal);if(!s.isFile()||s.nlink!==1||(s.mode&0o077)||s.uid!==process.getuid()||s.size>2000000)throw Error('PRIVATE_JOURNAL');return (await readFile(config.journal,'utf8')).trim().split('\n').filter(Boolean).map(JSON.parse);}catch(e){if(e.code==='ENOENT')return [];throw e;}},async append(row){const f=await open(config.journal,constants.O_WRONLY|constants.O_CREAT|constants.O_APPEND|constants.O_NOFOLLOW,0o600);try{await f.writeFile(JSON.stringify(row)+'\n');await f.sync();}finally{await f.close();}}};
 const source=createOwnerRiskSource({policy:config.policy,authenticateOwner:existingOwnerMFA(config.auth),journal:signedDecisionJournal({records,signRecord:sign,publicKey,keyId:signing.keyId}),signReceipt:sign});
 const server=createServer(async(req,res)=>{res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');try{
  if(req.method!=='POST'||!['/authorize','/retire','/receipt'].includes(req.url))throw Error('OPERATION');let body='';for await(const b of req){if(Buffer.byteLength(body)+b.length>30000)throw Error('BODY');body+=b.toString();}const input=JSON.parse(body);
  if(Object.hasOwn(input,'token'))throw Error('TOKEN_BODY_FORBIDDEN');
  const result=await source[req.url==='/authorize'?'authorize':req.url==='/retire'?'retire':'receipt']({...input,...(req.url!=='/receipt'?{token:req.headers.authorization?.replace(/^Bearer /,'')}: {})});
  res.writeHead(200);res.end(JSON.stringify(result));
 }catch{res.writeHead(403);res.end('{"error":"OWNER_SOURCE_DENIED"}');}});
 server.requestTimeout=15000;server.headersTimeout=10000;
 await new Promise((ok,no)=>{server.once('error',no);server.listen(config.socket,ok);});await chmod(config.socket,0o600);
 const stop=()=>{clearTimeout(timer);source.close();server.close();server.closeAllConnections();};const timer=setTimeout(stop,end);timer.unref();process.once('SIGTERM',stop);process.once('SIGINT',stop);
 return {server,stop};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{await startOwnerSource(await privateFile(resolve(process.argv[2])));console.log('NYRA_PRIVATE_OWNER_SOURCE_READY');}catch{console.error('NYRA_PRIVATE_OWNER_SOURCE_DENIED');process.exitCode=1;}}

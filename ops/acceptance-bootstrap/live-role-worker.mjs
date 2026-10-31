// Digest-pinned non-root private role process; only own LOGIN/IPC file mounted.
import {readFileSync,lstatSync} from 'node:fs';
import {privatePort} from './private-port.mjs';
import {liveRoleService} from './live-role-service.mjs';
import {evidenceSigner} from '../../lib/publication/runtime/acceptance-evidence.mjs';
let liveDB;
async function run(){
 if(process.env.NYRA_5C_LIVE_ROLE!=='1'||!process.getuid())throw Error('DISABLED');
 const read=p=>{const s=lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||s.uid!==process.getuid()||(s.mode&0o077))throw Error('PRIVATE_ROLE_FILE');return JSON.parse(readFileSync(p,'utf8'));};
 const c=read('/run/role/runtime.json');if(c.db.host!=='db'||c.db.port!==5432||c.db.database!=='postgres'||c.db.user!=='nyra_accept_'+c.role)throw Error('ROLE_LOGIN');
 const {default:pg}=await import('/app/node_modules/pg/lib/index.js'),db=liveDB=new pg.Client({...c.db,connectionTimeoutMillis:5000,statement_timeout:15000});await db.connect();
 const key=read('/run/role/ipc.json');let operation,ready;const initialized=new Promise(resolve=>ready=resolve);
 const port=privatePort({role:c.role,key:Buffer.from(key.hex,'hex'),side:'worker',timeout:180000,input:process.stdin,output:process.stdout,onCall:async(op,a)=>{await initialized;return operation(op,a);}});
 let signEvidence,evidencePublicKey;
 if(c.role==='broker'){const k=read('/run/role/evidence-key.json');if(k.keyId!==c.evidenceKeyId)throw Error('KEY_ID');const secret=await crypto.subtle.importKey('jwk',k.privateKey,'Ed25519',false,['sign']);signEvidence=evidenceSigner({privateKey:secret,publicKeyId:k.keyId});}
 evidencePublicKey=await crypto.subtle.importKey('jwk',c.evidencePublicKey,'Ed25519',false,['verify']);
 operation=liveRoleService({...c,query:db.query.bind(db),getJSON:url=>port.query('github',{url}),readPolicyState:privilege=>read('/run/role/policy/state.json')[privilege],assertAdministration:async p=>{if(await port.query('administration',{privilege:p.role})!==true)throw Error('ADMIN_GATE');},keySource:()=>port.query('jwks',{}),signEvidence,evidencePublicKey,privateQuery:port.query});
 process.stdin.on('end',()=>{port.close();db.end().catch(()=>{});});
 await operation('identity',{});ready();
}
if(process.argv[1]===new URL(import.meta.url).pathname)run().catch(async()=>{console.error('NYRA_LIVE_ROLE_DENIED');await liveDB?.end().catch(()=>{});process.exit(1);});

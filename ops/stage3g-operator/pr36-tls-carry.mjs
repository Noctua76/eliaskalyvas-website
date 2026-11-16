// Read-only PR36 binding. The original PR35 verifier and receipt stay byte-identical.
import {readFile,lstat} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {verifyOriginalTLS} from './tls-carry-forward.mjs';
const HERE=dirname(fileURLToPath(import.meta.url)),ROOT='/opt/nyra-5c/bootstrap',STAGE='/opt/nyra-5c/live-runtime';
const CARRY='__CARRY_SHA256__',sha=b=>createHash('sha256').update(b).digest('hex');
const need=(v,c)=>{if(!v)throw Error(c);};
async function bytes(p){const s=await lstat(p);need(s.isFile()&&!s.isSymbolicLink()&&s.nlink===1&&s.uid===0&&(s.mode&0o022)===0,'PR36_TLS_FILE');return readFile(p);}
const git=args=>execFileSync('git',['-C',ROOT,...args],{encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:20000}).trim();
export async function verifyHistoricalTLSCarryForward(input){
 const b=await bytes(HERE+'/PR36-TLS-CARRY.json');need(sha(b)===CARRY,'PR36_TLS_SCOPE_PIN');const s=JSON.parse(b);
 need(s.schema==='nyra.stage3g.pr36.tls-carry-forward.v1'&&s.resourceId==='617219249'&&s.targetSHA256===input.targetSHA256&&s.sourceSHA===input.sourceSHA&&Date.now()<Date.parse(s.hostExpiresAt),'PR36_TLS_BINDING');
 need(git(['rev-parse','HEAD'])===s.sourceSHA&&git(['rev-parse','HEAD^{tree}'])===s.treeSHA&&git(['show','-s','--format=%P','HEAD'])===s.parents.join(' ')&&git(['status','--porcelain','--untracked-files=all'])==='','PR36_TLS_SOURCE');
 need(git(['diff','--name-only',s.historicalSourceSHA,s.sourceSHA]).split('\n').sort().join('\n')===[...s.allowedChangedPaths].sort().join('\n'),'PR36_TLS_CHANGED_PATHS');
 for(const [n,h]of Object.entries(s.nativeSHA256))need(sha(await bytes(ROOT+'/'+n))===h&&sha(await bytes(STAGE+'/'+n))===h,'PR36_TLS_RUNTIME_PIN');
 const original=await verifyOriginalTLS({resourceId:s.resourceId,targetSHA256:s.targetSHA256});
 need(original.status==='PASS'&&original.historicalSourceSHA===s.historicalSourceSHA,'PR36_TLS_ORIGINAL_RECEIPT');
 return {...original,sourceSHA:s.sourceSHA,carryForwardSHA256:CARRY,historicalReceiptUnmodified:true,noDNSQueries:true,noHTTPSInvocation:true,servicesActivated:false};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 try{need(process.argv.length===4&&process.argv[2]==='--verify'&&process.argv[3]===CARRY,'PR36_TLS_APPROVAL');const s=JSON.parse(await bytes(HERE+'/PR36-TLS-CARRY.json'));console.log(JSON.stringify(await verifyHistoricalTLSCarryForward({sourceSHA:s.sourceSHA,targetSHA256:s.targetSHA256,resourceId:s.resourceId})));}
 catch{console.log(JSON.stringify({marker:'NYRA_PR36_TLS_CARRY_STOP',code:'TLS_CARRY_NOT_VERIFIED',servicesActivated:false}));process.exitCode=1;}
}

// Future-host Docker retirement executor. Not installed or authorized.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {readFileSync,lstatSync} from 'node:fs';
import {hostname as systemHostname} from 'node:os';
const CONFIG='/etc/nyra-continuation/retirement.json',MACHINE_ID='/etc/machine-id';
const SHA=/^[a-f0-9]{64}$/,ID=/^[A-Za-z0-9][A-Za-z0-9_.-]*$/,UTC=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,DAY=86400000;
const need=(v,c)=>{if(!v)throw Error('NYRA_RETIRE_'+c);};
const hash=s=>createHash('sha256').update(s).digest('hex');
const keys=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join('|')===k.slice().sort().join('|');
const stamp=s=>typeof s==='string'&&UTC.test(s)&&Number.isFinite(Date.parse(s))&&new Date(Date.parse(s)).toISOString()===s;
const specs=[{kind:'container',list:['ps','-aq','--no-trunc'],remove:['rm','-f']},{kind:'network',list:['network','ls','-q','--no-trunc'],remove:['network','rm']},{kind:'volume',list:['volume','ls','-q'],remove:['volume','rm']}];
export function validateRetirementManifest(m,{hostname,machineId,now=Date.now}={}){
 need(keys(m,['schema','bootstrapId','hostname','machineIdSHA256','createdAt','expiresAt','planSHA256','authorization','providerResourceId']),'MANIFEST_KEYS');
 need(m.schema==='nyra.acceptance.continuation.retirement.v1'&&m.authorization===false,'MANIFEST_SCHEMA');
 need(typeof m.bootstrapId==='string'&&/^nyra-acceptance-[a-z0-9-]{6,80}$/.test(m.bootstrapId)&&m.bootstrapId!=='nyra-acceptance-20261102-01','BOOTSTRAP');
 need(m.hostname===m.bootstrapId&&m.hostname===hostname&&m.hostname!=='nyra-acceptance-20261102-01','HOST_IDENTITY');
 need(typeof machineId==='string'&&/^[0-9a-f]{32}$/.test(machineId)&&SHA.test(m.machineIdSHA256)&&hash(machineId)===m.machineIdSHA256,'MACHINE_IDENTITY');
 need(SHA.test(m.planSHA256)&&typeof m.providerResourceId==='string'&&/^[1-9][0-9]{0,19}$/.test(m.providerResourceId)&&m.providerResourceId!=='615221104','RESOURCE_SCOPE');
 need(stamp(m.createdAt)&&stamp(m.expiresAt)&&Date.parse(m.expiresAt)-Date.parse(m.createdAt)===14*DAY,'HOST_LIFETIME');
 need(typeof now()==='number'&&Number.isFinite(now())&&now()>=Date.parse(m.expiresAt),'NOT_EXPIRED');
 return Object.freeze({label:'com.noctua.nyra.acceptance='+m.planSHA256,planSHA256:m.planSHA256,expiresAt:m.expiresAt,providerResourceId:m.providerResourceId});
}
const readIds=(run,args)=>{const s=run(args);need(typeof s==='string','DOCKER_OUTPUT');const ids=s.trim().split(/\s+/).filter(Boolean);need(ids.every(x=>ID.test(x))&&new Set(ids).size===ids.length,'DOCKER_IDS');return ids;};
export function retireDocker(m,{hostname,machineId,now=Date.now,run=(args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']})}={}){
 const scope=validateRetirementManifest(m,{hostname,machineId,now});
 const resources=[];
 for(const k of specs)for(const id of readIds(run,[...k.list,'--filter','label='+scope.label])){
  const parsed=JSON.parse(run([k.kind,'inspect',id]));
  need(Array.isArray(parsed)&&parsed.length===1,'INSPECT_COUNT');
  const labels=k.kind==='container'?parsed[0]?.Config?.Labels:parsed[0]?.Labels;
  need(labels?.['com.noctua.nyra.acceptance']===scope.planSHA256,'INSPECT_SCOPE');
  resources.push({kind:k.kind,id,remove:k.remove,list:k.list});
 }
 const removed=[];
 for(const r of resources){run([...r.remove,r.id]);need(!readIds(run,r.list).includes(r.id),'RESOURCE_REMAINS');removed.push({kind:r.kind,id:r.id});}
 for(const k of specs)need(readIds(run,[...k.list,'--filter','label='+scope.label]).length===0,'SCOPED_REMAINS');
 return Object.freeze({status:'LOCAL_DOCKER_SCOPE_CLEARED',planSHA256:scope.planSHA256,removed,providerResourceId:scope.providerResourceId,providerDestroyed:false,credentialsRevoked:false,privateFilesRetired:false,dbRolesRetired:false,retirementComplete:false,manualRequired:['Retire private artifacts and DB roles','Revoke GitHub credential at issuer','Close owner/session','Destroy exact provider Droplet and verify billing','Review DNS/proxy mapping']});
}
function readRootConfig(path){const st=lstatSync(path);need(st.isFile()&&!st.isSymbolicLink()&&st.uid===0&&(st.mode&0o077)===0,'CONFIG_PERMISSIONS');const contents=readFileSync(path,'utf8');need(Buffer.byteLength(contents,'utf8')<=16384,'CONFIG_SIZE');return JSON.parse(contents);}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{need(process.argv.length===2,'NO_ARGS');need(process.getuid?.()===0,'ROOT_REQUIRED');
  const manifest=readRootConfig(CONFIG),machineId=readFileSync(MACHINE_ID,'utf8').trim();
  process.stdout.write(JSON.stringify(retireDocker(manifest,{hostname:systemHostname(),machineId}))+'\n');
 }catch(e){process.stderr.write('NYRA_RETIRE_FAILED: '+String(e?.message||'unknown')+'\n');process.exitCode=1;}
}

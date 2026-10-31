// Run ONLY on the approved temporary host. Dry-run by default. Destruction is
// restricted to an exact plan digest label; unrelated Docker resources untouched.
import {execFileSync} from 'node:child_process';
import {readFile} from 'node:fs/promises';
import {bootstrapPlan} from './plan.mjs';
export function cleanupPlan(config,{execute=(args)=>execFileSync('docker',args,{encoding:'utf8',stdio:['ignore','pipe','pipe']}),apply=false}={}){
 const plan=bootstrapPlan(config),label='com.noctua.nyra.acceptance='+plan.planSHA256,removed=[];
 const resources=[
  ['container',['ps','-aq','--no-trunc'],['rm','-f']],
  ['network',['network','ls','-q','--no-trunc'],['network','rm']],
  ['volume',['volume','ls','-q'],['volume','rm']]
 ];
 const listIds=args=>{
  const ids=execute(args).trim().split(/\s+/).filter(Boolean);
  if(ids.some(id=>!(/^[A-Za-z0-9][A-Za-z0-9_.-]*$/).test(id)))throw Error('CLEANUP_RESOURCE');
  return ids;
 };
 for(const [kind,list,remove] of resources){
  const ids=listIds([...list,'--filter','label='+label]);
  for(const id of ids){
   const rows=JSON.parse(execute([kind,'inspect',id]));
   const labels=kind==='container'?rows[0]?.Config?.Labels:rows[0]?.Labels;
   if(labels?.['com.noctua.nyra.acceptance']!==plan.planSHA256)throw Error('CLEANUP_SCOPE');
   if(apply){
    execute([...remove,id]);
    // Re-read full IDs/names independently of the plan label: a resource
    // remaining with a changed label must not be mistaken for absence.
    // Docker listing/inspection/removal errors propagate; none means absent.
    if(listIds(list).includes(id))throw Error('CLEANUP_REMAINS');
   }
   removed.push({kind,id,removed:apply});
  }
 }

 return {planSHA256:plan.planSHA256,apply,resources:removed,manualRequired:['Revoke GitHub read credential at issuer','Retire owner decision and close owner session','Remove private key/IPC/login files after retaining sanitized signed evidence','Remove approved DNS/proxy mapping and transient timer']};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{console.log(JSON.stringify(cleanupPlan(JSON.parse(await readFile(process.argv[2],'utf8')),{apply:process.argv[3]==='--apply'}),null,2));}catch{console.error('SCOPED_CLEANUP_FAILED');process.exitCode=1;}}

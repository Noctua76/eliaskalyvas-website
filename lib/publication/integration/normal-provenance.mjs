// Independent normal-build registrar tooling; never accepts submitted paths.
import {execFileSync} from 'node:child_process';
import {existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {hashJSON} from '../contract.mjs';
import {sha256} from './archive.mjs';
import {createNormalBuildSnapshot} from './build.mjs';
import {createPublicPathScopeAuthority,WITNESS_PATH} from './observer.mjs';
import {requireDelivery as need} from '../runtime/materialize.mjs';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8'}).trim();
function checkout(codeSHA){
 need(/^[a-f0-9]{40}$/.test(codeSHA)&&git('rev-parse','HEAD')===codeSHA,'INVENTORY_CHECKOUT');
 need(git('status','--porcelain','--untracked-files=all')==='','INVENTORY_DIRTY');
 for(const f of ['.env','.env.local','.env.production','.env.production.local'])need(!existsSync(root+f),'INVENTORY_DOTENV');
}
export async function buildNormalProvenance({codeSHA,builder,verifier,token}){
 need(builder?.privilege==='build'&&builder.codeSHA===codeSHA&&['runId','runAttempt','checkRunId','workflowSHA','jobWorkflowSHA'].every(k=>typeof builder[k]==='string'),'INVENTORY_BUILDER');
 let identity;
 if(verifier){identity=await verifier.verify(token);verifier.assert(identity);need(identity.privilege==='build'&&['codeSHA','runId','runAttempt','checkRunId'].every(k=>identity[k]===builder[k]),'INVENTORY_IDENTITY');}
 checkout(codeSHA);const {inventory,files}=await createNormalBuildSnapshot({codeSHA});checkout(codeSHA);
 need(!files.has(WITNESS_PATH),'INVENTORY_WITNESS');
 if(verifier)verifier.assert(identity);
 const record={schema_version:'nyra.normal.provenance.v1',inventory,builder:{...structuredClone(builder),assurance:identity?'protected_oidc':'unprotected_ci'},files:[...files].map(([path,b])=>({path,sha256:sha256(b),bytes:b.length})).sort((a,b)=>a.path.localeCompare(b.path,'en'))};
 return {record,digest:hashJSON(record)};
}
// Approved digest is selected by a separate registrar, not a workflow argument.
export function immutableNormalInventoryAuthority({configurationSHA256,loadApprovedRecord}){
 return createPublicPathScopeAuthority({configurationSHA256,loadApprovedInventory:async codeSHA=>{
  const row=await loadApprovedRecord(codeSHA,configurationSHA256),r=row?.record;
  need(r?.schema_version==='nyra.normal.provenance.v1'&&hashJSON(r)===row.digest&&r.inventory.codeSHA===codeSHA&&r.inventory.configurationSHA256===configurationSHA256,'INVENTORY_PROVENANCE');
  need(r.builder.privilege==='build'&&r.builder.assurance==='protected_oidc'&&r.builder.codeSHA===codeSHA&&/^[a-f0-9]{40}$/.test(r.builder.workflowSHA)&&/^[a-f0-9]{40}$/.test(r.builder.jobWorkflowSHA),'INVENTORY_BUILDER');
  need(Array.isArray(r.files)&&r.files.length===r.inventory.paths.length&&new Set(r.files.map(f=>f.path)).size===r.files.length&&r.files.every(f=>r.inventory.paths.includes(f.path)&&/^[a-f0-9]{64}$/.test(f.sha256)&&Number.isSafeInteger(f.bytes)&&f.bytes>=0),'INVENTORY_BYTES');
  return r.inventory;
 }});
}
export function postgresApprovedInventoryLoader({query}){return async(code,config)=>(await query('select record,digest from nyra_trust.inventories where code_sha=$1 and configuration_sha256=$2',[code,config])).rows[0];}

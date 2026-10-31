// Read-only executable bootstrap planner. It cannot provision, generate keys,
// dispatch GitHub jobs, approve risk or access production. No secrets in output.
import {readFile} from 'node:fs/promises';
import {hashJSON} from '../../lib/publication/contract.mjs';
export function bootstrapPlan(c){
 const need=(v)=>{if(!v)throw Error('BOOTSTRAP_UNAPPROVED_OR_INCOMPLETE');};
 need(c?.schema==='nyra.acceptance.bootstrap.v1'&&c.repository==='Noctua76/eliaskalyvas-website'&&c.repositoryId==='1389733212'&&c.ownerId==='217035723'&&c.governanceMode==='SINGLE_OWNER');
 need(typeof c.host==='string'&&/^[a-zA-Z0-9][a-zA-Z0-9.-]+$/.test(c.host)&&/^[a-f0-9]{40}$/.test(c.callerSHA)&&c.reusableSHA==='cefd1a402dcffd0b00f05f7d7539ba381120641e');
 const u=new URL(c.collectorOrigin);need(u.protocol==='https:'&&u.origin===c.collectorOrigin&&!['eliaskalyvas.gr','www.eliaskalyvas.gr'].includes(u.hostname)&&!u.hostname.endsWith('.supabase.co')&&!u.username);
 need(typeof c.evidenceKeyId==='string'&&c.evidenceKeyId.length>0&&/^[a-f0-9]{64}$/.test(c.evidencePublicKeySHA256)&&/^[a-f0-9]{64}$/.test(c.ownerDecisionPublicKeySHA256));
 const start=Date.parse(c.windowStartsAt),end=Date.parse(c.windowEndsAt);need(Number.isFinite(start)&&Number.isFinite(end)&&end>start&&end-start<=86400000);
 return {planSHA256:hashJSON(c),host:c.host,collectorOrigin:c.collectorOrigin,window:{start:c.windowStartsAt,end:c.windowEndsAt},resources:{linuxHosts:1,minimum:{cpu:4,memoryGiB:8,diskGiB:20},disposablePostgres:1,registrar:1,broker:1,privateOwnerSource:1,builderNetwork:'none',permanentServices:0},publicIngress:['GET /ready/{fixed-role}/{run}/{attempt}','POST /acceptance/{fixed-role}'],privateOnly:['owner source UNIX socket','GitHub admin reader','App audit','PostgreSQL','signed evidence','registrar/broker authenticated IPC'],credentialScopes:{github:['Administration:read','Actions:read','Checks:read','Contents:read','Pull requests:read','Environments:read','Metadata:read'],roles:['nyra_trust_registrar','nyra_trust_broker'],workflowCredentials:[],productionServiceKeys:[]},pins:{callerSHA:c.callerSHA,reusableSHA:c.reusableSHA,evidenceKeyId:c.evidenceKeyId,evidencePublicKeySHA256:c.evidencePublicKeySHA256,ownerDecisionPublicKeySHA256:c.ownerDecisionPublicKeySHA256},publicProbePlan:{purpose:'isolated-live-trust-acceptance',approved:true,origin:c.collectorOrigin+'/',publicEvidenceKeyId:c.evidenceKeyId},dispatchesPerformed:0,authorization:false};
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{console.log(JSON.stringify(bootstrapPlan(JSON.parse(await readFile(process.argv[2],'utf8'))),null,2));}catch{console.error('BOOTSTRAP_UNAPPROVED_OR_INCOMPLETE');process.exitCode=1;}}

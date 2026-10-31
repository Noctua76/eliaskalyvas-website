// Host-specific non-root coordinator. Private role FDs only; no Docker access,
// GitHub write API, owner approval endpoint, key generation or public TCP port.
import {Socket} from 'node:net';
import {readFile,writeFile,lstat,open} from 'node:fs/promises';
import {privateFile} from './owner-source.mjs';
import {privatePort} from './private-port.mjs';
import {ownerRequest} from './owner-request.mjs';
import {composeTrustAcceptance,verifyPinnedObservation} from './compose-trust.mjs';
import {startUnixIngress} from './live-ingress.mjs';
import {administrationReader,readAdministrationEvidence,administrationGate} from '../../lib/publication/runtime/administration-evidence.mjs';
import {authenticatedApplicationInventory} from '../../lib/publication/runtime/application-inventory.mjs';
import {githubKeySource} from '../../lib/publication/runtime/oidc.mjs';
import {validateGovernance} from '../../lib/publication/runtime/governance.mjs';
import {IMMUTABLE_REPOSITORY_PREFIX} from '../../lib/publication/runtime/delivery-policy.mjs';
import {ENVIRONMENT_IDS} from '../../lib/publication/runtime/administration-evidence.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
import {verifyEvidence} from '../../lib/publication/runtime/acceptance-evidence.mjs';
const roles=['build','inspection','publication'];
const need=(v,c)=>{if(!v)throw Error('FRA1_'+c);};
const fd=(n,readable)=>new Socket({fd:n,readable,writable:!readable});
export function assertAcceptanceCompletion({mode,observedRoles,inventory=false,consumed=false}){
 need(['discovery','provenance'].includes(mode)&&roles.every(r=>observedRoles.includes(r))&&(mode==='discovery'||inventory&&consumed),'ACCEPTANCE_INCOMPLETE');return true;
}
export function validateFRA1Policies(c){
 need(['discovery','provenance'].includes(c.mode)&&/^[a-f0-9]{40}$/.test(c.callerSHA),'MODE_PIN');
 for(const role of roles){const p=c.policies?.[role];validateGovernance(p?.governance,'217035723');
  need(p.role===role&&p.governance.mode==='SINGLE_OWNER'&&p.repository==='Noctua76/eliaskalyvas-website'&&p.repositoryId==='1389733212'&&p.ownerId==='217035723'&&p.issuer==='https://token.actions.githubusercontent.com'&&p.ref==='refs/heads/main'&&p.callerSHA===c.callerSHA&&p.environment==='nyra-'+role&&p.environmentId===ENVIRONMENT_IDS[p.environment],'IDENTITY_PIN');
  need(p.workflowRef==='Noctua76/eliaskalyvas-website/.github/workflows/nyra-live-trust-acceptance.yml@refs/heads/main'&&p.jobWorkflowSHA==='cefd1a402dcffd0b00f05f7d7539ba381120641e'&&p.jobWorkflowRef==='Noctua76/eliaskalyvas-website/.github/workflows/nyra-live-trust-probe.yml@'+p.jobWorkflowSHA&&p.audience==='urn:nyra:acceptance:'+role&&JSON.stringify(p.events)==='["workflow_dispatch"]'&&typeof p.jobName==='string'&&p.jobName.length>0,'WORKFLOW_PIN');
  need(c.mode==='discovery'?p.purpose==='identity-observation-only'&&p.subject==='urn:nyra:unapproved-subject-discovery'&&p.codeSHA===c.callerSHA:p.purpose==='registered-provenance-acceptance'&&p.subject?.startsWith(IMMUTABLE_REPOSITORY_PREFIX+':')&&!/[\s*]/.test(p.subject),'SUBJECT_PIN');
 }
 return true;
}
export async function createFRA1Runtime({config:c,ports,buildPort,getJSON,readSignedAudit,readOwnerDecision,persist,now=Date.now}){
 validateFRA1Policies(c);
 need(c.evidenceKeyId==='nyra-5c-fra1-evidence-v1','EVIDENCE_KEY_ID');
 need(c.origin==='https://nyra-5c.eliaskalyvas.gr'&&['discovery','provenance'].includes(c.mode)&&roles.every(r=>c.policies[r]?.callerSHA===c.callerSHA&&c.policies[r]?.role===r),'CONFIG');
 need(Object.values(ports).length===2&&typeof ports.registrar.call==='function'&&typeof ports.broker.call==='function','ROLE_PORTS');
 const readApplications=authenticatedApplicationInventory({readSignedAudit,publicKey:c.auditPublicKey,keyId:c.auditKeyId,now});
 const readEvidence=()=>readAdministrationEvidence({getJSON,governance:c.policies.build.governance,readApplicationInventory:readApplications,now});
 const gate=administrationGate({readEvidence,acceptedApplicationsSHA256:c.acceptedApplicationsSHA256,ownerRiskDecisionId:c.ownerDecisionId,readOwnerRiskDecision:readOwnerDecision,ownerDecisionPublicKey:c.ownerPublicKey,ownerDecisionKeyId:c.ownerKeyId,now});
 const assertAdministration=async p=>{await gate(p);need(now()<Date.parse(c.windowEndsAt),'EXPIRED');return true;};
 const registrars=Object.fromEntries(roles.map(privilege=>[privilege,{register:selector=>ports.registrar.call('register',{privilege,selector}),revoke:selector=>ports.registrar.call('revoke',{privilege,selector})}]));
 let approvedInventory=null,consumed=false;const observedRoles=new Set();
 const brokerAcceptors=Object.fromEntries(roles.map(privilege=>[privilege,async token=>{
  const r=await ports.broker.call('accept',{privilege,token});
  const observed=await verifyPinnedObservation(r.signed,{publicKey:c.evidencePublicKey,keyId:c.evidenceKeyId,policy:c.policies[privilege],now});
  need(await composition.watcher.isReady({role:privilege,runId:observed.runId,runAttempt:observed.runAttempt,checkRunId:observed.checkRunId}),'JOB_NOT_READY');
  if(c.mode==='provenance'){
   if(privilege==='build'){need(r.grant?.privilege==='build','BUILD_GRANT');approvedInventory=await ports.registrar.call('capture',{handle:r.handle,grant:r.grant});await persist({kind:'inventory',record:approvedInventory});}
   if(privilege==='publication'){need(approvedInventory?.configurationSHA256,'BUILD_REQUIRED');const evidence=await ports.broker.call('consume',{handle:r.handle,configurationSHA256:approvedInventory.configurationSHA256});const record=await verifyEvidence(evidence,{publicKey:c.evidencePublicKey,keyId:c.evidenceKeyId});need(record.schema==='nyra.provenance.acceptance.v1'&&record.codeSHA===c.callerSHA&&record.publicationPerformed===false&&record.inventoryDigest===approvedInventory.digest,'PROVENANCE_EVIDENCE');await persist({kind:'provenance',envelope:evidence});consumed=true;}
  }
  return r.signed;
 }]));
 const composition=composeTrustAcceptance({getJSON,registrars,policies:c.policies,assertAdministration,assertOwnerDecision:assertAdministration,brokerAcceptors,persistSignedEvidence:async row=>{await persist({kind:'observation',...row});observedRoles.add(row.role);return true;},evidencePublicKey:c.evidencePublicKey,evidenceKeyId:c.evidenceKeyId,callerSHA:c.callerSHA,windowStartsAt:c.windowStartsAt,windowEndsAt:c.windowEndsAt,enabled:true,now});
 return {composition,assertAdministration,assertComplete:()=>assertAcceptanceCompletion({mode:c.mode,observedRoles:[...observedRoles],inventory:!!approvedInventory,consumed}),async query(op,a){
  if(op==='github')return getJSON(a.url);
  if(op==='administration'){need(roles.includes(a.privilege),'POLICY');return assertAdministration(c.policies[a.privilege]);}
  if(op==='revalidate')return ports.broker.call('revalidate',a);
  if(op==='rebuild'){await assertAdministration(c.policies.build);return buildPort.call('build',a);}
  throw Error('PRIVATE_QUERY_SCOPE');
 }};
}
async function main(){
 need(process.env.NYRA_5C_FRA1_RUNTIME==='1'&&process.getuid?.()!==0,'DISABLED');
 const c=await privateFile('/var/lib/nyra-5c/coordinator/live.json');
 const pub=async file=>{const p=await privateFile(file),key=await crypto.subtle.importKey('jwk',p.publicKey,'Ed25519',false,['verify']);return {key,jwk:p.publicKey,keyId:p.keyId};};
 for(const [name,path]of [['audit',c.auditKeyFile],['owner',c.ownerKeyFile],['evidence',c.evidenceKeyFile]]){const p=await pub(path);need(hashJSON(p.jwk)===c[name+'PublicKeySHA256']&&p.keyId===c[name+'KeyId'],'KEY_PIN');c[name+'PublicKey']=p.key;}
 if(c.mode==='provenance')for(const role of roles){const e=await privateFile(c.reviewedDiscoveryReceipts?.[role]);need(e.digest===c.reviewedDiscoveryDigests?.[role],'DISCOVERY_REVIEW_PIN');const r=await verifyEvidence(e,{publicKey:c.evidencePublicKey,keyId:c.evidenceKeyId});validateFRA1Policies({...c,mode:'discovery',policies:c.reviewedDiscoveryPolicies});const p=c.reviewedDiscoveryPolicies[role];await verifyPinnedObservation(e,{publicKey:c.evidencePublicKey,keyId:c.evidenceKeyId,policy:p,now:()=>Date.parse(r.observedAt)});need(r.claims.sub===c.policies[role].subject,'EXACT_OBSERVED_SUBJECT');}
 const dir=await lstat(c.evidenceDirectory);need(dir.isDirectory()&&!dir.isSymbolicLink()&&dir.uid===process.getuid()&&(dir.mode&0o077)===0,'EVIDENCE_DIRECTORY');
 const token=await privateFile(c.githubReadCredential);need(typeof token.token==='string'&&token.token.length>0,'READ_IDENTITY');
 const getJSON=administrationReader({tokenSource:async()=>token.token}),jwks=githubKeySource();let runtime;
 const keys=await privateFile('/var/lib/nyra-5c/coordinator/role-ipc.json');
 const ports=Object.fromEntries([['registrar',4,3],['broker',6,5]].map(([role,input,output])=>[role,privatePort({role,key:Buffer.from(keys[role],'hex'),input:fd(input,true),output:fd(output,false),side:'coordinator',timeout:180000,onQuery:async(op,a)=>{if(op==='jwks')return jwks();return runtime.query(op,a);}})]));
 const buildPort=privatePort({role:'registrar',key:Buffer.from(keys.builder,'hex'),input:fd(7,true),output:fd(8,false),side:'coordinator',timeout:180000});
 const persist=async record=>{const path=c.evidenceDirectory+'/'+Date.now()+'-'+crypto.randomUUID()+'.json',f=await open(path,'wx',0o600);try{await f.writeFile(JSON.stringify(record));await f.sync();}finally{await f.close();}};
 let ingress,stopped=false,stopping,completed=false;
 const stop=()=>{if(stopping)return stopping;stopped=true;stopping=(async()=>{try{try{await runtime?.composition.watcher.retire();}finally{await ports.registrar.call('retire',{});const receipt=await ports.broker.call('retirement',{});const record=await verifyEvidence(receipt,{publicKey:c.evidencePublicKey,keyId:c.evidenceKeyId});need(record.schema==='nyra.acceptance.retirement.v1'&&record.activeRegistrations===0&&record.policiesSHA256===hashJSON(c.policies),'RETIREMENT');await persist({kind:'retirement',envelope:receipt});}}finally{ingress?.close();ingress?.closeAllConnections();Object.values(ports).forEach(p=>p.close());buildPort.close();}})();return stopping;};
 try{
  runtime=await createFRA1Runtime({config:c,ports,buildPort,getJSON,readSignedAudit:()=>privateFile(c.applicationAuditFile),readOwnerDecision:input=>ownerRequest({socket:c.ownerReceiptSocket,operation:'receipt',input}),persist});
  process.once('SIGTERM',()=>stop().catch(()=>{}));process.once('SIGINT',()=>stop().catch(()=>{}));
  for(const role of ['registrar','broker']){const result=await ports[role].call('identity',{});need(result.identity==='nyra_accept_'+role,'DATABASE_ROLE');}
  await runtime.composition.watcher.arm();
  ingress=await startUnixIngress({handler:runtime.composition.ingress,socketPath:'/run/nyra-5c/ingress.sock',groupId:c.ingressGroupId,enable:true});
  console.log('NYRA_FRA1_PRIVATE_WATCHER_ARMED_NO_DISPATCH');
  while(!stopped){need(Date.now()<Date.parse(c.windowEndsAt),'WINDOW');need(!Object.values(ports).some(p=>p.isClosed()),'ROLE_EXIT');const r=await runtime.composition.watcher.scan();if(r.completed){completed=true;break;}await new Promise(r=>setTimeout(r,1000));}
  need(completed,'INTERRUPTED');runtime.assertComplete();
 }finally{await stop();}
}
if(process.argv[1]===new URL(import.meta.url).pathname)main().catch(()=>{console.error('NYRA_FRA1_ACCEPTANCE_CLOSED');process.exitCode=1;});

// New target-bound repository-scoped coordinator. No legacy inventory fallback.
// Importing does not start a listener or obtain credentials.
import {Socket} from 'node:net';
import {readFileSync,lstatSync} from 'node:fs';
import {open,lstat} from 'node:fs/promises';
import {bindRepositoryControlPlane} from '../../runtime/nyra-edge/repository-binding.mjs';
import {reviewedAcceptancePolicies} from '../../lib/publication/integration/live-acceptance.mjs';
import {retirePolicyState} from './retire-policy-state.mjs';
import {privateFile} from './owner-source.mjs';
import {privatePort} from './private-port.mjs';
import {ownerRequest} from './owner-request.mjs';
import {composeTrustAcceptance,verifyPinnedObservation} from './compose-trust.mjs';
import {startUnixIngress} from './live-ingress.mjs';
import {githubKeySource} from '../../lib/publication/runtime/oidc.mjs';
import {verifyEvidence} from '../../lib/publication/runtime/acceptance-evidence.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
import {validateReplacementTarget} from './replacement-target.mjs';
const assertAcceptanceCompletion=({mode,observedRoles,inventory,consumed})=>{if(!['build','inspection','publication'].every(r=>observedRoles.includes(r))||(mode==='provenance'&&(!inventory||!consumed)))throw Error('ACCEPTANCE_INCOMPLETE');return true;};
const roles=['build','inspection','publication'];
const need=(v,c)=>{if(!v)throw Error('REPOSITORY_RUNTIME_'+c);};
const fd=(n,readable)=>new Socket({fd:n,readable,writable:!readable});
export async function createRepositoryRuntime({config:c,ports,buildPort,adminTokenSource,fetcher=fetch,readOwnerDecision,persist,readPolicyState,invalidatePolicyState,now=Date.now}){
 validateReplacementTarget(c.target,{created:true,now});
 need(c.origin===c.target.origin&&c.windowEndsAt===c.target.expiresAt&&c.windowStartsAt===c.target.createdAt&&c.callerSHA===c.configuration.repositoryTrust.sourceSHA,'TARGET_PIN');
 c={...c,policies:reviewedAcceptancePolicies(c.configuration),mode:c.configuration.acceptanceMode};
 need(Object.values(ports).length===2&&typeof ports.registrar.call==='function'&&typeof ports.broker.call==='function'&&typeof persist==='function','ROLE_PORTS');
 const binding=bindRepositoryControlPlane({configuration:c.configuration,adminTokenSource,fetcher,readOwnerRiskDecision:readOwnerDecision,ownerRiskDecisionId:c.ownerDecisionId,ownerDecisionPublicJWK:c.ownerPublicJWK,ownerDecisionKeyId:c.ownerKeyId,retirementPublicJWK:c.evidencePublicJWK,retirementKeyId:c.evidenceKeyId,readPolicyState,invalidatePolicyState,retireRegistrations:async pins=>{
  await ports.registrar.call('retire',{});const envelope=await ports.broker.call('retirement',pins);await persist({kind:'retirement',envelope});return envelope;
 },now});
 const getJSON=binding.getJSON;
 const assertAdministration=async(p,operation='identity')=>{need(now()<Date.parse(c.windowEndsAt),'EXPIRED');return binding.assertAdministration(p,operation);};
 // A provenance phase can use only subjects from the externally reviewed signed
 // discovery artifacts. A caller-supplied subject or valid-looking digest fails.
 if(c.mode==='provenance'){
  need(c.reviewedDiscovery?.approved===true&&/^[a-f0-9]{64}$/.test(c.reviewedDiscovery.reviewSHA256),'SUBJECT_REVIEW');
  const discovery=reviewedAcceptancePolicies(c.reviewedDiscovery.configuration);
  need(c.reviewedDiscovery.configuration.acceptanceMode==='discovery','DISCOVERY_MODE');
  for(const role of roles){const envelope=c.reviewedDiscovery.receipts?.[role];need(hashJSON(envelope)===c.reviewedDiscovery.envelopeSHA256s?.[role],'DISCOVERY_PIN');
   const record=await verifyEvidence(envelope,{publicKey:c.evidencePublicKey,keyId:c.evidenceKeyId});
   await verifyPinnedObservation(envelope,{publicKey:c.evidencePublicKey,keyId:c.evidenceKeyId,policy:discovery[role],now:()=>Date.parse(record.observedAt)});
   need(record.claims.sub===c.policies[role].subject&&record.claims.sha===c.callerSHA,'EXACT_DISCOVERED_SUBJECT');
  }
 }
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
 const composition=composeTrustAcceptance({origin:c.origin,getJSON,registrars,policies:c.policies,assertAdministration,assertOwnerDecision:assertAdministration,brokerAcceptors,persistSignedEvidence:async row=>{await persist({kind:'observation',...row});observedRoles.add(row.role);return true;},evidencePublicKey:c.evidencePublicKey,evidenceKeyId:c.evidenceKeyId,callerSHA:c.callerSHA,windowStartsAt:c.windowStartsAt,windowEndsAt:c.windowEndsAt,enabled:true,now});
 return {binding,composition,assertAdministration,assertComplete:()=>assertAcceptanceCompletion({mode:c.mode,observedRoles:[...observedRoles],inventory:!!approvedInventory,consumed}),async query(op,a){
  if(op==='github')return getJSON(a.url);
  if(op==='administration'){need(roles.includes(a.privilege),'POLICY');return assertAdministration(c.policies[a.privilege],a.operation??'identity');}
  if(op==='revalidate'){await assertAdministration(c.policies.build);return ports.broker.call('revalidate',a);}
  if(op==='rebuild'){await assertAdministration(c.policies.build);return buildPort.call('build',a);}
  throw Error('PRIVATE_QUERY_SCOPE');
 }};
}
async function main(){
 need(process.env.NYRA_REPOSITORY_ACCEPTANCE==='1'&&process.getuid?.()>0&&process.argv[2],'DISABLED');
 const c=await privateFile(process.argv[2]);validateReplacementTarget(c.target,{created:true});
 const pub=async file=>{const p=await privateFile(file);return {...p,key:await crypto.subtle.importKey('jwk',p.publicKey,'Ed25519',false,['verify'])};};
 const owner=await pub(c.ownerKeyFile),evidence=await pub(c.evidenceKeyFile);
 Object.assign(c,{ownerPublicJWK:owner.publicKey,ownerKeyId:owner.keyId,evidencePublicJWK:evidence.publicKey,evidencePublicKey:evidence.key,evidenceKeyId:evidence.keyId});
 const dir=await lstat(c.evidenceDirectory);need(dir.isDirectory()&&!dir.isSymbolicLink()&&dir.uid===process.getuid()&&(dir.mode&0o077)===0,'EVIDENCE_DIRECTORY');
 const keys=await privateFile(c.roleIPCFile),jwks=githubKeySource();let runtime;
 const ports=Object.fromEntries([['registrar',4,3],['broker',6,5]].map(([role,input,output])=>[role,privatePort({role,key:Buffer.from(keys[role],'hex'),input:fd(input,true),output:fd(output,false),side:'coordinator',timeout:180000,onQuery:async(op,a)=>{if(op==='jwks')return jwks();return runtime.query(op,a);}})]));
 const buildPort=privatePort({role:'registrar',key:Buffer.from(keys.builder,'hex'),input:fd(7,true),output:fd(8,false),side:'coordinator',timeout:180000});
 const persist=async record=>{const f=await open(c.evidenceDirectory+'/'+Date.now()+'-'+crypto.randomUUID()+'.json','wx',0o600);try{await f.writeFile(JSON.stringify(record));await f.sync();}finally{await f.close();}};
 const readPolicyState=role=>{const s=lstatSync(c.policyStateFile);need(s.isFile()&&!s.isSymbolicLink()&&s.uid===process.getuid()&&(s.mode&0o027)===0,'STATE');return JSON.parse(readFileSync(c.policyStateFile,'utf8'))[role];};
 let ingress,stopping,stopped=false,completed=false;
 const stop=()=>stopping??=(async()=>{stopped=true;try{await runtime?.binding.retire();}finally{ingress?.close();ingress?.closeAllConnections();Object.values(ports).forEach(p=>p.close());buildPort.close();}})();
 try{
  runtime=await createRepositoryRuntime({config:c,ports,buildPort,adminTokenSource:async()=>{const x=await privateFile(c.githubReadCredential);need(x.bootstrapId===c.target.bootstrapId&&Date.parse(x.issuedAt)>=Date.parse(c.target.createdAt)&&Date.parse(x.expiresAt)>Date.now()&&Date.parse(x.expiresAt)<=Date.parse(c.target.expiresAt),'FRESH_CREDENTIAL');return x.token;},readOwnerDecision:input=>ownerRequest({socket:c.ownerReceiptSocket,operation:'receipt',input}),persist,readPolicyState,invalidatePolicyState:policySHA256s=>retirePolicyState({path:c.policyStateFile,policySHA256s})});
  process.once('SIGTERM',()=>stop().catch(()=>{}));process.once('SIGINT',()=>stop().catch(()=>{}));
  for(const role of ['registrar','broker'])need((await ports[role].call('identity',{})).identity==='nyra_accept_'+role,'DATABASE_ROLE');
  await runtime.composition.watcher.arm();
  ingress=await startUnixIngress({origin:c.origin,handler:runtime.composition.ingress,socketPath:'/run/nyra-5c/ingress.sock',groupId:c.ingressGroupId,enable:true});
  while(!stopped){need(Date.now()<Date.parse(c.windowEndsAt)&&!Object.values(ports).some(p=>p.isClosed()),'WINDOW_OR_ROLE_EXIT');const r=await runtime.composition.watcher.scan();if(r.completed){completed=true;break;}await new Promise(r=>setTimeout(r,1000));}
  need(completed,'INTERRUPTED');runtime.assertComplete();
 }finally{await stop();}
}
if(process.argv[1]===new URL(import.meta.url).pathname)main().catch(()=>{console.error('NYRA_REPOSITORY_ACCEPTANCE_CLOSED');process.exitCode=1;});

// Test-only worker in a dedicated container. No TCP listener or host credential.
// Each container mounts ONLY its own role credential and IPC key. No Docker socket.
import {readFile,writeFile} from 'node:fs/promises';
import {createInterface} from 'node:readline';
import {evidenceSigner,verifyEvidence} from '../../lib/publication/runtime/acceptance-evidence.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
import {authenticatedFrames} from '../../lib/publication/runtime/acceptance-ipc.mjs';
import {createJobRegistrar} from '../../lib/publication/runtime/job-registrar.mjs';
import {composeIdentityBroker,createProtectedInventoryRegistrar} from '../../lib/publication/integration/protected-composition.mjs';
import {REQUIRED_CHECKS} from '../../lib/publication/runtime/governance.mjs';
import {isolatedFixture} from './isolated-fixture.mjs';
if(process.env.NYRA_ISOLATED_WORKER!=='1')throw Error('ISOLATED_WORKER_DISABLED');
const config=JSON.parse(await readFile('/worker.json','utf8'));
if(config.scope!=='synthetic-isolated-acceptance')throw Error('ISOLATED_SCOPE');
if(config.role==='builder'){
 if(config.db||config.ipcKey)throw Error('BUILDER_CREDENTIAL');
 const {rebuildCleanNormal}=await import('../../lib/publication/integration/clean-rebuild.mjs');
 await writeFile('/evidence/normal.json',JSON.stringify(await rebuildCleanNormal({codeSHA:config.head,builder:config.builder,sourceManifest:config.sourceManifest})),{flag:'wx',mode:0o600});
}else{
 const {default:pg}=await import('../native-acceptance/node_modules/pg/lib/index.js');
 if(!['registrar','broker'].includes(config.role)||config.db.user!=='nyra_accept_'+config.role)throw Error('ROLE_CONFIG');
 const db=new pg.Client({...config.db,statement_timeout:15000,lock_timeout:10000});await db.connect();const query=db.query.bind(db),grants=new Map();
 const receiptPublic=await crypto.subtle.importKey('jwk',config.receiptPublic,'Ed25519',false,['verify']);
 const signReceipt=config.role==='broker'?evidenceSigner({privateKey:await crypto.subtle.importKey('jwk',config.receiptPrivate,'Ed25519',false,['sign']),publicKeyId:'isolated-broker'}):null;
 const input=authenticatedFrames({key:Buffer.from(config.ipcKey,'hex'),role:config.role,direction:'request'}),output=authenticatedFrames({key:Buffer.from(config.ipcKey,'hex'),role:config.role,direction:'response'});
 const fixtures=Object.fromEntries(['build','publication'].map(p=>[p,isolatedFixture(config.head,p)]));
 const registrars=Object.fromEntries(Object.entries(fixtures).map(([p,f])=>[p,createJobRegistrar({policy:f.policy,privilege:p,getJSON:f.getJSON,query,requiredChecks:REQUIRED_CHECKS,readPolicyState:f.readPolicyState})]));
 const brokers=config.role==='broker'?Object.fromEntries(Object.entries(fixtures).map(([p,f])=>[p,composeIdentityBroker({configuration:f.configuration,privilege:p,getJSON:f.getJSON,brokerQuery:query,keySource:async()=>({keys:[config.jwk]}),readPolicyState:f.readPolicyState})])):{};
 const invoke=async body=>{
  if(body.op==='identity')return {user:(await query('select current_user')).rows[0].current_user,pid:process.pid,hasOnlyOwnCredential:true};
  if(config.role==='registrar'&&body.op==='register')return registrars[body.privilege].register(fixtures[body.privilege].selector);
  if(config.role==='registrar'&&body.op==='revoke')return registrars.build.revoke({...fixtures.build.selector,checkRunId:fixtures.build.builder.checkRunId});
  if(config.role==='broker'&&body.op==='authorize'){
   const grant=await brokers[body.privilege].authorize(body.token),handle=crypto.randomUUID();grants.set(handle,{grant,privilege:body.privilege});return {handle,grant};
  }
  if(config.role==='broker'&&body.op==='revalidate'){
   const item=grants.get(body.handle);if(!item)throw Error('UNKNOWN_GRANT');await brokers[item.privilege].revalidate(item.grant);return signReceipt({schema:'nyra.ipc.revalidation.v1',handle:body.handle,grantDigest:hashJSON(item.grant),policySHA256:item.grant.policySHA256,expiresAt:Math.min(Date.now()+5000,Date.parse(item.grant.expiresAt))});
  }
  if(config.role==='broker'&&body.op==='consume'){
   const grant=await brokers.publication.authorize(body.token);await brokers.publication.revalidate(grant);
   const scope=await brokers.publication.inventoryAuthority(body.configurationSHA256).forAttempt({codeSHA:config.head});return {codeSHA:scope.codeSHA,publicationIdentity:true};
  }
  if(config.role==='broker'&&body.op==='forbidden-write'){
   try{await query('insert into nyra_trust.inventories select * from nyra_trust.inventories');}catch{return {denied:true};}throw Error('BROKER_PRIVILEGE_ESCAPE');
  }
  if(config.role==='registrar'&&body.op==='capture'){
   // Only the authenticated coordinator relays a grant issued by the distinct
   // broker process. It MUST provide a fresh broker revalidation immediately
   // before invoking capture; SQL separately rechecks expiry/revocation.
   const result=await createProtectedInventoryRegistrar({authorizeBuild:async()=>body.grant,revalidateBuild:async c=>{const proof=await verifyEvidence(body.revalidated,{publicKey:receiptPublic,keyId:'isolated-broker'});if(proof.policySHA256!==c.policySHA256||proof.handle!==body.handle||proof.grantDigest!==hashJSON(c)||proof.expiresAt<=Date.now())throw Error('IPC_REVALIDATION');},registrarQuery:query,rebuild:async()=>JSON.parse(await readFile('/rebuild/normal.json','utf8'))}).capture(body.handle);
   return result;
  }
  throw Error('ROLE_OPERATION_DENIED');
 };
 try{for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity})){
  let response;try{const body=input.decode(JSON.parse(line));response={ok:true,result:(await invoke(body))??null};}catch{response={ok:false,code:'ISOLATED_OPERATION_DENIED'};}
  process.stdout.write(JSON.stringify(output.encode(response))+'\n');
 }}finally{await db.end();}
}

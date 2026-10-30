import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,chmod,rm,symlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {existingOwnerMFA,createOwnerRiskSource,signedDecisionJournal} from '../lib/publication/runtime/owner-risk-source.mjs';
import {evidenceSigner,verifyEvidence} from '../lib/publication/runtime/acceptance-evidence.mjs';
import {bootstrapPlan} from '../ops/acceptance-bootstrap/plan.mjs';
import {privateFile,startOwnerSource} from '../ops/acceptance-bootstrap/owner-source.mjs';
import {administrationGate,ENVIRONMENT_IDS} from '../lib/publication/runtime/administration-evidence.mjs';
import {hashJSON} from '../lib/publication/contract.mjs';
import {integrationAPI} from './fixtures/protected-integration.mjs';
const user='11111111-1111-4111-8111-111111111111',session='22222222-2222-4222-8222-222222222222',clock=()=>2000000000000;
const token=(patch={})=>'eyJsynthetic.'+Buffer.from(JSON.stringify({sub:user,session_id:session,aal:'aal2',exp:Math.floor(clock()/1000)+600,...patch})).toString('base64url')+'.synthetic';
const authConfig={projectOrigin:'https://project.supabase.co',statusURL:'https://project.supabase.co/functions/v1/nyra-api/status',ownerOrigin:'https://eliaskalyvas.gr',ownerAuthUserId:user,publicApiKey:'synthetic-public-key',now:clock};
const apps=[{appId:'development',permissions:{contents:'write',workflows:'write'}}],digest=hashJSON(apps);
const policy=()=>({repository:'Noctua76/eliaskalyvas-website',repositoryId:'1389733212',ownerId:'217035723',governanceMode:'SINGLE_OWNER',policyVersion:1,applicationsSHA256:digest,ownerAuthUserId:user,windowEndsAt:new Date(clock()+3600000).toISOString()});
async function fixture(){
 const keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),sign=evidenceSigner({privateKey:keys.privateKey,publicKeyId:'test-control-plane'}),rows=[];let valid=true;
 const authenticateOwner=existingOwnerMFA({...authConfig,fetcher:async url=>{if(!valid)return new Response(null,{status:401});return Response.json(url.endsWith('/user')?{id:user,is_anonymous:false}:{publishing:false});}});
 const journal=signedDecisionJournal({records:{read:async()=>structuredClone(rows),append:async r=>rows.push(structuredClone(r))},signRecord:sign,publicKey:keys.publicKey,keyId:'test-control-plane'});
 const args={policy:policy(),authenticateOwner,journal,signReceipt:sign,now:clock},source=createOwnerRiskSource(args);
 const approve=()=>source.authorize({token:token(),applicationsSHA256:digest,policyVersion:1,riskAcknowledgment:{write:true,merge:true,workflow:true}});
 return {keys,sign,rows,journal,source,args,approve,invalidate:()=>valid=false};
}
test('Bootstrap owner adapter uses ONLY exact remote Auth + approved status GET; verifies real-owner/MFA semantics',async()=>{
 const calls=[],auth=existingOwnerMFA({...authConfig,fetcher:async(url,options)=>{calls.push({url,options});return Response.json(url.endsWith('/user')?{id:user,is_anonymous:false}:{publishing:false});}});
 const result=await auth(token());assert.equal(result.ownerId,'217035723');assert.equal(result.contract,'existing-owner-mfa');assert(!JSON.stringify(result).includes(token()));
 assert.deepEqual(calls.map(x=>x.url),[authConfig.projectOrigin+'/auth/v1/user',authConfig.statusURL]);assert(calls.every(x=>x.options.method==='GET'&&x.options.redirect==='error'));assert(!calls.some(x=>x.url.includes('openai')));
});
for(const [name,change]of Object.entries({aal:{aal:'aal1'},subject:{sub:session},expired:{exp:1},session:{session_id:'unknown'}}))test('Bootstrap remote owner rejects '+name,async()=>{
 const auth=existingOwnerMFA({...authConfig,fetcher:async url=>Response.json(url.endsWith('/user')?{id:user,is_anonymous:false}:{publishing:false})});await assert.rejects(auth(token(change)),/UNVERIFIED/);
});
test('Bootstrap owner adapter rejects non-owner, failed status gate, anonymous user, redirects and unavailable backend',async()=>{
 for(const fetcher of [async()=>Response.json({id:session,is_anonymous:false}),async()=>Response.json({id:user,is_anonymous:true}),async url=>url.endsWith('/user')?Response.json({id:user,is_anonymous:false}):new Response(null,{status:403}),async()=>{throw Error('private session');}])await assert.rejects(existingOwnerMFA({...authConfig,fetcher})(token()),e=>e.message==='OWNER_MFA_UNVERIFIED');
 assert.throws(()=>existingOwnerMFA({...authConfig,statusURL:'https://evil.invalid/functions/v1/nyra-api/status'}));
});
test('Bootstrap independently authenticated decision produces receipt accepted by the EXISTING administration gate',async()=>{
 const f=await fixture(),d=await f.approve(),p=integrationAPI().policy;
 const record={schema:'nyra.administration.observation.v1',observedAt:new Date(clock()).toISOString(),mainSHA:p.callerSHA,applications:{apps},environments:Object.entries(ENVIRONMENT_IDS).map(([environment,environmentId])=>({environment,environmentId,mainSHA:p.callerSHA,governanceMode:'SINGLE_OWNER',policyVersion:1}))};
 const gate=administrationGate({readEvidence:async()=>({record,digest:hashJSON(record)}),acceptedApplicationsSHA256:digest,ownerRiskDecisionId:d.decisionId,readOwnerRiskDecision:f.source.receipt,ownerDecisionPublicKey:f.keys.publicKey,ownerDecisionKeyId:'test-control-plane',now:clock});
 assert.equal(await gate(p),record);assert(!JSON.stringify(f.rows).includes(token()));assert.equal(f.rows.length,1);
 f.invalidate();await assert.rejects(gate(p),/SOURCE_UNVERIFIED/);
});
test('Bootstrap rejects static/caller approval, different inventory/policy and incomplete acknowledgments',async()=>{
 const f=await fixture();for(const patch of [{token:'unsigned'},{applicationsSHA256:'f'.repeat(64)},{policyVersion:2},{riskAcknowledgment:{write:true,merge:true}},{riskAcknowledgment:{write:true,merge:true,workflow:true,approved:true}}])await assert.rejects(f.source.authorize({token:token(),applicationsSHA256:digest,policyVersion:1,riskAcknowledgment:{write:true,merge:true,workflow:true},...patch}));assert.equal(f.rows.length,0);
});
test('Bootstrap signed journal rejects tampering/reordering, and latest real decision supersedes old approval',async()=>{
 const f=await fixture(),first=await f.approve(),second=await f.approve();await assert.rejects(f.source.receipt({decisionId:first.decisionId,challenge:crypto.randomUUID()}),/INACTIVE/);
 const e=await f.source.receipt({decisionId:second.decisionId,challenge:crypto.randomUUID()});assert.equal((await verifyEvidence(e,{publicKey:f.keys.publicKey,keyId:'test-control-plane'})).decisionId,second.decisionId);
 const saved=structuredClone(f.rows);[f.rows[0],f.rows[1]]=[f.rows[1],f.rows[0]];await assert.rejects(f.journal.current());f.rows.splice(0,f.rows.length,...saved);
 f.rows[0].record.decision.applicationsSHA256='a'.repeat(64);await assert.rejects(f.journal.current());
});
test('Bootstrap live retirement/restart/close deny further receipts instead of restoring static authorization',async()=>{
 const f=await fixture(),d=await f.approve(),read=()=>f.source.receipt({decisionId:d.decisionId,challenge:crypto.randomUUID()});await read();
 await assert.rejects(createOwnerRiskSource(f.args).receipt({decisionId:d.decisionId,challenge:crypto.randomUUID()}));
 await f.source.retire({token:token(),decisionId:d.decisionId});await assert.rejects(read(),/INACTIVE/);f.source.close();await assert.rejects(f.approve(),/WINDOW_EXPIRED/);
});
test('Bootstrap source rechecks journal after remote owner authentication so concurrent retirement wins',async()=>{
 const f=await fixture(),d=await f.approve();let active=f.rows.at(-1).record.decision;
 const source=createOwnerRiskSource({...f.args,authenticateOwner:async()=>{active={...active,state:'retired'};return {contract:'existing-owner-mfa',ownerId:'217035723',authUserId:user,sessionDigest:hashJSON(session),expiresAt:clock()+300000};},journal:{append:async()=>{},current:async()=>structuredClone(active)}});
 // Fresh source has no retained session; the injected test authenticator is used
 // only to force the interleaving, not as real authorization evidence.
 await assert.rejects(source.receipt({decisionId:d.decisionId,challenge:crypto.randomUUID()}),/CHANGED/);
});
test('Bootstrap CLI plan is non-authorizing, enforces isolation, reviewed reusable pin and finite cleanup window',()=>{
 const c={schema:'nyra.acceptance.bootstrap.v1',...policy(),host:'owner-acceptance.example.net',collectorOrigin:'https://acceptance.example.net',callerSHA:'c'.repeat(40),reusableSHA:'cefd1a402dcffd0b00f05f7d7539ba381120641e',evidenceKeyId:'externally-pinned',evidencePublicKeySHA256:'a'.repeat(64),ownerDecisionPublicKeySHA256:'b'.repeat(64),windowStartsAt:new Date(clock()).toISOString(),windowEndsAt:new Date(clock()+3600000).toISOString()};delete c.ownerAuthUserId;delete c.policyVersion;delete c.applicationsSHA256;
 const p=bootstrapPlan(c);assert.equal(p.authorization,false);assert.equal(p.dispatchesPerformed,0);assert.deepEqual(p.credentialScopes.workflowCredentials,[]);assert.equal(p.resources.builderNetwork,'none');
 for(const patch of [{host:null},{collectorOrigin:'https://eliaskalyvas.gr'},{reusableSHA:'main'},{ownerDecisionPublicKeySHA256:null},{windowEndsAt:new Date(clock()+90000000).toISOString()}])assert.throws(()=>bootstrapPlan({...c,...patch}));
});
test('Bootstrap private files and disabled owner socket fail closed without provisioning or opening a listener',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nyra-bootstrap-test-'));try{const path=join(dir,'private.json');await writeFile(path,'{}',{mode:0o600});assert.deepEqual(await privateFile(path),{});await chmod(path,0o644);await assert.rejects(privateFile(path));await chmod(path,0o600);const link=join(dir,'link');await symlink(path,link);await assert.rejects(privateFile(link));await assert.rejects(startOwnerSource({}),/DISABLED/);}finally{await rm(dir,{recursive:true,force:true});}
});

test('Bootstrap real private UNIX transport rejects token-in-body and uses only private header authentication',async t=>{
 const {ownerRequest}=await import('../ops/acceptance-bootstrap/owner-request.mjs'),f=await fixture(),dir=await mkdtemp(join(tmpdir(),'nyra-source-test-'));let service;
 const old=process.env.NYRA_ACCEPTANCE_OWNER_SOURCE;process.env.NYRA_ACCEPTANCE_OWNER_SOURCE='1';
 try{await chmod(dir,0o700);const publicKey=await crypto.subtle.exportKey('jwk',f.keys.publicKey),signingKey=join(dir,'test-key.json');
  await writeFile(signingKey,JSON.stringify({keyId:'test-control-plane',privateKey:await crypto.subtle.exportKey('jwk',f.keys.privateKey),publicKey}),{mode:0o600});
  const socket=join(dir,'owner.sock');service=await startOwnerSource({socket,journal:join(dir,'decisions.jsonl'),signingKey,keyId:'test-control-plane',publicKeySHA256:hashJSON(publicKey),policy:{...policy(),windowEndsAt:new Date(Date.now()+60000).toISOString()},auth:{...authConfig,fetcher:async url=>Response.json(url.endsWith('/user')?{id:user,is_anonymous:false}:{publishing:false})}});
  const d=await ownerRequest({socket,operation:'authorize',input:{token:token(),applicationsSHA256:digest,policyVersion:1,riskAcknowledgment:{write:true,merge:true,workflow:true}}});
  const receipt=await ownerRequest({socket,operation:'receipt',input:{decisionId:d.decisionId,challenge:crypto.randomUUID()}});assert.equal(receipt.keyId,'test-control-plane');
  await ownerRequest({socket,operation:'retire',input:{token:token(),decisionId:d.decisionId}});await assert.rejects(ownerRequest({socket,operation:'receipt',input:{decisionId:d.decisionId,challenge:crypto.randomUUID()}}));
 }catch(e){if(e.code==='EPERM'&&!process.env.GITHUB_ACTIONS)t.skip('Workspace denies UNIX listen; required CI must exercise the real socket');else throw e;}finally{service?.stop();if(old===undefined)delete process.env.NYRA_ACCEPTANCE_OWNER_SOURCE;else process.env.NYRA_ACCEPTANCE_OWNER_SOURCE=old;await rm(dir,{recursive:true,force:true});}
});
test('Bootstrap cleanup dry-run/apply are exact-label scoped and reject substituted resources',async()=>{
 const {cleanupPlan}=await import('../ops/acceptance-bootstrap/cleanup.mjs');
 const c={schema:'nyra.acceptance.bootstrap.v1',...policy(),host:'owner-acceptance.example.net',collectorOrigin:'https://acceptance.example.net',callerSHA:'c'.repeat(40),reusableSHA:'cefd1a402dcffd0b00f05f7d7539ba381120641e',evidenceKeyId:'externally-pinned',evidencePublicKeySHA256:'a'.repeat(64),ownerDecisionPublicKeySHA256:'b'.repeat(64),windowStartsAt:new Date(clock()).toISOString(),windowEndsAt:new Date(clock()+3600000).toISOString()},label=bootstrapPlan(c).planSHA256,calls=[];
 const execute=args=>{calls.push(args);if(args[0]==='ps')return 'owned-container';if(args.includes('inspect'))return JSON.stringify([{Config:{Labels:{'com.noctua.nyra.acceptance':label}}}]);return '';};
 assert.equal(cleanupPlan(c,{execute}).resources[0].removed,false);assert(!calls.some(x=>x[0]==='rm'));assert.equal(cleanupPlan(c,{execute,apply:true}).resources[0].removed,true);assert(calls.some(x=>x[0]==='rm'));
 assert.throws(()=>cleanupPlan(c,{apply:true,execute:args=>args.includes('inspect')?'[{"Config":{"Labels":{}}}]':args[0]==='ps'?'other-container':''}),/SCOPE/);
});

test('Bootstrap retirement during async signing wins before any receipt is returned',async()=>{
 const f=await fixture(),d=await f.approve();let active=await f.journal.current();
 const source=createOwnerRiskSource({...f.args,authenticateOwner:async()=>({contract:'existing-owner-mfa',ownerId:'217035723',authUserId:user,sessionDigest:hashJSON(session),expiresAt:clock()+300000}),journal:{append:async()=>{},current:async()=>structuredClone(active)},signReceipt:async record=>{const receipt=await f.sign(record);active={...active,state:'retired'};return receipt;}});
 await assert.rejects(source.receipt({decisionId:d.decisionId,challenge:crypto.randomUUID()}),/CHANGED/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {evidenceSigner} from '../lib/publication/runtime/acceptance-evidence.mjs';
import {hashJSON} from '../lib/publication/contract.mjs';
import {inspectRepositoryAuthorityV2,validateRepositoryAuthorityV2Plan} from '../lib/publication/runtime/repository-authority-v2.mjs';
import {ENVIRONMENT_IDS} from '../lib/publication/runtime/administration-evidence.mjs';
import {REQUIRED_CHECKS} from '../lib/publication/runtime/governance.mjs';

const TIME=Date.parse('2026-11-01T20:00:00Z');
const iso=n=>new Date(n).toISOString();
const sha='a'.repeat(40);
const challenge='challenge-not-from-a-job-123456';
const plan=()=>({
 schema:'nyra.repository-authority.plan.v2',purpose:'non-publishing-feasibility',
 activation:'INACTIVE',repository:'Noctua76/eliaskalyvas-website',
 repositoryId:'1389733212',ownerId:'217035723',mainSHA:sha,
 predecessorPolicySHA256:'f'.repeat(64),
 governance:{schema:'nyra.governance.v1',mode:'SINGLE_OWNER',policyVersion:1,
  ownerId:'217035723',ownerAuthorizationSHA:'b'.repeat(40),reviewerIds:[]},
 integrationRisk:'UNVERIFIED',unknownPermissionIsNotNone:true,
 acceptedForTrust:false,productionAuthorized:false
});
const admin=()=>({
 schema:'nyra.repository-authority.admin-evidence.v2',
 purpose:'non-publishing-feasibility',authorization:false,
 repository:'Noctua76/eliaskalyvas-website',repositoryId:'1389733212',
 ownerId:'217035723',mainSHA:sha,governanceMode:'SINGLE_OWNER',
 source:{type:'authenticated-repository-admin-read',readOnly:true,
  independentOfDelivery:true,paginationComplete:true,
  oldestSourceAt:iso(TIME-3000),observedAt:iso(TIME-1000),
  surfaces:['main-protection','required-checks','environments','collaborators','deploy-keys','actions-default']},
 branch:{protected:true,pullRequestRequired:true,requiredApprovals:0,
  adminEnforced:true,noBypassActors:true,strictChecks:true,
  conversationsRequired:true,forcePushesAllowed:false,deletionsAllowed:false,
  checks:REQUIRED_CHECKS.map(context=>({context,appId:15368}))},
 environments:Object.entries(ENVIRONMENT_IDS).map(([name,id])=>({
  name,id,mainOnly:true,tagCount:0,mandatoryReviewers:0,adminBypass:false,secretCount:0
 })),
 repositoryAdministration:{nonOwnerWriteCollaborators:0,deployKeys:0,
  defaultWorkflowPermissions:'read',actionsCanApprovePR:false},
 accountIntegrationInventory:'UNVERIFIED',externalAdminMutationRisk:'UNRESOLVED'
});
const owner=(p=plan())=>({
 schema:'nyra.repository-authority.owner-risk-receipt.v2',
 purpose:'non-publishing-feasibility',authorization:false,state:'active',
 challenge,planSHA256:hashJSON(p),
 repository:'Noctua76/eliaskalyvas-website',repositoryId:'1389733212',
 ownerId:'217035723',mainSHA:sha,
 issuedAt:iso(TIME-1000),expiresAt:iso(TIME+30000),
 ownerAuthorization:{contract:'existing-owner-mfa',verified:true,aal:'aal2',
  ownerId:'217035723',evidenceId:'verified-source-test-only'},
 riskAcknowledgment:{unknownIntegrations:true,externalWriteAuthority:true,
  mutableAdminControls:true,nonPublishingOnly:true}
});
const adminKeys=await webcrypto.subtle.generateKey('Ed25519',false,['sign','verify']);
const ownerKeys=await webcrypto.subtle.generateKey('Ed25519',false,['sign','verify']);
const aSign=evidenceSigner({privateKey:adminKeys.privateKey,publicKeyId:'test-independent-admin'});
const oSign=evidenceSigner({privateKey:ownerKeys.privateKey,publicKeyId:'test-independent-owner'});
async function evaluate({p=plan(),a=admin(),o=owner(p),t=TIME,keys=[adminKeys.publicKey,ownerKeys.publicKey],keyIds=['test-independent-admin','test-independent-owner'],c=challenge}={}){
 return inspectRepositoryAuthorityV2({plan:p,adminEnvelope:await aSign(a),ownerEnvelope:await oSign(o),
  adminPublicKey:keys[0],ownerPublicKey:keys[1],adminKeyId:keyIds[0],ownerKeyId:keyIds[1],challenge:c,now:()=>t});
}
test('Signed, fresh, exact repository-only observations produce diagnostic but never a trust or publication capability',async()=>{
 const r=await evaluate();
 assert.equal(r.candidateFeasibility,true);
 assert.equal(r.signaturesVerified,true);
 assert.equal(r.unresolvedAccountWideIntegrations,true);
 assert.equal(r.externalWriteRisk,'UNRESOLVED');
 for(const k of ['acceptedForTrust','ownerPublicationAuthorized','productionAuthorized'])
  assert.equal(r[k],false);
 assert.equal(r.mainSHA,sha);
 assert(!Object.hasOwn(r,'grant'));
});
for(const [name,mutate]of Object.entries({
 'production activation':p=>p.activation='ENABLED',
 'fabricated acceptance':p=>p.acceptedForTrust=true,
 'fabricated production authority':p=>p.productionAuthorized=true,
 'secret injection':p=>p.token='plaintext',
 'other account':p=>p.ownerId='999',

 'reviewer governance':p=>{p.governance.mode='OWNER_WITH_REVIEWERS';p.governance.reviewerIds=['77'];},
 'missing reviewer mode':p=>delete p.governance,
 'unknown mapped to none':p=>p.unknownPermissionIsNotNone=false,
 'pretend complete integration inventory':p=>p.integrationRisk='VERIFIED'
}))test('Plan rejects '+name,()=>{
 const p=plan();mutate(p);assert.throws(()=>validateRepositoryAuthorityV2Plan(p));
});
for(const [name,mutate]of Object.entries({
 'unsigned authorization declaration':a=>a.authorization=true,
 'wrong main SHA':a=>a.mainSHA='c'.repeat(40),
 'wrong repository':a=>a.repository='evil/repo',
 'not independent reader':a=>a.source.independentOfDelivery=false,
 'stale oldest source':a=>a.source.oldestSourceAt=iso(TIME-60000),
 'future source timestamp':a=>a.source.observedAt=iso(TIME+5000),
 'missing independent source surface':a=>a.source.surfaces.pop(),
 'pagination incomplete':a=>a.source.paginationComplete=false,
 'no strict checks':a=>a.branch.strictChecks=false,
 'wrong required-check App':a=>a.branch.checks[0].appId=9,
 'missing required check':a=>a.branch.checks.pop(),
 'mandatory human reviewer':a=>a.branch.requiredApprovals=1,
 'admin bypass':a=>a.branch.noBypassActors=false,
 'force push':a=>a.branch.forcePushesAllowed=true,
 'missing Environment':a=>a.environments.pop(),
 'wrong Environment ID':a=>a.environments[0].id='999',
 'unexpected Environment reviewer':a=>a.environments[0].mandatoryReviewers=1,
 'Environment admin bypass':a=>a.environments[0].adminBypass=true,
 'Environment secret':a=>a.environments[0].secretCount=1,
 'unknown collaborator':a=>a.repositoryAdministration.nonOwnerWriteCollaborators=null,
 'unreviewed deploy key':a=>a.repositoryAdministration.deployKeys=1,
 'workflow write default':a=>a.repositoryAdministration.defaultWorkflowPermissions='write',
 'pretend external risk resolved':a=>a.externalAdminMutationRisk='NONE',
 'pretend account-wide inventory verified':a=>a.accountIntegrationInventory='VERIFIED'
}))test('Independent admin evidence denies '+name,async()=>{
 const a=admin();mutate(a);await assert.rejects(evaluate({a}));
});
for(const [name,mutate]of Object.entries({
 'owner authorizes publication':o=>o.authorization=true,
 'wrong owner challenge':o=>o.challenge='other-challenge',
 'wrong plan digest':o=>o.planSHA256='0'.repeat(64),
 'other owner':o=>o.ownerId='999',
 'no MFA':o=>o.ownerAuthorization.verified=false,
 'wrong assurance':o=>o.ownerAuthorization.aal='aal1',
 'missing risk acceptance':o=>o.riskAcknowledgment.externalWriteAuthority=false,
 'missing non-publishing acknowledgement':o=>o.riskAcknowledgment.nonPublishingOnly=false,
 'stale decision':o=>{o.issuedAt=iso(TIME-70000);o.expiresAt=iso(TIME+20000);},
 'expired decision':o=>{o.issuedAt=iso(TIME-40000);o.expiresAt=iso(TIME-10000);},
 'retired decision':o=>o.state='retired'
}))test('Owner feasibility receipt denies '+name,async()=>{
 const o=owner();mutate(o);await assert.rejects(evaluate({o}));
});
test('Cross-signed source, wrong key pin, tampered evidence and changed challenge fail',async()=>{
 await assert.rejects(evaluate({keys:[ownerKeys.publicKey,adminKeys.publicKey]}));
 await assert.rejects(evaluate({keyIds:['test-other','test-independent-owner']}));
 await assert.rejects(evaluate({c:'second-independent-challenge'}));
 await assert.rejects(evaluate({keyIds:['test-independent-owner','test-independent-owner']}));
 const a=await aSign(admin()),o=await oSign(owner());
 a.record.branch.noBypassActors=false;
 await assert.rejects(inspectRepositoryAuthorityV2({plan:plan(),adminEnvelope:a,ownerEnvelope:o,
  adminPublicKey:adminKeys.publicKey,adminKeyId:'test-independent-admin',
  ownerPublicKey:ownerKeys.publicKey,ownerKeyId:'test-independent-owner',
  challenge,now:()=>TIME}));
});

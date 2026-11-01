// NYRA Trust Policy v2: INACTIVE feasibility inspector, not a replacement gate.
// Imported only by tests until an explicit owner-authorized, separately validated
// integration is reviewed. No service, routes, secret access or publication grant.
import {verifyEvidence} from './acceptance-evidence.mjs';
import {hashJSON} from '../contract.mjs';
import {TrustError} from './oidc.mjs';
import {REQUIRED_CHECKS,validateGovernance} from './governance.mjs';
import {ENVIRONMENT_IDS} from './administration-evidence.mjs';

const REPO='Noctua76/eliaskalyvas-website';
const REPO_ID='1389733212', OWNER_ID='217035723';
const SHA=/^[a-f0-9]{40}$/, HEX=/^[a-f0-9]{64}$/;
const fail=(code)=>{throw new TrustError('V2_'+code);};
const need=(ok,code)=>{if(!ok)fail(code);};
const own=(o,k)=>o!==null&&typeof o==='object'&&Object.hasOwn(o,k);
const exact=(v,names)=>Array.isArray(v)&&v.length===names.length&&new Set(v).size===v.length&&names.every(x=>v.includes(x));
const fresh=(value,now,maxAge)=>typeof value==='string'&&Number.isFinite(Date.parse(value))&&now-Date.parse(value)>=0&&now-Date.parse(value)<maxAge;

export function validateRepositoryAuthorityV2Plan(p){
 need(p?.schema==='nyra.repository-authority.plan.v2'&&p.purpose==='non-publishing-feasibility'&&p.activation==='INACTIVE','PLAN');
 need(p.repository===REPO&&p.repositoryId===REPO_ID&&p.ownerId===OWNER_ID&&SHA.test(p.mainSHA)&&HEX.test(p.predecessorPolicySHA256),'IDENTITY');
 validateGovernance(p.governance,OWNER_ID);
 need(p.governance.mode==='SINGLE_OWNER'&&p.governance.reviewerIds.length===0,'GOVERNANCE');
 need(p.integrationRisk==='UNVERIFIED'&&p.unknownPermissionIsNotNone===true,'UNKNOWN_RISK');
 need(p.acceptedForTrust===false&&p.productionAuthorized===false,'NO_ACTIVATION');
 need(!['token','secret','signingKey','acceptedApplicationsSHA256','override','adminEvidence','ownerReceipt'].some(k=>own(p,k)),'INJECTED_POLICY');
 return p;
}

function validateAdmin(a,p,now){
 need(a?.schema==='nyra.repository-authority.admin-evidence.v2'&&a.purpose==='non-publishing-feasibility'&&a.authorization===false,'ADMIN_SCHEMA');
 need(a.repository===REPO&&a.repositoryId===REPO_ID&&a.ownerId===OWNER_ID&&a.mainSHA===p.mainSHA&&a.governanceMode==='SINGLE_OWNER','ADMIN_IDENTITY');
 const s=a.source;
 need(s?.type==='authenticated-repository-admin-read'&&s.readOnly===true&&s.paginationComplete===true&&s.independentOfDelivery===true,'ADMIN_SOURCE');
 need(fresh(s.oldestSourceAt,now,60000)&&fresh(s.observedAt,now,60000)&&Date.parse(s.oldestSourceAt)<=Date.parse(s.observedAt),'ADMIN_FRESHNESS');
 need(exact(s.surfaces,['main-protection','required-checks','environments','collaborators','deploy-keys','actions-default']),'ADMIN_COVERAGE');
 const b=a.branch;
 need(b?.protected===true&&b.pullRequestRequired===true&&b.requiredApprovals===0&&b.adminEnforced===true&&b.noBypassActors===true&&b.strictChecks===true&&b.conversationsRequired===true&&b.forcePushesAllowed===false&&b.deletionsAllowed===false,'BRANCH_PROTECTION');
 need(Array.isArray(b.checks)&&b.checks.length===REQUIRED_CHECKS.length&&REQUIRED_CHECKS.every(c=>b.checks.filter(x=>x?.context===c&&x.appId===15368).length===1),'CHECK_ORIGIN');
 need(Array.isArray(a.environments)&&a.environments.length===3,'ENVIRONMENTS');
 for(const [name,id] of Object.entries(ENVIRONMENT_IDS)){
  const rows=a.environments.filter(e=>e?.name===name);
  need(rows.length===1&&String(rows[0].id)===id&&rows[0].mainOnly===true&&rows[0].tagCount===0&&rows[0].mandatoryReviewers===0&&rows[0].adminBypass===false&&rows[0].secretCount===0,'ENVIRONMENT_PROTECTION');
 }
 const d=a.repositoryAdministration;
 need(d?.nonOwnerWriteCollaborators===0&&d.deployKeys===0&&d.defaultWorkflowPermissions==='read'&&d.actionsCanApprovePR===false,'ADMIN_SCOPE');
 need(a.accountIntegrationInventory==='UNVERIFIED'&&a.externalAdminMutationRisk==='UNRESOLVED','RESIDUAL_RISK');
}

function validateOwner(d,p,challenge,now){
 need(d?.schema==='nyra.repository-authority.owner-risk-receipt.v2'&&d.purpose==='non-publishing-feasibility'&&d.authorization===false&&d.state==='active','OWNER_SCHEMA');
 need(d.challenge===challenge&&d.planSHA256===hashJSON(p)&&d.repository===REPO&&d.repositoryId===REPO_ID&&d.ownerId===OWNER_ID&&d.mainSHA===p.mainSHA,'OWNER_BINDING');
 const issued=Date.parse(d.issuedAt),expires=Date.parse(d.expiresAt);
 need(Number.isFinite(issued)&&Number.isFinite(expires)&&issued<=now&&now<expires&&expires-issued>0&&expires-issued<=60000,'OWNER_FRESHNESS');
 const o=d.ownerAuthorization,r=d.riskAcknowledgment;
 need(o?.contract==='existing-owner-mfa'&&o.verified===true&&o.aal==='aal2'&&o.ownerId===OWNER_ID&&typeof o.evidenceId==='string'&&o.evidenceId.length>0,'OWNER_MFA');
 need(r?.unknownIntegrations===true&&r.externalWriteAuthority===true&&r.mutableAdminControls===true&&r.nonPublishingOnly===true,'OWNER_RISK');
}

export async function inspectRepositoryAuthorityV2({
 plan,adminEnvelope,ownerEnvelope,adminPublicKey,adminKeyId,
 ownerPublicKey,ownerKeyId,challenge,now=Date.now
}){
 validateRepositoryAuthorityV2Plan(plan);
 need(typeof now==='function'&&typeof challenge==='string'&&challenge.length>=16&&challenge.length<=128,'CHALLENGE');
 need(typeof adminKeyId==='string'&&adminKeyId.length>0&&typeof ownerKeyId==='string'&&ownerKeyId.length>0&&adminKeyId!==ownerKeyId,'SEPARATE_SIGNERS');
 need(adminPublicKey?.type==='public'&&ownerPublicKey?.type==='public'&&adminPublicKey.algorithm?.name==='Ed25519'&&ownerPublicKey.algorithm?.name==='Ed25519','PINNED_KEYS');
 let admin,owner;
 try{admin=await verifyEvidence(adminEnvelope,{publicKey:adminPublicKey,keyId:adminKeyId});}
 catch{fail('ADMIN_SIGNATURE');}
 validateAdmin(admin,plan,now());
 try{owner=await verifyEvidence(ownerEnvelope,{publicKey:ownerPublicKey,keyId:ownerKeyId});}
 catch{fail('OWNER_SIGNATURE');}
 validateOwner(owner,plan,challenge,now());
 // This intentionally returns NO capability, accepted policy, or permission.
 // Repository-only evidence cannot exclude undiscovered external write paths.
 return Object.freeze({
  schema:'nyra.repository-authority.diagnostic.v2',purpose:'non-publishing-feasibility',
  planSHA256:hashJSON(plan),mainSHA:plan.mainSHA,
  authenticatedSourcesObserved:true,signaturesVerified:true,
  unresolvedAccountWideIntegrations:true,externalWriteRisk:'UNRESOLVED',
  candidateFeasibility:true,acceptedForTrust:false,
  ownerPublicationAuthorized:false,productionAuthorized:false
 });
}

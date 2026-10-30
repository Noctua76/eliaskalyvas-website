// Unmounted Phase 5C adapter. Registration is a separate control-plane act;
// neither an OIDC bearer nor workflow input can register or approve itself.
import {createOIDCVerifier,TrustError} from './oidc.mjs';
import {hashJSON} from '../contract.mjs';
import {REQUIRED_CHECKS,validateGovernance,policyGuard,verifyGovernanceAccess,verifyMergedChecks} from './governance.mjs';
const need=(ok,code)=>{if(!ok)throw new TrustError(code);};
const decimal=v=>typeof v==='string'&&/^[1-9][0-9]{0,19}$/.test(v);
const sha=v=>typeof v==='string'&&/^[a-f0-9]{40}$/.test(v);
export function validateJobRegistration(r,policy){
 validateGovernance(policy.governance,policy.ownerId);
 need(r?.governance&&hashJSON(r.governance)===hashJSON(policy.governance)&&r.policySHA256===hashJSON(policy),'REGISTRATION_GOVERNANCE');
 need(r&&['build','inspection','publication'].includes(r.privilege),'REGISTRATION_PRIVILEGE');
 for(const k of ['runId','runAttempt','checkRunId','jobId','workflowId','checkSuiteId'])need(decimal(r[k]),'REGISTRATION_ID');
 for(const k of ['codeSHA','workflowSHA'])need(sha(r[k]),'REGISTRATION_SHA');
 for(const [k,v]of Object.entries({repository:policy.repository,repositoryId:policy.repositoryId,ownerId:policy.ownerId,ref:policy.ref,environment:policy.environment,workflowRef:policy.workflowRef,jobWorkflowRef:policy.jobWorkflowRef,jobWorkflowSHA:policy.jobWorkflowSHA,jobName:policy.jobName}))need(r[k]===v,'REGISTRATION_'+k);
 need(policy.events.includes(r.event)&&r.ref==='refs/heads/main'&&r.workflowRef.endsWith('@refs/heads/main')&&r.jobWorkflowRef.endsWith('@'+r.jobWorkflowSHA),'REGISTRATION_CONTEXT');
 need(typeof r.workflowPath==='string'&&/^\.github\/workflows\/[A-Za-z0-9_-]+\.yml$/.test(r.workflowPath)&&r.workflowRef===r.repository+'/'+r.workflowPath+'@'+r.ref,'REGISTRATION_WORKFLOW');
 need(Number.isFinite(Date.parse(r.expiresAt)),'REGISTRATION_EXPIRY');
 return r;
}
// These are authenticated GitHub API responses, never runner-supplied evidence.
export async function verifyLiveProtections({getJSON,repository,environment,requiredChecks,policy,expectedCodeSHA}){
 need(policy?.repository===repository&&policy.environment===environment&&Array.isArray(requiredChecks)&&requiredChecks.length===2&&REQUIRED_CHECKS.every(c=>requiredChecks.includes(c)),'PROTECTION_CONFIG');
 const g=validateGovernance(policy.governance,policy.ownerId);
 const root='https://api.github.com/repos/'+repository;
 const branch=await getJSON(root+'/branches/main');
 const p=await getJSON(root+'/branches/main/protection');
 const e=await getJSON(root+'/environments/'+encodeURIComponent(environment));
 const b=await getJSON(root+'/environments/'+encodeURIComponent(environment)+'/deployment-branch-policies?per_page=100');
 need(branch.name==='main'&&branch.protected===true&&sha(branch.commit?.sha),'MAIN_UNPROTECTED');
 if(expectedCodeSHA)need(branch.commit.sha===expectedCodeSHA,'STALE_MAIN');
 need(p.enforce_admins?.enabled===true&&p.allow_force_pushes?.enabled===false&&p.allow_deletions?.enabled===false&&p.required_conversation_resolution?.enabled===true,'MAIN_PROTECTION');
 const review=p.required_pull_request_reviews;
 // A non-null required_pull_request_reviews object is mandatory even at zero.
 // Missing/null is not a PR gate; ambiguous flags/allowances are not accepted.
 need(review&&typeof review==='object'&&!Array.isArray(review),'MAIN_PR_REQUIRED');
 const bypass=review.bypass_pull_request_allowances;
 need(bypass&&['users','teams','apps'].every(k=>Array.isArray(bypass[k])&&bypass[k].length===0),'MAIN_PR_BYPASS');
 if(g.mode==='SINGLE_OWNER')need(review.required_approving_review_count===0&&review.dismiss_stale_reviews===false&&review.require_last_push_approval===false&&review.require_code_owner_reviews===false,'MAIN_SINGLE_OWNER');
 else need(Number.isInteger(review.required_approving_review_count)&&review.required_approving_review_count>=1&&review.dismiss_stale_reviews===true&&review.require_last_push_approval===true,'MAIN_REVIEW');
 need(p.required_status_checks?.strict===true&&p.required_status_checks.checks?.length===2&&requiredChecks.every(c=>p.required_status_checks.checks.filter(x=>x.context===c&&x.app_id===15368).length===1),'MAIN_CHECKS');
 const reviewers=e.protection_rules?.filter(x=>x.type==='required_reviewers');
 need(e.name===environment&&String(e.id)===policy.environmentId&&e.can_admins_bypass===false&&Array.isArray(e.protection_rules),'ENV_PROTECTION');
 if(g.mode==='SINGLE_OWNER')need(reviewers.length===0,'ENV_SINGLE_OWNER');
 else need(reviewers.length===1&&reviewers[0].prevent_self_review===true&&Array.isArray(reviewers[0].reviewers)&&reviewers[0].reviewers.length===g.reviewerIds.length&&new Set(reviewers[0].reviewers.map(x=>String(x.reviewer?.id))).size===g.reviewerIds.length&&reviewers[0].reviewers.every(x=>x.type==='User'&&g.reviewerIds.includes(String(x.reviewer?.id))),'ENV_REVIEWERS');
 const secrets=await getJSON(root+'/environments/'+encodeURIComponent(environment)+'/secrets?per_page=100');
 need(secrets.total_count===0&&Array.isArray(secrets.secrets)&&secrets.secrets.length===0,'ENV_SECRETS');
 need(e.deployment_branch_policy?.protected_branches===false&&e.deployment_branch_policy?.custom_branch_policies===true&&b.total_count===1&&b.branch_policies?.length===1&&b.branch_policies[0].name==='main'&&b.branch_policies[0].type==='branch','ENV_BRANCH_POLICY');
 await verifyGovernanceAccess({getJSON,root,policy});
 await verifyMergedChecks({getJSON,root,mainSHA:branch.commit.sha});
 return {mainSHA:branch.commit.sha,governanceMode:g.mode,policyVersion:g.policyVersion};
}
export function registeredGithubJobFacts({getJSON,store,policy,privilege,requiredChecks,readPolicyState,now=Date.now}){
 need(typeof getJSON==='function'&&store&&typeof store.load==='function'&&['build','inspection','publication'].includes(privilege),'TRUST_CONFIG');
 const guard=policyGuard(policy,readPolicyState);
 return async selector=>{
  guard();
  for(const k of ['runId','runAttempt','checkRunId'])need(decimal(selector[k]),'JWT_RUN');
  const r=validateJobRegistration(await store.load(selector),policy);
  need(r.privilege===privilege&&!r.revokedAt&&Date.parse(r.expiresAt)>now(),'REGISTRATION_INACTIVE');
  const live=await verifyLiveProtections({getJSON,repository:policy.repository,environment:policy.environment,requiredChecks,policy,expectedCodeSHA:r.codeSHA});
  need(r.codeSHA===live.mainSHA,'STALE_MAIN');
  const root='https://api.github.com/repos/'+policy.repository;
  const run=await getJSON(root+'/actions/runs/'+r.runId);
  const jobs=await getJSON(root+'/actions/runs/'+r.runId+'/attempts/'+r.runAttempt+'/jobs?per_page=100');
  const check=await getJSON(root+'/check-runs/'+r.checkRunId);
  need(jobs.total_count<=100&&jobs.total_count===jobs.jobs?.length,'JOB_LOOKUP_INCOMPLETE');
  const matched=jobs.jobs.filter(j=>String(j.id)===r.jobId&&j.check_run_url===root+'/check-runs/'+r.checkRunId);
  need(matched.length===1,'JOB_LOOKUP');const j=matched[0];
  need(String(run.id)===r.runId&&String(run.run_attempt)===r.runAttempt&&run.head_sha===r.codeSHA&&run.head_branch==='main'&&run.path===r.workflowPath&&String(run.workflow_id)===r.workflowId&&run.event===r.event&&run.status==='in_progress'&&String(run.check_suite_id)===r.checkSuiteId&&run.repository?.full_name===r.repository&&String(run.repository?.id)===r.repositoryId&&String(run.repository?.owner?.id)===r.ownerId&&run.head_repository?.id===run.repository.id,'REGISTERED_RUN');
  need(j.name===r.jobName&&j.status==='in_progress'&&String(j.run_id)===r.runId&&String(j.run_attempt)===r.runAttempt&&j.head_sha===r.codeSHA&&check.status==='in_progress'&&String(check.id)===r.checkRunId&&check.head_sha===r.codeSHA&&String(check.check_suite?.id)===r.checkSuiteId&&check.app?.id===15368,'REGISTERED_JOB');
  guard();
  // workflowSHA is a separately approved registration pin, NOT run.head_sha.
  return {runId:r.runId,runAttempt:r.runAttempt,checkRunId:r.checkRunId,sha:r.codeSHA,workflowSHA:r.workflowSHA,jobName:r.jobName,environment:r.environment,status:j.status,repositoryId:r.repositoryId,ownerId:r.ownerId};
 };
}
export function createProtectedOIDCVerifier({policy,privilege,store,getJSON,requiredChecks,keySource,readPolicyState,now=Date.now}){
 policy=structuredClone(policy);const guard=policyGuard(policy,readPolicyState);
 const verifier=createOIDCVerifier({policy,keySource,now,jobFacts:registeredGithubJobFacts({getJSON,store,policy,privilege,requiredChecks,readPolicyState,now})});
 const capabilities=new WeakMap();
 return Object.freeze({async verify(token){
  guard();const c=await verifier.verify(token);guard();
  // One transaction rechecks registration/revocation/expiry and consumes jti.
  // A lost acknowledgement burns the token; a fresh token is required to retry.
  need(await store.consume({...c,privilege,policySHA256:hashJSON(policy)}),'TOKEN_REVOKED_OR_REPLAYED');
  const protectedCapability=Object.freeze({...c,privilege,policySHA256:hashJSON(policy),governanceMode:policy.governance.mode,policyVersion:policy.governance.policyVersion});
  guard();capabilities.set(protectedCapability,c);return protectedCapability;
 },assert(c){guard();need(capabilities.has(c),'UNVERIFIED_MACHINE');verifier.assert(capabilities.get(c));return c;}});
}
// query belongs to a dedicated broker DB role; no Supabase service key in jobs.
export function postgresIdentityStore({query}){
 return Object.freeze({
  async load(s){const r=(await query('select registration,revoked_at,expires_at from nyra_trust.jobs where run_id=$1 and run_attempt=$2 and check_run_id=$3',[s.runId,s.runAttempt,s.checkRunId])).rows[0];return r?{...r.registration,revokedAt:r.revoked_at,expiresAt:new Date(r.expires_at).toISOString()}:null;},
  async consume(c){const r=await query(`with active as (select * from nyra_trust.jobs
   where run_id=$2 and run_attempt=$3 and check_run_id=$4 and revoked_at is null
   and expires_at>clock_timestamp() and $5::timestamptz>clock_timestamp()
   and registration->>'codeSHA'=$6 and registration->>'privilege'=$7 and policy_sha256=$8
   for share)
   insert into nyra_trust.used_tokens(jti,run_id,run_attempt,check_run_id,expires_at)
   select $1,run_id,run_attempt,check_run_id,$5::timestamptz from active
   on conflict(jti) do nothing returning jti`,[c.jti,c.runId,c.runAttempt,c.checkRunId,c.expiresAt,c.codeSHA,c.privilege,c.policySHA256]);return r.rows.length===1;}
 });
}

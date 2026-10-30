// Trusted control-plane configuration only. No inference from collaborators,
// workflow inputs, JWT claims or editorial payloads. No production policy shipped.
import {TrustError} from './oidc.mjs';
import {hashJSON} from '../contract.mjs';
export const REQUIRED_CHECKS=Object.freeze(['nyra-required-regression','nyra-required-production-build']);
const need=(ok,code)=>{if(!ok)throw new TrustError(code);};
const decimal=v=>typeof v==='string'&&/^[1-9][0-9]{0,19}$/.test(v);
export function validateGovernance(g,ownerId){
 need(decimal(ownerId)&&g?.schema==='nyra.governance.v1'&&['SINGLE_OWNER','OWNER_WITH_REVIEWERS'].includes(g.mode)&&Number.isSafeInteger(g.policyVersion)&&g.policyVersion>0&&g.ownerId===ownerId&&/^[a-f0-9]{40}$/.test(g.ownerAuthorizationSHA),'GOVERNANCE_CONFIG');
 need(Array.isArray(g.reviewerIds)&&new Set(g.reviewerIds).size===g.reviewerIds.length&&g.reviewerIds.every(id=>decimal(id)&&id!==ownerId),'GOVERNANCE_REVIEWERS');
 need(g.mode==='SINGLE_OWNER'?g.reviewerIds.length===0:g.reviewerIds.length>0,'GOVERNANCE_MODE');
 return g;
}
// readPolicyState is an independently authorized, live control-plane reader.
// It must publish monotonic reviewed versions; never bind it to request JSON or
// a frozen startup digest. Missing/unavailable/stale state denies authorization.
export function policyGuard(policy,readPolicyState){
 validateGovernance(policy.governance,policy.ownerId);need(typeof readPolicyState==='function','POLICY_STATE_REQUIRED');
 const digest=hashJSON(policy);
 return ()=>{const s=readPolicyState();need(s&&s.policySHA256===digest&&s.policyVersion===policy.governance.policyVersion&&s.mode===policy.governance.mode&&s.ownerAuthorizationSHA===policy.governance.ownerAuthorizationSHA,'POLICY_RETIRED');return digest;};
}
export async function verifyGovernanceAccess({getJSON,root,policy}){
 const g=validateGovernance(policy.governance,policy.ownerId),repo=await getJSON(root),people=await getJSON(root+'/collaborators?affiliation=all&per_page=100');
 need(repo.full_name===policy.repository&&String(repo.id)===policy.repositoryId&&String(repo.owner?.id)===g.ownerId&&repo.owner?.type==='User','GOVERNANCE_OWNER');
 need(Array.isArray(people)&&people.length<100&&new Set(people.map(p=>p.id)).size===people.length,'GOVERNANCE_ACCESS_INCOMPLETE');
 for(const p of people)if(String(p.id)!==g.ownerId)need(p.permissions?.admin===false&&p.permissions?.maintain===false,'OWNER_ADMIN_AUTHORITY');
 for(const id of g.reviewerIds){const person=people.find(p=>String(p.id)===id);need(person?.type==='User'&&person.permissions?.push===true&&person.permissions?.pull===true,'REVIEWER_INELIGIBLE');}
}
// General CI runs on PR merge revisions, not main pushes. Resolve the merged PR
// for this exact main SHA, then require both latest actual jobs from that PR's
// required-ci.yml run, bound to GitHub Actions. Pages build cannot substitute.
export async function verifyMergedChecks({getJSON,root,mainSHA}){
 const prs=await getJSON(root+'/commits/'+mainSHA+'/pulls?per_page=100');
 need(Array.isArray(prs)&&prs.length<100,'MAIN_PR_EVIDENCE');
 const matches=prs.filter(p=>p.merged_at&&p.merge_commit_sha===mainSHA&&p.base?.ref==='main'&&p.base?.repo?.full_name===root.slice('https://api.github.com/repos/'.length));
 need(matches.length===1,'MAIN_PR_EVIDENCE');const pr=matches[0];
 need(/^[a-f0-9]{40}$/.test(pr.head?.sha)&&pr.head.repo?.id===pr.base.repo?.id,'MAIN_PR_EVIDENCE');
 const runs=await getJSON(root+'/actions/runs?event=pull_request&head_sha='+pr.head.sha+'&per_page=100');
 need(runs.total_count>0&&runs.total_count<100&&runs.total_count===runs.workflow_runs?.length&&runs.workflow_runs.every(r=>Number.isSafeInteger(r.id)&&r.id>0),'MAIN_CHECKS_INCOMPLETE');
 const candidates=runs.workflow_runs.filter(r=>r.path==='.github/workflows/required-ci.yml');need(candidates.length>0,'MAIN_CHECK_MISSING');
 const latest=[...candidates].sort((a,b)=>b.id-a.id)[0];
 const run=await getJSON(root+'/actions/runs/'+latest.id);
 need(run.id===latest.id&&run.path==='.github/workflows/required-ci.yml'&&run.event==='pull_request'&&run.head_sha===pr.head.sha&&run.status==='completed'&&run.conclusion==='success'&&run.repository?.id===pr.base.repo.id&&Number.isSafeInteger(run.run_attempt)&&run.run_attempt>0,'MAIN_CHECK_SOURCE');
 const checks=await getJSON(root+'/commits/'+pr.head.sha+'/check-runs?filter=latest&per_page=100');
 need(checks.total_count<100&&checks.total_count===checks.check_runs?.length,'MAIN_CHECKS_INCOMPLETE');
 for(const name of REQUIRED_CHECKS){
  // GitHub filter=latest still returns duplicate names across check suites.
  // Only the latest run/attempt can supply the required successful checks.
  const matched=checks.check_runs.filter(c=>c.name===name&&c.check_suite?.id===run.check_suite_id);need(matched.length===1,'MAIN_CHECK_MISSING');const c=matched[0];
  need(c.app?.id===15368&&c.head_sha===pr.head.sha&&c.status==='completed'&&c.conclusion==='success','MAIN_CHECK_UNSUCCESSFUL');
  need(c.details_url==='https://github.com/'+pr.base.repo.full_name+'/actions/runs/'+run.id+'/job/'+c.id,'MAIN_CHECK_SOURCE');
  const jobs=await getJSON(root+'/actions/runs/'+run.id+'/attempts/'+run.run_attempt+'/jobs?per_page=100');
  need(jobs.total_count<100&&jobs.total_count===jobs.jobs?.length,'MAIN_CHECKS_INCOMPLETE');
  const j=jobs.jobs.filter(j=>String(j.id)===String(c.id)&&j.name===name);
  need(j.length===1&&j[0].status==='completed'&&j[0].conclusion==='success'&&j[0].head_sha===pr.head.sha&&j[0].run_attempt===run.run_attempt&&j[0].check_run_url===root+'/check-runs/'+c.id,'MAIN_CHECK_SOURCE');
 }
}
// Control-plane preflight only, not an approval endpoint. The owner-authorized
// reviewed manifest and its history must be authenticated by the state provider.
export function validateGovernanceTransition(previous,next){
 validateGovernance(previous,previous?.ownerId);validateGovernance(next,previous.ownerId);
 need(next.policyVersion===previous.policyVersion+1&&next.previousGovernanceSHA256===hashJSON(previous)&&next.ownerAuthorizationSHA!==previous.ownerAuthorizationSHA,'GOVERNANCE_TRANSITION');
 return next;
}

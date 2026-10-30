import test from 'node:test';
import assert from 'node:assert/strict';
import {signedOIDC} from './fixtures/phase4b.mjs';
import {policy,registration,apiFixture,now,readState} from './fixtures/protected-delivery.mjs';
import {createProtectedOIDCVerifier} from '../lib/publication/runtime/protected-identity.mjs';
const signed=await signedOIDC();
function fixture(){const api=apiFixture(),r=registration(),seen=new Set();let revoked=false;
 const store={load:async()=>({...r,revokedAt:revoked?'revoked':null}),consume:async c=>{if(revoked||seen.has(c.jti))return false;seen.add(c.jti);return true;}};
 const v=createProtectedOIDCVerifier({policy,privilege:'inspection',store,getJSON:api.getJSON,readPolicyState:readState(policy),requiredChecks:['nyra-required-regression','nyra-required-production-build'],keySource:async()=>({keys:[signed.jwk]}),now});
 const token=(patch={})=>signed.sign({aud:policy.audience,sub:policy.subject,environment:policy.environment,workflow_ref:policy.workflowRef,workflow_sha:r.workflowSHA,job_workflow_ref:policy.jobWorkflowRef,job_workflow_sha:policy.jobWorkflowSHA,...patch});
 return {v,r,...api,store,token,revoke:()=>{revoked=true;}};
}
test('5C synthetic signed identity matches independently registered workflow SHA, not head SHA',async()=>{const f=fixture(),c=await f.v.verify(await f.token());assert.equal(c.codeSHA,f.r.codeSHA);f.v.assert(c);assert.throws(()=>f.v.assert({...c}),/UNVERIFIED/);});
for(const [claim,value]of Object.entries({iss:'https://evil.invalid',aud:'urn:nyra:publication',sub:'repo:test/repo:environment:github-pages',repository_id:'999',repository_owner_id:'999',repository:'evil/repo',ref:'refs/heads/evil',ref_type:'tag',environment:'github-pages',workflow_ref:'test/repo/.github/workflows/pages.yml@refs/heads/main',workflow_sha:'a'.repeat(40),job_workflow_ref:'test/repo/.github/workflows/pages.yml@refs/heads/main',job_workflow_sha:'d'.repeat(40),sha:'d'.repeat(40),run_id:'101',run_attempt:'2',check_run_id:'301',event_name:'pull_request',runner_environment:'self-hosted',exp:0,iat:Math.floor(now()/1000)+1,nbf:Math.floor(now()/1000)+1}))test('5C signed negative claim '+claim,async()=>{const f=fixture();await assert.rejects(f.v.verify(await f.token({[claim]:value})));});
for(const field of ['codeSHA','workflowSHA','workflowId','checkSuiteId','jobId','jobName','privilege','environment','jobWorkflowSHA','repository','ref','workflowPath'])test('5C registration mismatch '+field,async()=>{const f=fixture();f.r[field]=field.endsWith('SHA')?'d'.repeat(40):'invalid';await assert.rejects(f.v.verify(await f.token({workflow_sha:'c'.repeat(40)})));});
const apiNegatives={
 'unprotected main':d=>d['/branches/main'].protected=false,
 'stale main':d=>d['/branches/main'].commit.sha='d'.repeat(40),
 'admin bypass':d=>d['/branches/main/protection'].enforce_admins.enabled=false,
 'no strict checks':d=>d['/branches/main/protection'].required_status_checks.strict=false,
 'wrong check app':d=>d['/branches/main/protection'].required_status_checks.checks[0].app_id=1,
 'no review':d=>d['/branches/main/protection'].required_pull_request_reviews.required_approving_review_count=0,
 'stale review':d=>d['/branches/main/protection'].required_pull_request_reviews.dismiss_stale_reviews=false,
 'last pusher approval':d=>d['/branches/main/protection'].required_pull_request_reviews.require_last_push_approval=false,
 'environment bypass':d=>d['/environments/nyra-inspection'].can_admins_bypass=true,
 'environment self review':d=>d['/environments/nyra-inspection'].protection_rules[0].prevent_self_review=false,
 'environment wildcard':d=>d['/environments/nyra-inspection/deployment-branch-policies?per_page=100'].branch_policies[0].name='*',
 'environment tag':d=>d['/environments/nyra-inspection/deployment-branch-policies?per_page=100'].branch_policies[0].type='tag',
 'rerun':d=>d['/actions/runs/100'].run_attempt=2,
 'wrong workflow':d=>d['/actions/runs/100'].path='.github/workflows/pages.yml',
 'wrong event':d=>d['/actions/runs/100'].event='pull_request',
 'fork job':d=>d['/actions/runs/100'].head_repository.id=999,
 'incomplete jobs':d=>d['/actions/runs/100/attempts/1/jobs?per_page=100'].total_count=101,
 'wrong job':d=>d['/actions/runs/100/attempts/1/jobs?per_page=100'].jobs[0].id=401,
 'ordinary pages substitution':d=>d['/actions/runs/100/attempts/1/jobs?per_page=100'].jobs[0].name='deploy',
 'terminal job':d=>d['/actions/runs/100/attempts/1/jobs?per_page=100'].jobs[0].status='completed',
 'wrong check suite':d=>d['/check-runs/300'].check_suite.id=601,
 'check app substitution':d=>d['/check-runs/300'].app.id=1
};
for(const [name,mutate]of Object.entries(apiNegatives))test('5C live facts fail closed: '+name,async()=>{const f=fixture();mutate(f.data);await assert.rejects(f.v.verify(await f.token()));});
test('5C revocation, global replay, expired registration and outage deny access',async()=>{
 const f=fixture(),t=await f.token();await f.v.verify(t);await assert.rejects(f.v.verify(t),/REPLAYED/);f.revoke();await assert.rejects(f.v.verify(await f.token({jti:'synthetic-fresh-002'})),/INACTIVE/);
 const expired=fixture();expired.r.expiresAt=new Date(now()-1).toISOString();await assert.rejects(expired.v.verify(await expired.token()),/INACTIVE/);
 const offline=fixture();delete offline.data['/branches/main/protection'];await assert.rejects(offline.v.verify(await offline.token()),/UNAVAILABLE/);
});

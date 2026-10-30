import test from 'node:test';
import assert from 'node:assert/strict';
import {integrationAPI,claims,now} from './fixtures/protected-integration.mjs';
import {governance,readState,addGovernanceEvidence} from './fixtures/protected-delivery.mjs';
import {signedOIDC} from './fixtures/phase4b.mjs';
import {hashJSON} from '../lib/publication/contract.mjs';
import {REQUIRED_CHECKS,validateGovernanceTransition,verifyMergedChecks} from '../lib/publication/runtime/governance.mjs';
import {reviewedDeliveryPolicy} from '../lib/publication/runtime/delivery-policy.mjs';
import {verifyLiveProtections,createProtectedOIDCVerifier} from '../lib/publication/runtime/protected-identity.mjs';
import {createJobRegistrar} from '../lib/publication/runtime/job-registrar.mjs';
import {composeIdentityBroker} from '../lib/publication/integration/protected-composition.mjs';
import {protectedVerifiers} from '../runtime/nyra-edge/integration.mjs';
const fFor=(mode='SINGLE_OWNER')=>{
 const f=integrationAPI();f.configuration.governance=governance('217035723',mode);f.policy=reviewedDeliveryPolicy(f.configuration,'build');
 if(mode==='OWNER_WITH_REVIEWERS'){
  Object.assign(f.data['/branches/main/protection'].required_pull_request_reviews,{required_approving_review_count:1,dismiss_stale_reviews:true,require_last_push_approval:true});
  f.data['/environments/nyra-build'].protection_rules=[{type:'required_reviewers',prevent_self_review:true,reviewers:[{type:'User',reviewer:{id:77}}]}];
 }
 addGovernanceEvidence(f.data,f.policy);f.readPolicyState=readState(f.policy);return f;
};
const verify=f=>verifyLiveProtections({getJSON:f.getJSON,repository:f.policy.repository,environment:f.policy.environment,requiredChecks:REQUIRED_CHECKS,policy:f.policy});
for(const mode of ['SINGLE_OWNER','OWNER_WITH_REVIEWERS'])test('Governance positive protected main / exact Environment: '+mode,async()=>{const f=fFor(mode),r=await verify(f);assert.equal(r.governanceMode,mode);assert.equal(r.policyVersion,1);});
const negatives={
 'unprotected main':f=>f.data['/branches/main'].protected=false,
 'missing PR gate':f=>delete f.data['/branches/main/protection'].required_pull_request_reviews,
 'null PR gate':f=>f.data['/branches/main/protection'].required_pull_request_reviews=null,
 'ambiguous zero approvals':f=>delete f.data['/branches/main/protection'].required_pull_request_reviews.required_approving_review_count,
 'unexpected mandatory review':f=>f.data['/branches/main/protection'].required_pull_request_reviews.required_approving_review_count=1,
 'mandatory last-push approval':f=>f.data['/branches/main/protection'].required_pull_request_reviews.require_last_push_approval=true,
 'mandatory code-owner review':f=>f.data['/branches/main/protection'].required_pull_request_reviews.require_code_owner_reviews=true,
 'admin bypass':f=>f.data['/branches/main/protection'].enforce_admins.enabled=false,
 'PR bypass actor':f=>f.data['/branches/main/protection'].required_pull_request_reviews.bypass_pull_request_allowances.apps.push({id:1}),
 'ambiguous bypass evidence':f=>delete f.data['/branches/main/protection'].required_pull_request_reviews.bypass_pull_request_allowances,
 'force push':f=>f.data['/branches/main/protection'].allow_force_pushes.enabled=true,
 'deletion':f=>f.data['/branches/main/protection'].allow_deletions.enabled=true,
 'unresolved conversations':f=>f.data['/branches/main/protection'].required_conversation_resolution.enabled=false,
 'non-strict CI':f=>f.data['/branches/main/protection'].required_status_checks.strict=false,
 'missing required check':f=>f.data['/branches/main/protection'].required_status_checks.checks.pop(),
 'wrong required-check App':f=>f.data['/branches/main/protection'].required_status_checks.checks[0].app_id=1,
 'duplicate required context':f=>f.data['/branches/main/protection'].required_status_checks.checks[1].context=REQUIRED_CHECKS[0],
 'Environment admin bypass':f=>f.data['/environments/nyra-build'].can_admins_bypass=true,
 'unpinned auto-created Environment':f=>f.data['/environments/nyra-build'].id=701,
 'missing Environment reviewer evidence':f=>delete f.data['/environments/nyra-build'].protection_rules,
 'unexpected Environment reviewer gate':f=>f.data['/environments/nyra-build'].protection_rules=[{type:'required_reviewers',reviewers:[]}],
 'missing Environment branches':f=>delete f.data['/environments/nyra-build'].deployment_branch_policy,
 'wildcard Environment branch':f=>f.data['/environments/nyra-build/deployment-branch-policies?per_page=100'].branch_policies[0].name='*',
 'Environment tag':f=>f.data['/environments/nyra-build/deployment-branch-policies?per_page=100'].branch_policies[0].type='tag',
 'extra Environment branch':f=>f.data['/environments/nyra-build/deployment-branch-policies?per_page=100'].total_count=2,
 'Environment secrets':f=>{f.data['/environments/nyra-build/secrets?per_page=100']={total_count:1,secrets:[{name:'PRIVILEGED'}]};},
 'unknown Environment secrets':f=>delete f.data['/environments/nyra-build/secrets?per_page=100'],
 'other administrator':f=>f.data['/collaborators?affiliation=all&per_page=100'].push({id:77,permissions:{admin:true,maintain:true}}),
 'unknown collaborator privileges':f=>f.data['/collaborators?affiliation=all&per_page=100'].push({id:77}),
 'incorrect repository owner':f=>f.data[''].owner.id=1,
 'missing merged PR':f=>f.data['/commits/'+'a'.repeat(40)+'/pulls?per_page=100']=[],
 'incorrect merged SHA':f=>f.data['/commits/'+'a'.repeat(40)+'/pulls?per_page=100'][0].merge_commit_sha='b'.repeat(40),
 'missing CI check':f=>{const c=f.data['/commits/'+'d'.repeat(40)+'/check-runs?filter=latest&per_page=100'];c.check_runs.pop();c.total_count--;},
 'pending check':f=>f.data['/commits/'+'d'.repeat(40)+'/check-runs?filter=latest&per_page=100'].check_runs[0].status='in_progress',
 'skipped check':f=>f.data['/commits/'+'d'.repeat(40)+'/check-runs?filter=latest&per_page=100'].check_runs[0].conclusion='skipped',
 'neutral check':f=>f.data['/commits/'+'d'.repeat(40)+'/check-runs?filter=latest&per_page=100'].check_runs[0].conclusion='neutral',
 'failed check':f=>f.data['/commits/'+'d'.repeat(40)+'/check-runs?filter=latest&per_page=100'].check_runs[0].conclusion='failure',
 'incorrectly sourced check':f=>f.data['/commits/'+'d'.repeat(40)+'/check-runs?filter=latest&per_page=100'].check_runs[0].app.id=1,
 'ordinary Pages CI source':f=>f.data['/actions/runs/900'].path='.github/workflows/pages.yml',
 'check from another attempt':f=>f.data['/actions/runs/900/attempts/1/jobs?per_page=100'].jobs[0].run_attempt=2,
 'stale successful run behind pending latest':f=>{f.data['/actions/runs?event=pull_request&head_sha='+'d'.repeat(40)+'&per_page=100']={total_count:2,workflow_runs:[{id:900,path:'.github/workflows/required-ci.yml'},{id:902,path:'.github/workflows/required-ci.yml'}]};f.data['/actions/runs/902']={...f.data['/actions/runs/900'],id:902,status:'queued',conclusion:null};}
};
for(const [name,mutate]of Object.entries(negatives))test('Governance SINGLE_OWNER denies '+name,async()=>{const f=fFor();mutate(f);await assert.rejects(verify(f));});
for(const [name,mutate]of Object.entries({
 'zero PR approvals':f=>f.data['/branches/main/protection'].required_pull_request_reviews.required_approving_review_count=0,
 'stale approvals':f=>f.data['/branches/main/protection'].required_pull_request_reviews.dismiss_stale_reviews=false,
 'last-pusher approval':f=>f.data['/branches/main/protection'].required_pull_request_reviews.require_last_push_approval=false,
 'self review':f=>f.data['/environments/nyra-build'].protection_rules[0].prevent_self_review=false,
 'missing Environment review':f=>f.data['/environments/nyra-build'].protection_rules=[],
 'unapproved Environment reviewer':f=>f.data['/environments/nyra-build'].protection_rules[0].reviewers[0].reviewer.id=78,
 'ineligible read-only reviewer':f=>f.data['/collaborators?affiliation=all&per_page=100'][0].permissions.push=false,
 'unaccepted reviewer access':f=>f.data['/collaborators?affiliation=all&per_page=100']=[]
}))test('Governance future reviewer mode denies '+name,async()=>{const f=fFor('OWNER_WITH_REVIEWERS');mutate(f);await assert.rejects(verify(f));});
test('Governance does not change with collaborator count; both modes require explicit policy',async()=>{
 const f=fFor();f.data['/collaborators?affiliation=all&per_page=100'].push({id:77,type:'User',permissions:{admin:false,maintain:false,push:true,pull:true}});assert.equal((await verify(f)).governanceMode,'SINGLE_OWNER');
 const c=structuredClone(f.configuration);delete c.governance;assert.throws(()=>reviewedDeliveryPolicy(c,'build'));
 c.governance={...f.configuration.governance,mode:'AUTO'};assert.throws(()=>reviewedDeliveryPolicy(c,'build'));
});
test('Governance transition requires version, predecessor digest and fresh owner authorization',()=>{
 const a=governance('217035723','SINGLE_OWNER'),b={...governance('217035723'),policyVersion:2,ownerAuthorizationSHA:'e'.repeat(40),previousGovernanceSHA256:hashJSON(a)};
 assert.equal(validateGovernanceTransition(a,b).mode,'OWNER_WITH_REVIEWERS');
 for(const patch of [{policyVersion:1},{policyVersion:3},{ownerAuthorizationSHA:a.ownerAuthorizationSHA},{previousGovernanceSHA256:'0'.repeat(64)},{ownerId:'77'},{reviewerIds:['217035723']}])assert.throws(()=>validateGovernanceTransition(a,{...b,...patch}));
 const back={...a,policyVersion:3,ownerAuthorizationSHA:'c'.repeat(40),previousGovernanceSHA256:hashJSON(b)};assert.equal(validateGovernanceTransition(b,back).mode,'SINGLE_OWNER');
});
test('Governance cannot be substituted by identity configuration, job inputs or JWT claims',async()=>{
 const f=fFor();f.configuration.identities.build.governance=governance('217035723');assert.throws(()=>reviewedDeliveryPolicy(f.configuration,'build'),/GOVERNANCE_SOURCE/);delete f.configuration.identities.build.governance;
 const records=new Map(),registrar=createJobRegistrar({policy:f.policy,privilege:'build',getJSON:f.getJSON,query:async(sql,args)=>records.set(args[2],JSON.parse(args[3])),requiredChecks:REQUIRED_CHECKS,readPolicyState:f.readPolicyState,now});
 await assert.rejects(registrar.register({runId:'100',runAttempt:'1',governanceMode:'OWNER_WITH_REVIEWERS'}),/REGISTRAR_FIELDS/);assert.equal(records.size,0);
 await registrar.register({runId:'100',runAttempt:'1'});const r=records.get('300'),signed=await signedOIDC(),verifier=createProtectedOIDCVerifier({policy:f.policy,privilege:'build',getJSON:f.getJSON,requiredChecks:REQUIRED_CHECKS,readPolicyState:f.readPolicyState,now,keySource:async()=>({keys:[signed.jwk]}),store:{load:async()=>r,consume:async()=>true}});
 const c=await verifier.verify(await signed.sign({...claims(f.policy),governanceMode:'OWNER_WITH_REVIEWERS',policyVersion:999,governance:{mode:'OWNER_WITH_REVIEWERS'}}));
 assert.equal(c.governanceMode,'SINGLE_OWNER');assert.equal(c.policyVersion,1);assert.equal(c.policySHA256,hashJSON(f.policy));
});
test('Governance policy retirement invalidates registrations, grants and Pages capabilities',async()=>{
 const f=fFor(),signed=await signedOIDC();let state=f.readPolicyState(),row;
 const readPolicyState=()=>state,registrar=createJobRegistrar({policy:f.policy,privilege:'build',getJSON:f.getJSON,requiredChecks:REQUIRED_CHECKS,readPolicyState,now,query:async(sql,args)=>{if(sql.startsWith('insert'))row=JSON.parse(args[3]);}});
 await registrar.register({runId:'100',runAttempt:'1'});
 const query=async(sql,args)=>sql.startsWith('select registration')?{rows:[{registration:row,expires_at:new Date(now()+300000),revoked_at:null}]}:{rows:[{jti:args[0]}]};
 const broker=composeIdentityBroker({configuration:f.configuration,privilege:'build',getJSON:f.getJSON,brokerQuery:query,keySource:async()=>({keys:[signed.jwk]}),readPolicyState,now});
 const token=await signed.sign(claims(f.policy)),grant=await broker.authorize(token);broker.verifier.assert(await broker.verifier.verify(await signed.sign({...claims(f.policy),jti:'synthetic-governance-fresh'})));
 const pf=integrationAPI('publication');let publicationRow,ps=pf.readPolicyState();
 await createJobRegistrar({policy:pf.policy,privilege:'publication',getJSON:pf.getJSON,requiredChecks:REQUIRED_CHECKS,readPolicyState:()=>ps,now,query:async(sql,args)=>{publicationRow=JSON.parse(args[3]);}}).register({runId:'100',runAttempt:'1'});
 const pages=protectedVerifiers({policy:pf.policy,pagesAudience:'urn:nyra:pages',getJSON:pf.getJSON,keySource:async()=>({keys:[signed.jwk]}),store:{load:async()=>publicationRow},requiredChecks:REQUIRED_CHECKS,readPolicyState:()=>ps,now});
 const pageCap=await pages.pagesVerifier.verify(await signed.sign({...claims(pf.policy),aud:'urn:nyra:pages'}));pages.pagesVerifier.assert(pageCap);
 ps={...ps,policyVersion:2};const oldDigest=state.policySHA256;state={...state,mode:'OWNER_WITH_REVIEWERS',policyVersion:2,policySHA256:'0'.repeat(64)};
 await assert.rejects(broker.authorize(await signed.sign({...claims(f.policy),jti:'synthetic-governance-next'})),/POLICY_RETIRED/);await assert.rejects(broker.revalidate(grant),/POLICY_RETIRED/);assert.throws(()=>pages.pagesVerifier.assert(pageCap),/POLICY_RETIRED/);
 await assert.rejects(registrar.register({runId:'100',runAttempt:'1'}),/POLICY_RETIRED/);
 // A new process with a different policy rejects the old immutable registration
 // before API or token consumption, even when live state blesses the new policy.
 const next=fFor('OWNER_WITH_REVIEWERS');next.policy={...next.policy,governance:{...next.policy.governance,policyVersion:2,ownerAuthorizationSHA:'e'.repeat(40)}};
 assert.notEqual(hashJSON(next.policy),oldDigest);
 const v=createProtectedOIDCVerifier({policy:next.policy,privilege:'build',getJSON:next.getJSON,requiredChecks:REQUIRED_CHECKS,readPolicyState:readState(next.policy),now,keySource:async()=>({keys:[signed.jwk]}),store:{load:async()=>row,consume:async()=>assert.fail('old registration consumed')}});
 await assert.rejects(v.verify(await signed.sign({...claims(next.policy),jti:'synthetic-cross-mode'})),/REGISTRATION_GOVERNANCE/);
});
test('Governance required-CI correlation accepts real API quirks without counting stale suites',async()=>{
 const f=fFor(),checks=f.data['/commits/'+'d'.repeat(40)+'/check-runs?filter=latest&per_page=100'];
 checks.check_runs.push(...checks.check_runs.map(c=>({...c,id:c.id+100,check_suite:{id:800},conclusion:'failure'})));checks.total_count=4;
 f.data['/actions/runs/900'].pull_requests=[];await verify(f);
});
test('Governance missing live policy state has no permissive fallback',()=>{
 const f=fFor();assert.throws(()=>composeIdentityBroker({configuration:f.configuration,privilege:'build',getJSON:f.getJSON,brokerQuery:async()=>({rows:[]})}),/POLICY_STATE_REQUIRED/);
});
test('Governance inventory authority rejects cross-mode records and in-flight retirement',async()=>{
 const f=integrationAPI('publication');let state=f.readPolicyState(),record={schema_version:'nyra.normal.provenance.v1',inventory:{schema_version:'nyra.public.paths.v1',codeSHA:'a'.repeat(40),configurationSHA256:'b'.repeat(64),paths:['index.html']},builder:{privilege:'build',assurance:'protected_oidc',codeSHA:'a'.repeat(40),workflowSHA:'a'.repeat(40),jobWorkflowSHA:'b'.repeat(40),governance:f.policy.governance},files:[{path:'index.html',sha256:'c'.repeat(64),bytes:10}]};let retire=false;
 const broker=composeIdentityBroker({configuration:f.configuration,privilege:'publication',getJSON:f.getJSON,readPolicyState:()=>state,brokerQuery:async()=>{if(retire)state={...state,policyVersion:2};return {rows:[{record,digest:hashJSON(record)}]};}}),authority=broker.inventoryAuthority('b'.repeat(64));
 assert.equal((await authority.forAttempt({codeSHA:'a'.repeat(40)})).codeSHA,'a'.repeat(40));record={...record,builder:{...record.builder,governance:governance('217035723')}};
 await assert.rejects(authority.forAttempt({codeSHA:'a'.repeat(40)}),/INVENTORY_GOVERNANCE/);record.builder.governance=f.policy.governance;retire=true;await assert.rejects(authority.forAttempt({codeSHA:'a'.repeat(40)}),/POLICY_RETIRED/);
});

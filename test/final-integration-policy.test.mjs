import test from 'node:test';
import assert from 'node:assert/strict';
import {reviewedIntegrationPolicy} from '../lib/publication/integration/policy.mjs';
import {reviewedDeliveryPolicy} from '../lib/publication/runtime/delivery-policy.mjs';
import {requestProtectedJob} from '../ops/protected-delivery/workflow-request.mjs';
import {integrationConfiguration} from './fixtures/final-integration.mjs';
import {configuration} from './fixtures/protected-integration.mjs';
for(const role of ['build','inspection','publication'])test('Explicit integration '+role+' policy pins role/job/caller/events; v1 cannot silently satisfy v2',()=>{
 const c=integrationConfiguration(),p=reviewedIntegrationPolicy(c,role);assert.equal(p.environment,'nyra-'+role);assert.deepEqual(p.events,['push','workflow_dispatch']);
 assert.throws(()=>reviewedIntegrationPolicy(configuration(),role));assert.throws(()=>reviewedDeliveryPolicy(c,role));
 for(const change of [x=>x.identities[role].environment='github-pages',x=>x.identities[role].subject+='*',x=>x.identities[role].subject='repo:Noctua76@217035723/eliaskalyvas-website@1389733212:',x=>x.identities[role].jobWorkflowSHA='main',x=>x.identities[role].jobName='ordinary-pages',x=>x.identities[role].workflowRef=x.identities[role].workflowRef.replace('pages-orchestrator','nyra-protected-caller'),x=>x.acceptance.acceptedEvents=['workflow_dispatch'],x=>x.identities[role].events=['pull_request'],x=>x.identities[role].repositoryId='1']){const altered=structuredClone(c);change(altered);assert.throws(()=>reviewedIntegrationPolicy(altered,role));}
});
test('Only a separately accepted integration policy permits normal protected push; old policy retains dispatch-only boundary',async()=>{
 const c=integrationConfiguration(),p=reviewedIntegrationPolicy(c,'build'),env={GITHUB_REPOSITORY:p.repository,GITHUB_REF:p.ref,GITHUB_SHA:p.callerSHA,GITHUB_EVENT_NAME:'push',RUNNER_ENVIRONMENT:'github-hosted',ACTIONS_ID_TOKEN_REQUEST_URL:'https://unit.actions.githubusercontent.com/token',ACTIONS_ID_TOKEN_REQUEST_TOKEN:'UNIT_ONLY'},calls=[];
 const fetcher=async(url,args)=>{calls.push({url,args});return Response.json(calls.length===1?{value:'UNIT_JWT'}:{});};
 assert.equal((await requestProtectedJob({configuration:c,privilege:'build',env,fetcher})).accepted,true);assert.equal(calls[1].args.body,'{}');
 await assert.rejects(requestProtectedJob({configuration:configuration(),privilege:'build',env,fetcher}));assert.equal(calls.length,2);
});

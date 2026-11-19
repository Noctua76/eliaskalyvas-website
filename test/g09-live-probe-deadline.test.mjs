import test from 'node:test';
import assert from 'node:assert/strict';
import {probeIdentity} from '../ops/protected-delivery/live-probe.mjs';
const plan={purpose:'isolated-live-trust-acceptance',publicEvidenceKeyId:'synthetic-public-evidence-key',approved:true,origin:'https://synthetic-nyra.invalid/'};
const environment={GITHUB_REPOSITORY:'Noctua76/eliaskalyvas-website',GITHUB_REPOSITORY_ID:'1389733212',GITHUB_REPOSITORY_OWNER_ID:'217035723',GITHUB_REF:'refs/heads/main',GITHUB_REF_PROTECTED:'true',GITHUB_EVENT_NAME:'workflow_dispatch',RUNNER_ENVIRONMENT:'github-hosted',GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',ACTIONS_ID_TOKEN_REQUEST_URL:'https://synthetic.actions.githubusercontent.com/token',ACTIONS_ID_TOKEN_REQUEST_TOKEN:'synthetic-noncredential'};
function fixture({readyAfter=1,responseMillis=0,failReady=false,lateReady=false,badAck=false,token='synthetic-not-a-real-token',tokenOK=true,acceptOK=true,failToken=false,failAccept=false,ackOverride=null,bodyMillis=0}={}){
 let milliseconds=0,readyCalls=0,tokenCalls=0,acceptCalls=0;
 const fetcher=async(url,options)=>{
  assert.ok(options.signal instanceof AbortSignal);
  if(url.pathname.startsWith('/ready/')){
   readyCalls++;milliseconds+=responseMillis;
   if(failReady)throw Error('SYNTHETIC_READINESS_TIMEOUT');
   if(lateReady)milliseconds=30001;
   return {ok:true,json:async()=>{milliseconds+=bodyMillis;return {ready:readyCalls>=readyAfter};}};
  }
  if(url.hostname.endsWith('.actions.githubusercontent.com')){tokenCalls++;assert.equal(url.searchParams.get('audience'),'urn:nyra:acceptance:build');if(failToken)throw Object.assign(Error('SYNTHETIC_OIDC_TIMEOUT'),{name:'TimeoutError'});return {ok:tokenOK,json:async()=>({value:token})};}
  acceptCalls++;assert.equal(url.pathname,'/acceptance/build');if(failAccept)throw Object.assign(Error('SYNTHETIC_POST_TIMEOUT'),{name:'TimeoutError'});return {ok:acceptOK,json:async()=>ackOverride??({accepted:true,keyId:plan.publicEvidenceKeyId,digest:badAck?'invalid':'a'.repeat(64)})};
 };
 return {fetcher,now:()=>milliseconds,wait:async ms=>{milliseconds+=ms;},counts:()=>({milliseconds,readyCalls,tokenCalls,acceptCalls})};
}
test('Immediate readiness retains OIDC and signed-evidence acknowledgment checks',async()=>{
 const f=fixture();const r=await probeIdentity({privilege:'build',plan,env:environment,...f});assert.equal(r.authorization,false);assert.equal(r.evidenceDigest,'a'.repeat(64));assert.equal(f.counts().tokenCalls,1);assert.equal(f.counts().acceptCalls,1);
});
test('Slow negative responses stop before token acquisition at the total readiness deadline',async()=>{
 const f=fixture({readyAfter:30,responseMillis:10000});await assert.rejects(probeIdentity({privilege:'build',plan,env:environment,...f}));assert.equal(f.counts().readyCalls,3);assert.equal(f.counts().tokenCalls,0);assert.equal(f.counts().acceptCalls,0);
});
test('A ready response that arrives after the deadline is rejected without OIDC',async()=>{
 const f=fixture({lateReady:true});await assert.rejects(probeIdentity({privilege:'build',plan,env:environment,...f}));assert.equal(f.counts().tokenCalls,0);
});
test('Fast false responses retain the normal readiness polling opportunity',async()=>{
 const f=fixture({readyAfter:25});await probeIdentity({privilege:'build',plan,env:environment,...f});assert.equal(f.counts().readyCalls,25);assert.equal(f.counts().milliseconds,24000);
});
test('Readiness network failure remains fail closed without token or acceptance call',async()=>{
 const f=fixture({failReady:true});await assert.rejects(probeIdentity({privilege:'build',plan,env:environment,...f}));assert.equal(f.counts().tokenCalls,0);assert.equal(f.counts().acceptCalls,0);
});
test('Unprotected ref is rejected before any network call',async()=>{
 const f=fixture();await assert.rejects(probeIdentity({privilege:'build',plan,env:{...environment,GITHUB_REF_PROTECTED:'false'},...f}));assert.equal(f.counts().readyCalls,0);
});
test('Missing approved plan is rejected before any network call',async()=>{
 const f=fixture();await assert.rejects(probeIdentity({privilege:'build',plan:{...plan,approved:false},env:environment,...f}));assert.equal(f.counts().readyCalls,0);
});
test('Invalid acknowledgment still cannot produce acceptance',async()=>{
 const f=fixture({badAck:true});await assert.rejects(probeIdentity({privilege:'build',plan,env:environment,...f}));
});
test('The final readiness request is bounded by the remaining phase deadline',async t=>{
 const timeouts=[];const real=AbortSignal.timeout;t.mock.method(AbortSignal,'timeout',ms=>{timeouts.push(ms);return real(ms);});
 const f=fixture({readyAfter:30,responseMillis:10000});await assert.rejects(probeIdentity({privilege:'build',plan,env:environment,...f}));assert.deepEqual(timeouts,[10000,10000,8000]);assert.equal(f.counts().tokenCalls,0);
});
test('JSON body time counts toward readiness and a late body cannot acquire OIDC',async()=>{
 const f=fixture({bodyMillis:30001});await assert.rejects(probeIdentity({privilege:'build',plan,env:environment,...f}));assert.equal(f.counts().tokenCalls,0);
});
test('OIDC and acceptance keep their separate 10-second and 60-second signals',async t=>{
 const timeouts=[];const real=AbortSignal.timeout;t.mock.method(AbortSignal,'timeout',ms=>{timeouts.push(ms);return real(ms);});
 const f=fixture();await probeIdentity({privilege:'build',plan,env:environment,...f});assert.deepEqual(timeouts,[10000,10000,60000]);
});
test('OIDC timeout is fail closed and never retried or followed by POST',async()=>{
 const f=fixture({failToken:true});await assert.rejects(probeIdentity({privilege:'build',plan,env:environment,...f}));assert.equal(f.counts().tokenCalls,1);assert.equal(f.counts().acceptCalls,0);
});
test('Acceptance timeout preserves uncertain outcome without a retry',async()=>{
 const f=fixture({failAccept:true});await assert.rejects(probeIdentity({privilege:'build',plan,env:environment,...f}));assert.equal(f.counts().acceptCalls,1);
});
test('OIDC and acceptance HTTP denials remain fail closed',async()=>{
 for(const options of [{tokenOK:false},{acceptOK:false}]){const f=fixture(options);await assert.rejects(probeIdentity({privilege:'build',plan,env:environment,...f}));assert.ok(f.counts().tokenCalls<=1&&f.counts().acceptCalls<=1);}
});
test('Empty, whitespace, oversized and non-string OIDC values never reach POST',async()=>{
 for(const token of ['', ' ', 'synthetic token', '\n', 'x'.repeat(20000), null, [], 42]){const f=fixture({token});await assert.rejects(probeIdentity({privilege:'build',plan,env:environment,...f}));assert.equal(f.counts().acceptCalls,0);}
});
test('Acknowledgment digest must be a string; an array is not coerced',async()=>{
 for(const digest of [['a'.repeat(64)],null,42,{}]){const f=fixture({ackOverride:{accepted:true,keyId:plan.publicEvidenceKeyId,digest}});await assert.rejects(probeIdentity({privilege:'build',plan,env:environment,...f}));assert.equal(f.counts().acceptCalls,1);}
});
test('Non-string public evidence key cannot authorize any network request',async()=>{
 for(const key of [true,[],{},1,'']){const f=fixture();await assert.rejects(probeIdentity({privilege:'build',plan:{...plan,publicEvidenceKeyId:key},env:environment,...f}));assert.equal(f.counts().readyCalls,0);}
});
test('Wrong acknowledgment key or acceptance flag never produces a result',async()=>{
 for(const ackOverride of [{accepted:true,keyId:'different',digest:'a'.repeat(64)},{accepted:false,keyId:plan.publicEvidenceKeyId,digest:'a'.repeat(64)}]){const f=fixture({ackOverride});await assert.rejects(probeIdentity({privilege:'build',plan,env:environment,...f}));}
});
test('Untrusted OIDC request host is rejected before token retrieval',async()=>{
 const f=fixture();await assert.rejects(probeIdentity({privilege:'build',plan,env:{...environment,ACTIONS_ID_TOKEN_REQUEST_URL:'https://synthetic-untrusted.invalid/token'},...f}));assert.equal(f.counts().tokenCalls,0);assert.equal(f.counts().acceptCalls,0);
});
test('Invalid run identifiers and protected context fail before the readiness call',async()=>{
 for(const changes of [{GITHUB_RUN_ID:'0'},{GITHUB_RUN_ATTEMPT:'0'},{RUNNER_ENVIRONMENT:'self-hosted'},{GITHUB_EVENT_NAME:'pull_request'},{GITHUB_REPOSITORY_OWNER_ID:'1'}]){const f=fixture();await assert.rejects(probeIdentity({privilege:'build',plan,env:{...environment,...changes},...f}));assert.equal(f.counts().readyCalls,0);}
});
test('Invalid origin fails before any network call',async()=>{
 for(const origin of ['http://synthetic.invalid/','https://user@synthetic.invalid/','https://synthetic.invalid/path','https://synthetic.invalid/#fragment']){const f=fixture();await assert.rejects(probeIdentity({privilege:'build',plan:{...plan,origin},env:environment,...f}));assert.equal(f.counts().readyCalls,0);}
});

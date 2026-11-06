import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateReplacementTarget,CONTINUATION_HOST_MS} from '../ops/acceptance-bootstrap/replacement-target.mjs';
import {renderUbuntuSetup,renderCanonicalExpiryTimer,renderCanonicalExpiryService} from '../ops/acceptance-bootstrap/offline-bootstrap.mjs';
import {validateLauncherSession,validateLauncherRenewal} from '../ops/acceptance-bootstrap/repository-launch.mjs';
import {replacementRoleExpiry,replacementRenewalWindow,replacementRenewalSQL} from '../ops/acceptance-bootstrap/repository-db.mjs';
const created='2026-11-06T09:00:00Z',expiry='2026-11-20T09:00:00Z';
const target=()=>({schema:'nyra.acceptance.replacement.v2',bootstrapId:'nyra-acceptance-20261106-02',hostname:'nyra-acceptance-20261106-02',provider:'DigitalOcean',region:'fra1',origin:'https://nyra-acceptance.eliaskalyvas.gr',operatorCIDRs:['203.0.113.10/32'],cpu:4,memoryGiB:8,maximumHours:336,optionalResources:false,reviewedHead:'29a73458d4cd941e5ed514db56dc2c553d041bda',resourceId:'615221105',ipv4:'93.184.216.34',createdAt:created,expiresAt:expiry,authorization:false});
const now=()=>Date.parse(created)+1000;
test('v2 accepts exactly 14 days from source-created UTC, never authorizes',()=>{
 const t=target();assert.equal(CONTINUATION_HOST_MS,1209600000);
 assert.equal(Date.parse(t.expiresAt)-Date.parse(t.createdAt),CONTINUATION_HOST_MS);
 const result=validateReplacementTarget(t,{created:true,now});assert.equal(result.authorization,false);
 assert.equal(result.liveAcceptance,false);
});
test('day three is a goal, not host expiry or runtime retirement',()=>{
 const t=target();assert.equal(validateReplacementTarget(t,{created:true,now:()=>Date.parse(created)+4*86400000}).created,true);
});
test('v2 refuses 24h host, 21-day host, retired ID, altered owner baseline and unauthorized target',()=>{
 for(const mutate of [
  t=>t.maximumHours=24,t=>t.expiresAt='2026-11-07T09:00:00Z',
  t=>t.expiresAt='2026-11-27T09:00:00Z',
  t=>t.resourceId='615221104',t=>t.bootstrapId='nyra-acceptance-20261102-01',
  t=>t.reviewedHead='1dbeb46c4ad7ac39dfc313bf47361bf2868e50ee',
  t=>t.authorization=true,t=>t.createdAt='2026-11-06T09:00:00+00:00',
  t=>{t.createdAt='2026-11-06T09:00:00.123Z';t.expiresAt='2026-11-20T09:00:00.123Z';}
 ]){const t=target();mutate(t);assert.throws(()=>validateReplacementTarget(t,{created:true,now}));}
});
test('real generated installer distinguishes v2 14d and v1 24h',()=>{
 const t=target();for(const k of ['resourceId','ipv4','createdAt','expiresAt'])t[k]=null;
 const lock=JSON.parse(readFileSync(new URL('../ops/acceptance-bootstrap/prerequisites.lock.json',import.meta.url),'utf8'));
 const script=renderUbuntuSetup(t,lock);
 assert.match(script,/1209600/);assert.match(script,/start.microsecond==0 and end.microsecond==0/);assert.match(script,/nyra-repository-expiry.timer/);
 assert.match(script,/expiry\.timer\.template/);assert.match(script,/\/usr\/local\/bin\/node/);
 const timer=renderCanonicalExpiryTimer();assert.match(timer,/^Persistent=true$/m);assert.match(timer,/^AccuracySec=1s$/m);
 assert.match(timer,/^Unit=nyra-repository-expiry\.service$/m);assert.match(renderCanonicalExpiryService(),/^AssertPathExists=\/usr\/local\/sbin\/nyra-repository-expire$/m);
});

test('v2 launcher validates independent 24h session before starting private runtime',()=>{
 const t=target(),start=Date.parse(created);
 const valid={startsAt:new Date(start+86400000).toISOString(),endsAt:new Date(start+2*86400000).toISOString(),authorization:false};
 const at=()=>start+86400000+1000;
 const r=validateLauncherSession(t,valid,{now:at});assert.equal(r.end,valid.endsAt);
 for(const bad of [
  null,{...valid,authorization:true},{...valid,endsAt:new Date(start+3*86400000).toISOString()},
  {...valid,endsAt:new Date(start+15*86400000).toISOString()},
  {...valid,startsAt:new Date(start-1000).toISOString()},
  {...valid,endsAt:valid.startsAt},{...valid,extra:true},
  {...valid,startsAt:'2026-11-07T09:00:00+00:00'},
  {...valid,endsAt:'2026-11-08T09:00:00'}
 ])assert.throws(()=>validateLauncherSession(t,bad,{now:at}),/REPLACEMENT_LAUNCH_/);
});

test('v2 PostgreSQL credentials expire within 24h, never at 14-day host retirement',()=>{
 const t=target(),start=Date.parse(created);
 const soon=replacementRoleExpiry(t,{now:()=>start+1000});
 assert.equal(soon,new Date(start+1000+86400000).toISOString());
 assert.notEqual(soon,new Date(Date.parse(t.expiresAt)).toISOString());
 const late=replacementRoleExpiry(t,{now:()=>Date.parse(expiry)-3600000});
 assert.equal(late,new Date(Date.parse(expiry)).toISOString());
 assert.throws(()=>replacementRoleExpiry(t,{now:()=>Date.parse(expiry)+1}),/REPLACEMENT_DEADLINE/);
});

test('later PostgreSQL renewal is bound to one non-authorizing session and cannot gain 14-day standing login',()=>{
 const t=target(),day=86400000,begin=Date.parse(created)+2*day;
 const session={schema:'nyra.acceptance.pg-session.v1',bootstrapId:t.bootstrapId,
  providerResourceId:t.resourceId,sessionId:'d7df28d6-04c1-4b34-a32a-076c6d5be033',
  startsAt:new Date(begin).toISOString(),endsAt:new Date(begin+day).toISOString(),authorization:false};
 const current=()=>begin+1000;
 const v=replacementRenewalWindow(t,session,{now:current});
 assert.equal(v.roleValidUntil,session.endsAt);
 assert.equal(v.authorized,false);
 assert.notEqual(v.roleValidUntil,t.expiresAt);
 for(const mutate of [
  x=>x.authorization=true,
  x=>x.providerResourceId='615221104',
  x=>x.bootstrapId='nyra-acceptance-20261102-01',
  x=>x.sessionId='anonymous',
  x=>x.endsAt=new Date(begin+2*day).toISOString(),
  x=>x.endsAt=t.expiresAt,
  x=>x.startsAt=new Date(begin+2000).toISOString(),
  x=>x.extra='untrusted',
  x=>x.endsAt='2026-11-09T09:00:00+00:00'
 ]){const bad={...session};mutate(bad);assert.throws(()=>replacementRenewalWindow(t,bad,{now:current}),/DB_RENEWAL_/);}
 assert.throws(()=>replacementRenewalWindow(t,session,{now:()=>begin+day}),/DB_RENEWAL_WINDOW/);
});

test('scoped PostgreSQL renewal SQL rotates both role passwords, disconnects old sessions and reads UTC validity',()=>{
 const t=target(),day=86400000,begin=Date.parse(created)+2*day;
 const session={schema:'nyra.acceptance.pg-session.v1',bootstrapId:t.bootstrapId,providerResourceId:t.resourceId,
  sessionId:'d7df28d6-04c1-4b34-a32a-076c6d5be033',startsAt:new Date(begin).toISOString(),
  endsAt:new Date(begin+day).toISOString(),authorization:false};
 const lease=replacementRenewalWindow(t,session,{now:()=>begin+1000});
 const sql=replacementRenewalSQL(lease,{registrar:'a'.repeat(48),broker:'b'.repeat(48)});
 assert.match(sql,/^BEGIN;\n/);
 assert.match(sql,/ALTER ROLE nyra_accept_registrar PASSWORD/);
 assert.match(sql,/ALTER ROLE nyra_accept_broker PASSWORD/);
 assert.equal((sql.match(/VALID UNTIL/g)||[]).length,2);
 assert.match(sql,/pg_terminate_backend/);
 assert.match(sql,/FROM pg_authid/);
 assert.match(sql,/COMMIT;\nSELECT rolname/);
 assert(!sql.includes(t.expiresAt));
 assert.throws(()=>replacementRenewalSQL({...lease,authorized:true},{registrar:'a'.repeat(48),broker:'b'.repeat(48)}),/DB_RENEWAL_SQL_SCOPE/);
 assert.throws(()=>replacementRenewalSQL(lease,{registrar:"a' OR 1=1",broker:'b'.repeat(48)}),/DB_RENEWAL_SQL_SCOPE/);
});

test('v2 launcher requires committed session-bound DB renewal after first bootstrap lease',()=>{
 const target=target(); const now=Date.parse(target.createdAt)+2*86400000;
 const window={start:new Date(now).toISOString(),end:new Date(now+3600000).toISOString()};
 assert.throws(()=>validateLauncherRenewal(target,window,null,{now:()=>now}),/DB_RENEWAL_REQUIRED/);
 const state={schema:'nyra.acceptance.db-renewal-state.v1',bootstrapId:target.bootstrapId,sessionId:'a1b2c3d4-1111-4111-8111-222222222222',startsAt:window.start,endsAt:window.end,roleValidUntil:window.end,status:'complete'};
 assert.equal(validateLauncherRenewal(target,window,state,{now:()=>now}),true);
 for(const x of [{...state,status:'db-updated'},{...state,endsAt:new Date(now+7200000).toISOString()},{...state,roleValidUntil:new Date(now-1).toISOString()}])
  assert.throws(()=>validateLauncherRenewal(target,window,x,{now:()=>now}),/DB_RENEWAL_JOURNAL/);
});

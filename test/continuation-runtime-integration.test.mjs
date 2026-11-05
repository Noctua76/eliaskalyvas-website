import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {validateReplacementTarget,CONTINUATION_HOST_MS} from '../ops/acceptance-bootstrap/replacement-target.mjs';
import {renderUbuntuSetup,renderCanonicalExpiryTimer,renderCanonicalExpiryService} from '../ops/acceptance-bootstrap/offline-bootstrap.mjs';
import {validateLauncherSession} from '../ops/acceptance-bootstrap/repository-launch.mjs';
import {replacementRoleExpiry} from '../ops/acceptance-bootstrap/repository-db.mjs';
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

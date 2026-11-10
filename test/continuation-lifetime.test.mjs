import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeLifetime,validateSession,proposeExtension} from '../ops/acceptance-bootstrap/continuation-lifetime.mjs';
const start='2026-11-06T09:00:00.000Z',day=86400000;
const proposal=()=>proposeLifetime({bootstrapId:'nyra-acceptance-20261106-02',createdAt:start,now:()=>Date.parse(start)-1});
const at=x=>new Date(Date.parse(start)+x*day).toISOString();
test('14d proposal deterministically pins 3d goal and day10 extension decision',()=>{
 const a=proposal(),b=proposal();assert.deepEqual(a,b);
 assert.equal(a.executionGoalAt,at(3));assert.equal(a.extensionDecisionAt,at(10));assert.equal(a.expiresAt,at(14));assert.equal(a.authorization,false);
});
test('reject old host, backdating and a malformed timestamp',()=>{
 assert.throws(()=>proposeLifetime({bootstrapId:'nyra-acceptance-20261102-01',createdAt:start,now:()=>0}),/LIFETIME_NEW_HOST/);
 assert.throws(()=>proposeLifetime({bootstrapId:'nyra-acceptance-20261106-02',createdAt:start,now:()=>Date.parse(start)+1}),/LIFETIME_START/);
 assert.throws(()=>proposeLifetime({bootstrapId:'nyra-acceptance-20261106-02',createdAt:'2026-11-06T09:00:00Z',now:()=>0}),/LIFETIME_START/);
});
test('new short-lived session stays within 24h even when host lasts 14d',()=>{
 const p=proposal();const r=validateSession({lifetime:p,sessionStart:at(2),sessionEnd:at(3),now:()=>Date.parse(at(2))+1});assert.equal(r.authorization,false);
 assert.throws(()=>validateSession({lifetime:p,sessionStart:at(2),sessionEnd:at(4),now:()=>Date.parse(at(2))+1}),/LIFETIME_SESSION_WINDOW/);
 assert.throws(()=>validateSession({lifetime:p,sessionStart:at(13),sessionEnd:at(15),now:()=>Date.parse(at(13))+1}),/LIFETIME_SESSION_WINDOW/);
 assert.throws(()=>validateSession({lifetime:{...p,expiresAt:at(21)},sessionStart:at(2),sessionEnd:at(3),now:()=>Date.parse(at(2))+1}),/LIFETIME_HOST_WINDOW/);
});
test('7d extension is only a proposal after separate owner decision and day10',()=>{
 const p=proposal();assert.throws(()=>proposeExtension({lifetime:p,decisionAt:at(10)}),/LIFETIME_SEPARATE_OWNER_DECISION_REQUIRED/);
 assert.throws(()=>proposeExtension({lifetime:p,decisionAt:at(9),ownerApproved:true}),/LIFETIME_DECISION_WINDOW/);
 assert.throws(()=>proposeExtension({lifetime:p,decisionAt:at(13),ownerApproved:true}),/LIFETIME_DECISION_WINDOW/);
 const e=proposeExtension({lifetime:p,decisionAt:at(10),ownerApproved:true});assert.equal(e.proposedExpiresAt,at(21));assert.equal(e.executionApproved,false);assert.equal(e.authorization,false);
});

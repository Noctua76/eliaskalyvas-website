import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeLifetime} from '../ops/acceptance-bootstrap/continuation-lifetime.mjs';
import {proposeWatcherSession} from '../ops/acceptance-bootstrap/continuation-watcher-session.mjs';
const start='2026-11-06T09:00:00.000Z',DAY=86400000;
const at=days=>new Date(Date.parse(start)+days*DAY).toISOString();
const host=()=>proposeLifetime({bootstrapId:'nyra-acceptance-20261106-02',createdAt:start,now:()=>Date.parse(start)-1});
const source='29a73458d4cd941e5ed514db56dc2c553d041bda';
const session=(overrides={})=>({lifetime:host(),sessionStartsAt:at(2),sessionEndsAt:at(3),sourceSHA:source,now:()=>Date.parse(at(2))+60000,...overrides});
test('14-day host permits an independently bounded 24-hour watcher proposal, without authority',()=>{
 const x=proposeWatcherSession(session());
 assert.equal(x.windowEndsAt,at(3));assert.equal(x.hostProposalSHA256,host().proposalSHA256);
 assert.equal(x.authorization,false);assert.equal(x.dispatchAllowed,false);assert.equal(x.registrationAllowed,false);
});
test('watcher refuses 48-hour window, sessions beyond host expiry and altered host digest',()=>{
 assert.throws(()=>proposeWatcherSession(session({sessionEndsAt:at(4)})),/LIFETIME_SESSION_WINDOW/);
 assert.throws(()=>proposeWatcherSession(session({sessionStartsAt:at(13),sessionEndsAt:at(15),now:()=>Date.parse(at(13))+60000})),/LIFETIME_SESSION_WINDOW/);
 assert.throws(()=>proposeWatcherSession(session({lifetime:{...host(),expiresAt:at(21)}})),/LIFETIME_HOST_WINDOW/);
});
test('watcher rejects unpinned source or an almost expired session',()=>{
 assert.throws(()=>proposeWatcherSession(session({sourceSHA:'main'})),/WATCHER_SESSION_SOURCE_PIN/);
 assert.throws(()=>proposeWatcherSession(session({now:()=>Date.parse(at(3))-60000})),/WATCHER_SESSION_MIN_REMAINING_5_MINUTES/);
});

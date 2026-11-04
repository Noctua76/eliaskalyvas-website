import test from 'node:test';
import assert from 'node:assert/strict';
import {proposeLifetime} from '../ops/acceptance-bootstrap/continuation-lifetime.mjs';
import {renderContinuationExpiryUnits} from '../ops/acceptance-bootstrap/continuation-expiry-units.mjs';
const start='2026-11-06T09:00:00.000Z';
const contract=()=>proposeLifetime({bootstrapId:'nyra-acceptance-20261106-02',createdAt:start,now:()=>Date.parse(start)-1});
const args=()=>({lifetime:contract(),cleanupCommand:'/usr/local/lib/nyra-continuation/retirement-v1.mjs',cleanupSHA256:'a'.repeat(64),hostIdentitySHA256:'b'.repeat(64),now:()=>Date.parse(start)});
test('exact UTC 14d deadline rendered as persistent systemd timer with no commands executed',()=>{
 const a=renderContinuationExpiryUnits(args()),b=renderContinuationExpiryUnits(args());
 assert.deepEqual(a,b);assert.equal(a.calendar,'2026-11-20 09:00:00 UTC');
 assert.match(a.timer,/OnCalendar=2026-11-20 09:00:00 UTC/);
 assert.match(a.timer,/Persistent=true/);
 assert.match(a.service,/ExecStart=\/usr\/bin\/node \/usr\/local\/lib\/nyra-continuation\/retirement-v1\.mjs/);
 assert.equal(a.enforcementVerified,false);assert.equal(a.installApproved,false);assert.equal(a.providerDeletionScheduled,false);
});
test('reject past deadline, altered lifetime pin, missing digest and unsafe shell command',()=>{
 const valid=args();
 assert.throws(()=>renderContinuationExpiryUnits({...valid,now:()=>Date.parse(contract().expiresAt)+1}),/EXPIRY_UNIT_NOT_EXPIRED/);
 assert.throws(()=>renderContinuationExpiryUnits({...valid,lifetime:{...contract(),expiresAt:'2026-11-27T09:00:00.000Z'}}),/EXPIRY_UNIT_HOST_DIGEST/);
 assert.throws(()=>renderContinuationExpiryUnits({...valid,cleanupSHA256:'not-a-digest'}),/EXPIRY_UNIT_MISSING_PINS/);
 assert.throws(()=>renderContinuationExpiryUnits({...valid,cleanupCommand:'/bin/sh -c rm -rf /'}),/EXPIRY_UNIT_CLEANUP_PATH/);
 assert.throws(()=>renderContinuationExpiryUnits({...valid,cleanupCommand:'/root/nyra-github-app/app-5594139.pem'}),/EXPIRY_UNIT_CLEANUP_PATH/);
});

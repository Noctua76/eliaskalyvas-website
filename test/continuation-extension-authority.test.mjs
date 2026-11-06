import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {hashJSON} from '../lib/publication/contract.mjs';
import {signingKeySHA256} from '../lib/publication/runtime/repository-policy.mjs';
import {verifyExtensionAuthority} from '../ops/acceptance-bootstrap/continuation-extension-authority.mjs';
import {migrateExtensionGeneration} from '../ops/acceptance-bootstrap/extension-migration.mjs';
import {verifyInstalledExtension} from '../ops/acceptance-bootstrap/extension-effective.mjs';
import {renderCanonicalExpiryTimer} from '../ops/acceptance-bootstrap/canonical-expiry.mjs';
const t0='2026-11-06T09:00:00Z',old='2026-11-20T09:00:00Z',next='2026-11-27T09:00:00Z';
const clock=()=>Date.parse('2026-11-16T09:00:10Z');
const target={schema:'nyra.acceptance.replacement.v2',authorization:false,bootstrapId:'nyra-acceptance-20261106-02',hostname:'nyra-acceptance-20261106-02',provider:'DigitalOcean',region:'fra1',origin:'https://nyra-acceptance.eliaskalyvas.gr',operatorCIDRs:['203.0.113.10/32'],cpu:4,memoryGiB:8,maximumHours:336,optionalResources:false,reviewedHead:'29a73458d4cd941e5ed514db56dc2c553d041bda',resourceId:'615221105',ipv4:'93.184.216.34',createdAt:t0,expiresAt:old};
const machineId='a'.repeat(32),generation='b'.repeat(64);
const hash=x=>createHash('sha256').update(x).digest('hex');
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const jwk=publicKey.export({format:'jwk'}),keyId='owner-key-test';
const pin=signingKeySHA256(jwk);
const record=()=>({schema:'nyra.acceptance.host-extension-approval.v1',repository:'Noctua76/eliaskalyvas-website',governanceMode:'SINGLE_OWNER',ownerId:'217035723',
 bootstrapId:target.bootstrapId,providerResourceId:target.resourceId,machineIdSHA256:hash(machineId),
 oldDeadline:old,newDeadline:next,previousGenerationSHA256:generation,
 decisionId:'11111111-1111-4111-8111-111111111111',issuedAt:'2026-11-16T09:00:00Z',expiresAt:'2026-11-16T09:05:00Z'});
const envelope=x=>{const digest=hashJSON(x);return {record:x,digest,keyId,signature:sign(null,Buffer.from(digest),privateKey).toString('base64url')};};
const valid=x=>verifyExtensionAuthority({target,envelope:x,ownerPublicJWK:jwk,ownerKeyId:keyId,expectedKeySHA256:pin,machineId,previousGenerationSHA256:generation,now:clock});
test('existing pinned SINGLE_OWNER signed evidence verifies fresh exact host +7d receipt; does not install',async()=>{
 const v=await valid(envelope(record()));assert.equal(v.oldDeadline,old);assert.equal(v.newDeadline,next);assert.equal(v.executionAuthorized,false);
});
test('extension authority refuses self approval, malformed signed record, forged signature, wrong host, wrong key and expiry',async()=>{
 await assert.rejects(valid(envelope({...record(),authorization:true})),/EXTENSION_AUTH_FIELDS/);
 const changes=[
 x=>x.newDeadline='2026-11-28T09:00:00Z',
 x=>x.oldDeadline='2026-11-19T09:00:00Z',
 x=>x.providerResourceId='615221104',
 x=>x.bootstrapId='nyra-acceptance-20261102-01',
 x=>x.machineIdSHA256='c'.repeat(64),
 x=>x.previousGenerationSHA256='d'.repeat(64),
 x=>x.issuedAt='2026-11-15T09:00:00Z',
 x=>x.expiresAt='2026-11-17T09:00:00Z',
 x=>x.governanceMode='MULTI_OWNER'
 ];
 for(const change of changes){const x=record();change(x);await assert.rejects(valid(envelope(x)),/EXTENSION_AUTH_/);}
 const e=envelope(record());e.record.oldDeadline='2026-11-19T09:00:00Z';
 await assert.rejects(valid(e),/EXTENSION_AUTH_SIGNATURE/);
 await assert.rejects(verifyExtensionAuthority({target,envelope:envelope(record()),ownerPublicJWK:jwk,ownerKeyId:keyId,expectedKeySHA256:'f'.repeat(64),machineId,previousGenerationSHA256:generation,now:clock}),/EXTENSION_AUTH_KEY_PIN/);
 await assert.rejects(verifyExtensionAuthority({target,envelope:envelope(record()),ownerPublicJWK:jwk,ownerKeyId:keyId,expectedKeySHA256:pin,machineId,previousGenerationSHA256:generation,now:()=>Date.parse('2026-11-16T09:06:00Z')}),/EXTENSION_AUTH_FRESHNESS/);
});

test('generation migration stages and independently reads new expiry while old timer stays armed',async()=>{
 const oldGeneration={enabled:true,active:true,service:'nyra-repository-expiry.service',deadline:old,generationSHA256:generation};
 let candidate,staged=false,active=false,committed=false;
 const hooks={
  target,envelope:envelope(record()),ownerPublicJWK:jwk,ownerKeyId:keyId,
  expectedKeySHA256:pin,machineId,now:clock,
  readCurrent:async()=>oldGeneration,replaySeen:async()=>false,
  assertFreshOwnerMFA:async()=>true,assertFreshAdministration:async()=>true,
  stageCandidate:async x=>{candidate=x;staged=true;},
  readCandidate:async()=>({sha256:candidate.candidateSHA256,enabled:true,active:true,deadline:next,
   unit:'nyra-repository-expiry.service',originalStillArmed:true}),
  activate:async x=>{assert.equal(x.retainOldUntilVerified,true);active=true;},
  readEffective:async()=>({enabled:active,active,deadline:next,sha256:candidate.candidateSHA256,unit:'nyra-repository-expiry.service'}),
  commitReceipt:async x=>{assert.equal(x.replayProtection,true);committed=true;return true;},
  rollback:async()=>{throw Error('MUST_NOT_ROLLBACK');}
 };
 const result=await migrateExtensionGeneration(hooks);
 assert.equal(result.newDeadline,next);assert.equal(result.credentialsExtended,false);
 assert.equal(result.originalTimerRetirementAuthorized,false);
 assert(staged&&active&&committed);
});
test('generation migration refuses replay, absent AAL2 and failed staging, rolls back original timer',async()=>{
 const oldGeneration={enabled:true,active:true,service:'nyra-repository-expiry.service',deadline:old,generationSHA256:generation};
 let recovered=0,stageCalls=0;
 const hooks={target,envelope:envelope(record()),ownerPublicJWK:jwk,ownerKeyId:keyId,
  expectedKeySHA256:pin,machineId,now:clock,readCurrent:async()=>oldGeneration,
  replaySeen:async()=>false,assertFreshOwnerMFA:async()=>true,assertFreshAdministration:async()=>true,
  stageCandidate:async()=>{stageCalls++;},readCandidate:async()=>({active:false}),
  activate:async()=>{throw Error('MUST_NOT_ACTIVATE');},
  readEffective:async()=>{throw Error('MUST_NOT_READ');},
  commitReceipt:async()=>{throw Error('MUST_NOT_COMMIT');},
  rollback:async()=>{recovered++;}
 };
 await assert.rejects(migrateExtensionGeneration({...hooks,replaySeen:async()=>true}),/EXTENSION_MIGRATION_REPLAY/);
 await assert.rejects(migrateExtensionGeneration({...hooks,assertFreshOwnerMFA:async()=>false}),/EXTENSION_MIGRATION_OWNER_AAL2/);
 assert.equal(stageCalls,0);
 await assert.rejects(migrateExtensionGeneration(hooks),/EXTENSION_MIGRATION_CANDIDATE_READBACK/);
 assert.equal(recovered,1);
 await assert.rejects(migrateExtensionGeneration({...hooks,rollback:async()=>{throw Error('CRASH');}}),/EXTENSION_MIGRATION_ROLLBACK_UNVERIFIED/);
});

test('installed extension defers original expiry only with exact signed approval, committed receipt and both unit hashes',async()=>{
 const oldTimer=renderCanonicalExpiryTimer('2026-11-20 09:00:00 UTC');
 const newTimer=renderCanonicalExpiryTimer('2026-11-27 09:00:00 UTC');
 const signed=record();signed.previousGenerationSHA256=hash(oldTimer);
 const approval=envelope(signed);
 const receipt={schema:'nyra.acceptance.extension-installed.v1',status:'committed',
  bootstrapId:target.bootstrapId,providerResourceId:target.resourceId,envelope:approval,
  ownerPublicJWK:jwk,ownerKeyId:keyId,expectedKeySHA256:pin,
  decisionId:signed.decisionId,oldDeadline:old,newDeadline:next,
  oldTimerSHA256:hash(oldTimer),newTimerSHA256:hash(newTimer),
  committedAt:'2026-11-16T09:01:00.000Z'};
 const args={target,receipt,machineId,oldTimer,newTimer,trustedOwnerKeySHA256:pin,trustedOwnerKeyId:keyId};
 const early=await verifyInstalledExtension({...args,now:()=>Date.parse('2026-11-21T09:00:00Z')});
 assert.equal(early.shouldDefer,true);
 const final=await verifyInstalledExtension({...args,now:()=>Date.parse(next)});
 assert.equal(final.shouldDefer,false);
 await assert.rejects(verifyInstalledExtension({...args,newTimer:newTimer.replace('Persistent=true','Persistent=false')}),/NYRA_EXTENSION_EFFECTIVE_GENERATIONS/);
 await assert.rejects(verifyInstalledExtension({...args,trustedOwnerKeySHA256:'f'.repeat(64)}),/NYRA_EXTENSION_EFFECTIVE_TRUSTED_OWNER_PIN/);
 await assert.rejects(verifyInstalledExtension({...args,receipt:{...receipt,status:'staged'}}),/NYRA_EXTENSION_EFFECTIVE_RECEIPT/);
 await assert.rejects(verifyInstalledExtension({...args,receipt:{...receipt,committedAt:'2026-11-17T09:00:00Z'}}),/NYRA_EXTENSION_EFFECTIVE_COMMIT_TIME/);
 await assert.rejects(verifyInstalledExtension({...args,receipt:{...receipt,newDeadline:'2026-11-28T09:00:00Z'}}),/NYRA_EXTENSION_EFFECTIVE_DECISION_BINDING/);
});

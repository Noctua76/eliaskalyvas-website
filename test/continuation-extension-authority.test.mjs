import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,createHash} from 'node:crypto';
import {verifyExtensionAuthority} from '../ops/acceptance-bootstrap/continuation-extension-authority.mjs';
const t0='2026-11-06T09:00:00Z',old='2026-11-20T09:00:00Z',next='2026-11-27T09:00:00Z';
const clock=()=>Date.parse('2026-11-16T09:00:10Z');
const target={schema:'nyra.acceptance.replacement.v2',authorization:false,bootstrapId:'nyra-acceptance-20261106-02',resourceId:'615221105',expiresAt:old};
const machineId='a'.repeat(32),generation='b'.repeat(64);
const hash=x=>createHash('sha256').update(x).digest('hex');
const {publicKey,privateKey}=generateKeyPairSync('ed25519');
const pin=hash(publicKey.export({format:'der',type:'spki'}));
const receipt=()=>{const m={schema:'nyra.acceptance.host-extension-approval.v1',bootstrapId:target.bootstrapId,providerResourceId:target.resourceId,
 machineIdSHA256:hash(machineId),oldDeadline:old,newDeadline:next,previousGenerationSHA256:generation,
 decisionId:'11111111-1111-4111-8111-111111111111',issuedAt:'2026-11-16T09:00:00Z',expiresAt:'2026-11-16T09:05:00Z'};
 return {...m,signature:sign(null,Buffer.from(JSON.stringify(m)),privateKey).toString('base64url')};};
const valid=x=>verifyExtensionAuthority({target,approval:x,publicKey,expectedKeySHA256:pin,machineId,previousGenerationSHA256:generation,now:clock});
test('fresh Ed25519 owner extension approval verifies exact 14d-to-21d host-bound deadline but never installs itself',()=>{
 const v=valid(receipt());assert.equal(v.oldDeadline,old);assert.equal(v.newDeadline,next);assert.equal(v.executionAuthorized,false);
});
test('host extension refuses self-approval, forged signature, wrong host, wrong key, stale generation and replay window',()=>{
 assert.throws(()=>valid({...receipt(),authorization:true}),/EXTENSION_AUTH_FIELDS/);
 const cases=[
 x=>x.newDeadline='2026-11-28T09:00:00Z',
 x=>x.oldDeadline='2026-11-19T09:00:00Z',
 x=>x.providerResourceId='615221104',
 x=>x.bootstrapId='nyra-acceptance-20261102-01',
 x=>x.machineIdSHA256='c'.repeat(64),
 x=>x.previousGenerationSHA256='d'.repeat(64),
 x=>x.issuedAt='2026-11-15T09:00:00Z',
 x=>x.expiresAt='2026-11-17T09:00:00Z',
 x=>x.signature='x'+x.signature.slice(1)
 ];
 for(const change of cases){const x=receipt();change(x);assert.throws(()=>valid(x),/EXTENSION_AUTH_/);}
 assert.throws(()=>verifyExtensionAuthority({target,approval:receipt(),publicKey,expectedKeySHA256:'f'.repeat(64),machineId,previousGenerationSHA256:generation,now:clock}),/EXTENSION_AUTH_KEY_IDENTITY/);
 assert.throws(()=>verifyExtensionAuthority({target,approval:receipt(),publicKey,expectedKeySHA256:pin,machineId,previousGenerationSHA256:generation,now:()=>Date.parse('2026-11-16T09:06:00Z')}),/EXTENSION_AUTH_FRESHNESS/);
});

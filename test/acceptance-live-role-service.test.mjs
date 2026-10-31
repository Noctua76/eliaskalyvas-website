// UNIT-ONLY signed identity fixtures. No real acceptance evidence is generated.
import test from 'node:test';
import assert from 'node:assert/strict';
import {liveRoleService} from '../ops/acceptance-bootstrap/live-role-service.mjs';
import {integrationAPI,claims,now} from './fixtures/protected-integration.mjs';
import {readState} from './fixtures/protected-delivery.mjs';
import {signedOIDC} from './fixtures/phase4b.mjs';
import {evidenceSigner,verifyEvidence} from '../lib/publication/runtime/acceptance-evidence.mjs';
test('UNIT ONLY: real registrar/observation bindings reuse crypto, independent API registration and durable replay interfaces',async()=>{
 const f=integrationAPI('build'),policies=Object.fromEntries(['build','inspection','publication'].map(role=>[role,{...integrationAPI(role).policy,role,purpose:'identity-observation-only',subject:'urn:nyra:unapproved-subject-discovery',codeSHA:f.policy.callerSHA}]));
 Object.assign(f.data['/actions/runs/100'],{actor:{id:217035723},triggering_actor:{id:217035723}});
 let row;const used=new Set();
 const query=async(sql,args)=>{
  if(sql.startsWith('insert into nyra_trust.jobs')){row=JSON.parse(args[3]);return {rows:[]};}
  if(sql.startsWith('select registration'))return {rows:row?[{registration:row,revoked_at:null,expires_at:row.expiresAt}]:[]};
  if(sql.includes('insert into nyra_trust.used_tokens')){if(used.has(args[0]))return {rows:[]};used.add(args[0]);return {rows:[{jti:args[0]}]};}
  throw Error('UNEXPECTED_TEST_QUERY');
 };
 const signed=await signedOIDC(),keys=await crypto.subtle.generateKey('Ed25519',true,['sign','verify']),sign=evidenceSigner({privateKey:keys.privateKey,publicKeyId:'unit-only'}),common={mode:'discovery',policies,query,getJSON:f.getJSON,readPolicyState:role=>readState(policies[role])(),assertAdministration:async()=>{},keySource:async()=>({keys:[signed.jwk]}),signEvidence:sign,now};
 const registrar=liveRoleService({...common,role:'registrar'}),broker=liveRoleService({...common,role:'broker'});
 await registrar('register',{privilege:'build',selector:{runId:'100',runAttempt:'1'}});
 const token=await signed.sign({...claims(f.policy),repository_owner:'Noctua76',sub:'repo:Noctua76@217035723/eliaskalyvas-website@1389733212:unit-only:build'});
 const result=await broker('accept',{privilege:'build',token});const record=await verifyEvidence(result.signed,{publicKey:keys.publicKey,keyId:'unit-only'});assert.equal(record.authorization,false);assert.equal(record.claims.run_id,'100');
 await assert.rejects(broker('accept',{privilege:'build',token}),/REPLAY/);await assert.rejects(registrar('accept',{privilege:'build',token}),/ROLE_OPERATION_DENIED/);
});

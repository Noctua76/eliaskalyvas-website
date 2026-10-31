import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFileSync} from 'node:child_process';
import {stageLiveRuntime} from '../ops/acceptance-bootstrap/stage-live-runtime.mjs';
import {liveRoleArgs,scopedFRA1Cleanup,cleanupUnits} from '../ops/acceptance-bootstrap/fra1-launch.mjs';
import {readState} from './fixtures/protected-delivery.mjs';
import {integrationAPI} from './fixtures/protected-integration.mjs';
import {liveRoleService} from '../ops/acceptance-bootstrap/live-role-service.mjs';
test('FRA1 role mounts contain only own private credentials and dedicated read-only runtime; no Docker socket or public ports',()=>{for(const role of ['registrar','broker']){const a=liveRoleArgs(role,1001,1001),s=a.join(' ');assert(a.includes('--read-only'));assert(!a.includes('--publish'));assert(!s.includes('docker.sock'));assert(!s.includes('/coordinator/'));assert(!s.includes('/owner/'));assert(!s.includes(role==='registrar'?'/broker/':'/registrar/'));assert.equal(s.includes('evidence-key.json'),role==='broker');assert(s.includes('/policy,dst=/run/role/policy,readonly'));}assert.throws(()=>liveRoleArgs('owner',0,0));});
test('FRA1 cleanup fails closed on an unrelated container label; expiry unit uses an absolute reviewed stop command',()=>{assert.throws(()=>scopedFRA1Cleanup(()=> 'unrelated'),/CLEANUP_SCOPE/);const u=cleanupUnits('2026-11-01T00:00:00Z');assert(u.timer.includes('Persistent=true'));assert(u.service.includes('fra1-launch.mjs --cleanup'));assert(!u.service.includes('Caddy'));});
test('Real role adapter checks exact PostgreSQL identity and cannot accept operations for the opposite role',async()=>{const policies=Object.fromEntries(['build','inspection','publication'].map(role=>[role,{...integrationAPI(role).policy,role,purpose:'identity-observation-only',subject:'urn:nyra:unapproved-subject-discovery'}]));const broker=liveRoleService({role:'broker',mode:'discovery',policies,query:async()=>({rows:[{identity:'postgres'}]}),getJSON:async()=>{},readPolicyState:privilege=>readState(policies[privilege])(),assertAdministration:async()=>{},signEvidence:async()=>{}});await assert.rejects(broker('identity',{}),/ROLE_IDENTITY/);await assert.rejects(broker('register',{privilege:'build',selector:{}}),/ROLE_OPERATION_DENIED/);});
test('FRA1 public plan contains routing identity only, not owner approval, JWT subjects or credentials',async()=>{const p=JSON.parse(await readFile(new URL('../ops/protected-delivery/live-acceptance-plan.json',import.meta.url)));assert.equal(p.origin,'https://nyra-5c.eliaskalyvas.gr/');assert.equal(p.publicEvidenceKeyId,'nyra-5c-fra1-evidence-v1');assert.deepEqual(Object.keys(p).sort(),['approved','origin','publicEvidenceKeyId','purpose']);});

test('Dedicated staged live runtime imports without Vite, React, production dependencies, fixtures or credentials',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'nyra-live-stage-test-'));try{
  const target=join(dir,'runtime'),result=await stageLiveRuntime({source:new URL('../',import.meta.url).pathname,destination:target});assert.equal(result.credentialsCopied,false);assert.equal(result.fixturesCopied,false);
  const files=JSON.parse(await readFile(join(target,'runtime-files.json')));assert(!files.some(p=>p.startsWith('test/')||p.endsWith('build.mjs')));
  const output=execFileSync(process.execPath,['--input-type=module','-e',`await import(${JSON.stringify('file://'+target+'/ops/acceptance-bootstrap/live-role-service.mjs')});await import(${JSON.stringify('file://'+target+'/ops/acceptance-bootstrap/fra1-runtime.mjs')});console.log('PRIVATE_LIVE_GRAPH_PASS')`],{encoding:'utf8',timeout:20000});assert.match(output,/PRIVATE_LIVE_GRAPH_PASS/);
 }finally{await rm(dir,{recursive:true,force:true});}
});

test('Scoped retirement revokes all policy registrations, including lost acknowledgements; broker denies incomplete cleanup',async()=>{
 const policies=Object.fromEntries(['build','inspection','publication'].map(role=>[role,{...integrationAPI(role).policy,role,purpose:'identity-observation-only',subject:'urn:nyra:unapproved-subject-discovery'}]));let retired=0;
 const shared={mode:'discovery',policies,getJSON:async()=>{},readPolicyState:r=>readState(policies[r])(),assertAdministration:async()=>{throw Error('expired owner');}};
 const registrar=liveRoleService({...shared,role:'registrar',query:async(sql)=>{assert.match(sql,/update nyra_trust.jobs/);retired++;return {rows:[]};}});
 assert.deepEqual(await registrar('retire',{}),{retired:true});assert.equal(retired,3);
 let count=1;const broker=liveRoleService({...shared,role:'broker',query:async()=>({rows:[{count}]}),signEvidence:async r=>r});await assert.rejects(broker('retirement',{}),/RETIREMENT_INCOMPLETE/);count=0;assert.equal((await broker('retirement',{})).activeRegistrations,0);
});

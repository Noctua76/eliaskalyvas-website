import test from 'node:test';
import assert from 'node:assert/strict';
import {stageCommands,loginsSQL,expiryUnitContents,cleanupScript,resourceExists,IMAGE,DB,NET,LABEL} from '../ops/acceptance-bootstrap/db-stage.mjs';

test('Temporary PostgreSQL 17 is digest-pinned, internal-only and has no published ports', () => {
  const {network,db}=stageCommands();
  assert(network.includes('--internal'));
  assert(network.includes(LABEL));
  assert.equal(db.at(-1),IMAGE);
  assert(db.includes(DB));
  assert(db.includes(NET));
  assert(db.includes('--env-file'));
  assert(!db.includes('-p')&&!db.includes('--publish')&&!db.includes('--publish-all'));
  assert(db.includes('--restart')&&db.includes('no'));
});

test('Distinct role-scoped PostgreSQL logins reject arbitrary SQL', () => {
  const sql=loginsSQL('a'.repeat(48),'b'.repeat(48));
  assert.match(sql,/nyra_accept_registrar login inherit/);
  assert.match(sql,/nyra_accept_broker login inherit/);
  assert.match(sql,/grant connect on database postgres/);
  assert.throws(()=>loginsSQL("x';drop database postgres;",'b'.repeat(48)),/NYRA_PG_PASSWORD/);
});

test('Persistent UTC expiry uses an independent exact-label cleanup script', () => {
  const units=expiryUnitContents('2026-11-01T04:15:00.000Z');
  assert.match(units.timer,/OnCalendar=2026-11-01 04:15:00 UTC/);
  assert.match(units.timer,/Persistent=true/);
  assert.match(units.service,/ExecStart=\/usr\/local\/sbin\/nyra-5c-db-cleanup/);
  const script=cleanupScript();
  assert.match(script,/pr20-fra1-temporary/);
  assert.match(script,/docker network inspect/);
  assert.match(script,/docker rm -f nyra-5c-pg17/);
  assert(!script.includes('docker system prune'));
  assert(!units.service.includes('docker system prune'));
});

test('DB cleanup distinguishes absence from Docker failure and refuses ambiguous names',()=>{
 assert.equal(resourceExists('container',DB,()=>''),false);
 assert.equal(resourceExists('network',NET,()=>NET),true);
 assert.throws(()=>resourceExists('container',DB,()=>{throw Error('daemon unavailable')}),/daemon unavailable/);
 assert.throws(()=>resourceExists('container',DB,()=>DB+'\nother'),/RESOURCE_SCOPE/);
 assert.throws(()=>resourceExists('container','unrelated',()=>''),/RESOURCE_SCOPE/);
});
test('Generated DB cleanup aborts on failed Docker reads before deleting private files',async()=>{
 const {mkdtemp,writeFile,chmod,rm}=await import('node:fs/promises'),{tmpdir}=await import('node:os'),{join}=await import('node:path'),{spawnSync}=await import('node:child_process');
 const dir=await mkdtemp(join(tmpdir(),'nyra-cleanup-script-'));try{
  await writeFile(join(dir,'docker'),'#!/bin/sh\nexit 42\n');await chmod(join(dir,'docker'),0o700);
  await writeFile(join(dir,'rm'),'#!/bin/sh\necho SHOULD_NEVER_DELETE\n');await chmod(join(dir,'rm'),0o700);
  const r=spawnSync('/bin/sh',['-c',cleanupScript()],{env:{PATH:dir},encoding:'utf8'});assert.equal(r.status,42);assert(!r.stdout.includes('SHOULD_NEVER_DELETE'));
 }finally{await rm(dir,{recursive:true,force:true});}
});

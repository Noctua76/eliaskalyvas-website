import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {postgresIdentityStore} from '../../lib/publication/runtime/protected-identity.mjs';
import {registration,policy} from '../../test/fixtures/protected-delivery.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
// Same assertions run locally in PGlite and in existing isolated native PG17.
export async function acceptTrustStore({admin,broker,otherBroker=broker,registrar,afterSchema=async()=>{}}){
 await admin(await readFile(new URL('./schema.sql',import.meta.url),'utf8'));
 await afterSchema();
 const expiresAt=new Date(Date.now()+240000).toISOString(),r={...registration(),expiresAt};
 const add=async(row=r)=>registrar('insert into nyra_trust.jobs(run_id,run_attempt,check_run_id,registration,policy_sha256,expires_at) values($1,$2,$3,$4,$5,$6)',[row.runId,row.runAttempt,row.checkRunId,JSON.stringify(row),hashJSON(policy),expiresAt]);
 await add();const a=postgresIdentityStore({query:broker}),b=postgresIdentityStore({query:otherBroker}),s={runId:'100',runAttempt:'1',checkRunId:'300'};
 assert.equal((await a.load(s)).workflowSHA,r.workflowSHA);
 const cap={...s,codeSHA:r.codeSHA,expiresAt,jti:'5c-native-replay-001',privilege:'inspection',policySHA256:hashJSON(policy)};
 const race=await Promise.all([a.consume(cap),b.consume(cap)]);assert.deepEqual(race.sort(),[false,true]);
 assert.equal(await a.consume({...cap,jti:'5c-wrong-role-002',privilege:'publication'}),false);
 assert.equal(await a.consume({...cap,jti:'5c-wrong-code-003',codeSHA:'d'.repeat(40)}),false);
 assert.equal(await a.consume({...cap,jti:'5c-wrong-attempt-004',runAttempt:'2'}),false);
 assert.equal(await a.consume({...cap,jti:'5c-wrong-check-005',checkRunId:'301'}),false);
 assert.equal(await a.consume({...cap,jti:'5c-wrong-policy-006',policySHA256:'d'.repeat(64)}),false);
 assert.equal(await a.consume({...cap,jti:'5c-expired-token-007',expiresAt:new Date(Date.now()-1000).toISOString()}),false);
 await assert.rejects(broker('insert into nyra_trust.jobs select * from nyra_trust.jobs'));
 await assert.rejects(broker("update nyra_trust.jobs set revoked_at=clock_timestamp()"));
 await assert.rejects(broker('update nyra_trust.jobs set run_id=run_id'));
 await assert.rejects(registrar("update nyra_trust.jobs set registration='{}'"));
 await assert.rejects(admin("update nyra_trust.jobs set registration='{}'"),/TRUST_IMMUTABLE/);
 await registrar('update nyra_trust.jobs set revoked_at=clock_timestamp()');
 assert((await a.load(s)).revokedAt);assert.equal(await a.consume({...cap,jti:'5c-revoked-token-008'}),false);
 await assert.rejects(admin('update nyra_trust.jobs set revoked_at=null'),/TRUST_IMMUTABLE/);
 // Independent registrar pins a digest. Broker can only read, never approve.
 await registrar('insert into nyra_trust.inventories values($1,$2,$3,$4)',[r.codeSHA,'e'.repeat(64),'f'.repeat(64),'{}']);
 await assert.rejects(registrar('insert into nyra_trust.inventories values($1,$2,$3,$4)',[r.codeSHA,'e'.repeat(64),'0'.repeat(64),'{}']));
 await assert.rejects(broker('insert into nyra_trust.inventories values($1,$2,$3,$4)',['d'.repeat(40),'e'.repeat(64),'f'.repeat(64),'{}']));
 await assert.rejects(admin("update nyra_trust.inventories set record='{}'"),/TRUST_IMMUTABLE/);
 await assert.rejects(admin('delete from nyra_trust.used_tokens'),/TRUST_IMMUTABLE/);
 return {replayRace:race,revocation:true,leastPrivilege:true,immutableInventory:true,syntheticIdentityOnly:true};
}

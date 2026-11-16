import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {assertOwnerDecisionCommitMargin,ownerBoundRenewalSQL,sanitizedRenewalFailure} from '../ops/acceptance-bootstrap/repository-db-renewal.mjs';

const now=Date.parse('2026-11-16T08:53:15.000Z');
const at=n=>new Date(n).toISOString();
const lease={authorized:false,roleValidUntil:at(Date.now()+3600000)};
const passwords={registrar:'a'.repeat(48),broker:'b'.repeat(48)};
test('G08 requires strictly more than ten minutes at its commit boundary',()=>{
 assert.equal(assertOwnerDecisionCommitMargin(at(now+600001),{now}),at(now+600001));
 for(const n of [now-1,now,now+599999,now+600000])assert.throws(()=>assertOwnerDecisionCommitMargin(at(n),{now}),/OWNER_DECISION_MARGIN/);
 for(const value of [null,undefined,'invalid',"2026-11-16T09:08:15Z'; COMMIT; --",'2026-11-16T09:08:15+00:00'])assert.throws(()=>assertOwnerDecisionCommitMargin(value,{now}),/OWNER_DECISION_MARGIN/);
 assert.throws(()=>assertOwnerDecisionCommitMargin(at(now+900000),{now:NaN}),/OWNER_DECISION_MARGIN/);
});
test('renewal SQL retains isolation and enforces DB-clock margin before changes and COMMIT',()=>{
 const sql=ownerBoundRenewalSQL(lease,passwords,at(now+900000),{now});
 assert.equal((sql.match(/DO \$nyra_owner_clock\$/g)||[]).length,2);
 assert(sql.indexOf('clock_timestamp()')<sql.indexOf('ALTER ROLE'));
 assert(sql.lastIndexOf('clock_timestamp()')>sql.lastIndexOf('ALTER ROLE'));
 assert(sql.lastIndexOf('clock_timestamp()')<sql.indexOf('\nCOMMIT;'));
 assert.equal((sql.match(/^COMMIT;$/gm)||[]).length,1);
 assert(sql.includes("SET LOCAL password_encryption = 'scram-sha-256'"));
 assert.throws(()=>ownerBoundRenewalSQL(lease,passwords,at(now+600000),{now}),/OWNER_DECISION_MARGIN/);
});
test('new diagnostics expose only fixed codes and preserve noAutomaticRetry',()=>{
 const safe=sanitizedRenewalFailure(Error('NYRA_DB_RENEWAL_OWNER_DECISION_MARGIN'));
 assert.equal(safe.code,'NYRA_DB_RENEWAL_OWNER_DECISION_MARGIN');assert.equal(safe.noAutomaticRetry,true);
 const secret='PRIVATE_TOKEN_NEVER_EXPORT';
 assert.equal(sanitizedRenewalFailure(Error(secret)).code,'UNCLASSIFIED');
 assert(!JSON.stringify(sanitizedRenewalFailure(Error(secret))).includes(secret));
});
test('offline PostgreSQL accepts an adequate decision and rejects clock skew before SQL mutation',async()=>{
 const db=new PGlite();try{
  await db.exec('create role nyra_accept_registrar login; create role nyra_accept_broker login;');
  const time=Date.now();
  await db.exec(ownerBoundRenewalSQL(lease,passwords,at(time+900000),{now:time}));
  const before=await db.query("select rolname,rolvaliduntil::text,rolpassword from pg_authid where rolname like 'nyra_accept_%' order by rolname");
  // A host clock behind PostgreSQL must never grant the missing time margin.
  const skewed=ownerBoundRenewalSQL(lease,{registrar:'c'.repeat(48),broker:'d'.repeat(48)},at(time+590000),{now:time-60000});
  await assert.rejects(db.exec(skewed),/NYRA_DB_RENEWAL_OWNER_DECISION_MARGIN/);
  await db.exec('ROLLBACK;');
  assert.deepEqual((await db.query("select rolname,rolvaliduntil::text,rolpassword from pg_authid where rolname like 'nyra_accept_%' order by rolname")).rows,before.rows);
 }finally{await db.close();}
});
test('offline PostgreSQL rolls back changed roles if ten-minute margin is lost before COMMIT',async()=>{
 const db=new PGlite();try{
  await db.exec('create role nyra_accept_registrar login; create role nyra_accept_broker login; create sequence g08_reached_precommit;');
  const baseline=(await db.query("select rolname,rolvaliduntil::text,rolpassword from pg_authid where rolname like 'nyra_accept_%' order by rolname")).rows;
  const time=Date.now();
  let sql=ownerBoundRenewalSQL(lease,passwords,at(time+600800),{now:time});
  const last=sql.lastIndexOf('DO $nyra_owner_clock$');
  sql=sql.slice(0,last)+"SELECT nextval('g08_reached_precommit'); SELECT pg_sleep(1.0);\n"+sql.slice(last);
  await assert.rejects(db.exec(sql),/NYRA_DB_RENEWAL_OWNER_DECISION_MARGIN/);
  await db.exec('ROLLBACK;');
  assert.equal((await db.query('select is_called from g08_reached_precommit')).rows[0].is_called,true,'First guard passed and the final boundary was reached');
  assert.deepEqual((await db.query("select rolname,rolvaliduntil::text,rolpassword from pg_authid where rolname like 'nyra_accept_%' order by rolname")).rows,baseline);
 }finally{await db.close();}
});

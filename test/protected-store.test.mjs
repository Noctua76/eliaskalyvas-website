import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {acceptTrustStore} from '../ops/protected-delivery/store-acceptance.mjs';
test('5C durable registry, replay, revocation and immutable inventory with isolated SQL roles',async()=>{
 const db=new PGlite();
 const role=r=>async(sql,args)=>{await db.exec('set role '+r);try{return args?await db.query(sql,args):await db.query(sql);}finally{await db.exec('reset role');}};
 // PGlite shares one session, so serialize per-role calls; native PG uses two
 // independent broker connections for the actual concurrent unique-jti race.
 let pending=Promise.resolve();const serial=r=>(...args)=>{const p=pending.then(()=>role(r)(...args));pending=p.catch(()=>{});return p;};
 try{const result=await acceptTrustStore({admin:async sql=>db.exec(sql),registrar:serial('nyra_trust_registrar'),broker:serial('nyra_trust_broker')});assert(result.revocation);}finally{await db.close();}
});

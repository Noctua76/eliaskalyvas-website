import test from 'node:test';
import {PGlite} from '@electric-sql/pglite';
import {acceptTrustStore} from '../ops/protected-delivery/store-acceptance.mjs';
import {acceptProtectedIntegration} from '../ops/protected-delivery/integration-acceptance.mjs';
test('B2 SQL registrar/broker registration, protected inventory consumption and revocation',async()=>{
 const db=new PGlite();let pending=Promise.resolve();
 const role=name=>(...args)=>{const p=pending.then(async()=>{await db.exec('set role '+name);try{return await db.query(...args);}finally{await db.exec('reset role');}});pending=p.catch(()=>{});return p;};
 const registrar=role('nyra_trust_registrar'),broker=role('nyra_trust_broker');
 try{await acceptTrustStore({admin:sql=>db.exec(sql),registrar,broker});await acceptProtectedIntegration({registrarQuery:registrar,brokerQuery:broker});}finally{await db.close();}
});

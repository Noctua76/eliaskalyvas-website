import assert from 'node:assert/strict';
import pg from '../native-acceptance/node_modules/pg/lib/index.js';
import {acceptTrustStore} from './store-acceptance.mjs';
export async function nativeProtectedAcceptance(config){
 const clients=[];const connection=async role=>{const c=new pg.Client({host:config.dbHost,port:config.ports.db,user:'postgres',password:config.password,database:'postgres',statement_timeout:15000,lock_timeout:10000});await c.connect();clients.push(c);if(role)await c.query('set role '+role);return c.query.bind(c);};
 try{
  const admin=await connection();assert(Number((await admin('show server_version_num')).rows[0].server_version_num)>=170000);
  // Roles are created by the proposal first; connections assume roles lazily.
  const lazy=role=>{let q;return async(...args)=>{q??=await connection(role);return q(...args);};};
  const result=await acceptTrustStore({admin,broker:lazy('nyra_trust_broker'),otherBroker:lazy('nyra_trust_broker'),registrar:lazy('nyra_trust_registrar')});
  config.event(config.prefix+':5C-native-trust-store','PASS',result);
  config.event(config.prefix+':5C-real-protected-GitHub-OIDC','NOT VERIFIED','Synthetic signing and native SQL do not establish protected GitHub invocation');
 }finally{await Promise.all(clients.map(c=>c.end()));}
}

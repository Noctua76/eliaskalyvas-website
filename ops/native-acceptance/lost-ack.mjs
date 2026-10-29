// Native PostgreSQL wire fault: drop COMMIT CommandComplete before client sees it.
// Only the fixed isolated service is allowed. No credentials or wire bytes logged.
import assert from 'node:assert/strict';
import {createServer,createConnection} from 'node:net';
import pg from 'pg';
export async function lostCommitAcknowledgement({host,port,password,operation}){
 assert(host==='db'&&port===5432);let armed=false,observedCommit=false,backendPID;
 const sockets=new Set();
 const server=createServer(client=>{
  const backend=createConnection({host,port});sockets.add(client);sockets.add(backend);
  client.on('error',()=>{});backend.on('error',()=>client.destroy());client.on('close',()=>backend.destroy());backend.on('close',()=>client.destroy());
  client.pipe(backend);let buffer=Buffer.alloc(0);
  backend.on('data',chunk=>{
   buffer=Buffer.concat([buffer,chunk]);
   while(buffer.length>=5){const size=buffer.readUInt32BE(1)+1;assert(size>=5&&size<=16*1024*1024);if(buffer.length<size)return;const message=buffer.subarray(0,size);buffer=buffer.subarray(size);
    if(armed&&message[0]===67&&message.subarray(5).toString()==='COMMIT\0'){observedCommit=true;client.destroy();backend.destroy();return;}
    client.write(message);
   }
  });
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const client=new pg.Client({host:'127.0.0.1',port:server.address().port,user:'postgres',password,database:'postgres',ssl:false,statement_timeout:15000});client.on('error',()=>{});
 try{await client.connect();await client.query('set role service_role');backendPID=(await client.query('select pg_backend_pid() pid')).rows[0].pid;
  await client.query('begin');await operation(client);armed=true;await assert.rejects(client.query('commit'),/Connection terminated/);assert(observedCommit,'Server COMMIT completion must precede forced transport loss');
  return {backendPID,serverCommitObserved:true,clientAcknowledgementDelivered:false};
 }finally{await client.end();for(const s of sockets)s.destroy();await new Promise(r=>server.close(r));}
}

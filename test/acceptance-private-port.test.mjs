import test from 'node:test';
import assert from 'node:assert/strict';
import {PassThrough} from 'node:stream';
import {privatePort} from '../ops/acceptance-bootstrap/private-port.mjs';
const pair=(workerRole='registrar')=>{const a=new PassThrough(),b=new PassThrough(),key=Buffer.alloc(32,22);let worker;const coordinator=privatePort({role:'registrar',key,side:'coordinator',input:b,output:a,onQuery:async(op,args)=>{assert.equal(op,'github');return {read:args.url};},timeout:1000});worker=privatePort({role:workerRole,key,side:'worker',input:a,output:b,onCall:async(op,args)=>{if(op==='nested')return worker.query('github',args);if(op==='deny')throw Error('private credential must not leak');return args;},timeout:1000});return {coordinator,worker};};
test('Role stdio supports authenticated reverse API reads while a role operation awaits its response',async()=>{const p=pair();try{assert.deepEqual(await p.coordinator.call('nested',{url:'fixed-reader-url'}),{read:'fixed-reader-url'});await assert.rejects(p.coordinator.call('deny',{}),e=>e.message==='PRIVATE_OPERATION_DENIED');}finally{p.coordinator.close();p.worker.close();}});
test('Cross-role substitutions and worker closure reject outstanding private requests',async()=>{const p=pair('broker');try{await assert.rejects(p.coordinator.call('identity',{}));}finally{p.coordinator.close();p.worker.close();}const q=pair();q.worker.close();await assert.rejects(q.coordinator.call('identity',{}));q.coordinator.close();});

test('Actual OS child inherits worker stdin/stdout descriptors and closes cleanly without a privileged socket',async()=>{
 const {spawn}=await import('node:child_process'),{once}=await import('node:events');
 const portURL=new URL('../ops/acceptance-bootstrap/private-port.mjs',import.meta.url).href;
 const worker=spawn(process.execPath,['--input-type=module','-e',`import {privatePort} from ${JSON.stringify(portURL)};privatePort({role:'registrar',key:Buffer.alloc(32,22),side:'worker',input:process.stdin,output:process.stdout,onCall:async()=>({identity:'test-transport-only'})});`],{stdio:['pipe','pipe','pipe']});
 const coordinator=spawn(process.execPath,['--input-type=module','-e',`import {Socket} from 'node:net';import {privatePort} from ${JSON.stringify(portURL)};const p=privatePort({role:'registrar',key:Buffer.alloc(32,22),side:'coordinator',input:new Socket({fd:4,readable:true,writable:false}),output:new Socket({fd:3,readable:false,writable:true})});const r=await p.call('identity',{});console.log(r.identity);p.close();`],{stdio:['ignore','pipe','pipe',worker.stdin,worker.stdout]});
 let output='',err='';coordinator.stdout.on('data',b=>output+=b);coordinator.stderr.on('data',b=>err+=b);const timer=setTimeout(()=>{coordinator.kill();worker.kill();},8000);
 try{const [code]=await once(coordinator,'exit');assert.equal(code,0,err);assert.equal(output.trim(),'test-transport-only');}finally{clearTimeout(timer);worker.stdin.end();worker.kill();coordinator.kill();}
});

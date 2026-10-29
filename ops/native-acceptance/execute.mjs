// Runs only inside the unprivileged, egress-blocked CI driver container.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {runNative} from './suite.mjs';
import {runNativeInspection} from '../edge-acceptance/inspection-suite.mjs';
assert(process.env.NYRA_NATIVE_CONTAINER==='1');assert(process.version.startsWith('v22.'));
const config=JSON.parse(readFileSync('/native-config.json','utf8'));
assert(config.dbHost==='db'&&config.authHost==='auth'&&config.restHost==='rest');
const event=(id,status,detail)=>console.log('NATIVE:'+JSON.stringify({id,status,detail}));
try{
 // A focused 5C native rerun reuses the existing disposable infrastructure,
 // without rerunning the unrelated, already accepted 5B inspection suite.
 const catalog=config.protectedMode
  ?await import('../protected-delivery/native.mjs').then(m=>m.nativeProtectedAcceptance({...config,event}))
  :await (config.inspectionMode?runNativeInspection:runNative)({...config,event,out:'/evidence'});
 writeFileSync('/evidence/'+config.prefix+'-catalog.json',JSON.stringify(catalog));
}catch(e){event(config.prefix+':execution','FAIL',{name:e.name,code:e.code||null,message:e.message,location:e.stack?.split('\n').slice(1,4).join('\n')});process.exitCode=1;}

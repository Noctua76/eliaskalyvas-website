// Offline byte sealing only. Does not authorize publication or deploy an artifact.
import {createHash} from 'node:crypto';
import {hashJSON} from '../contract.mjs';
import {requireDelivery} from './materialize.mjs';
export function artifactSealer(){
 const sealed=new WeakMap();
 return Object.freeze({
  seal(files,{candidateId,attemptId,fence,manifestSHA256,codeSHA}){
   requireDelivery(files instanceof Map&&files.size>0,'BUILD_FILES_REQUIRED');
   const inventory=[...files].map(([path,bytes])=>{requireDelivery(typeof path==='string'&&path.length<400&&!path.startsWith('/')&&!path.split('/').some(p=>p==='.'||p==='..'||p==='')&&!/[\\\u0000-\u001f]/.test(path)&&bytes instanceof Uint8Array,'BUILD_FILE');return {path,sha256:createHash('sha256').update(bytes).digest('hex')}}).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
   const proof=Object.freeze({candidateId,attemptId,fence,manifestSHA256,codeSHA,artifactSHA256:hashJSON(inventory)});sealed.set(proof,new Map([...files].map(([p,b])=>[p,new Uint8Array(b)])));return proof;
  },
  files(proof){requireDelivery(sealed.has(proof),'UNVERIFIED_BUILD_ARTIFACT');return new Map([...sealed.get(proof)].map(([p,b])=>[p,new Uint8Array(b)]))},
  assert(proof){requireDelivery(sealed.has(proof),'UNVERIFIED_BUILD_ARTIFACT');return proof;}
 });
}
export function artifactRecorder({sealer,store}){return Object.freeze({async record(proof){sealer.assert(proof);return store.recordArtifact(proof)}})}

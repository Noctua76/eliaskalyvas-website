// Role/direction/sequence-bound authenticated private IPC, not a public endpoint.
import {createHmac,timingSafeEqual} from 'node:crypto';
import {canonicalize} from '../canonical-json.mjs';
export function authenticatedFrames({key,role,direction}){
 if(!Buffer.isBuffer(key)||key.length!==32||!['registrar','broker'].includes(role)||!['request','response'].includes(direction))throw Error('IPC_CONFIG');
 let sent=0,received=0;const mac=frame=>createHmac('sha256',key).update(canonicalize(frame)).digest();
 return {encode(body){const frame={role,direction,sequence:++sent,body};return {...frame,mac:mac(frame).toString('hex')};},decode(envelope){
  if(!envelope||envelope.role!==role||envelope.direction!==direction||envelope.sequence!==received+1||!/^[a-f0-9]{64}$/.test(envelope.mac))throw Error('IPC_AUTH');
  const {mac:given,...frame}=envelope;if(!timingSafeEqual(Buffer.from(given,'hex'),mac(frame)))throw Error('IPC_AUTH');received++;return frame.body;
 }};
}

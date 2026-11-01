// Existing policyGuard readers re-read this private directory-mounted file.
// One private coordinator owns the writer lock; role workers have read-only mounts.
import {openSync,closeSync,lstatSync,fstatSync,readFileSync,writeFileSync,fsyncSync,fchownSync,renameSync,unlinkSync,constants} from 'node:fs';
import {dirname} from 'node:path';
import {randomUUID} from 'node:crypto';
export function retirePolicyState({path,policySHA256s}){
 if(!Array.isArray(policySHA256s)||policySHA256s.length!==3||new Set(policySHA256s).size!==3||!policySHA256s.every(x=>/^[a-f0-9]{64}$/.test(x)))throw Error('POLICY_RETIREMENT_SCOPE');
 const parent=lstatSync(dirname(path));if(!parent.isDirectory()||parent.isSymbolicLink()||parent.uid!==process.getuid()||(parent.mode&0o022))throw Error('POLICY_STATE_DIRECTORY');
 const lock=path+'.retiring',handle=openSync(lock,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600);let source,temp;
 try{
  const st=lstatSync(path);if(!st.isFile()||st.isSymbolicLink()||st.nlink!==1||st.uid!==process.getuid()||(st.mode&0o027)||st.size>65536)throw Error('POLICY_STATE_FILE');
  source=openSync(path,constants.O_RDONLY|constants.O_NOFOLLOW);const actual=fstatSync(source);if(actual.ino!==st.ino||actual.dev!==st.dev)throw Error('POLICY_STATE_CHANGED');
  const state=JSON.parse(readFileSync(source,'utf8'));closeSync(source);source=undefined;
  for(const role of ['build','inspection','publication']){if(!Object.hasOwn(state,role))throw Error('POLICY_STATE_INCOMPLETE');if(policySHA256s.includes(state[role]?.policySHA256))state[role]=null;}
  temp=path+'.retired-'+randomUUID();const out=openSync(temp,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,st.mode&0o777);
  try{fchownSync(out,st.uid,st.gid);writeFileSync(out,JSON.stringify(state));fsyncSync(out);}finally{closeSync(out);}
  renameSync(temp,path);temp=undefined;const dir=openSync(dirname(path),constants.O_RDONLY);try{fsyncSync(dir);}finally{closeSync(dir);}
 }finally{if(source!==undefined)closeSync(source);if(temp)unlinkSync(temp);closeSync(handle);unlinkSync(lock);}
}

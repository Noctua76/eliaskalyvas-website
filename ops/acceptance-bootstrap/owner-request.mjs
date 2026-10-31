// Operator private-channel client. Never pass the bearer in argv/environment.
// stdin: {token: NEW_OWNER_AAL2_TOKEN, ...operation fields}; token is removed
// from the operation body and sent only in Authorization over the UNIX socket.
import {request} from 'node:http';
import {writeFile} from 'node:fs/promises';
import {privateFile} from './owner-source.mjs';
export async function ownerRequest({socket,operation,input}){
 if(!['authorize','retire','receipt'].includes(operation))throw Error('OWNER_OPERATION');
 const {token,...body}=input;
 if(operation==='receipt'&&token)throw Error('UNEXPECTED_TOKEN');
 const text=JSON.stringify(body);if(Buffer.byteLength(text)>30000)throw Error('OWNER_BODY');
 return new Promise((resolve,reject)=>{const req=request({socketPath:socket,path:'/'+operation,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(text),...(operation!=='receipt'?{Authorization:'Bearer '+token}:{})},timeout:15000},res=>{let data='';res.on('data',b=>{data+=b.toString();if(data.length>100000){req.destroy();reject(Error('OWNER_RESPONSE'));}});res.on('end',()=>{try{if(res.statusCode!==200)throw Error('OWNER_REQUEST_DENIED');resolve(JSON.parse(data));}catch{reject(Error('OWNER_REQUEST_DENIED'));}});});req.on('error',()=>reject(Error('OWNER_REQUEST_DENIED')));req.on('timeout',()=>req.destroy());req.end(text);});
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{
 const [operation,configPath,out]=process.argv.slice(2),config=await privateFile(configPath);let input='';for await(const b of process.stdin){if(Buffer.byteLength(input)+b.length>30000)throw Error('OWNER_BODY');input+=b.toString();}
 const result=await ownerRequest({socket:config.socket,operation,input:JSON.parse(input)});
 if(operation==='receipt'){if(!out)throw Error('PRIVATE_OUTPUT_REQUIRED');await writeFile(out,JSON.stringify(result),{flag:'wx',mode:0o600});console.log('PRIVATE_OWNER_RECEIPT_SAVED');}else console.log(JSON.stringify(result));
}catch{console.error('OWNER_REQUEST_DENIED');process.exitCode=1;}}

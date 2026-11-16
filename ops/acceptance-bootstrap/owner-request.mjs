// Operator private-channel client. Never pass the bearer in argv/environment.
// stdin: {token: NEW_OWNER_AAL2_TOKEN, ...operation fields}; token is removed
// from the operation body and sent only in Authorization over the UNIX socket.
import {request} from 'node:http';
import {writeFile} from 'node:fs/promises';
import {privateFile} from './owner-source.mjs';
const denied=code=>Object.assign(Error('OWNER_REQUEST_DENIED'),{nyraCode:code});
export async function ownerRequest({socket,operation,input}){
 if(!['authorize','retire','receipt','extend','renew'].includes(operation))throw Error('OWNER_OPERATION');
 const {token,...body}=input;
 if(operation==='receipt'&&token)throw Error('UNEXPECTED_TOKEN');
 const text=JSON.stringify(body);if(Buffer.byteLength(text)>30000)throw Error('OWNER_BODY');
 return new Promise((resolve,reject)=>{const req=request({socketPath:socket,path:'/'+operation,method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(text),...(operation!=='receipt'?{Authorization:'Bearer '+token}:{})},timeout:15000},res=>{let data='';res.on('data',b=>{data+=b.toString();if(data.length>100000){reject(denied('OWNER_RESPONSE_TOO_LARGE'));req.destroy();}});res.on('end',()=>{if(res.statusCode!==200){reject(denied('OWNER_HTTP_DENIED'));return;}try{resolve(JSON.parse(data));}catch{reject(denied('OWNER_RESPONSE_INVALID'));}});});req.on('error',e=>reject(denied(e.code==='ENOENT'?'OWNER_CHANNEL_ABSENT':e.code==='ECONNREFUSED'?'OWNER_CHANNEL_REFUSED':e.code==='EACCES'?'OWNER_CHANNEL_ACCESS_DENIED':'OWNER_CHANNEL_UNAVAILABLE')));req.on('timeout',()=>{reject(denied('OWNER_CHANNEL_TIMEOUT'));req.destroy();});req.end(text);});
}
if(process.argv[1]===new URL(import.meta.url).pathname){try{
 const [operation,configPath,out]=process.argv.slice(2),config=await privateFile(configPath);let input='';for await(const b of process.stdin){if(Buffer.byteLength(input)+b.length>30000)throw Error('OWNER_BODY');input+=b.toString();}
 const result=await ownerRequest({socket:config.socket,operation,input:JSON.parse(input)});
 if(operation==='receipt'||operation==='extend'||operation==='renew'){
  if(!out||operation==='extend'&&out!=='/opt/nyra-5c/private/extension-approval.json'||operation==='renew'&&out!=='/opt/nyra-5c/private/renewal-approval.json')
   throw Error('PRIVATE_OUTPUT_REQUIRED');
  await writeFile(out,JSON.stringify(result),{flag:'wx',mode:0o600});
  console.log('PRIVATE_OWNER_APPROVAL_SAVED');
 }else console.log(JSON.stringify(result));
}catch{console.error('OWNER_REQUEST_DENIED');process.exitCode=1;}}

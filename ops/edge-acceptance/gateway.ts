// Fixed disposable probe routes. No production URL, arbitrary worker path, caller
// limits, credentials, public export or publication dispatch is supported.
const modes=['healthy','memory','cpu','wall','deadline','concurrent','crash','network','sharp','guarded'];
const cached=new Map();
const reply=(error,status)=>Response.json({error},{status,headers:{'Cache-Control':'no-store'}});
Deno.serve(async req=>{
 const url=new URL(req.url),mode=url.pathname.split('/')[1];
 if(url.pathname==='/_health')return new Response('ready');
 if(!modes.includes(mode))return reply('NOT_FOUND',404);
 if(url.search)return reply('UNSUPPORTED_SELECTOR',400);
 // Read incrementally: Content-Length is untrusted and omission cannot bypass.
 const reader=req.body?.getReader();let size=0;
 if(reader){while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>65536){await reader.cancel();return reply('PAYLOAD_TOO_LARGE',413);}}}
 if(size)return reply('UNSUPPORTED_BODY',400);
 const options={servicePath:'/native/'+mode,maybeEntrypoint:'file:///native/'+mode+'/index.ts',envVars:[],forceCreate:true,noModuleCache:true,
  memoryLimitMb:64,workerTimeoutMs:3000,cpuTimeSoftLimitMs:250,cpuTimeHardLimitMs:500,context:{useReadSyncFileAPI:true}};
 if(mode==='wall')options.workerTimeoutMs=1000;
 if(mode==='sharp'||mode==='guarded'){options.memoryLimitMb=150;options.workerTimeoutMs=10000;options.cpuTimeSoftLimitMs=1500;options.cpuTimeHardLimitMs=2000;options.staticPatterns=['/native/'+mode+'/**/*'];}
 try{
  let pending=mode==='concurrent'?cached.get(mode):null;
  if(!pending){pending=EdgeRuntime.userWorkers.create(options);if(mode==='concurrent')cached.set(mode,pending);}
  const worker=await pending;
  const request=new Request(req.url,{method:'GET'}); // no caller header or body relay
  EdgeRuntime.applySupabaseTag(req,request); // supported native request correlation; no user authorization is granted
  const response=mode==='deadline'?await Promise.race([worker.fetch(request),new Promise(resolve=>setTimeout(()=>resolve(reply('EXECUTION_DEADLINE',504)),400))]):await worker.fetch(request);
  if(response.status>=500&&mode!=='guarded')return reply('WORKER_UNAVAILABLE',503);
  return response;
 }catch{return reply('WORKER_UNAVAILABLE',503);}
});

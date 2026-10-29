// Test-only main gateway. Uses the official v1.77.4 example's user-worker options.
// Only exact test packages are selectable; no env/secrets or arbitrary FS access.
const schemas=['shared','release','manifest','event','receipt','dataset'];
const variants=['raw','bundled',...schemas.flatMap(n=>['missing-'+n,'altered-'+n]),'bundle-missing-shared','bundle-altered-shared'];
Deno.serve(async req=>{
 if(new URL(req.url).pathname==='/_health')return new Response('ready');
 const name=new URL(req.url).pathname.split('/')[1];
 if(!variants.includes(name))return new Response('not found',{status:404});
 try{
  const servicePath='/native/'+name;
  const worker=await EdgeRuntime.userWorkers.create({
   servicePath,maybeEntrypoint:'file://'+servicePath+'/native-entry.ts',
   memoryLimitMb:150,workerTimeoutMs:30000,cpuTimeSoftLimitMs:10000,cpuTimeHardLimitMs:20000,
   noModuleCache:true,forceCreate:true,envVars:[],
   staticPatterns:[servicePath+'/contracts/**/*.json'],
   // Supported option in the pinned runtime's examples/main/index.ts, not a
   // permission bypass. Only packaged static assets are visible in the worker.
   context:{useReadSyncFileAPI:true},
  });
  return await worker.fetch(req);
 }catch(e){return Response.json({gatewayError:String(e)},{status:500});}
});

// Test-only gateway using the pinned runtime's supported user-worker API.
// No arbitrary service paths, environment relay, credentials or public ports.
const variants = ['raw-npm', 'raw-sync', 'raw-async', 'bundle-sync', 'bundle-async', 'missing-sync', 'altered-sync'];
Deno.serve(async req => {
 const name = new URL(req.url).pathname.split('/')[1];
 if (!variants.includes(name)) return new Response('not found', {status:404});
 try {
  const servicePath = '/native/' + name;
  const worker = await EdgeRuntime.userWorkers.create({
   servicePath, maybeEntrypoint:'file://' + servicePath + '/native-entry.ts',
   memoryLimitMb:150, workerTimeoutMs:30000, cpuTimeSoftLimitMs:10000,
   cpuTimeHardLimitMs:20000, noModuleCache:true, forceCreate:true, envVars:[],
   staticPatterns:[servicePath + '/contracts/**/*.json'],
   context:{useReadSyncFileAPI:!name.endsWith('-async')},
  });
  return await worker.fetch(req);
 } catch(e) { return Response.json({gatewayError:String(e)}, {status:500}); }
});

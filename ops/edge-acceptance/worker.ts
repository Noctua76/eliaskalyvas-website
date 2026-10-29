// Disposable native resource probe; no credentials, private records or authority.
const instance=crypto.randomUUID();let active=0,peak=0;
Deno.serve(async req=>{
 const mode=new URL(req.url).pathname.split('/')[1];
 if(mode==='memory'){
  const retained=[];for(let i=0;i<16;i++){const bytes=new Uint8Array(8*1024*1024);bytes.fill(i+1);retained.push(bytes);await new Promise(r=>setTimeout(r,30));}
  return Response.json({unexpected:true,allocated:retained.reduce((n,x)=>n+x.length,0)});
 }
 if(mode==='cpu'){const end=performance.now()+2500;let n=1;while(performance.now()<end)n=Math.sqrt(n+1.1);return Response.json({unexpected:true,n});}
 if(mode==='wall'||mode==='deadline')await new Promise(r=>setTimeout(r,5000));
 if(mode==='crash')throw Error('PRIVATE_PROBE_STACK_SENTINEL');
 if(mode==='network'){
  const blocked=[];for(const url of ['http://169.254.169.254','https://1.1.1.1']){try{await fetch(url,{signal:AbortSignal.timeout(250)});blocked.push(false);}catch{blocked.push(true);}}
  return Response.json({blocked});
 }
 if(mode==='concurrent'){active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,150));active--;}
 return Response.json({ok:true,instance,mode,peak,environmentKeys:Object.keys(Deno.env.toObject())});
});

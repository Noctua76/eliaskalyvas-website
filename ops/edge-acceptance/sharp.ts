// Actual pinned Sharp import and full decode attempt. No fake success, header-only
// replacement, downloaded image or Node/build result is used as Edge evidence.
let result;const inventory=[],fixtureHashes=[];
const hash=async bytes=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))).map(x=>x.toString(16).padStart(2,'0')).join('');
for(const row of JSON.parse(await Deno.readTextFile('./byte-inventory.json'))){const bytes=await Deno.readFile(row.path);const actual=await hash(bytes);if(actual!==row.sha256||bytes.length!==row.bytes)throw Error('NATIVE_PROBE_PACKAGE_INTEGRITY');inventory.push({...row,actual});}
const cases=JSON.parse(await Deno.readTextFile('./fixtures.json'));
for(const c of cases){const bytes=Uint8Array.from(atob(c.base64),x=>x.charCodeAt(0));const actual=await hash(bytes);if(actual!==c.sha256)throw Error('NATIVE_PROBE_FIXTURE_INTEGRITY');fixtureHashes.push({name:c.name,actual,expected:c.sha256});}
try{
 const {default:sharp}=await import('./node_modules/sharp/lib/index.js');
 const decoded=[];
 for(const c of cases){const bytes=Uint8Array.from(atob(c.base64),x=>x.charCodeAt(0));const image=sharp(bytes,{limitInputPixels:40000000,failOn:'warning'});const meta=await image.metadata();await image.raw().toBuffer();decoded.push({name:c.name,format:meta.format,width:meta.width,height:meta.height});}
 result={compatible:true,decoded,inventory,fixtureHashes};
}catch(error){result={compatible:false,inventory,fixtureHashes,name:error.name,code:error.code||null,message:String(error.message).slice(0,1800)};}
Deno.serve(()=>Response.json(result));

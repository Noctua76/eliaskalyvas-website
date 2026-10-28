// Run separately under both Node and Deno; no providers, credentials or network.
import {Buffer} from 'node:buffer';
if(typeof globalThis.Buffer==='undefined')globalThis.Buffer=Buffer;
const {loadPrivateRuntime}=await import('../runtime/nyra-edge/package.mjs');
const {contract,adapters}=await loadPrivateRuntime();
const {releaseFixture,dataset,NOW}=await import('./fixtures/publication-v1.1.mjs');
const data=dataset([releaseFixture()]);contract.validatePublicationSet(data,{now:NOW});
const invalid=[];for(const text of ['{"x":1,"x":2}','{"x":-0}','{"x":1.1}']){try{contract.hashJSON(contract.parseContractJSON(text));invalid.push('accepted')}catch(e){invalid.push(e.code)}}
const schemaFailures=[];
for(const kind of ['private-field','canonical','date','version']){const bad=structuredClone(data);if(kind==='private-field')bad.releases[0].private_note='not public';if(kind==='canonical')bad.releases[0].canonical_url='https://example.invalid/';if(kind==='date')bad.releases[0].release.modified_at='bad-date';if(kind==='version')bad.manifest.schema_version='other';try{contract.validatePublicationSet(bad,{now:NOW});schemaFailures.push('accepted')}catch(e){schemaFailures.push(e.code)}}
const {materializeQueued,validateLiveReceipt}=await import('../lib/publication/runtime/materialize.mjs');const {queuedFixture,receiptFor,signedOIDC,policy,CLOCK}=await import('./fixtures/phase4b.mjs');const {uid}=await import('./fixtures/publication-v1.1.mjs');let n=30000;const candidate=materializeQueued({...queuedFixture(),ids:()=>uid(n++)});validateLiveReceipt(candidate,receiptFor(candidate),CLOCK);
const jwt=await signedOIDC();const {createOIDCVerifier}=await import('../lib/publication/runtime/oidc.mjs');const verifier=createOIDCVerifier({policy,keySource:async()=>({keys:[jwt.jwk]}),jobFacts:async()=>jwt.facts,now:()=>Date.parse(CLOCK)});const verified=await verifier.verify(await jwt.sign());
console.log(JSON.stringify({schemaFailures,materialized:contract.hashJSON(candidate.dataset),oidcVerified:verified.codeSHA==='a'.repeat(40),hash:contract.hashJSON(data),schemas:contract.hashJSON(contract.schemas),unicode:contract.hashJSON({a:1,b:'Ελληνικά'}),invalid,bytes:await adapters.byteHash(new Uint8Array([1,2,3])),runtimeModulesLoaded:true}));

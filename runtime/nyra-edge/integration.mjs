// Explicit dependency composition. No service client, credential or route mount.
import {Buffer} from 'node:buffer';
import {createPrivateDeliveryService,createPrivateDeliveryHandler} from '../../lib/publication/integration/service.mjs';
import {artifactProvenanceVerifier} from '../../lib/publication/integration/archive.mjs';
import {validatePublicFiles,independentObserver} from '../../lib/publication/integration/observer.mjs';
import {supabaseDispatchJournal,createPagesDispatcher} from '../../lib/publication/integration/dispatch.mjs';
import {createOIDCVerifier} from '../../lib/publication/runtime/oidc.mjs';
import {currentMainJobFacts} from '../../lib/publication/integration/github.mjs';
export function protectedVerifiers({policy,pagesAudience,getJSON,keySource,now=Date.now}){
 const jobFacts=currentMainJobFacts({getJSON,repository:policy.repository,environment:policy.environment});
 return {verifier:createOIDCVerifier({policy,keySource,jobFacts,now}),pagesVerifier:createOIDCVerifier({policy:{...policy,audience:pagesAudience},keySource,jobFacts,now})};
}
export function composePrivateDelivery({db,verifier,pagesVerifier,storage,github,publicReader,repository,baseSitemap,fetcher=fetch,clock=()=>new Date().toISOString(),enabled=false}){
 if(typeof globalThis.Buffer==='undefined')globalThis.Buffer=Buffer;
 const journal=supabaseDispatchJournal(db),provenance=artifactProvenanceVerifier({github,validateFiles:(files,ctx)=>validatePublicFiles(files,{...ctx,baseSitemap,now:clock()})});
 const observe=independentObserver({github,publicReader,provenance,baseSitemap,clock});
 const dispatcher=createPagesDispatcher({repository,journal,pagesVerifier,fetcher});
 const service=createPrivateDeliveryService({db,verifier,storage,provenance,observe,dispatcher,clock});
 return {handler:createPrivateDeliveryHandler({service,enabled}),service};
}

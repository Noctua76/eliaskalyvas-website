// Explicit dependency composition. No service client, credential or route mount.
import {Buffer} from 'node:buffer';
import {createPrivateDeliveryService,createPrivateDeliveryHandler} from '../../lib/publication/integration/service.mjs';
import {artifactProvenanceVerifier} from '../../lib/publication/integration/archive.mjs';
import {validatePublicFiles,independentObserver} from '../../lib/publication/integration/observer.mjs';
import {supabaseDispatchJournal,createPagesDispatcher} from '../../lib/publication/integration/dispatch.mjs';
import {policyGuard} from '../../lib/publication/runtime/governance.mjs';
import {createOIDCVerifier} from '../../lib/publication/runtime/oidc.mjs';
import {createProtectedOIDCVerifier,registeredGithubJobFacts} from '../../lib/publication/runtime/protected-identity.mjs';
export function protectedVerifiers({policy,pagesAudience,getJSON,keySource,store,requiredChecks,readPolicyState,now=Date.now}){
 const jobFacts=registeredGithubJobFacts({getJSON,store,policy,privilege:'publication',requiredChecks,readPolicyState,now});
 // Broker requests consume fresh jtis. The separately addressed Pages token
 // stays behind the existing one-shot, server-journaled dispatch boundary.
 const guard=policyGuard(policy,readPolicyState),pages=createOIDCVerifier({policy:{...policy,audience:pagesAudience},keySource,jobFacts,now});
 return {verifier:createProtectedOIDCVerifier({policy,privilege:'publication',store,getJSON,requiredChecks,keySource,readPolicyState,now}),pagesVerifier:Object.freeze({async verify(token){guard();const c=await pages.verify(token);guard();return c;},assert(c){guard();return pages.assert(c);}})};
}
export function composePrivateDelivery({db,verifier,pagesVerifier,storage,github,publicReader,repository,baseSitemap,pathScopeAuthority,fetcher=fetch,clock=()=>new Date().toISOString(),enabled=false}){
 if(typeof globalThis.Buffer==='undefined')globalThis.Buffer=Buffer;
 const journal=supabaseDispatchJournal(db),provenance=artifactProvenanceVerifier({github,validateFiles:async(files,ctx)=>{const pathScope=await pathScopeAuthority.forAttempt(ctx.attempt);return validatePublicFiles(files,{...ctx,baseSitemap,pathScope,now:clock()});}});
 const observe=independentObserver({github,publicReader,provenance,baseSitemap,pathScopeAuthority,clock});
 const dispatcher=createPagesDispatcher({repository,journal,pagesVerifier,fetcher});
 const service=createPrivateDeliveryService({db,verifier,storage,provenance,observe,dispatcher,clock});
 return {handler:createPrivateDeliveryHandler({service,enabled}),service};
}

// Test-only disabled composition. No real credential, dispatcher or public port.
import {composePrivateDelivery} from '../../runtime/nyra-edge/integration.mjs';
const forbidden=()=>{throw Error('NATIVE_TEST_DELIVERY_DISABLED');};
const {handler}=composePrivateDelivery({db:{rpc:forbidden},verifier:{verify:forbidden,assert:forbidden},pagesVerifier:{verify:forbidden,assert:forbidden},storage:{},github:{},publicReader:{},repository:'test/native',baseSitemap:'',pathScopeAuthority:{},fetcher:forbidden,enabled:false});
Deno.serve({hostname:'0.0.0.0',port:9000},handler);

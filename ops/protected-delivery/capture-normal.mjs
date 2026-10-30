import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {buildNormalProvenance,immutableNormalInventoryAuthority} from '../../lib/publication/integration/normal-provenance.mjs';
import {hashJSON} from '../../lib/publication/contract.mjs';
// Unprotected PR CI is evidence of reproducibility only, never an approved
// inventory registration. This record is explicitly labelled untrusted CI.
const codeSHA=process.env.NYRA_TEST_SHA;assert(/^[a-f0-9]{40}$/.test(codeSHA));
const builder={privilege:'build',assurance:'unprotected_ci',codeSHA,workflowSHA:codeSHA,jobWorkflowSHA:codeSHA,runId:process.env.GITHUB_RUN_ID||'1',runAttempt:process.env.GITHUB_RUN_ATTEMPT||'1',checkRunId:'1',acceptanceOnly:true};
const value=await buildNormalProvenance({codeSHA,builder});
const authority=immutableNormalInventoryAuthority({configurationSHA256:value.record.inventory.configurationSHA256,loadApprovedRecord:async()=>value});
await assert.rejects(authority.forAttempt({codeSHA}),/INVENTORY_BUILDER/);
assert.equal(value.digest,hashJSON(value.record));assert.equal(value.record.files.length,115);
assert(!value.record.files.some(f=>f.path==='.well-known/nyra-release.json'||/native-results|nyra_trust|normal-provenance/.test(f.path)));
// The public normal build must contain no private runtime/test canary strings.
for(const f of value.record.files)assert(!/PRIVATE_NATIVE_|SYNTHETIC_PHASE3_PUBLIC_TEST|P5B_PRIVATE_CANARY|PRIVATE_PROBE_STACK_SENTINEL|nyra_inspection_|nyra\.inspection\.v1|quarantined_private|native-results|nyra_trust/.test(await readFile('dist/'+f.path,'utf8')),f.path);
await mkdir('native-results',{recursive:true});await writeFile('native-results/normal-provenance.json',JSON.stringify({...value,trust:'UNPROTECTED_CI_NOT_APPROVED'},null,2));
console.log(JSON.stringify({codeSHA,files:value.record.files.length,digest:value.digest,trust:'UNPROTECTED_CI_NOT_APPROVED',realProtectedOIDC:'NOT VERIFIED'}));

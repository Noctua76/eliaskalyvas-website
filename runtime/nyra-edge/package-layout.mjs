// Package inventory only. No deploy command, endpoint, credentials or runtime mount.
// Preserve these relative paths; contract.mjs reads the unchanged schema files.
export const privateRuntimeFiles=Object.freeze([
 'runtime/nyra-edge/package.mjs','lib/publication/contract.mjs',
 'lib/publication/authority.mjs','lib/publication/authority-validation.mjs',
 'lib/publication/runtime/oidc.mjs','lib/publication/runtime/github-jobs.mjs',
 'lib/publication/runtime/protected-identity.mjs','lib/publication/runtime/governance.mjs',
 'lib/publication/runtime/materialize.mjs','lib/publication/runtime/machine.mjs',
 'lib/publication/runtime/assets.mjs','lib/publication/runtime/adapters.mjs','lib/publication/runtime/controller.mjs','lib/publication/runtime/artifact.mjs',
 ...['shared','release','manifest','event','receipt','dataset'].map(n=>'contracts/nyra-publication/v1.1/'+n+'.schema.json'),
 ...['api','instructions','evidence','presentation'].map(n=>'supabase/functions/nyra-api/lib/'+n+'.mjs')
]);

# NYRA v17 — Windows transfer readiness only

This branch changes no accepted source, generator, production workflow or host state.
The push-triggered workflow targets this exact branch on windows-2022, uses native
PowerShell 5.1 and Node 22, requests contents:read only, does not reference secrets,
and executes a newly introduced synthetic transport test.

The private v17 archive is not an input to this workflow. Only a generated public
synthetic ZIP is encrypted. AES-256-GCM authenticates content and envelope metadata;
RSA-3072 OAEP-SHA256 wraps a fresh 256-bit content key. The synthetic RSA private key
exists only as a process-local KeyObject and is never exported, logged or uploaded.
Only encrypted synthetic data and sanitized test proof are uploaded for one day.
The plaintext fixture directory and output workspace are removed and checked.

This fixture run establishes Windows/dependency/crypto/artifact capabilities only.
It does not establish a private input source, an externally held production
recipient key, a trusted secret-bearing workflow context, successor generation,
or native acceptance. Source/tree/TLS/retirement/signer pins remain unchanged.

Real private input and production encryption require a separately reviewed exact
context and approved private transfer/recipient-key route. The current connected
GitHub tools expose no Actions secret creation/update or workflow-dispatch tool.
Never place a signed Library URL in commits, PR text, workflow inputs or logs.
Never upload a plaintext successor to this public repository's artifacts.

Original generator and accepted compatibility tests are preserved without rerun.
No merge or production execution is authorized by this branch.

# Existing host — minimum read-only feasibility handoff

Run only inside the Owner's already authenticated normal Ubuntu SSH/Console session for the existing acceptance host. This is the fallback read-only feasibility requested by the Auditor; it grants no host write or preparation execution authority.

The connected provider GET currently returns HTTP403, and no existing-host command tool or SSH signing channel is exposed to the Implementation Agent. This single Owner-interface capture is necessary only for that unavailable authenticated channel. Do not send any private key, bearer or passphrase.

The command retrieves one public immutable source file into RAM, enforces its exact SHA-256 before execution, disables Python site setup and bytecode writes, and reports only command availability, Python/Node versions and free space for /opt and /tmp. It does not read private configuration, enumerate private files, invoke Docker, change services, create containers, fetch images or write files. A failure stops; do not substitute source hashes or retry without reconciliation.

Source SHA-256: 5f739e847ec8c6a11e11ed5cc70ea7658f46156652d7f36edecb9db34ab8dc81

```bash
python3 -I -B -S -c 'import hashlib,sys,urllib.request; d=urllib.request.urlopen("https://raw.githubusercontent.com/Noctua76/eliaskalyvas-website/e3206e848ce91adf1a8127d9ad97d6b2224fcfba/ops/stage3g-secure-prep/Read-HostFeasibility.py",timeout=15).read(16384); hashlib.sha256(d).hexdigest()=="5f739e847ec8c6a11e11ed5cc70ea7658f46156652d7f36edecb9db34ab8dc81" or sys.exit("SOURCE_HASH_MISMATCH"); exec(compile(d,"nyra-readonly-feasibility","exec"))'
```

Return only the resulting JSON or exact closed failure. A result is dependency/capacity evidence, not preparation approval, source alignment, G08 or live Trust Acceptance. No new four-hour or 15-minute cycle starts.

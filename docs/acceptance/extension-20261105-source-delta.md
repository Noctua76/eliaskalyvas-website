# Exact staged source delta

Base: `29a73458d4cd941e5ed514db56dc2c553d041bda`. New full source SHA must be the independently reviewed actual main after an approved merge; no prospective main SHA is invented here.

| File | Base raw SHA-256 | Proposed raw SHA-256 |
| --- | --- | --- |
| `ops/acceptance-bootstrap/cleanup.mjs` | `213775dd05951b92ccf8d6f35fbf1df63b8ad66d6f7396a7fb660056d71b3136` | `efa62b5beb8b1db09f2ce50bf36a46a57fd486e7f274bdfde0d0106d5111fea0` |
| `ops/acceptance-bootstrap/compose-trust.mjs` | `c03e64af1403d668817b9094ad67792f9f93d96634c798406762484fe534bd98` | `278f231974316fb0eccc783d07c25c351d9dfd213a031fd48deba58bff971a13` |
| `ops/acceptance-bootstrap/live-watcher.mjs` | `cb9adb5dd1eb76560c0e3d4ed7de9933122e89d6ffadbe95a9f61310992507db` | `a6bf50122e6e3d79d1a5e549253a6430eeaef66d2d3308388a2c2cc9b00edaa3` |
| `ops/acceptance-bootstrap/owner-source.mjs` | `2da6a9c520f58362ec224b5e0b309c133003de35e7a416db6a82d05fd26b64fc` | `3e119c06493d8f53ab984e1c7dceea8664a50c0fe218b9330a4fa1dc8307a644` |
| `ops/acceptance-bootstrap/replacement-target.mjs` | `f6a148a6604b1fd506b44e558c6f26b7b2ca98321bff9add8009cd5627e33f5e` | `57fd3d068119bc4952b34cf4f3004416235b89d94991ee2e503a50c3faae295a` |
| `ops/acceptance-bootstrap/repository-launch.mjs` | `cec0e25edf2f420cca41cae82ae032c963d41fa98013d739f39c4d121940059e` | `48256a126574403dcb53574afa907a0f23fc27eb4ed327c64a8923e5a39c23c1` |
| `ops/acceptance-bootstrap/repository-runtime.mjs` | `3ee720ae29f67cc67067cdc12b967af0c092b3ed5c466c2dbc7f561602176aba` | `0557c179aef00df480667c35489f007b950b8474c127f34bfe9440f051905dea` |

Seven staged files change; 50 of 57 remain byte-identical. The static closure remains exactly 57. No new operator utility is imported into it. Historical 57/57 candidate verification remains valid for source29; a NEW delta/57-byte verification is required for the new generation.

The personal-repository security correction is unchanged: `lib/publication/runtime/protected-identity.mjs` SHA-256 `a4dcc7fd2963c4ea4e3f1fab586ddad5dc0baddcc20b55bc0888329cc3151054`.

Immediate source29 alignment (not extension):

| File | Approved older bundle / b97 bytes (must match actual before) | Approved source29 after |
| --- | --- | --- |
| protected-identity.mjs | `bc9f4e709814fb9f18b274779750fc4c930c2f0fadf5600f5515633a72219072` | `a4dcc7fd2963c4ea4e3f1fab586ddad5dc0baddcc20b55bc0888329cc3151054` |
| replacement-target.mjs | `7e7c6694d331a7865f471fb9f24908c632c47c080106537c3799a911f6454587` | `f6a148a6604b1fd506b44e558c6f26b7b2ca98321bff9add8009cd5627e33f5e` |

Actual before-byte hashes have NOT been independently observed by this implementation session. The alignment preflight rejects any difference from this known historical pair, including a newer extension implementation.

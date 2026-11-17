"""Offline verifier ONLY. This file never calls the release generator or host."""
import argparse
import copy
import datetime as dt
import hashlib
import importlib.util
import json
import re
import sys
from pathlib import Path

sys.dont_write_bytecode = True
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--original', required=True)
parser.add_argument('--generated', required=True)
parser.add_argument('--report', required=True)
args = parser.parse_args()
original, new, report_path = Path(args.original), Path(args.generated), Path(args.report)
assert new.is_dir(), 'GENERATED_OUTPUT_MISSING_NO_GENERATION_PERFORMED'
assert not report_path.exists(), 'REPORT_EXISTS_NO_OVERWRITE'
h = lambda p: hashlib.sha256(p.read_bytes()).hexdigest()
j = lambda p: json.loads(p.read_text(encoding='utf-8-sig'))
old = original / 'actual-bound-release'
old_files = {p.relative_to(old).as_posix() for p in old.rglob('*') if p.is_file()}
new_files = {p.relative_to(new).as_posix() for p in new.rglob('*') if p.is_file()}
assert old_files == new_files, 'BOUND_FILE_SET_CHANGED'
changed = sorted(p for p in old_files if (old/p).read_bytes() != (new/p).read_bytes())
allowed = sorted(['ALIGNMENT-SCOPE.json', 'BINDING-REPORT.json', 'BOUND-RELEASE.json',
    'operator-package/OWNER-RENEWAL-RECOVERY-SCOPE.json',
    'operator-package/renewal-recovery-step.ps1', 'operator-package/SHA256SUMS'])
assert changed == allowed, ('UNEXPECTED_BOUND_DIFF', changed)
scope = j(new/'ALIGNMENT-SCOPE.json')
previous = j(old/'ALIGNMENT-SCOPE.json')
strip_time = lambda value: {k:v for k,v in value.items() if k not in ('notBefore','approvalNotAfter')}
assert strip_time(scope) == strip_time(previous), 'NON_TEMPORAL_ALIGNMENT_CHANGED'
assert strip_time(j(new/'operator-package/OWNER-RENEWAL-RECOVERY-SCOPE.json')) == strip_time(j(old/'operator-package/OWNER-RENEWAL-RECOVERY-SCOPE.json')), 'NON_TEMPORAL_PREPARATION_CHANGED'
parse = lambda value: dt.datetime.fromisoformat(value.replace('Z','+00:00'))
start, end = parse(scope['notBefore']), parse(scope['approvalNotAfter'])
assert (end-start).total_seconds() == 14400, 'FOUR_HOUR_BOUND'
assert parse(previous['approvalNotAfter']) <= start, 'WINDOW_OVERLAP'
assert end < parse('2026-11-22T19:17:37Z'), 'RETIREMENT_BOUND'
assert start <= dt.datetime.now(dt.timezone.utc) < end, 'WINDOW_NOT_CURRENT'
assert (end-dt.datetime.now(dt.timezone.utc)).total_seconds() > 1800, 'REVIEW_MARGIN_UNDER_30_MINUTES_STOP'
assert scope['sourceSHA'] == '4edff2353c55469918f2e3a90190916df9a8924d'
assert scope['treeSHA'] == '8fdac1689db7d0d2172481c4eb446bb20be18962'
assert scope['parents'] == ['8b82cc964bdbc1919caf91c2669ca154204c025d','225b1bc946b5626e9105f24afd644467852a91af']
tls = h(new/'operator-package/PR36-TLS-CARRY.json')
assert tls == '12d82a85c36e0c8216b9f6cdca26d9cd730f14954b952a2ecdc2218b337bb8ca', 'TLS_BYTES_CHANGED'
for name, digest in scope['helpers'].items():
    path = new/name
    if not path.exists(): path = new/'operator-package'/name
    assert h(path) == digest, ('ALIGNMENT_HELPER_PIN', name)
prep_path = 'operator-package/OWNER-RENEWAL-RECOVERY-SCOPE.json'
prep = j(new/prep_path)
assert len(prep['helperSHA256']) == 11
for name,digest in prep['helperSHA256'].items():
    assert h(new/'operator-package'/name) == digest, ('PREPARATION_HELPER_PIN', name)
assert (old/'operator-package/renewal-recovery-step.ps1').read_bytes().replace(h(old/prep_path).encode(), h(new/prep_path).encode()) == (new/'operator-package/renewal-recovery-step.ps1').read_bytes(), 'DEPENDENT_WRAPPER_CHANGED'
root = new/'operator-package'
seen = {}
for line in (root/'SHA256SUMS').read_text().splitlines():
    match = re.fullmatch(r'([a-f0-9]{64})  ([A-Za-z0-9._/-]+)', line)
    assert match, 'MANIFEST_FORMAT'
    digest, name = match.groups()
    assert name not in seen and not Path(name).is_absolute() and '..' not in Path(name).parts
    assert h(root/name) == digest, ('NEW_MANIFEST_HASH', name)
    seen[name] = digest
assert set(seen)|{'SHA256SUMS'} == {p.relative_to(root).as_posix() for p in root.rglob('*') if p.is_file()}, 'MANIFEST_FILE_SET'
inventory = j(new/'runtime-inventory.json')
assert len(inventory) == 64 and inventory == j(old/'runtime-inventory.json'), 'RUNTIME_INVENTORY_CHANGED'
spec = importlib.util.spec_from_file_location('nyra_offline_scope_only',new/'pr36-inactive-align.py')
native = importlib.util.module_from_spec(spec)
spec.loader.exec_module(native)
when = start + dt.timedelta(seconds=1)
native.validate_scope((new/'ALIGNMENT-SCOPE.json').read_bytes(),h(new/'ALIGNMENT-SCOPE.json'),tls,when)
negatives = []
def reject(label, value, instant=when, carry=tls):
    blob = json.dumps(value).encode()
    try: native.validate_scope(blob, hashlib.sha256(blob).hexdigest(), carry, instant)
    except RuntimeError: negatives.append(label)
    else: raise AssertionError(label)
reject('expired window',scope,end)
reject('not yet active',scope,start-dt.timedelta(seconds=1))
for field,value in [('targetSHA256','0'*64),('resourceId','617219250'),('treeSHA','0'*40),('configurationWrites',1),('credentialOperations',1),('serviceOperations',1),('dispatches',1),('providerMutations',1),('automaticRetries',1),('hostExpiresAt','2026-11-23T19:17:37Z')]:
    altered = copy.deepcopy(scope)
    altered[field] = value
    reject('altered '+field,altered)
reject('wrong TLS acknowledgment',scope,carry='0'*64)
report = {'marker':'NYRA_OFFLINE_GENERATED_SUCCESSOR_VERIFIED','status':'PASS',
    'alignmentScopeSHA256':h(new/'ALIGNMENT-SCOPE.json'),'preparationScopeSHA256':h(new/prep_path),
    'TLSCarryForwardSHA256':tls,'windowUTC':{'start':scope['notBefore'],'end':scope['approvalNotAfter']},
    'changedBoundFiles':changed,'newManifestPayloads':len(seen),'runtimeInventoryConsistency':64,
    'negativeScopeChecks':negatives,'hostCommands':0,'protectedExecution':False}
report_path.write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))

import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
const run=s=>execFileSync('python3',['-c',String.raw`
import importlib.util
p='ops/acceptance-bootstrap/extension-readonly-inventory.py'
spec=importlib.util.spec_from_file_location('inventory',p);m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
`+s],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}});
test('isolated namespace cannot produce a false host firewall verdict or invoke iptables',()=>{
 assert.match(run(String.raw`
checks=[]
f=m.firewall_observation('br-fixture','net:[other]','net:[host]',verify=lambda *a:checks.append(a))
assert f['firewallVerified'] is None and f['networkNamespaceVerified'] is False
assert f['status']=='NOT_OBSERVED_WRONG_NETWORK_NAMESPACE' and checks==[]
try:m.require_host_network_namespace(lambda p:'other' if '/self/' in p else 'host');raise AssertionError('wrong namespace accepted')
except RuntimeError as e:assert str(e)=='HOST_NETWORK_NAMESPACE_REQUIRED_FIREWALL_NOT_OBSERVED'
print('WRONG_NAMESPACE_CLOSED')`),/WRONG_NAMESPACE_CLOSED/);
});
test('host namespace confirms exactly the existing bridge rules; an unknown rule result stays unconfirmed',()=>{
 assert.match(run(String.raw`
checks=[]
def verify(*a):checks.append(a);return True
m.require_host_network_namespace(lambda p:'net:[host]')
f=m.firewall_observation('br-fixture','host','host',verify=verify)
assert f['firewallVerified'] is True and f['networkNamespaceVerified'] is True
assert len(checks)==2 and checks[0][2]=='INPUT' and checks[1][2]=='DOCKER-USER'
f=m.firewall_observation('br-fixture','host','host',verify=lambda *a:False)
assert f['status']=='HOST_RULES_NOT_CONFIRMED' and f['firewallVerified'] is False
print('HOST_NAMESPACE_ONLY')`),/HOST_NAMESPACE_ONLY/);
});

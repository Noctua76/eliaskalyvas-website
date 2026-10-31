import test from 'node:test';
import assert from 'node:assert/strict';
import {roleCommand,probePlan} from '../ops/acceptance-bootstrap/role-db-smoke.mjs';
test('Role probes are least-privilege, private and isolated by login',()=>{
 for(const [role,uid] of [['registrar',998],['broker',999]]){
  const args=roleCommand(role,uid,uid);
  assert(args.includes('--rm'));
  assert(args.includes('--read-only'));
  assert(args.includes('--cap-drop')&&args.includes('ALL'));
  assert(args.includes('--network')&&args.includes('nyra-5c-db-private'));
  assert(!args.includes('--publish')&&!args.includes('--publish-all'));
  const line=args.join(' ');
  assert(line.includes('/var/lib/nyra-5c/'+role+'/pg.json'));
  assert(!line.includes('/var/lib/nyra-5c/'+(role==='broker'?'registrar':'broker')+'/pg.json'));
  assert(!line.includes('/var/run/docker.sock'));
  assert(!line.includes('/opt/nyra-5c/private/db.env'));
  assert(!line.includes('GITHUB_TOKEN'));
 }
});
test('Role smoke check cannot be used to activate trust or grant other roles',()=>{
 assert.throws(()=>roleCommand('owner',998,998),/ROLE_PROBE_ARGS/);
 assert.throws(()=>roleCommand('broker',0,0),/ROLE_PROBE_ARGS/);
 const result=probePlan();
 assert.deepEqual(result.roles,['registrar','broker']);
 assert.equal(result.operation,'role-authentication-only');
 assert.equal(result.publicPorts,0);
 assert.equal(result.containersPermanent,0);
 assert.equal(result.authorization,false);
});

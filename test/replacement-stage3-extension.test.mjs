import test from 'node:test';
import assert from 'node:assert/strict';
import {validateReplacementTarget} from '../ops/acceptance-bootstrap/replacement-target.mjs';

const reviewed=()=>({
 schema:'nyra.acceptance.replacement.v1',
 bootstrapId:'nyra-acceptance-20261102-01',
 hostname:'nyra-acceptance-20261102-01',
 provider:'DigitalOcean',
 region:'fra1',
 origin:'https://nyra-acceptance.eliaskalyvas.gr',
 operatorCIDRs:['203.0.113.10/32'],
 cpu:4,memoryGiB:8,maximumHours:24,optionalResources:false,
 reviewedHead:'1dbeb46c4ad7ac39dfc313bf47361bf2868e50ee',
 resourceId:'615221104',ipv4:'139.59.136.219',
 createdAt:'2026-11-02T22:28:31Z',
 expiresAt:'2026-11-04T21:05:00Z',
 authorization:false
});
const clock=()=>Date.parse('2026-11-03T22:00:00Z');
test('exact approved Stage 3 target accepts extended deadline but grants no authorization',()=>{
 const x=validateReplacementTarget(reviewed(),{created:true,now:clock});
 assert.equal(x.created,true);
 assert.equal(x.authorization,false);
 assert.equal(x.liveAcceptance,false);
});
test('24h contract remains enforced for all other hosts and mutated extension details',()=>{
 const changes=[
 t=>{t.resourceId='615221105';},
 t=>{t.ipv4='139.59.136.220';},
 t=>{t.bootstrapId='nyra-other-acceptance';},
 t=>{t.hostname='nyra-other-acceptance';},
 t=>{t.expiresAt='2026-11-04T21:05:01Z';},
 t=>{t.expiresAt='2026-11-05T21:05:00Z';},
 t=>{t.origin='https://other.eliaskalyvas.gr';},
 t=>{t.createdAt='2026-11-01T21:05:00Z';},
 t=>{t.createdAt='2026-11-03T20:00:00Z';},
 t=>{t.authorization=true;},
 t=>{t.maximumHours=48;}
 ];
 for(const mutate of changes){const t=reviewed();mutate(t);assert.throws(()=>validateReplacementTarget(t,{created:true,now:clock}));}
});
test('exception closes at deadline; expired use requires explicit cleanup mode',()=>{
 const t=reviewed();
 assert.throws(()=>validateReplacementTarget(t,{created:true,now:()=>Date.parse(t.expiresAt)}),/REPLACEMENT_DEADLINE/);
 assert.equal(validateReplacementTarget(t,{created:true,allowExpired:true,now:()=>Date.parse(t.expiresAt)}).authorization,false);
});
test('ordinary host still permits standard 24-hour window',()=>{
 const t=reviewed();
 t.resourceId='12345';t.ipv4='93.184.216.34';
 t.createdAt='2026-11-03T21:00:00Z';t.expiresAt='2026-11-04T20:00:00Z';
 assert.equal(validateReplacementTarget(t,{created:true,now:clock}).created,true);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {canonicalize,ContractError} from '../lib/publication/canonical-json.mjs';
import {canonicalize as publicCanonicalize,ContractError as PublicError,hashJSON,parseContractJSON} from '../lib/publication/contract.mjs';
import {createHash} from 'node:crypto';
test('Canonical extraction preserves public function/class identity, hashing and parser errors',()=>{
 assert.equal(publicCanonicalize,canonicalize);assert.equal(PublicError,ContractError);
 const values=[null,true,false,0,Number.MAX_SAFE_INTEGER,'e\u0301',{z:[1,null,'😀'],a:'Ελλάδα'},Object.assign(Object.create(null),{b:2,a:1})];
 for(const v of values){assert.equal(publicCanonicalize(v),canonicalize(v));assert.equal(hashJSON(v),createHash('sha256').update(canonicalize(v),'utf8').digest('hex'));assert.equal(canonicalize(parseContractJSON(canonicalize(v))),canonicalize(v));}
 assert.throws(()=>parseContractJSON('{"a":1,"a":2}'),e=>e instanceof ContractError&&e.code==='DUPLICATE_JSON_KEY');
 assert.throws(()=>canonicalize(-0),e=>e instanceof PublicError&&e.code==='NON_CANONICAL_NUMBER');
});

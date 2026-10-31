// Dependency-free canonical JSON domain shared by contracts and private IPC.
export class ContractError extends Error {
  constructor(code) { super(code); this.name = 'ContractError'; this.code = code; }
}
const need = (condition, code) => { if (!condition) throw new ContractError(code); };

// RFC 8785 canonical serialization for the contract's JSON domain (safe integers only).
// Strings are preserved exactly; no Unicode normalization after approval.
export function canonicalize(value) {
  const ancestors = new Set();
  function encode(v) {
    if (v === null || typeof v === 'boolean') return JSON.stringify(v);
    if (typeof v === 'number') {
      need(Number.isSafeInteger(v) && !Object.is(v, -0), 'NON_CANONICAL_NUMBER');
      return JSON.stringify(v);
    }
    if (typeof v === 'string') {
      need(!/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/u.test(v), 'INVALID_UNICODE');
      return JSON.stringify(v);
    }
    need(v && typeof v === 'object', 'NON_JSON_VALUE');
    need(!ancestors.has(v), 'CYCLIC_VALUE');
    need(Object.getOwnPropertySymbols(v).length === 0, 'NON_JSON_VALUE');
    ancestors.add(v);
    let result;
    if (Array.isArray(v)) {
      need(Object.keys(v).length === v.length && Object.keys(v).every((k,i) => k === String(i)), 'NON_JSON_ARRAY');
      result = '[' + Array.from(v, encode).join(',') + ']';
    } else {
      need(Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null, 'NON_JSON_OBJECT');
      const keys = Reflect.ownKeys(v);
      need(keys.every(k => Object.getOwnPropertyDescriptor(v,k).enumerable && 'value' in Object.getOwnPropertyDescriptor(v,k)), 'NON_JSON_OBJECT');
      result = '{' + keys.sort().map(k => JSON.stringify(k) + ':' + encode(v[k])).join(',') + '}';
    }
    ancestors.delete(v);
    return result;
  }
  return encode(value);
}

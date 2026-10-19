"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stableStringify = void 0;
exports.stringify = stringify;
exports.stringifyBatch = stringifyBatch;
exports.createSerializerCache = createSerializerCache;
exports.stringifyJson = stringifyJson;
exports.stringifyJsonBatch = stringifyJsonBatch;
exports.selectJson = selectJson;
/** Upstream-compatible traversal, deliberately using JavaScript semantics. */
function stringify(data, options) {
    const opts = typeof options === 'function' ? { cmp: options } : options || {};
    const cycles = typeof opts.cycles === 'boolean' ? opts.cycles : false;
    const cmp = opts.cmp && ((f) => (node) => (a, b) => f({ key: a, value: node[a] }, { key: b, value: node[b] }))(opts.cmp);
    const seen = [];
    // `any` is intentional here: access, coercion, exceptions and reentrancy are
    // observable upstream behavior; preprocessing values changes that behavior.
    function visit(node) {
        if (node && node.toJSON && typeof node.toJSON === 'function')
            node = node.toJSON();
        if (node === undefined)
            return;
        if (typeof node === 'number')
            return isFinite(node) ? '' + node : 'null';
        if (typeof node !== 'object')
            return JSON.stringify(node);
        if (Array.isArray(node)) {
            let out = '[';
            for (let i = 0; i < node.length; i++) {
                if (i)
                    out += ',';
                out += visit(node[i]) || 'null';
            }
            return out + ']';
        }
        if (node === null)
            return 'null';
        if (seen.indexOf(node) !== -1) {
            if (cycles)
                return JSON.stringify('__cycle__');
            throw new TypeError('Converting circular structure to JSON');
        }
        const seenIndex = seen.push(node) - 1;
        const keys = Object.keys(node).sort(cmp && cmp(node));
        let out = '';
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const value = visit(node[key]);
            if (!value)
                continue;
            if (out)
                out += ',';
            out += JSON.stringify(key) + ':' + value;
        }
        seen.splice(seenIndex, 1);
        return '{' + out + '}';
    }
    return visit(data);
}
exports.stableStringify = stringify;
/** Ordered JS compatibility batch; this API does not cross the native boundary. */
function stringifyBatch(values, options) {
    if (!Array.isArray(values))
        throw new TypeError('values must be an array');
    return Array.from(values, value => stringify(value, options));
}
/** Caller MUST change version whenever serialization-visible state changes. */
function createSerializerCache(options) {
    let entries = new WeakMap();
    return {
        stringify(value, version) {
            if (arguments.length < 2)
                throw new TypeError('An explicit version is required');
            if ((typeof value !== 'object' || value === null) && typeof value !== 'function')
                throw new TypeError('Cache keys must be objects');
            const hit = entries.get(value);
            if (hit && Object.is(hit.version, version))
                return hit.output;
            const output = stringify(value, options);
            entries.set(value, { version, output });
            return output;
        },
        delete(value) { return entries.delete(value); },
        clear() { entries = new WeakMap(); }
    };
}
let binding;
function native() {
    return binding ??= require('../../native/binding.js');
}
function limits(options) {
    for (const [name, max] of [['maxDepth', 128], ['maxBytes', 67108864]]) {
        const value = options?.[name];
        if (value !== undefined && (!Number.isInteger(value) || value < 1 || value > max))
            throw new RangeError(`${name} must be an integer from 1 to ${max}`);
    }
    return [options?.maxDepth, options?.maxBytes];
}
/** Rust JSON-text sorter; preserves scalar token spelling, not JS normalization. */
function stringifyJson(input, options) {
    if (typeof input !== 'string')
        throw new TypeError('input must be a JSON string');
    if (!input.isWellFormed())
        throw new TypeError('JSON text must contain well-formed UTF-16; escape lone surrogates');
    return native().stringifyJson(input, ...limits(options));
}
/** Single native call. Maximum 1024 documents and 64 MiB combined UTF-8 input. */
function stringifyJsonBatch(inputs, options) {
    if (!Array.isArray(inputs) || inputs.some(input => typeof input !== 'string'))
        throw new TypeError('inputs must be an array of JSON strings');
    if (inputs.length > 1024)
        throw new RangeError('Batch limit is 1024 documents');
    let total = 0;
    for (const input of inputs) {
        if (typeof input !== 'string' || !input.isWellFormed())
            throw new TypeError('JSON text must contain well-formed UTF-16; escape lone surrogates');
        total += Buffer.byteLength(input);
    }
    if (total > 67108864)
        throw new RangeError('Batch input limit is 64 MiB');
    return native().stringifyJsonBatch(inputs, ...limits(options));
}
/** Extract raw JSON text using a JSON Pointer subset; missing paths yield undefined. */
function selectJson(input, path, options) {
    if (typeof input !== 'string' || !input.isWellFormed())
        throw new TypeError('input must be well-formed JSON text');
    if (typeof path !== 'string' || !path.isWellFormed())
        throw new TypeError('path must be a well-formed string');
    if (path !== '' && !path.startsWith('/'))
        throw new RangeError('path must be empty or start with /');
    if (Buffer.byteLength(path) > 65536)
        throw new RangeError('Path limit is 64 KiB');
    const segments = path === '' ? [] : path.slice(1).split('/').map(segment => {
        if (/~(?![01])/u.test(segment))
            throw new RangeError('Invalid JSON pointer escape');
        return segment.replace(/~1/g, '/').replace(/~0/g, '~');
    });
    if (segments.length > 128)
        throw new RangeError('Path limit is 128 segments');
    return native().selectJson(input, segments, ...limits(options)) ?? undefined;
}
exports.default = stringify;

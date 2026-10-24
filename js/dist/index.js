"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.JsonError = void 0;
exports.canonicalize = canonicalize;
exports.canonicalizeAsync = canonicalizeAsync;
exports.sortKeys = sortKeys;
exports.sortKeysAsync = sortKeysAsync;
exports.minify = minify;
exports.minifyAsync = minifyAsync;
exports.validate = validate;
exports.isValid = isValid;
exports.select = select;
exports.equal = equal;
exports.canonicalHash = canonicalHash;
exports.canonicalizeValue = canonicalizeValue;
const node_crypto_1 = require("node:crypto");
/** Thrown for any input the engine rejects. Position fields are absent for live values. */
class JsonError extends SyntaxError {
    code;
    /** UTF-8 byte offset into the input. */
    offset;
    /** One-based line. */
    line;
    /** One-based column in UTF-16 code units, as editors count. */
    column;
    /** For `equal`, which argument failed: 0 or 1. */
    argument;
    constructor(code, reason, position) {
        super(position ? `${reason} at line ${position.line} column ${position.column}` : reason);
        this.name = 'JsonError';
        this.code = code;
        if (position)
            Object.assign(this, position);
    }
}
exports.JsonError = JsonError;
let loaded;
// Loaded on first use so `canonicalizeValue` works even where the addon cannot load.
const native = () => (loaded ??= require('../../native/binding.js'));
const REASON = /^(ERR_JSON_[A-Z_]+)\|(\d+)\|(\d+)\|(\d+)\|(\d)\|(.*)$/s;
function rethrow(error) {
    const match = error instanceof Error ? REASON.exec(error.message) : null;
    if (!match)
        throw error;
    const [, code, offset, line, column, argument, reason] = match;
    throw new JsonError(code, reason, {
        offset: Number(offset), line: Number(line), column: Number(column), argument: Number(argument),
    });
}
function call(run) {
    try {
        return run();
    }
    catch (error) {
        rethrow(error);
    }
}
const encoder = new TextEncoder();
let scratch = new Uint8Array(0);
const RETAIN_LIMIT = 16 * 1024 * 1024;
const REPLACEMENT = Buffer.from([0xef, 0xbf, 0xbd]);
// Every encoder, Node-API's included, silently turns lone surrogates into U+FFFD.
function wellFormed(text, argument) {
    if (!text.isWellFormed()) {
        throw new JsonError('ERR_JSON_ENCODING', 'JSON text contains a lone UTF-16 surrogate character; escape it as \\uXXXX', { ...locateIllFormed(text), argument });
    }
}
/**
 * Node-API string conversion measures the UTF-8 length in one full pass, zero-fills,
 * then transcodes in a second pass. From 1 KiB up, `encodeInto` a reused buffer is
 * 6-50% faster end to end; below that the extra objects cost more. The surrogate
 * check then only runs when the output contains U+FFFD, which a byte search rules
 * out an order of magnitude faster than `isWellFormed`. The reused buffer stays
 * under 16 MiB, and only argument 0 uses it so `equal` never aliases its inputs.
 */
// Callers must read every option before this runs: an option getter that calls the
// API again would otherwise overwrite the shared buffer before the native call.
function utf8(text, argument) {
    if (text.length < 1024) {
        wellFormed(text, argument);
        return text;
    }
    let bytes;
    if (argument === 0 && scratch.length >= text.length) {
        const { read, written } = encoder.encodeInto(text, scratch);
        if (read === text.length)
            bytes = Buffer.from(scratch.buffer, 0, written);
    }
    if (bytes === undefined) {
        const size = Buffer.byteLength(text, 'utf8');
        if (argument === 0 && size <= RETAIN_LIMIT) {
            scratch = new Uint8Array(Math.min(RETAIN_LIMIT, Math.ceil(size * 1.25)));
            bytes = Buffer.from(scratch.buffer, 0, encoder.encodeInto(text, scratch).written);
        }
        else {
            bytes = Buffer.from(text, 'utf8');
        }
    }
    if (bytes.indexOf(REPLACEMENT) !== -1)
        wellFormed(text, argument);
    return bytes;
}
function source(input, argument = 0) {
    if (typeof input === 'string')
        return utf8(input, argument);
    if (Buffer.isBuffer(input))
        return input;
    if (input instanceof Uint8Array)
        return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
    throw new TypeError('JSON input must be a string, Buffer or Uint8Array');
}
function locateIllFormed(text) {
    let line = 1, lineStart = 0, i = 0;
    for (; i < text.length; i++) {
        const unit = text.charCodeAt(i);
        if (unit === 10) {
            line++;
            lineStart = i + 1;
            continue;
        }
        if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < text.length) {
            const next = text.charCodeAt(i + 1);
            if (next >= 0xdc00 && next <= 0xdfff) {
                i++;
                continue;
            }
        }
        if (unit >= 0xd800 && unit <= 0xdfff)
            break;
    }
    return { offset: Buffer.byteLength(text.slice(0, i)), line, column: i - lineStart + 1 };
}
function limits(options) {
    if (options === undefined)
        return [undefined, undefined];
    if (typeof options !== 'object' || options === null)
        throw new TypeError('options must be an object');
    const { maxDepth, maxBytes } = options;
    return [integer('maxDepth', maxDepth, 1024), integer('maxBytes', maxBytes, 2 ** 30)];
}
function integer(name, value, max) {
    if (value === undefined)
        return undefined;
    if (!Number.isInteger(value) || value < 1 || value > max) {
        throw new RangeError(`${name} must be an integer from 1 to ${max}`);
    }
    return value;
}
function strict(options) {
    const value = options?.strictNumbers;
    if (value !== undefined && typeof value !== 'boolean')
        throw new TypeError('strictNumbers must be a boolean');
    return value === true;
}
function asBuffer(options) {
    const output = options?.output;
    if (output === undefined || output === 'string')
        return false;
    if (output === 'buffer')
        return true;
    throw new TypeError("output must be 'string' or 'buffer'");
}
const MINIFY = 0, SORT = 1, CANONICAL = 2;
function transform(mode, input, options) {
    const [maxDepth, maxBytes] = limits(options);
    const buffer = asBuffer(options), exact = strict(options);
    const text = source(input);
    return call(() => native().transformSync(text, mode, buffer, maxDepth, maxBytes, exact));
}
function transformAsync(mode, input, options) {
    try {
        const [maxDepth, maxBytes] = limits(options);
        const buffer = asBuffer(options), exact = strict(options);
        const text = source(input);
        return native().transformAsync(text, mode, buffer, maxDepth, maxBytes, exact).catch(rethrow);
    }
    catch (error) {
        return Promise.reject(error);
    }
}
function canonicalize(input, options) {
    return transform(CANONICAL, input, options);
}
function canonicalizeAsync(input, options) {
    return transformAsync(CANONICAL, input, options);
}
function sortKeys(input, options) {
    return transform(SORT, input, options);
}
function sortKeysAsync(input, options) {
    return transformAsync(SORT, input, options);
}
function minify(input, options) {
    return transform(MINIFY, input, options);
}
function minifyAsync(input, options) {
    return transformAsync(MINIFY, input, options);
}
/** Throws `JsonError` with line and column when the text is not RFC 8259 JSON. */
function validate(input, options) {
    const [maxDepth, maxBytes] = limits(options);
    const text = source(input);
    call(() => native().validate(text, maxDepth, maxBytes));
}
function isValid(input, options) {
    try {
        validate(input, options);
        return true;
    }
    catch (error) {
        if (error instanceof JsonError)
            return false;
        throw error;
    }
}
/**
 * Returns the raw JSON text at an RFC 6901 JSON Pointer such as `/users/0/name`,
 * or `undefined` when nothing is there. The whole document is still validated.
 * Duplicate keys resolve to the last one, as with `JSON.parse`.
 */
function select(input, pointer, options) {
    const path = parsePointer(pointer);
    const [maxDepth, maxBytes] = limits(options);
    const text = source(input);
    return call(() => native().select(text, path, maxDepth, maxBytes)) ?? undefined;
}
function parsePointer(pointer) {
    if (typeof pointer !== 'string')
        throw new TypeError('pointer must be a string');
    if (pointer === '')
        return [];
    if (!pointer.startsWith('/'))
        throw new RangeError("JSON Pointer must be empty or start with '/'");
    if (!pointer.isWellFormed())
        throw new RangeError('JSON Pointer contains a lone surrogate');
    return pointer.slice(1).split('/').map(segment => {
        if (/~(?![01])/.test(segment))
            throw new RangeError(`invalid escape in JSON Pointer segment '${segment}'`);
        return segment.replaceAll('~1', '/').replaceAll('~0', '~');
    });
}
/** True when two documents are the same JSON value, compared by canonical form. */
function equal(a, b, options) {
    const [maxDepth, maxBytes] = limits(options);
    const exact = strict(options);
    // `b` first: only `a` may use the shared buffer, and nothing may run after it is filled.
    const right = source(b, 1), left = source(a, 0);
    return call(() => native().equal(left, right, maxDepth, maxBytes, exact));
}
/** Digest of the RFC 8785 form: a content address that ignores formatting and key order. */
function canonicalHash(input, options) {
    const bytes = canonicalize(input, { ...options, output: 'buffer' });
    return (0, node_crypto_1.createHash)(options?.algorithm ?? 'sha256').update(bytes).digest(options?.encoding ?? 'hex');
}
/**
 * RFC 8785 for live JavaScript values, in plain JavaScript. Follows `JSON.stringify`
 * for `toJSON`, wrapper objects and skipped members, but throws where RFC 8785
 * forbids output: non-finite numbers, lone surrogates and cycles.
 */
function canonicalizeValue(value) {
    const stack = new Set();
    const visit = (key, input) => {
        let value = input;
        if ((typeof value === 'object' && value !== null) || typeof value === 'bigint') {
            const toJSON = value.toJSON;
            if (typeof toJSON === 'function')
                value = toJSON.call(value, key);
        }
        if (value instanceof Number || value instanceof String || value instanceof Boolean)
            value = value.valueOf();
        switch (typeof value) {
            case 'string':
                if (!value.isWellFormed())
                    throw new JsonError('ERR_JSON_LONE_SURROGATE', 'string contains a lone UTF-16 surrogate');
                return JSON.stringify(value);
            case 'number':
                if (!Number.isFinite(value))
                    throw new JsonError('ERR_JSON_NUMBER_RANGE', `${value} has no JSON representation`);
                return String(value);
            case 'boolean':
                return value ? 'true' : 'false';
            case 'bigint':
                throw new TypeError('BigInt value cannot be canonicalized; convert it to a number or string first');
            case 'object': {
                if (value === null)
                    return 'null';
                if (stack.has(value))
                    throw new TypeError('Converting circular structure to JSON');
                stack.add(value);
                let out;
                if (Array.isArray(value)) {
                    out = '[' + value.map((item, i) => visit(String(i), item) ?? 'null').join(',') + ']';
                }
                else {
                    const record = value;
                    // Default sort compares UTF-16 code units, which is RFC 8785 order.
                    const members = [];
                    for (const name of Object.keys(record).sort()) {
                        if (!name.isWellFormed())
                            throw new JsonError('ERR_JSON_LONE_SURROGATE', 'object key contains a lone UTF-16 surrogate');
                        const member = visit(name, record[name]);
                        if (member !== undefined)
                            members.push(JSON.stringify(name) + ':' + member);
                    }
                    out = '{' + members.join(',') + '}';
                }
                stack.delete(value);
                return out;
            }
            default:
                return undefined;
        }
    };
    return visit('', value);
}

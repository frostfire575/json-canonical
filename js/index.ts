import { createHash, type BinaryToTextEncoding } from 'node:crypto';

/** JSON text as a string or as UTF-8 bytes (Buffer or any Uint8Array). */
export type JsonInput = string | Uint8Array;

export interface LimitOptions {
  /** Maximum container nesting, 1..1024. Default 128. */
  maxDepth?: number;
  /** Maximum UTF-8 bytes of input, and separately of output, 1..2^30. Default 64 MiB. */
  maxBytes?: number;
}

export interface CanonicalOptions extends LimitOptions {
  /**
   * Throw `ERR_JSON_PRECISION` when the canonical number would denote a different
   * decimal value than the one written, such as an integer ID above 2^53 losing
   * digits. `0.1` passes because it prints back as `0.1`. Default false, which
   * rounds as RFC 8785 and `JSON.parse` do.
   */
  strictNumbers?: boolean;
}

export type OutputOption = { output?: 'string' } | { output: 'buffer' };

export type JsonErrorCode =
  | 'ERR_JSON_SYNTAX'
  | 'ERR_JSON_ENCODING'
  | 'ERR_JSON_DEPTH'
  | 'ERR_JSON_SIZE'
  | 'ERR_JSON_DUPLICATE_KEY'
  | 'ERR_JSON_LONE_SURROGATE'
  | 'ERR_JSON_NUMBER_RANGE'
  | 'ERR_JSON_PRECISION';

/** Thrown for any input the engine rejects. Position fields are absent for live values. */
export class JsonError extends SyntaxError {
  readonly code: JsonErrorCode;
  /** UTF-8 byte offset into the input. */
  readonly offset?: number;
  /** One-based line. */
  readonly line?: number;
  /** One-based column in UTF-16 code units, as editors count. */
  readonly column?: number;
  /** For `equal`, which argument failed: 0 or 1. */
  readonly argument?: number;

  constructor(code: JsonErrorCode, reason: string, position?: { offset: number; line: number; column: number; argument: number }) {
    super(position ? `${reason} at line ${position.line} column ${position.column}` : reason);
    this.name = 'JsonError';
    this.code = code;
    if (position) Object.assign(this, position);
  }
}

interface Binding {
  transformSync(input: string | Buffer, mode: number, asBuffer: boolean, maxDepth: number | undefined, maxBytes: number | undefined, strict: boolean): string | Buffer;
  transformAsync(input: string | Buffer, mode: number, asBuffer: boolean, maxDepth: number | undefined, maxBytes: number | undefined, strict: boolean): Promise<string | Buffer>;
  validate(input: string | Buffer, maxDepth: number | undefined, maxBytes: number | undefined): void;
  select(input: string | Buffer, path: string[], maxDepth: number | undefined, maxBytes: number | undefined): string | null;
  equal(a: string | Buffer, b: string | Buffer, maxDepth: number | undefined, maxBytes: number | undefined, strict: boolean): boolean;
}

let loaded: Binding | undefined;
// Loaded on first use so `canonicalizeValue` works even where the addon cannot load.
const native = (): Binding => (loaded ??= require('../../native/binding.js') as Binding);

const REASON = /^(ERR_JSON_[A-Z_]+)\|(\d+)\|(\d+)\|(\d+)\|(\d)\|(.*)$/s;

function rethrow(error: unknown): never {
  const match = error instanceof Error ? REASON.exec(error.message) : null;
  if (!match) throw error;
  const [, code, offset, line, column, argument, reason] = match;
  throw new JsonError(code as JsonErrorCode, reason!, {
    offset: Number(offset), line: Number(line), column: Number(column), argument: Number(argument),
  });
}

function call<T>(run: () => T): T {
  try {
    return run();
  } catch (error) {
    rethrow(error);
  }
}

const encoder = new TextEncoder();
let scratch = new Uint8Array(0);

const RETAIN_LIMIT = 16 * 1024 * 1024;
const REPLACEMENT = Buffer.from([0xef, 0xbf, 0xbd]);

// Every encoder, Node-API's included, silently turns lone surrogates into U+FFFD.
function wellFormed(text: string, argument: number): void {
  if (!text.isWellFormed()) {
    throw new JsonError('ERR_JSON_ENCODING', 'JSON text contains a lone UTF-16 surrogate character; escape it as \\uXXXX',
      { ...locateIllFormed(text), argument });
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
function utf8(text: string, argument: number): string | Buffer {
  if (text.length < 1024) {
    wellFormed(text, argument);
    return text;
  }
  let bytes: Buffer | undefined;
  if (argument === 0 && scratch.length >= text.length) {
    const { read, written } = encoder.encodeInto(text, scratch);
    if (read === text.length) bytes = Buffer.from(scratch.buffer, 0, written);
  }
  if (bytes === undefined) {
    const size = Buffer.byteLength(text, 'utf8');
    if (argument === 0 && size <= RETAIN_LIMIT) {
      scratch = new Uint8Array(Math.min(RETAIN_LIMIT, Math.ceil(size * 1.25)));
      bytes = Buffer.from(scratch.buffer, 0, encoder.encodeInto(text, scratch).written);
    } else {
      bytes = Buffer.from(text, 'utf8');
    }
  }
  if (bytes.indexOf(REPLACEMENT) !== -1) wellFormed(text, argument);
  return bytes;
}

function source(input: unknown, argument = 0): string | Buffer {
  if (typeof input === 'string') return utf8(input, argument);
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError('JSON input must be a string, Buffer or Uint8Array');
}

function locateIllFormed(text: string) {
  let line = 1, lineStart = 0, i = 0;
  for (; i < text.length; i++) {
    const unit = text.charCodeAt(i);
    if (unit === 10) { line++; lineStart = i + 1; continue; }
    if (unit >= 0xd800 && unit <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) { i++; continue; }
    }
    if (unit >= 0xd800 && unit <= 0xdfff) break;
  }
  return { offset: Buffer.byteLength(text.slice(0, i)), line, column: i - lineStart + 1 };
}

function limits(options: LimitOptions | undefined): [number | undefined, number | undefined] {
  if (options === undefined) return [undefined, undefined];
  if (typeof options !== 'object' || options === null) throw new TypeError('options must be an object');
  const { maxDepth, maxBytes } = options;
  return [integer('maxDepth', maxDepth, 1024), integer('maxBytes', maxBytes, 2 ** 30)];
}

function integer(name: string, value: unknown, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > max) {
    throw new RangeError(`${name} must be an integer from 1 to ${max}`);
  }
  return value as number;
}

function strict(options: CanonicalOptions | undefined): boolean {
  const value = options?.strictNumbers;
  if (value !== undefined && typeof value !== 'boolean') throw new TypeError('strictNumbers must be a boolean');
  return value === true;
}

function asBuffer(options: { output?: unknown } | undefined): boolean {
  const output = options?.output;
  if (output === undefined || output === 'string') return false;
  if (output === 'buffer') return true;
  throw new TypeError("output must be 'string' or 'buffer'");
}

const MINIFY = 0, SORT = 1, CANONICAL = 2;

function transform(mode: number, input: JsonInput, options: (CanonicalOptions & { output?: unknown }) | undefined) {
  const [maxDepth, maxBytes] = limits(options);
  const buffer = asBuffer(options), exact = strict(options);
  const text = source(input);
  return call(() => native().transformSync(text, mode, buffer, maxDepth, maxBytes, exact));
}

function transformAsync(mode: number, input: JsonInput, options: (CanonicalOptions & { output?: unknown }) | undefined) {
  try {
    const [maxDepth, maxBytes] = limits(options);
    const buffer = asBuffer(options), exact = strict(options);
    const text = source(input);
    return native().transformAsync(text, mode, buffer, maxDepth, maxBytes, exact).catch(rethrow);
  } catch (error) {
    return Promise.reject(error);
  }
}

/**
 * RFC 8785 JSON Canonicalization Scheme. Equal JSON values give identical output,
 * so the result can be hashed or signed. Rejects duplicate keys, lone surrogates
 * and numbers outside the double range.
 */
export function canonicalize(input: JsonInput, options?: CanonicalOptions & { output?: 'string' }): string;
export function canonicalize(input: JsonInput, options: CanonicalOptions & { output: 'buffer' }): Buffer;
export function canonicalize(input: JsonInput, options?: CanonicalOptions & OutputOption): string | Buffer {
  return transform(CANONICAL, input, options);
}

/** Same as `canonicalize`, on the libuv thread pool so large documents do not block the event loop. */
export function canonicalizeAsync(input: JsonInput, options?: CanonicalOptions & { output?: 'string' }): Promise<string>;
export function canonicalizeAsync(input: JsonInput, options: CanonicalOptions & { output: 'buffer' }): Promise<Buffer>;
export function canonicalizeAsync(input: JsonInput, options?: CanonicalOptions & OutputOption): Promise<string | Buffer> {
  return transformAsync(CANONICAL, input, options);
}

/**
 * Recursively sorts object keys by UTF-16 code units and removes whitespace, keeping
 * every number and string token exactly as written (`1.10` stays `1.10`, big integers
 * keep all digits). Rejects duplicate keys.
 */
export function sortKeys(input: JsonInput, options?: LimitOptions & { output?: 'string' }): string;
export function sortKeys(input: JsonInput, options: LimitOptions & { output: 'buffer' }): Buffer;
export function sortKeys(input: JsonInput, options?: LimitOptions & OutputOption): string | Buffer {
  return transform(SORT, input, options);
}

export function sortKeysAsync(input: JsonInput, options?: LimitOptions & { output?: 'string' }): Promise<string>;
export function sortKeysAsync(input: JsonInput, options: LimitOptions & { output: 'buffer' }): Promise<Buffer>;
export function sortKeysAsync(input: JsonInput, options?: LimitOptions & OutputOption): Promise<string | Buffer> {
  return transformAsync(SORT, input, options);
}

/** Removes insignificant whitespace after validating, keeping order and tokens. */
export function minify(input: JsonInput, options?: LimitOptions & { output?: 'string' }): string;
export function minify(input: JsonInput, options: LimitOptions & { output: 'buffer' }): Buffer;
export function minify(input: JsonInput, options?: LimitOptions & OutputOption): string | Buffer {
  return transform(MINIFY, input, options);
}

export function minifyAsync(input: JsonInput, options?: LimitOptions & { output?: 'string' }): Promise<string>;
export function minifyAsync(input: JsonInput, options: LimitOptions & { output: 'buffer' }): Promise<Buffer>;
export function minifyAsync(input: JsonInput, options?: LimitOptions & OutputOption): Promise<string | Buffer> {
  return transformAsync(MINIFY, input, options);
}

/** Throws `JsonError` with line and column when the text is not RFC 8259 JSON. */
export function validate(input: JsonInput, options?: LimitOptions): void {
  const [maxDepth, maxBytes] = limits(options);
  const text = source(input);
  call(() => native().validate(text, maxDepth, maxBytes));
}

export function isValid(input: JsonInput, options?: LimitOptions): boolean {
  try {
    validate(input, options);
    return true;
  } catch (error) {
    if (error instanceof JsonError) return false;
    throw error;
  }
}

/**
 * Returns the raw JSON text at an RFC 6901 JSON Pointer such as `/users/0/name`,
 * or `undefined` when nothing is there. The whole document is still validated.
 * Duplicate keys resolve to the last one, as with `JSON.parse`.
 */
export function select(input: JsonInput, pointer: string, options?: LimitOptions): string | undefined {
  const path = parsePointer(pointer);
  const [maxDepth, maxBytes] = limits(options);
  const text = source(input);
  return call(() => native().select(text, path, maxDepth, maxBytes)) ?? undefined;
}

function parsePointer(pointer: unknown): string[] {
  if (typeof pointer !== 'string') throw new TypeError('pointer must be a string');
  if (pointer === '') return [];
  if (!pointer.startsWith('/')) throw new RangeError("JSON Pointer must be empty or start with '/'");
  if (!pointer.isWellFormed()) throw new RangeError('JSON Pointer contains a lone surrogate');
  return pointer.slice(1).split('/').map(segment => {
    if (/~(?![01])/.test(segment)) throw new RangeError(`invalid escape in JSON Pointer segment '${segment}'`);
    return segment.replaceAll('~1', '/').replaceAll('~0', '~');
  });
}

/** True when two documents are the same JSON value, compared by canonical form. */
export function equal(a: JsonInput, b: JsonInput, options?: CanonicalOptions): boolean {
  const [maxDepth, maxBytes] = limits(options);
  const exact = strict(options);
  // `b` first: only `a` may use the shared buffer, and nothing may run after it is filled.
  const right = source(b, 1), left = source(a, 0);
  return call(() => native().equal(left, right, maxDepth, maxBytes, exact));
}

export interface HashOptions extends CanonicalOptions {
  /** Any algorithm `crypto.createHash` accepts. Default 'sha256'. */
  algorithm?: string;
  /** Default 'hex'. */
  encoding?: BinaryToTextEncoding;
}

/** Digest of the RFC 8785 form: a content address that ignores formatting and key order. */
export function canonicalHash(input: JsonInput, options?: HashOptions): string {
  const bytes = canonicalize(input, { ...options, output: 'buffer' });
  return createHash(options?.algorithm ?? 'sha256').update(bytes).digest(options?.encoding ?? 'hex');
}

/**
 * RFC 8785 for live JavaScript values, in plain JavaScript. Follows `JSON.stringify`
 * for `toJSON`, wrapper objects and skipped members, but throws where RFC 8785
 * forbids output: non-finite numbers, lone surrogates and cycles.
 */
export function canonicalizeValue(value: unknown): string | undefined {
  const stack = new Set<object>();
  const visit = (key: string, input: unknown): string | undefined => {
    let value = input;
    if ((typeof value === 'object' && value !== null) || typeof value === 'bigint') {
      const toJSON = (value as { toJSON?: unknown }).toJSON;
      if (typeof toJSON === 'function') value = toJSON.call(value, key);
    }
    if (value instanceof Number || value instanceof String || value instanceof Boolean) value = value.valueOf();
    switch (typeof value) {
      case 'string':
        if (!value.isWellFormed()) throw new JsonError('ERR_JSON_LONE_SURROGATE', 'string contains a lone UTF-16 surrogate');
        return JSON.stringify(value);
      case 'number':
        if (!Number.isFinite(value)) throw new JsonError('ERR_JSON_NUMBER_RANGE', `${value} has no JSON representation`);
        return String(value);
      case 'boolean':
        return value ? 'true' : 'false';
      case 'bigint':
        throw new TypeError('BigInt value cannot be canonicalized; convert it to a number or string first');
      case 'object': {
        if (value === null) return 'null';
        if (stack.has(value)) throw new TypeError('Converting circular structure to JSON');
        stack.add(value);
        let out: string;
        if (Array.isArray(value)) {
          out = '[' + value.map((item, i) => visit(String(i), item) ?? 'null').join(',') + ']';
        } else {
          const record = value as Record<string, unknown>;
          // Default sort compares UTF-16 code units, which is RFC 8785 order.
          const members: string[] = [];
          for (const name of Object.keys(record).sort()) {
            if (!name.isWellFormed()) throw new JsonError('ERR_JSON_LONE_SURROGATE', 'object key contains a lone UTF-16 surrogate');
            const member = visit(name, record[name]);
            if (member !== undefined) members.push(JSON.stringify(name) + ':' + member);
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

import { type BinaryToTextEncoding } from 'node:crypto';
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
export type OutputOption = {
    output?: 'string';
} | {
    output: 'buffer';
};
export type JsonErrorCode = 'ERR_JSON_SYNTAX' | 'ERR_JSON_ENCODING' | 'ERR_JSON_DEPTH' | 'ERR_JSON_SIZE' | 'ERR_JSON_DUPLICATE_KEY' | 'ERR_JSON_LONE_SURROGATE' | 'ERR_JSON_NUMBER_RANGE' | 'ERR_JSON_PRECISION';
/** Thrown for any input the engine rejects. Position fields are absent for live values. */
export declare class JsonError extends SyntaxError {
    readonly code: JsonErrorCode;
    /** UTF-8 byte offset into the input. */
    readonly offset?: number;
    /** One-based line. */
    readonly line?: number;
    /** One-based column in UTF-16 code units, as editors count. */
    readonly column?: number;
    /** For `equal`, which argument failed: 0 or 1. */
    readonly argument?: number;
    constructor(code: JsonErrorCode, reason: string, position?: {
        offset: number;
        line: number;
        column: number;
        argument: number;
    });
}
/**
 * RFC 8785 JSON Canonicalization Scheme. Equal JSON values give identical output,
 * so the result can be hashed or signed. Rejects duplicate keys, lone surrogates
 * and numbers outside the double range.
 */
export declare function canonicalize(input: JsonInput, options?: CanonicalOptions & {
    output?: 'string';
}): string;
export declare function canonicalize(input: JsonInput, options: CanonicalOptions & {
    output: 'buffer';
}): Buffer;
/** Same as `canonicalize`, on the libuv thread pool so large documents do not block the event loop. */
export declare function canonicalizeAsync(input: JsonInput, options?: CanonicalOptions & {
    output?: 'string';
}): Promise<string>;
export declare function canonicalizeAsync(input: JsonInput, options: CanonicalOptions & {
    output: 'buffer';
}): Promise<Buffer>;
/**
 * Recursively sorts object keys by UTF-16 code units and removes whitespace, keeping
 * every number and string token exactly as written (`1.10` stays `1.10`, big integers
 * keep all digits). Rejects duplicate keys.
 */
export declare function sortKeys(input: JsonInput, options?: LimitOptions & {
    output?: 'string';
}): string;
export declare function sortKeys(input: JsonInput, options: LimitOptions & {
    output: 'buffer';
}): Buffer;
export declare function sortKeysAsync(input: JsonInput, options?: LimitOptions & {
    output?: 'string';
}): Promise<string>;
export declare function sortKeysAsync(input: JsonInput, options: LimitOptions & {
    output: 'buffer';
}): Promise<Buffer>;
/** Removes insignificant whitespace after validating, keeping order and tokens. */
export declare function minify(input: JsonInput, options?: LimitOptions & {
    output?: 'string';
}): string;
export declare function minify(input: JsonInput, options: LimitOptions & {
    output: 'buffer';
}): Buffer;
export declare function minifyAsync(input: JsonInput, options?: LimitOptions & {
    output?: 'string';
}): Promise<string>;
export declare function minifyAsync(input: JsonInput, options: LimitOptions & {
    output: 'buffer';
}): Promise<Buffer>;
/** Throws `JsonError` with line and column when the text is not RFC 8259 JSON. */
export declare function validate(input: JsonInput, options?: LimitOptions): void;
export declare function isValid(input: JsonInput, options?: LimitOptions): boolean;
/**
 * Returns the raw JSON text at an RFC 6901 JSON Pointer such as `/users/0/name`,
 * or `undefined` when nothing is there. The whole document is still validated.
 * Duplicate keys resolve to the last one, as with `JSON.parse`.
 */
export declare function select(input: JsonInput, pointer: string, options?: LimitOptions): string | undefined;
/** True when two documents are the same JSON value, compared by canonical form. */
export declare function equal(a: JsonInput, b: JsonInput, options?: CanonicalOptions): boolean;
export interface HashOptions extends CanonicalOptions {
    /** Any algorithm `crypto.createHash` accepts. Default 'sha256'. */
    algorithm?: string;
    /** Default 'hex'. */
    encoding?: BinaryToTextEncoding;
}
/** Digest of the RFC 8785 form: a content address that ignores formatting and key order. */
export declare function canonicalHash(input: JsonInput, options?: HashOptions): string;
/**
 * RFC 8785 for live JavaScript values, in plain JavaScript. Follows `JSON.stringify`
 * for `toJSON`, wrapper objects and skipped members, but throws where RFC 8785
 * forbids output: non-finite numbers, lone surrogates and cycles.
 */
export declare function canonicalizeValue(value: unknown): string | undefined;

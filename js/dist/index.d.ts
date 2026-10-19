export interface CompareEntry {
    key: string;
    value: unknown;
}
export type Comparator = (a: CompareEntry, b: CompareEntry) => number;
export interface StringifyOptions {
    cmp?: Comparator;
    cycles?: boolean;
}
export type Options = StringifyOptions | Comparator;
/** Upstream-compatible traversal, deliberately using JavaScript semantics. */
export declare function stringify(data: unknown, options?: Options): string | undefined;
export declare const stableStringify: typeof stringify;
/** Ordered JS compatibility batch; this API does not cross the native boundary. */
export declare function stringifyBatch(values: readonly unknown[], options?: Options): (string | undefined)[];
export interface SerializerCache {
    stringify(value: object, version: unknown): string | undefined;
    delete(value: object): boolean;
    clear(): void;
}
/** Caller MUST change version whenever serialization-visible state changes. */
export declare function createSerializerCache(options?: Options): SerializerCache;
export interface JsonTextOptions {
    /** Maximum container nesting, 1..128; default 128. */
    maxDepth?: number;
    /** Input AND output byte limit per document, 1..67108864; default 16777216. */
    maxBytes?: number;
}
/** Rust JSON-text sorter; preserves scalar token spelling, not JS normalization. */
export declare function stringifyJson(input: string, options?: JsonTextOptions): string;
/** Single native call. Maximum 1024 documents and 64 MiB combined UTF-8 input. */
export declare function stringifyJsonBatch(inputs: readonly string[], options?: JsonTextOptions): string[];
/** Extract raw JSON text using a JSON Pointer subset; missing paths yield undefined. */
export declare function selectJson(input: string, path: string, options?: JsonTextOptions): string | undefined;
export default stringify;

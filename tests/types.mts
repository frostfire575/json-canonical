import { canonicalize, canonicalizeAsync, select, JsonError, type JsonErrorCode, type CanonicalOptions } from 'stable-json-rs';

const options: CanonicalOptions = { maxDepth: 64, strictNumbers: true };
const text: string = canonicalize('{"a":1}', options);
const bytes: Buffer = canonicalize(new Uint8Array([0x31]), { output: 'buffer' });
const later: Promise<Buffer> = canonicalizeAsync('1', { output: 'buffer' });
const found: string | undefined = select(text, '/a');
try {
  canonicalize('{');
} catch (error) {
  if (error instanceof JsonError) {
    const errorCode: JsonErrorCode = error.code;
    const line: number | undefined = error.line;
    void errorCode; void line;
  }
}
// @ts-expect-error output must be 'string' or 'buffer'
canonicalize('1', { output: 'array' });
void bytes; void later; void found;

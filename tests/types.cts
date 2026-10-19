import api = require('stable-json-rs');
const result: string | undefined = api.stringify({ a: 1 });
const list: (string | undefined)[] = api.stringifyBatch([1, undefined]);
const native: string[] = api.stringifyJsonBatch(['{}']);
api.createSerializerCache().stringify({}, 1);
// @ts-expect-error explicit version is required
api.createSerializerCache().stringify({});
// @ts-expect-error text input only
api.stringifyJson({});
void [result, list, native];

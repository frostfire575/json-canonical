import json = require('stable-json-rs');

const sorted: string = json.sortKeys(Buffer.from('{"b":1,"a":2}'));
const hash: string = json.canonicalHash(sorted, { algorithm: 'sha256', encoding: 'base64' });
const same: boolean = json.equal('1', '1.0');
const value: string | undefined = json.canonicalizeValue({ a: 1 });
void hash; void same; void value;

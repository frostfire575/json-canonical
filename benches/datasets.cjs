'use strict';
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const read = (name) => JSON.parse(fs.readFileSync(path.join(__dirname, 'data', name), 'utf8'));
function datasets() {
  let deep = { leaf: true };
  for (let i = 0; i < 80; i++) deep = { z: i, a: deep };
  const wide = Object.fromEntries(Array.from({ length: 1500 }, (_, i) => [`key-${1500 - i}`, i]));
  const unicode = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`বাংলা😀${i}`, '日本語\nالعربية\\বাংলা😀'.repeat(8)]));
  const records = Array.from({ length: 600 }, (_, i) => ({ id: i, name: `record ${i}`, active: i % 2 === 0, tags: ['api', 'json'], meta: { rank: i / 7 } }));
  return {
    tiny: { z: 1, a: true, m: 'hello' },
    'upstream-api-fixture': read('upstream-test.json'),
    'application-config': read('typescript-package.json'),
    'dependency-lock': read('typescript-package-lock.json'),
    'public-api-data': read('jsonplaceholder-data.json'),
    deep,
    wide,
    unicode,
    'large-string': { z: 'x'.repeat(150000), a: 'line\nquote"'.repeat(1000) },
    'record-array': records,
    'backend-payload': { status: 'ok', pagination: { limit: 600, next: null }, data: records, request: { method: 'GET', path: '/api/records' } },
    'batch-32': Array.from({ length: 32 }, (_, i) => ({ z: i, a: { state: true, message: `row ${i}` } })),
  };
}
function describe(value) {
  const text = JSON.stringify(value);
  return { jsonBytes: Buffer.byteLength(text), sha256: crypto.createHash('sha256').update(text).digest('hex') };
}
module.exports = { datasets, describe };

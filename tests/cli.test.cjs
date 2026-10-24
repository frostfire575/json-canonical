'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const json = require('..');

const cli = path.join(__dirname, '..', 'js', 'dist', 'cli.js');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'stable-json-cli-'));
const file = (name, text) => {
  fs.writeFileSync(path.join(dir, name), text);
  return name;
};
const a = file('a.json', '{"b":1.10,"a":[1e2,"\\u00e9"],"big":12345678901234567890}');
const b = file('b.json', '{\n  "big": 12345678901234567890,\n  "a": [100, "é"],\n  "b": 1.1\n}');
const bad = file('bad.json', '{\n  "a": [1,,2]\n}');

const run = (args, input) => {
  const result = spawnSync(process.execPath, [cli, ...args], { cwd: dir, input, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
};
const text = fs.readFileSync(path.join(dir, a), 'utf8');

test('transforms write the exact API output with no trailing newline', () => {
  assert.deepEqual(run(['canonicalize', a]), { status: 0, stdout: json.canonicalize(text), stderr: '' });
  assert.deepEqual(run(['sort-keys', a]), { status: 0, stdout: json.sortKeys(text), stderr: '' });
  assert.deepEqual(run(['minify', b]), { status: 0, stdout: json.minify(fs.readFileSync(path.join(dir, b))), stderr: '' });
});

test('standard input is read when the file is omitted or -', () => {
  assert.equal(run(['canonicalize'], text).stdout, json.canonicalize(text));
  assert.equal(run(['canonicalize', '-'], text).stdout, json.canonicalize(text));
  assert.equal(run(['select', '/a/1'], text).stdout, '"\\u00e9"');
});

test('select prints the raw token and exits 1 when nothing matches', () => {
  assert.deepEqual(run(['select', '/big', a]), { status: 0, stdout: '12345678901234567890', stderr: '' });
  assert.deepEqual(run(['select', '/missing', a]), { status: 1, stdout: '', stderr: "stable-json: nothing at '/missing'\n" });
  assert.equal(run(['select', 'a', a]).status, 2);
});

test('hash matches canonicalHash and honours algorithm and encoding', () => {
  assert.equal(run(['hash', a]).stdout, json.canonicalHash(text) + '\n');
  assert.equal(run(['hash', '--algorithm', 'sha512', '--encoding', 'base64', b]).stdout,
    json.canonicalHash(text, { algorithm: 'sha512', encoding: 'base64' }) + '\n');
  assert.equal(run(['hash', '--algorithm', 'nope', a]).status, 2);
  assert.equal(run(['hash', '--encoding', 'latin1', a]).status, 2);
});

test('validate and equal report through the exit status', () => {
  assert.deepEqual(run(['validate', a]), { status: 0, stdout: '', stderr: '' });
  assert.equal(run(['equal', a, b]).status, 0);
  assert.equal(run(['equal', a, '-'], '{"a":[100,"é"],"b":1.1,"big":1}').status, 1);
  assert.equal(run(['equal', '-', '-']).status, 2);
});

test('rejected JSON names the input, line and column', () => {
  assert.deepEqual(run(['validate', bad]), { status: 1, stdout: '', stderr: 'bad.json:2:11: expected a JSON value (ERR_JSON_SYNTAX)\n' });
  assert.equal(run(['equal', a, bad]).stderr, 'bad.json:2:11: expected a JSON value (ERR_JSON_SYNTAX)\n');
  assert.equal(run(['validate'], '[1,').stderr, '<stdin>:1:4: unexpected end of JSON input (ERR_JSON_SYNTAX)\n');
  assert.match(run(['canonicalize', '--strict-numbers', a]).stderr, /^a\.json:1:\d+: .* \(ERR_JSON_PRECISION\)\n$/);
  assert.match(run(['validate', '--max-depth', '1'], '[[1]]').stderr, /\(ERR_JSON_DEPTH\)/);
});

test('usage and file errors exit 2', () => {
  for (const args of [[], ['frob'], ['select'], ['equal', a], ['validate', 'missing.json'], ['validate', '--what', a],
    ['validate', '--max-depth', '0', a], ['validate', '--max-bytes', 'x', a], ['minify', '--strict-numbers', a]]) {
    const result = run(args, '');
    assert.equal(result.status, 2, args.join(' '));
    assert.equal(result.stdout === '' || args.length === 0, true, args.join(' '));
  }
  assert.equal(run(['--help']).status, 0);
  assert.equal(run(['--version']).stdout, require('../package.json').version + '\n');
});

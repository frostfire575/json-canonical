'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const directory = path.resolve(__dirname, '../upstream/fast-json-stable-stringify');
const sha = '49e230da2c84247b29ad4de02c9395793caefd15';
if (!fs.existsSync(directory)) {
  execFileSync('git', ['clone', '--no-checkout', 'https://github.com/epoberezkin/fast-json-stable-stringify', directory], { stdio: 'inherit' });
  execFileSync('git', ['-C', directory, 'checkout', '--detach', sha], { stdio: 'inherit' });
}
const actual = execFileSync('git', ['-C', directory, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
if (actual !== sha) throw new Error(`Read-only upstream must be pinned to ${sha}; found ${actual}`);
if (execFileSync('git', ['-C', directory, 'status', '--porcelain'], { encoding: 'utf8' }).trim())
  throw new Error('Read-only upstream has local changes');
console.log(`Verified read-only upstream ${sha}`);

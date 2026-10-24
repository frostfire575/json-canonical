#!/usr/bin/env node
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_crypto_1 = require("node:crypto");
const node_fs_1 = require("node:fs");
const node_util_1 = require("node:util");
const json = __importStar(require("./index"));
const USAGE = `Usage: jcanon <command> [options] [file]
       (also installed as json-canonical)

Reads the file, or standard input when the file is omitted or '-'.

Commands:
  canonicalize           RFC 8785 canonical form
  sort-keys              sort object keys, keep every token as written
  minify                 remove whitespace, keep order and tokens
  validate               check RFC 8259 syntax, print nothing on success
  select <pointer>       print the value at an RFC 6901 JSON Pointer
  hash                   digest of the canonical form, hex SHA-256 by default
  equal <file> <file>    exit 0 when both are the same JSON value, 1 when not

Options:
  --max-depth <n>        nesting limit, 1..1024 (default 128)
  --max-bytes <n>        input and output size limit (default 67108864)
  --strict-numbers       canonicalize, hash, equal: reject numbers that would print differently
  --algorithm <name>     hash: any algorithm crypto.createHash accepts (default sha256)
  --encoding <name>      hash: hex, base64 or base64url (default hex)
  -h, --help             show this help
  -v, --version          show the version

Exit status: 0 on success, 1 when the JSON is rejected, the values differ or the
pointer matches nothing, 2 on a usage or file error.`;
const LIMITS = { 'max-depth': { type: 'string' }, 'max-bytes': { type: 'string' } };
const STRICT = { ...LIMITS, 'strict-numbers': { type: 'boolean' } };
const COMMANDS = {
    canonicalize: { options: STRICT, positionals: [0, 1] },
    'sort-keys': { options: LIMITS, positionals: [0, 1] },
    minify: { options: LIMITS, positionals: [0, 1] },
    validate: { options: LIMITS, positionals: [0, 1] },
    select: { options: LIMITS, positionals: [1, 2] },
    hash: { options: { ...STRICT, algorithm: { type: 'string' }, encoding: { type: 'string' } }, positionals: [0, 1] },
    equal: { options: STRICT, positionals: [2, 2] },
};
class UsageError extends Error {
}
// Names of the inputs in argument order, for `equal`'s JsonError.argument.
const inputs = [];
function integer(name, value) {
    if (typeof value !== 'string')
        return undefined;
    if (!/^\d+$/.test(value))
        throw new UsageError(`--${name} must be a positive integer`);
    return Number(value);
}
function read(file) {
    inputs.push(file === undefined || file === '-' ? '<stdin>' : file);
    if (file === undefined || file === '-') {
        if (process.stdin.isTTY)
            throw new UsageError('no input: pass a file or pipe JSON to standard input');
        return (0, node_fs_1.readFileSync)(0);
    }
    try {
        return (0, node_fs_1.readFileSync)(file);
    }
    catch (error) {
        throw new UsageError(`cannot read ${file}: ${error.code ?? error.message}`);
    }
}
// A terminal gets a final newline so the prompt does not run into the output; pipes
// and files get the exact bytes, so `jcanon canonicalize | sha256sum` hashes
// the canonical form itself.
function print(output, newline = process.stdout.isTTY) {
    process.stdout.write(output);
    if (newline)
        process.stdout.write('\n');
}
function run(argv) {
    const [command, ...rest] = argv;
    if (command === undefined || command === '-h' || command === '--help' || command === 'help') {
        process.stdout.write(USAGE + '\n');
        return command === undefined ? 2 : 0;
    }
    if (command === '-v' || command === '--version') {
        process.stdout.write(require('../../package.json').version + '\n');
        return 0;
    }
    const spec = COMMANDS[command];
    if (spec === undefined)
        throw new UsageError(`unknown command '${command}'`);
    let parsed;
    try {
        parsed = (0, node_util_1.parseArgs)({ args: rest, options: { ...spec.options, help: { type: 'boolean', short: 'h' } }, allowPositionals: true, strict: true });
    }
    catch (error) {
        throw new UsageError(error.message);
    }
    const { positionals } = parsed;
    const values = parsed.values;
    if (values.help) {
        process.stdout.write(USAGE + '\n');
        return 0;
    }
    const [min, max] = spec.positionals;
    if (positionals.length < min || positionals.length > max) {
        throw new UsageError(`${command} takes ${min === max ? min : `${min} or ${max}`} argument${max === 1 ? '' : 's'}, got ${positionals.length}`);
    }
    const options = {
        maxDepth: integer('max-depth', values['max-depth']),
        maxBytes: integer('max-bytes', values['max-bytes']),
        strictNumbers: values['strict-numbers'] === true,
    };
    switch (command) {
        case 'canonicalize':
            print(json.canonicalize(read(positionals[0]), { ...options, output: 'buffer' }));
            return 0;
        case 'sort-keys':
            print(json.sortKeys(read(positionals[0]), { ...options, output: 'buffer' }));
            return 0;
        case 'minify':
            print(json.minify(read(positionals[0]), { ...options, output: 'buffer' }));
            return 0;
        case 'validate':
            json.validate(read(positionals[0]), options);
            return 0;
        case 'select': {
            const [pointer, file] = positionals;
            const value = json.select(read(file), pointer, options);
            if (value === undefined) {
                process.stderr.write(`jcanon: nothing at '${pointer}'\n`);
                return 1;
            }
            print(value);
            return 0;
        }
        case 'hash': {
            const encoding = values.encoding;
            if (encoding !== undefined && !['hex', 'base64', 'base64url'].includes(encoding)) {
                throw new UsageError('--encoding must be hex, base64 or base64url');
            }
            const algorithm = values.algorithm;
            if (algorithm !== undefined && !(0, node_crypto_1.getHashes)().some(name => name.toLowerCase() === algorithm.toLowerCase())) {
                throw new UsageError(`unsupported --algorithm '${algorithm}'`);
            }
            print(json.canonicalHash(read(positionals[0]), { ...options, algorithm, encoding: encoding }), true);
            return 0;
        }
        case 'equal': {
            const [a, b] = positionals;
            if (a === '-' && b === '-')
                throw new UsageError('only one input can be standard input');
            return json.equal(read(a), read(b), options) ? 0 : 1;
        }
    }
    return 2;
}
try {
    process.exitCode = run(process.argv.slice(2));
}
catch (error) {
    if (error instanceof json.JsonError) {
        const where = error.line === undefined ? '' : `:${error.line}:${error.column}`;
        const reason = error.message.replace(/ at line \d+ column \d+$/, '');
        process.stderr.write(`${inputs[error.argument ?? 0] ?? '<stdin>'}${where}: ${reason} (${error.code})\n`);
        process.exitCode = 1;
    }
    else if (error instanceof UsageError || error instanceof RangeError) {
        process.stderr.write(`jcanon: ${error.message}\n`);
        process.exitCode = 2;
    }
    else {
        throw error;
    }
}

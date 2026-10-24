#!/usr/bin/env node
import { getHashes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { parseArgs, type ParseArgsConfig } from 'node:util';
import * as json from './index';

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

type Options = NonNullable<ParseArgsConfig['options']>;
const LIMITS: Options = { 'max-depth': { type: 'string' }, 'max-bytes': { type: 'string' } };
const STRICT: Options = { ...LIMITS, 'strict-numbers': { type: 'boolean' } };
const COMMANDS: Record<string, { options: Options; positionals: [number, number] }> = {
  canonicalize: { options: STRICT, positionals: [0, 1] },
  'sort-keys': { options: LIMITS, positionals: [0, 1] },
  minify: { options: LIMITS, positionals: [0, 1] },
  validate: { options: LIMITS, positionals: [0, 1] },
  select: { options: LIMITS, positionals: [1, 2] },
  hash: { options: { ...STRICT, algorithm: { type: 'string' }, encoding: { type: 'string' } }, positionals: [0, 1] },
  equal: { options: STRICT, positionals: [2, 2] },
};

class UsageError extends Error {}

// Names of the inputs in argument order, for `equal`'s JsonError.argument.
const inputs: string[] = [];

function integer(name: string, value: string | boolean | undefined): number | undefined {
  if (typeof value !== 'string') return undefined;
  if (!/^\d+$/.test(value)) throw new UsageError(`--${name} must be a positive integer`);
  return Number(value);
}

function read(file: string | undefined): Buffer {
  inputs.push(file === undefined || file === '-' ? '<stdin>' : file);
  if (file === undefined || file === '-') {
    if (process.stdin.isTTY) throw new UsageError('no input: pass a file or pipe JSON to standard input');
    return readFileSync(0);
  }
  try {
    return readFileSync(file);
  } catch (error) {
    throw new UsageError(`cannot read ${file}: ${(error as NodeJS.ErrnoException).code ?? (error as Error).message}`);
  }
}

// A terminal gets a final newline so the prompt does not run into the output; pipes
// and files get the exact bytes, so `jcanon canonicalize | sha256sum` hashes
// the canonical form itself.
function print(output: string | Buffer, newline = process.stdout.isTTY): void {
  process.stdout.write(output);
  if (newline) process.stdout.write('\n');
}

function run(argv: string[]): number {
  const [command, ...rest] = argv;
  if (command === undefined || command === '-h' || command === '--help' || command === 'help') {
    process.stdout.write(USAGE + '\n');
    return command === undefined ? 2 : 0;
  }
  if (command === '-v' || command === '--version') {
    process.stdout.write((require('../../package.json') as { version: string }).version + '\n');
    return 0;
  }
  const spec = COMMANDS[command];
  if (spec === undefined) throw new UsageError(`unknown command '${command}'`);

  let parsed;
  try {
    parsed = parseArgs({ args: rest, options: { ...spec.options, help: { type: 'boolean', short: 'h' } }, allowPositionals: true, strict: true });
  } catch (error) {
    throw new UsageError((error as Error).message);
  }
  const { positionals } = parsed;
  const values = parsed.values as Record<string, string | boolean | undefined>;
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
      const [pointer, file] = positionals as [string, string | undefined];
      const value = json.select(read(file), pointer, options);
      if (value === undefined) {
        process.stderr.write(`jcanon: nothing at '${pointer}'\n`);
        return 1;
      }
      print(value);
      return 0;
    }
    case 'hash': {
      const encoding = values.encoding as string | undefined;
      if (encoding !== undefined && !['hex', 'base64', 'base64url'].includes(encoding)) {
        throw new UsageError('--encoding must be hex, base64 or base64url');
      }
      const algorithm = values.algorithm as string | undefined;
      if (algorithm !== undefined && !getHashes().some(name => name.toLowerCase() === algorithm.toLowerCase())) {
        throw new UsageError(`unsupported --algorithm '${algorithm}'`);
      }
      print(json.canonicalHash(read(positionals[0]), { ...options, algorithm, encoding: encoding as 'hex' | undefined }), true);
      return 0;
    }
    case 'equal': {
      const [a, b] = positionals as [string, string];
      if (a === '-' && b === '-') throw new UsageError('only one input can be standard input');
      return json.equal(read(a), read(b), options) ? 0 : 1;
    }
  }
  return 2;
}

try {
  process.exitCode = run(process.argv.slice(2));
} catch (error) {
  if (error instanceof json.JsonError) {
    const where = error.line === undefined ? '' : `:${error.line}:${error.column}`;
    const reason = error.message.replace(/ at line \d+ column \d+$/, '');
    process.stderr.write(`${inputs[error.argument ?? 0] ?? '<stdin>'}${where}: ${reason} (${error.code})\n`);
    process.exitCode = 1;
  } else if (error instanceof UsageError || error instanceof RangeError) {
    process.stderr.write(`jcanon: ${error.message}\n`);
    process.exitCode = 2;
  } else {
    throw error;
  }
}

import { stringifyJson, selectJson, type JsonTextOptions } from 'stable-json-rs';
const input = '{"z":1.00,"users":[{"name":"Ada","id":7}],"a":-0}';
const options: JsonTextOptions = { maxDepth: 32, maxBytes: 1024 * 1024 };
const ordered: string = stringifyJson(input, options);
const rawName: string | undefined = selectJson(input, '/users/0/name', options);
console.log(ordered);
if (rawName !== undefined) {
  const name: unknown = JSON.parse(rawName);
  console.log(name);
}

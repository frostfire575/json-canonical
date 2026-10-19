import stringify, { stringifyJson, selectJson, type Comparator } from 'stable-json-rs';
const cmp: Comparator = (a, b) => a.key < b.key ? -1 : 1;
const result: string | undefined = stringify({}, cmp);
const text: string = stringifyJson('{}', { maxDepth: 32 });
void [result, text];
const selected: string | undefined = selectJson('{"a":1}', '/a');
void selected;

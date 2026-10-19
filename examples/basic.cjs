const { stringify, stringifyJson, createSerializerCache } = require('stable-json-rs');
console.log(stringify({ b: 2, a: 1 }));
console.log(stringifyJson('{"b":2,"a":1}'));
const cache = createSerializerCache();
const object = { name: 'Ada' };
console.log(cache.stringify(object, 1));
object.name = 'Grace';
console.log(cache.stringify(object, 2));

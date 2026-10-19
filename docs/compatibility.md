# Compatibility status

Oracle: fast-json-stable-stringify 2.1.0 at
`49e230da2c84247b29ad4de02c9395793caefd15` (MIT).

| Behavior | Compatibility API | Rust text API |
|---|---|---|
| Recursive object keys / arrays | Exact upstream ordering; tested | UTF-16 sorted keys, array order retained |
| Undefined/functions/symbols | Omit object fields, array null, top undefined; tested | Invalid JSON tokens |
| NaN/Infinity/-0 | Upstream null/null/0; tested | Invalid nonfinite tokens; preserves JSON -0 |
| Numbers | V8 formatting; edge cases tested | Original token precision/spelling retained |
| BigInt | Upstream exception/toJSON behavior | JSON number text has no BigInt type |
| toJSON/getters/proxies | Upstream invocation/events; tested | Not applicable |
| Custom comparator | Function/options form, value reads and receiver tested | Not supported |
| Object cycles / repeated references | Upstream error/marker; repeated allowed; tested | No graph references |
| Array cycles | Upstream RangeError even cycles:true; tested | Nesting limited |
| Unicode/lone surrogates | V8 escaping + UTF-16 ordering; tested | Keys require scalar Unicode; escaped surrogate values retained |
| Boxed values | Upstream ordinary object handling; tested | Not applicable |
| Duplicate JSON keys | Not applicable to JS objects | Reject decoded duplicates |

All 16 assertions from the four unmodified upstream test files run against the
public API. Seeded suites now cover 25,740 cases: 6,000 JS values, 3,000 supported
native objects, 2,000 lexical documents, 3,500 selection paths, 8,192 IEEE-754
bit patterns, 2,048 arbitrary UTF-16 strings and 1,000 shared nested graphs.
Separate adversarial tests check observable getter/toJSON/comparator/proxy events,
exceptions, cycles, 30,000 records and 40,000-key objects. Encoding tests compare
exact string code units across output sizes, Unicode densities and raw escapes.
This scope does not prove all
possible JS programs; arbitrary monkeypatching beyond tested behavior remains
a risk. No RFC8785 compliance claim. JSON.stringify differs for numeric-looking
key order, boxed primitives, toJSON arguments and other observable behavior.

Production review adds single-read validation for native extensions. Text batches
snapshot each indexed string once, including arrays with accessors or custom
iterators; native options are captured once in validation order. Independent
regressions cover malformed UTF-16 replacement and depth/byte-limit bypasses.
These corrections do not change upstream compatibility traversal or its callbacks.

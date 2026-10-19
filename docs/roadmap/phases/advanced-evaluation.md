# Advanced feature evaluation (2026-10-19)

These decisions describe current scope, not claims that deferred features work.

| Feature | Decision | Evidence, use case and acceptance |
|---|---|---|
| Full `parseJson` into JS objects | DEFERRED | Existing JSON.parse is the native V8 baseline. Rust still pays for JS object construction. No measured use case justifies a second object parser; research documents this boundary cost. Requires end-to-end object-creation benchmark before implementation. |
| Selective extraction | Evaluate next | Real1.38MB API fixture has small fields worth reading without full JS materialization. Existing Rust-backed @cnpmjs/packument establishes precedent. Require escaped-key/array/Unicode/whole-input-validity/missing/limits tests and >=10% median gain on a real fixture. Use a small pointer syntax, never JS expressions. |
| Streaming | DEFERRED | Existing APIs receive complete strings/objects; chunking completed output is not genuine streaming. Incremental parser, backpressure, cancellation and bounded buffering require a separate use case and protocol. No streaming export exists. |
| Async processing | DEFERRED | Existing calls are synchronous. Live JS object access cannot run freely on worker threads; text transfer also costs main-thread time. Need a large-text request-latency/event-loop benchmark and cancellation design before worker support. No async export exists. |
| Deterministic hashing | DEFERRED | Scalar token preservation is not RFC8785 and gives different digests for different numeric spellings. JS crypto over explicit output works now; a fused native digest requires measured memory/CPU advantage and clearly specified byte rules. No hash export exists. |

Batch and explicit-version cache APIs are implemented and tested separately;
cache hits are caller assertions of unchanged state, not deep mutation detection.

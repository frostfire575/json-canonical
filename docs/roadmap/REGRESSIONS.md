# Regressions

## 2026-10-19 fixed during MVP review
- Comparator must capture second opts.cmp read and invoke with no receiver.
  Regression tests compare dynamic getters, mutation and strict callback this.
- Object keys use indexed loop; Array.prototype iterator patches must not alter
  traversal. Regression executes in an isolated child.
- Literal lone surrogate text silently becomes U+FFFD at Node-API. Public native
  wrappers now reject ill-formed strings before conversion; escaped values retain
  spelling. Internal generated binding is not a supported public API.
- TS ESM default initially typed as CJS namespace: conditional .d.mts declaration
  verified by strict consumer compilation.

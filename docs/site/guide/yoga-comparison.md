# Yoga Comparison

Flexily is a pure JavaScript flexbox layout engine with a Yoga-compatible API.

**TL;DR:** Flexily is **1.5-2.5x faster for initial layout**, **5.5x faster for no-change re-layout**, and **2.5-3.5x smaller** than Yoga, with a synchronous API and pure JavaScript. Yoga is faster at per-node layout computation during incremental re-layout and deep nesting.

## Status

|                      | Yoga                                                 | Flexily                              |
| -------------------- | ---------------------------------------------------- | ------------------------------------ |
| **Maturity**         | Production, battle-tested (React Native, Ink, Litho) | Production-ready, fully tested       |
| **Test coverage**    | Extensive (auto-generated from Chrome)               | 1368 tests, 41/41 Yoga compatibility |
| **Real-world usage** | Millions of apps                                     | Used in production                   |

## API Compatibility

Flexily is designed as a **drop-in replacement** for Yoga's JavaScript API:

```typescript
// Same constants
import { FLEX_DIRECTION_ROW, JUSTIFY_CENTER, ALIGN_STRETCH } from "flexily"

// Same Node API
const root = Node.create()
root.setWidth(100)
root.setFlexDirection(FLEX_DIRECTION_ROW)
root.setJustifyContent(JUSTIFY_CENTER)

const child = Node.create()
child.setFlexGrow(1)
root.insertChild(child, 0)

root.calculateLayout(100, 100, DIRECTION_LTR)

console.log(child.getComputedWidth()) // Same output
```

**API coverage**: 100% of Yoga's commonly-used API is implemented with identical method signatures. 41/41 Yoga comparison tests pass.

## Bundle Size

|              | Yoga                           | Flexily           | Savings              |
| ------------ | ------------------------------ | ----------------- | -------------------- |
| **Minified** | 117 KB (25 KB JS + 89 KB WASM) | 47 KB (35 KB[^1]) | **2.5-3.4x smaller** |
| **Gzipped**  | 39 KB (9 KB JS + 28 KB WASM)   | 16 KB (11 KB[^1]) | **2.5-3.6x smaller** |

[^1]: Without the optional `debug` dependency (tree-shaken by most bundlers).

## Flexbox Spec Compliance

| Feature                                   | Yoga | Flexily | Notes              |
| ----------------------------------------- | ---- | ------- | ------------------ |
| **flex-direction** (row, column, reverse) | Yes  | Yes     |                    |
| **flex-grow**                             | Yes  | Yes     |                    |
| **flex-shrink**                           | Yes  | Yes     | CSS-spec compliant |
| **flex-basis**                            | Yes  | Yes     |                    |
| **justify-content** (6 values)            | Yes  | Yes     |                    |
| **align-items** (5 values)                | Yes  | Yes     |                    |
| **align-self**                            | Yes  | Yes     |                    |
| **align-content** (6 values)              | Yes  | Yes     |                    |
| **gap** (row/column)                      | Yes  | Yes     |                    |
| **padding/margin/border** (per-edge)      | Yes  | Yes     |                    |
| **min/max width/height**                  | Yes  | Yes     |                    |
| **percent values**                        | Yes  | Yes     |                    |
| **absolute positioning**                  | Yes  | Yes     |                    |
| **measure functions**                     | Yes  | Yes     |                    |
| **flex-wrap**                             | Yes  | Yes     |                    |
| **baseline alignment**                    | Yes  | Yes     |                    |
| **RTL direction**                         | Yes  | Yes     |                    |
| **aspect-ratio**                          | Yes  | Yes     |                    |

## Migration Guide

### From Yoga to Flexily

```diff
- import Yoga from 'yoga-wasm-web';
- const yoga = await Yoga.init();
- const root = yoga.Node.create();
+ import { Node } from 'flexily';
+ const root = Node.create();  // Synchronous!

// Rest of the API is identical
root.setWidth(100);
root.setFlexDirection(FLEX_DIRECTION_ROW);
// ...
```

### Key Changes

1. **No async init** -- Remove `await Yoga.init()`
2. **Import from package** -- `import { Node, FLEX_DIRECTION_ROW } from 'flexily'`

## Known Limitations

1. **No `order` property** -- Items laid out in insertion order
2. **No writing modes** -- Horizontal-tb only

## Performance

See [Performance](/guide/performance) for detailed benchmarks.

| Scenario                            | Winner      | Margin     |
| ----------------------------------- | ----------- | ---------- |
| Initial layout (create + calculate) | Flexily     | 1.5-2.5x   |
| **No-change re-layout**             | **Flexily** | **5.5x**   |
| Incremental re-layout (dirty leaf)  | Yoga        | 2.8-3.4x   |
| Deep nesting (15+ levels)           | Yoga        | increasing |

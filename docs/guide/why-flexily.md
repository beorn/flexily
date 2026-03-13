# Why Flexily?

_External project claims last verified: 2026-03._

[Yoga](https://yogalayout.dev/) is the industry standard flexbox engine, used by React Native, Ink, and thousands of apps. It's mature and battle-tested. But it's C++ compiled to WASM, and that creates real problems for JavaScript applications.

## The Problems with WASM

**Async initialization.** Yoga requires `await Yoga.init()` before creating any nodes. No synchronous startup, no use at module load time, no use in config files or build scripts. For CLIs that should start instantly, this adds latency and complexity.

**WASM boundary crossing.** Every method call (`setWidth`, `setFlexGrow`, etc.) crosses the JS-to-WASM boundary. Node creation is ~8x more expensive than a JS object. For TUIs that rebuild layout trees per render, this dominates.

**Memory growth.** WASM linear memory grows but never shrinks. Yoga's yoga-wasm-web has a [known memory growth bug](https://github.com/nicolo-ribaudo/yoga-wasm-web/issues/1) where each node allocation permanently grows the WASM heap. In long-running apps, this caused [120GB RAM usage in Claude Code](https://github.com/anthropics/claude-code/issues/4953).

**Debugging opacity.** You can't step into WASM in a JS debugger. When layout is wrong, you get a computed number with no way to inspect the algorithm's intermediate state. Flexily is readable JS -- set a breakpoint in `layout-zero.ts`.

**No tree-shaking.** The WASM binary is monolithic. You get the entire engine even if you use a fraction of the features.

## Flexily's Approach

Flexily fills the gap that Facebook's original pure-JS flexbox engine (`css-layout`) left when they moved to C++. Comprehensive CSS flexbox support, Yoga-compatible API, pure JS, zero WASM.

| Concern            | Yoga                  | Flexily                |
| ------------------ | --------------------- | ---------------------- |
| **Runtime**        | WebAssembly           | Pure JavaScript        |
| **Initialization** | Async (WASM load)     | Synchronous            |
| **Dependencies**   | WASM runtime required | `debug` (optional)     |
| **Debugging**      | WASM stack traces     | Native JS stack traces |
| **Bundle size**    | 117 KB minified       | 47 KB minified         |

## Performance Trade-offs

Each engine wins in different scenarios:

| Scenario                | Winner      | Margin     |
| ----------------------- | ----------- | ---------- |
| **Initial layout**      | Flexily     | 1.5-2.5x   |
| **No-change re-layout** | **Flexily** | **5.5x**   |
| **Single dirty leaf**   | Yoga        | 2.8-3.4x   |
| **Deep nesting (15+)**  | Yoga        | increasing |

For interactive TUIs where most keystrokes don't change layout, Flexily's fingerprint cache makes re-layout essentially free (27ns regardless of tree size).

See [Performance](/guide/performance) for detailed benchmarks.

## Use Flexily When

- You want synchronous initialization (no async `await init()`)
- You're in an environment where WASM is awkward (older bundlers, edge runtimes)
- You want smaller bundles (2.5-3.5x) and simpler debugging
- You're building interactive TUIs where no-change re-layout dominates

## Use Yoga When

- Your primary workload is frequent incremental re-layout of large pre-existing trees
- You have deep nesting (15+ levels) as your primary use case
- You're already using React Native or another Yoga-based system
- You need the battle-tested stability of a mature project

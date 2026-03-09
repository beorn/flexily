# Performance

Flexily and Yoga each win in different scenarios. The right choice depends on your workload.

## Performance Profile

Flexily's pure JavaScript architecture creates a distinctive performance profile compared to Yoga's WASM:

| Scenario                                                    | Winner  | Margin     | Why                                                   |
| ----------------------------------------------------------- | ------- | ---------- | ----------------------------------------------------- |
| **Initial layout** (create + layout)                        | Flexily | 1.5-2.5x   | JS node creation is cheap; no WASM boundary crossings |
| **No-change re-layout**                                     | Flexily | **5.5x**   | Fingerprint cache catches unchanged trees at the root |
| **Incremental re-layout** (single dirty leaf)               | Yoga    | 2.8-3.4x   | WASM per-node computation is faster                   |
| **Full re-layout** (constraint change on pre-existing tree) | Yoga    | 2.7x       | Same reason -- WASM layout computation is faster      |
| **Deep nesting** (15+ levels)                               | Yoga    | increasing | Flexily's function call overhead compounds at depth   |

**Key insight**: Flexily wins at node creation and cache hits. Yoga wins at raw layout computation.

## Why These Trade-offs Exist

### JS/WASM Interop: Flexily's Initial Layout Advantage

Yoga's WASM module is fast internally, but every interaction crosses the JS/WASM boundary:

```
JS                          WASM
|                           |
+-- node.setWidth(100) -----+-> Write to linear memory
+-- node.setFlexGrow(1) ----+-> Write to linear memory
+-- node.insertChild() -----+-> Update pointers in memory
+-- calculateLayout() ------+-> Run layout algorithm
+-- node.getComputedWidth() +-> Read from linear memory
|                           |
```

Each boundary crossing involves type conversion, memory read/write, and function call overhead. For a 100-node layout, that's 400+ crossings. This makes Yoga's node creation ~8x slower than Flexily's pure-JS creation.

### WASM Computation: Yoga's Re-layout Advantage

When re-laying out a pre-existing tree, node creation is amortized away. The benchmark becomes pure layout computation, where WASM's compiled code outperforms JIT-compiled JavaScript.

### Fingerprint Cache: Flexily's No-Change Advantage

Flexily stores a 5-field fingerprint per node: `(availableWidth, availableHeight, direction, offsetX, offsetY)`. When `calculateLayout()` is called with unchanged constraints on a clean tree, Flexily checks the fingerprint at the root and returns immediately -- **zero tree traversal**.

This makes Flexily **5.5x faster** for the common case of cursor movement, selection changes, and other UI updates that don't affect layout.

### Zero-Allocation Design

The layout algorithm eliminates temporary allocations during layout:

1. **FlexInfo structs on nodes** -- Mutated in place, not reallocated each pass
2. **Pre-allocated typed arrays** -- For flex-line tracking
3. **Inline iteration** -- No `filter()` calls that allocate intermediate arrays

See [Zero-Allocation Design](/guide/zero-allocation) for implementation details.

## Benchmark Results

All benchmarks on Apple M-series, Bun 1.2, macOS (February 2026), with JIT warmup. Times are mean per operation.

### Initial Layout (Create + Layout)

#### Flat Layouts

| Nodes | Flexily | Yoga     | Ratio        |
| ----- | ------- | -------- | ------------ |
| 100   | 74 us   | 157 us   | Flexily 2.1x |
| 500   | 371 us  | 835 us   | Flexily 2.3x |
| 1000  | 767 us  | 1797 us  | Flexily 2.3x |
| 2000  | 1497 us | 3937 us  | Flexily 2.6x |
| 5000  | 4929 us | 12496 us | Flexily 2.5x |

#### TUI Board (columns x bordered cards with measure functions)

This mirrors real terminal UI structure: columns with headers, bordered card containers, icon + text rows, text nodes with measure functions.

| Structure | ~Nodes | Flexily | Yoga    | Ratio        |
| --------- | ------ | ------- | ------- | ------------ |
| 3x5       | 64     | 124 us  | 191 us  | Flexily 1.5x |
| 5x10      | 206    | 367 us  | 619 us  | Flexily 1.7x |
| 5x20      | 406    | 605 us  | 1234 us | Flexily 2.0x |
| 8x30      | 969    | 1479 us | 3015 us | Flexily 2.0x |

#### Deep Nesting

| Depth | Flexily | Yoga   | Ratio        |
| ----- | ------- | ------ | ------------ |
| 1     | 1.4 us  | 3.1 us | Flexily 2.2x |
| 5     | 7.3 us  | 11 us  | Flexily 1.5x |
| 10    | 19 us   | 21 us  | Flexily 1.1x |
| 15    | 39 us   | 31 us  | Yoga 1.3x    |
| 20    | 53 us   | 41 us  | Yoga 1.3x    |
| 50    | 255 us  | 101 us | Yoga 2.5x    |

Flexily wins at shallow nesting but Yoga overtakes at 15+ levels.

### Re-layout (Pre-existing Tree)

#### No-Change Re-layout

| Structure             | Flexily  | Yoga    | Ratio            |
| --------------------- | -------- | ------- | ---------------- |
| 5x20 TUI (~406 nodes) | 0.027 us | 0.15 us | **Flexily 5.5x** |
| 8x30 TUI (~969 nodes) | 0.026 us | 0.14 us | **Flexily 5.5x** |

Flexily returns in **27 nanoseconds** regardless of tree size -- fingerprint check at root, zero traversal.

#### Single Leaf Dirty (Incremental)

| Structure             | Flexily | Yoga  | Ratio     |
| --------------------- | ------- | ----- | --------- |
| 5x20 TUI (~406 nodes) | 123 us  | 37 us | Yoga 3.4x |
| 8x30 TUI (~969 nodes) | 244 us  | 87 us | Yoga 2.8x |

### Feature-Specific Benchmarks

| Feature             | Winner  | Margin |
| ------------------- | ------- | ------ |
| AbsolutePositioning | Flexily | 3.5x   |
| FlexShrink          | Flexily | 2.7x   |
| AlignContent        | Flexily | 2.3x   |
| FlexGrow            | Flexily | 1.9x   |
| Gap                 | Flexily | 1.5x   |
| MeasureFunc         | Flexily | 1.4x   |
| FlexWrap            | Flexily | 1.2x   |
| PercentValues       | ~Equal  | -      |

## Real-World Performance Mix

For a terminal UI app (the primary target), the operation mix is roughly:

| Operation                          | Frequency     | Winner           |
| ---------------------------------- | ------------- | ---------------- |
| Initial render                     | Once          | Flexily 1.5-2x   |
| Cursor movement (no layout change) | Very frequent | **Flexily 5.5x** |
| Content edit (single node dirty)   | Frequent      | Yoga 3x          |
| Window resize                      | Occasional    | Yoga 2.7x        |

The no-change case dominates in interactive TUIs. Flexily's fingerprint cache makes this essentially free.

## Running Benchmarks

```bash
# Quick comparison (flat + deep, with warmup)
bun bench bench/yoga-compare-warmup.bench.ts

# Real-world scenarios (TUI boards, measure functions, property diversity)
bun bench bench/yoga-compare-rich.bench.ts

# Incremental re-layout (no-change, dirty leaf, resize)
bun bench bench/incremental.bench.ts

# Feature-specific
bun bench bench/features.bench.ts
```

## When to Use Yoga Instead

- **Frequent incremental re-layout** -- If your primary workload is single-node updates on large pre-existing trees, Yoga's WASM layout computation is 2-3x faster
- **Deep nesting (15+ levels)** -- Yoga's per-node overhead is lower
- **React Native ecosystem** -- Yoga is the native choice
- **Cold single-shot layouts** -- No warmup benefit for Flexily

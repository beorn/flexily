# Testing

Flexily uses a multi-layered testing strategy to ensure both initial layout correctness and incremental re-layout consistency. The test suite has caught 3 distinct caching/invalidation bugs that passed all single-pass tests.

## Test Categories

### 1. Yoga Compatibility Tests (41 tests)

Direct comparison against Yoga's WASM implementation. Both engines process the same node tree and must produce identical computed layouts.

```bash
bun test tests/yoga-compat/
```

### 2. Layout Feature Tests (~480 tests)

Traditional example-based tests for each flexbox feature: grow, shrink, wrap, alignment, absolute positioning, aspect ratio, measure functions, etc.

```bash
bun test tests/layout/
```

### 3. Re-layout Consistency Tests (~1200 tests)

The most sophisticated test layer. These test **incremental re-layout** -- the scenario where `calculateLayout()` is called on a tree that was previously laid out, with some nodes marked dirty.

**Why this matters**: Flexily uses caching (fingerprints, layout cache, measure cache) to skip recomputing unchanged subtrees. These caches are essential for performance but create subtle correctness risks. All 3 bugs found in Flexily were invisible to single-pass tests.

```bash
bun test tests/relayout-consistency.test.ts
```

#### Differential Oracle Pattern

The core testing technique: build a tree, layout, mark dirty, re-layout -- compare against a fresh layout of an identical tree. The fresh layout is a trivially correct reference (it can't have stale cached values).

```typescript
function expectRelayoutMatchesFresh(buildTree, width, height) {
  // Incremental: build -> layout -> dirty -> re-layout
  const { root, dirtyTargets } = buildTree()
  root.calculateLayout(width, height, DIRECTION_LTR)
  for (const t of dirtyTargets) t.markDirty()
  root.calculateLayout(width, height, DIRECTION_LTR)
  const incremental = getLayout(root)

  // Fresh reference: identical tree, single layout
  const fresh = buildTree()
  fresh.root.calculateLayout(width, height, DIRECTION_LTR)
  const reference = getLayout(fresh.root)

  expect(incremental).toEqual(reference)
}
```

#### Test Groups

| Group                             | Seeds | What it tests                                  |
| --------------------------------- | ----- | ---------------------------------------------- |
| Targeted scenarios                | 6     | Specific bug reproductions                     |
| measureNode invariant             | 1     | layout.width/height unchanged for clean nodes  |
| Fuzz: re-layout vs fresh          | 500   | Random trees + random dirty marking            |
| Fuzz: cache invalidation stress   | 100   | Same tree re-laid out at multiple widths       |
| Fuzz: idempotency                 | 200   | Layout twice with identical constraints        |
| Fuzz: resize round-trip           | 200   | Layout at W1->W2->W1, compare final vs fresh   |
| Fuzz: multi-step constraint sweep | 100   | 3 random widths -> dirty -> random final width |
| Fuzz: content change              | 100   | Random trees with mutable measure functions    |

### 4. Mutation Testing (8 mutations)

Verifies that the test suite detects deliberate code changes. Each mutation injects a known-wrong value into cache/invalidation logic.

```bash
bun scripts/mutation-test.ts
```

**Results**: 4 caught (real bugs), 4 equivalent (defense-in-depth layers).

## Public Testing API

Flexily exports diagnostic helpers for downstream consumers:

```typescript
import {
  getLayout,
  formatLayout,
  diffLayouts,
  textMeasure,
  assertLayoutSanity,
  expectRelayoutMatchesFresh,
  expectIdempotent,
  expectResizeRoundTrip,
} from "flexily/testing"
```

See [API Reference](/api/reference#testing-utilities) for the full list.

## Running Tests

```bash
# All tests
bun test

# Just re-layout consistency (most thorough)
bun test tests/relayout-consistency.test.ts

# Specific fuzz seed for debugging
bun vitest run tests/relayout-consistency.test.ts -t "seed=73"
```

## Investigating Failures

When a fuzz test fails:

1. **Note the seed**: `seed=73: re-layout matches fresh` -> seed is 73
2. **Run in isolation**: `bun vitest run tests/relayout-consistency.test.ts -t "seed=73"`
3. **Read the diff output**: The test reports exact node paths and value differences
4. **Check the bug taxonomy**: See [Incremental Layout Bugs](/guide/incremental-layout-bugs) for known bug patterns

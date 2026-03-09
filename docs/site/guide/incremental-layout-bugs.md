# Incremental Layout Bugs

A knowledge base on the correctness challenges of incremental layout in flexbox engines -- drawing from Chrome's LayoutNG, Yoga, PanGui, and Flexily's own experience.

## The Fundamental Tension

Flexbox layout is expensive for deep trees. Without caching, a layout pass can trigger exponential reflows as parent-child constraints cascade. But caching introduces a new class of bugs: **stale values surviving across layout passes**.

Every mature layout engine has struggled with this.

## Industry Experience

### Chrome Blink -> LayoutNG (2016-2019)

Chrome's original Blink flexbox implementation accumulated a **"chain of ~10 bugs over a year, where each fix caused another issue"** in their incremental layout system. The Blink team ultimately began **LayoutNG** -- a ground-up rewrite with clearer algorithms and more principled caching.

**Lesson**: Incremental layout bugs compound. A principled caching model is more maintainable than ad-hoc fixes.

### Facebook Yoga (2016-present)

Yoga takes a **conservative invalidation** approach. When any node is marked dirty, `markDirtyAndPropagate()` walks up the entire ancestor chain to the root. This trades some performance for safety.

**Lesson**: Conservative invalidation is safer than precise invalidation. The performance cost of occasional unnecessary recomputation is low; the correctness cost of a missed invalidation is high.

### PanGui (2024-2025)

PanGui chose the opposite extreme: **no incremental layout at all**. If any node is dirty, the entire tree is recomputed from scratch.

**Lesson**: Full recomputation is a valid strategy for smaller UIs.

## Bug Taxonomy

### 1. Sentinel Value Collisions

Cache invalidation uses a special value to mark entries as "stale." If that value collides with a legitimate domain value, the cache falsely reports a hit.

**Example**: Using `NaN` to mean "invalidated" in a system where `NaN` also means "unconstrained dimension."

**Prevention**: Use sentinel values outside the legitimate domain (e.g., `-1` for a non-negative dimension field).

### 2. Fingerprint Incompleteness

The cache key (fingerprint) captures the inputs to a layout call. If the fingerprint is missing an input that affects the result, the cache returns stale values when that input changes.

**Prevention**: Include all inputs that affect the final result in the cache key.

### 3. Measurement Side Effects

Measuring a node's intrinsic size may write to shared state. If the measurement runs on a node that won't be re-laid-out (because it's clean), the written state persists incorrectly.

**Prevention**: Measurement functions should not have side effects on layout state, or should save/restore any state they modify.

### 4. Two-Pass Interaction

Flexbox is inherently two-pass: measure children (determine flex basis), distribute space (grow/shrink), then re-measure affected children. The first pass may set state that the second pass assumes is still valid.

**Prevention**: Ensure that state set in pass 1 is either recalculated in pass 2 or that the cache correctly invalidates.

## Testing Strategies

### Differential Oracle (strongest)

Compare incremental re-layout against a fresh layout of an identical tree. The fresh layout is trivially correct (no caching involved). Any difference is a bug.

### Property-Based Testing

Define invariants that must hold for every layout:

- **Idempotency**: Layout twice with no changes -> same result
- **Resize stability**: Layout at W1->W2->W1 -> matches fresh at W1
- **Structural sanity**: All dimensions finite and non-negative

### Cache Stress Testing

Use the same tree instance across multiple `calculateLayout()` calls with varying constraints. This exercises cache rotation and sentinel correctness.

### Mutation Testing

Deliberately inject known-wrong values into cache logic. If no test fails, that indicates a coverage gap.

## Flexily's Approach

Flexily combines aggressive caching with extensive correctness testing:

**Caching layers:**

- **Per-node fingerprint** -- 5-field check enables skipping entire subtrees
- **Two-entry LRU layout cache** -- Stores results for two recent constraint sets per node
- **Four-entry measure cache** -- Caches measure function results
- **Position-only updates** -- When fingerprint matches, propagates position deltas without re-computing layout

**Correctness safeguards:**

- **1200+ fuzz tests** using the differential oracle
- **Conservative dirty propagation** (Yoga-style: walk to root)
- **Domain-safe sentinels** (`-1`, not `NaN`)
- **Side-effect isolation** (save/restore layout state in measurement)
- **Flex distribution guard** -- Detects when flex grow/shrink changed a child's size

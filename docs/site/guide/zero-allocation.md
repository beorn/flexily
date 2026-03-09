# Zero-Allocation Design

This document describes the zero-allocation optimization in Flexily and its trade-offs.

## Motivation

High-frequency TUI rendering (60+ fps) creates significant GC pressure from temporary objects allocated during each layout pass. The classic algorithm allocates:

- `ChildLayout` objects for each child during flex distribution
- `FlexLine[]` arrays for flex-wrap support
- Temporary arrays during filtered iteration

These allocations trigger frequent garbage collection, causing frame drops and latency spikes.

## Design

### FlexInfo on Nodes

Each Node stores a 25-field `FlexInfo` struct that is mutated (not reallocated) each layout pass:

```typescript
interface FlexInfo {
  // Flex distribution state
  mainSize: number
  baseSize: number
  mainMargin: number
  flexGrow: number
  flexShrink: number
  minMain: number
  maxMain: number
  frozen: boolean
  lineIndex: number
  relativeIndex: number
  baseline: number
  // Auto margin tracking
  mainStartMarginAuto: boolean
  mainEndMarginAuto: boolean
  mainStartMarginValue: number
  mainEndMarginValue: number
  // Cached resolved margins
  marginL: number
  marginT: number
  marginR: number
  marginB: number
  // Constraint fingerprinting (layout caching)
  lastAvailW: number
  lastAvailH: number
  lastOffsetX: number
  lastOffsetY: number
  lastDir: number
  layoutValid: boolean
}
```

### Pre-allocated Line Arrays

Module-level typed arrays store per-line metrics:

```typescript
let _lineCrossSizes = new Float64Array(32)
let _lineCrossOffsets = new Float64Array(32)
let _lineLengths = new Uint16Array(32)
let _lineChildren: Node[][] = [...]
let _lineJustifyStarts = new Float64Array(32)
let _lineItemSpacings = new Float64Array(32)
```

Memory usage: ~1,344 bytes total (covers 32 flex lines -- virtually all real layouts).

### Filtered Iteration

The `relativeIndex` field enables skipping absolute/hidden children without `filter()`:

```typescript
// Classic (allocates filtered array):
const relative = children.filter((c) => !isAbsolute(c) && !isHidden(c))

// Zero-alloc (skips inline):
for (const child of children) {
  if (child.flex.relativeIndex < 0) continue
  // Process child...
}
```

## Benchmark Results

| Scenario       | Classic | Zero-alloc     | Yoga WASM   |
| -------------- | ------- | -------------- | ----------- |
| Flat 500 nodes | 1x      | 1.75-2x faster | ~0.5x       |
| Deep 50 levels | 1x      | ~1x (similar)  | 1.2x faster |
| Kanban TUI     | 1x      | ~1.1x faster   | ~0.9x       |

**Key insight**: Zero-alloc excels at flat, wide layouts (the typical TUI structure).

## Trade-offs

### Advantages

- Eliminates temporary object allocation during layout
- Faster for flat, wide layouts (typical TUI structure)
- Cache-friendly contiguous memory access
- Reduces GC pause frequency

### Disadvantages

- Not reentrant (single layout calculation at a time)
- Higher memory per node (FlexInfo struct)
- More complex code than classic algorithm

## Usage

```typescript
// Default: Zero-allocation algorithm (recommended)
import { Node } from "flexily"

// Classic algorithm (for debugging or comparison)
import { Node } from "flexily/classic"
```

Both exports have identical APIs -- only the internal algorithm differs.

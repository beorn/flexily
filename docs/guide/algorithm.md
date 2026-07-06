# Flexily Layout Algorithm

Reference: [Planning-nl/flexbox.js](https://github.com/Planning-nl/flexbox.js)

## Overview

The algorithm works in multiple passes:

1. **Setup**: Initialize axis sizes, reset shrunk flag
2. **Layout Main Axis**: Distribute items, apply grow/shrink
3. **Layout Cross Axis**: Apply alignment

## Two Algorithm Variants

Flexily provides two layout algorithm implementations:

| Algorithm      | File                | Default | Strengths                               |
| -------------- | ------------------- | ------- | --------------------------------------- |
| **Zero-alloc** | `layout-zero.ts`    | ✅ Yes  | Faster for flat layouts, no GC pressure |
| **Classic**    | `classic/layout.ts` | No      | Simpler code, good for debugging        |

Both implement identical Yoga-compatible behavior. The zero-alloc version uses pre-allocated arrays and node-attached FlexInfo structs to eliminate temporary allocations during layout.

## Grow Algorithm

```
Input: amount (extra space to distribute)

1. Calculate totalGrowAmount = sum of all flex-grow values for items not at max size
2. If no grow items, exit
3. Loop while amount remaining:
   a. amountPerGrow = remaining / totalGrowAmount
   b. For each item:
      - If item.grow > 0:
        - grow = item.grow * amountPerGrow
        - If item has maxSize and size >= maxSize: skip (fully grown)
        - If item has maxSize and size + grow > maxSize:
          - grow = maxSize - size (cap at max)
          - totalGrowAmount -= item.grow (remove from next iteration)
        - finalSize = size + grow
        - Resize item to finalSize
        - remaining -= grow
        - If remaining ~= 0: done
```

**Key insight**: The algorithm iterates multiple times to handle items that hit their max size.

## Shrink Algorithm

```
Input: amount (space to remove)

1. Calculate totalScaledShrink = sum of (flex-shrink × flex-basis) for items above min size
2. If no shrinkable items, exit
3. Loop while amount remaining:
   a. For each item:
      - If item.shrink > 0 and size > minSize:
        - scaledShrink = item.shrink * item.baseSize
        - shrink = remaining * scaledShrink / totalScaledShrink
        - maxShrink = size - minSize
        - If shrink >= maxShrink:
          - shrink = maxShrink (cap at min)
          - totalScaledShrink -= scaledShrink (remove from next iteration)
        - finalSize = size - shrink
        - Resize item to finalSize
        - remaining -= shrink
        - If remaining ~= 0: done
```

**Key insight**: Shrink is proportional to `flex-shrink × flex-basis` (CSS spec compliant).
Items with larger basis values shrink more, matching browser behavior.

## Line Layout Flow

For each flex line, `layoutNode()`:

1. **Resolves flex sizes** — `distributeFlexSpaceForLine()` grows items when
   free space is positive and shrinks them when negative (the two algorithms above)
2. **Positions items along the main axis** — applies `justifyContent` spacing
3. **Measures the cross axis** — the line's cross size is the max of its items'
   cross sizes; `alignItems`/`alignSelf` then place each item within the line

## justify-content

Main-axis alignment supports:

- flex-start (default): items at start
- flex-end: items at end
- center: items centered
- space-between: first/last at edges, rest evenly spaced
- space-around: equal space around each item
- space-evenly: equal space between and around items

## RTL and Logical Edges

Both algorithms fully support RTL (right-to-left) layouts:

- `DIRECTION_RTL` reverses the main axis for row layouts
- `EDGE_START`/`EDGE_END` resolve to physical edges based on direction
- All margin, padding, and position edges respect direction

The `resolveEdgeValue()` function maps logical edges to physical edges:

- In LTR: START → LEFT, END → RIGHT
- In RTL: START → RIGHT, END → LEFT

## Baseline Alignment

Baseline alignment is supported via `setBaselineFunc()`:

```typescript
node.setBaselineFunc((width, height) => {
  // Return the baseline offset from the top
  return height * 0.8 // Example: 80% down
})
```

The baseline is used when `ALIGN_BASELINE` is set on the container's `alignItems`.

## Key Differences from CSS Spec

1. **No order property**: Items laid out in insertion order
2. **No writing modes**: Horizontal-tb only

## Files

| File                    | Description                             |
| ----------------------- | --------------------------------------- |
| `src/layout-zero.ts`    | Layout algorithm (default, ~2700 lines) |
| `src/node-zero.ts`      | Node class with FlexInfo                |
| `src/index.ts`          | Default export                          |
| `src/classic/layout.ts` | Classic layout algorithm (~1800 lines)  |
| `src/classic/node.ts`   | Classic Node class                      |
| `src/index-classic.ts`  | Classic export                          |

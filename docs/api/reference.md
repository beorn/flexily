# API Reference

## Composable API

The composable API is the recommended way to use Flexily. It provides a high-level engine with pluggable text measurement, built on top of the low-level Node API.

### createFlexily(options?)

Create a batteries-included engine with monospace text measurement.

```typescript
import { createFlexily } from "flexily"

const flex = createFlexily()
const node = flex.createNode()
node.setTextContent("Hello world")
flex.calculateLayout(node, 80, 24)
```

**Options:**

| Option       | Type     | Default | Description                          |
| ------------ | -------- | ------- | ------------------------------------ |
| `charWidth`  | `number` | `1`     | Width of each character cell         |
| `charHeight` | `number` | `1`     | Height of each character cell        |

For terminal UIs, the default `charWidth=1, charHeight=1` maps directly to terminal cells.

### createBareFlexily()

Create a minimal engine with no text measurement plugin. Use `pipe()` to add plugins.

```typescript
import { createBareFlexily, pipe, withTestMeasurer } from "flexily"

const flex = pipe(createBareFlexily(), withTestMeasurer())
```

Calling `setTextContent()` on a bare engine without a text plugin throws an error.

### pipe(engine, ...plugins)

Apply plugins to an engine, left to right. Returns the modified engine.

```typescript
import { createBareFlexily, pipe, withMonospace, withTestMeasurer } from "flexily"

const flex = pipe(createBareFlexily(), withMonospace(1, 1))
```

### FlexilyEngine

The composable engine interface.

```typescript
interface FlexilyEngine {
  createNode(): FlexilyNode
  calculateLayout(root: FlexilyNode, width?: number, height?: number, direction?: number): void
  textLayout?: TextLayoutService
}
```

| Method            | Description                                             |
| ----------------- | ------------------------------------------------------- |
| `createNode()`    | Create a new FlexilyNode (Node with text content mixin) |
| `calculateLayout` | Calculate layout for a tree (direction defaults to LTR) |
| `textLayout`      | The active text measurement backend (if any)            |

### FlexilyNode

Extends `Node` with text content methods. Created via `engine.createNode()`.

```typescript
interface FlexilyNode extends Node {
  setTextContent(text: string, style?: Partial<ResolvedTextStyle>): void
  getTextContent(): string | null
}
```

| Method             | Description                                                                 |
| ------------------ | --------------------------------------------------------------------------- |
| `setTextContent()` | Set text content and install an automatic measure function                  |
| `getTextContent()` | Get the current text content (or `null` if none)                            |

Calling `setMeasureFunc()` on a FlexilyNode clears its text content. Calling `setTextContent()` replaces any existing measure function.

### FlexilyPlugin

A function that extends or configures the engine.

```typescript
type FlexilyPlugin = (engine: FlexilyEngine) => FlexilyEngine
```

### TextLayoutService

The pluggable text measurement backend interface.

```typescript
interface TextLayoutService {
  prepare(input: TextPrepareInput): PreparedText
}
```

`prepare()` takes text and style, returning a `PreparedText` object that can compute intrinsic sizes and layout at any width.

### Text Measurement Plugins

#### withMonospace(charWidth?, charHeight?)

Monospace text measurement. Each grapheme cluster = `charWidth` units wide, always 1 line (no wrapping). Default for `createFlexily()`.

```typescript
import { createBareFlexily, pipe, withMonospace } from "flexily"

const flex = pipe(createBareFlexily(), withMonospace(1, 1))
```

| Parameter    | Type     | Default | Description                   |
| ------------ | -------- | ------- | ----------------------------- |
| `charWidth`  | `number` | `1`     | Width per character cell      |
| `charHeight` | `number` | `1`     | Height per character cell     |

#### withTestMeasurer()

Deterministic text measurement for tests and CI. Fixed grapheme width table: Latin 0.8, CJK 1.0, emoji 1.8 (relative to fontSize). Supports word wrapping.

```typescript
import { createBareFlexily, pipe, withTestMeasurer } from "flexily"

const flex = pipe(createBareFlexily(), withTestMeasurer())
```

Cross-platform deterministic -- same results on every OS and runtime.

#### withPretext(pretext)

Proportional font measurement via `@chenglou/pretext` (peer dependency). For Canvas-based text rendering.

```typescript
import { createBareFlexily, pipe, withPretext } from "flexily"
import pretext from "@chenglou/pretext"

const flex = pipe(createBareFlexily(), withPretext(pretext))
```

| Parameter | Type         | Description                                  |
| --------- | ------------ | -------------------------------------------- |
| `pretext`  | `PretextAPI` | The pretext module (install separately)      |

---

## Node

The low-level Yoga-compatible API. All composable API nodes extend Node.

### Creating Nodes

```typescript
import { Node } from "flexily"

const node = Node.create()
```

Nodes form a tree. Each node represents a flexbox container or leaf.

### Tree Operations

```typescript
node.insertChild(child, index) // Insert child at index
node.removeChild(child) // Remove child
node.getChildCount() // Number of children
node.getChild(index) // Get child by index
node.getParent() // Get parent node (or null)
```

### Dimension Setters

```typescript
node.setWidth(100) // Fixed width
node.setHeight(50) // Fixed height
node.setWidthAuto() // Auto width
node.setHeightAuto() // Auto height
node.setWidthPercent(50) // 50% of parent
node.setHeightPercent(50) // 50% of parent
node.setMinWidth(10)
node.setMinHeight(10)
node.setMaxWidth(200)
node.setMaxHeight(200)
```

### Flex Properties

```typescript
import {
  FLEX_DIRECTION_ROW,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_ROW_REVERSE,
  FLEX_DIRECTION_COLUMN_REVERSE,
  WRAP_WRAP,
  WRAP_NO_WRAP,
  JUSTIFY_CENTER,
  JUSTIFY_FLEX_START,
  JUSTIFY_FLEX_END,
  JUSTIFY_SPACE_BETWEEN,
  JUSTIFY_SPACE_AROUND,
  JUSTIFY_SPACE_EVENLY,
  ALIGN_CENTER,
  ALIGN_FLEX_START,
  ALIGN_FLEX_END,
  ALIGN_STRETCH,
  ALIGN_BASELINE,
} from "flexily"

node.setFlexDirection(FLEX_DIRECTION_ROW)
node.setFlexWrap(WRAP_WRAP)
node.setFlexGrow(1)
node.setFlexShrink(0)
node.setFlexBasis(100)
node.setJustifyContent(JUSTIFY_CENTER)
node.setAlignItems(ALIGN_CENTER)
node.setAlignSelf(ALIGN_FLEX_END)
node.setAlignContent(ALIGN_CENTER)
```

### Spacing

```typescript
import {
  EDGE_TOP,
  EDGE_RIGHT,
  EDGE_BOTTOM,
  EDGE_LEFT,
  EDGE_ALL,
  EDGE_START,
  EDGE_END,
  GUTTER_ALL,
  GUTTER_ROW,
  GUTTER_COLUMN,
} from "flexily"

// Padding
node.setPadding(EDGE_ALL, 10)
node.setPadding(EDGE_TOP, 5)

// Margin
node.setMargin(EDGE_ALL, 10)
node.setMarginAuto(EDGE_LEFT)

// Border
node.setBorder(EDGE_ALL, 1)

// Gap
node.setGap(GUTTER_ALL, 10)
node.setGap(GUTTER_ROW, 5)
node.setGap(GUTTER_COLUMN, 5)
```

### Positioning

```typescript
import { POSITION_TYPE_ABSOLUTE, POSITION_TYPE_RELATIVE } from "flexily"

node.setPositionType(POSITION_TYPE_ABSOLUTE)
node.setPosition(EDGE_TOP, 10)
node.setPosition(EDGE_LEFT, 20)
```

### Aspect Ratio

```typescript
node.setAspectRatio(16 / 9)
```

### Measure Functions

For leaf nodes that measure their own content (e.g., text):

```typescript
node.setMeasureFunc((width, widthMode, height, heightMode) => {
  // widthMode: MEASURE_MODE_EXACTLY | MEASURE_MODE_AT_MOST | MEASURE_MODE_UNDEFINED
  return { width: computedWidth, height: computedHeight }
})
```

### Baseline Functions

```typescript
node.setBaselineFunc((width, height) => {
  return baselineOffset // number
})
```

### Layout Calculation

```typescript
import { DIRECTION_LTR, DIRECTION_RTL } from "flexily"

node.calculateLayout(availableWidth, availableHeight, DIRECTION_LTR)
```

### Reading Computed Values

After `calculateLayout()`:

```typescript
node.getComputedLeft()
node.getComputedTop()
node.getComputedRight()
node.getComputedBottom()
node.getComputedWidth()
node.getComputedHeight()
node.getComputedPadding(EDGE_TOP)
node.getComputedMargin(EDGE_LEFT)
node.getComputedBorder(EDGE_ALL)
```

### Dirty Tracking

```typescript
node.isDirty() // Has this node been modified since last layout?
node.markDirty() // Force recalculation
```

### Disposal

```typescript
node.free() // Release resources
node.free() // Free this node and clean up references
```

## Constants

All constants are Yoga-compatible. Import from `flexily`:

| Category       | Constants                                                                                                                                          |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Direction      | `DIRECTION_LTR`, `DIRECTION_RTL`, `DIRECTION_INHERIT`                                                                                              |
| Flex Direction | `FLEX_DIRECTION_ROW`, `FLEX_DIRECTION_COLUMN`, `FLEX_DIRECTION_ROW_REVERSE`, `FLEX_DIRECTION_COLUMN_REVERSE`                                       |
| Justify        | `JUSTIFY_FLEX_START`, `JUSTIFY_CENTER`, `JUSTIFY_FLEX_END`, `JUSTIFY_SPACE_BETWEEN`, `JUSTIFY_SPACE_AROUND`, `JUSTIFY_SPACE_EVENLY`                |
| Align          | `ALIGN_FLEX_START`, `ALIGN_CENTER`, `ALIGN_FLEX_END`, `ALIGN_STRETCH`, `ALIGN_BASELINE`, `ALIGN_AUTO`, `ALIGN_SPACE_BETWEEN`, `ALIGN_SPACE_AROUND` |
| Wrap           | `WRAP_NO_WRAP`, `WRAP_WRAP`, `WRAP_WRAP_REVERSE`                                                                                                   |
| Position       | `POSITION_TYPE_STATIC`, `POSITION_TYPE_RELATIVE`, `POSITION_TYPE_ABSOLUTE`                                                                         |
| Edge           | `EDGE_LEFT`, `EDGE_TOP`, `EDGE_RIGHT`, `EDGE_BOTTOM`, `EDGE_START`, `EDGE_END`, `EDGE_HORIZONTAL`, `EDGE_VERTICAL`, `EDGE_ALL`                     |
| Gap            | `GUTTER_COLUMN`, `GUTTER_ROW`, `GUTTER_ALL`                                                                                                        |
| Measure Mode   | `MEASURE_MODE_EXACTLY`, `MEASURE_MODE_AT_MOST`, `MEASURE_MODE_UNDEFINED`                                                                           |
| Overflow       | `OVERFLOW_VISIBLE`, `OVERFLOW_HIDDEN`, `OVERFLOW_SCROLL`                                                                                           |
| Display        | `DISPLAY_FLEX`, `DISPLAY_NONE`                                                                                                                     |

## Testing Utilities

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

| Export                                        | Description                                          |
| --------------------------------------------- | ---------------------------------------------------- |
| `getLayout(node)`                             | Recursively extract computed layout as plain objects |
| `formatLayout(layout)`                        | Pretty-print a layout tree for debugging             |
| `diffLayouts(a, b)`                           | Node-by-node diff with NaN-safe comparison           |
| `textMeasure(width)`                          | Factory for wrapping text measure functions          |
| `assertLayoutSanity(node)`                    | Validate dimensions are finite and non-negative      |
| `expectRelayoutMatchesFresh(buildTree, w, h)` | Differential oracle: incremental must match fresh    |
| `expectIdempotent(buildTree, w, h)`           | Two identical layouts must produce same result       |
| `expectResizeRoundTrip(buildTree, widths)`    | Resize sequence must match fresh at final width      |

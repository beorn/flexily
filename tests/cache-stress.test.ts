/**
 * Caching Correctness Stress Tests
 *
 * Tests for constraint fingerprinting edge cases that could cause false cache hits.
 * Expert analysis (Jan 2026) identified these as high-risk areas:
 * 1. Percent + wrap combinations
 * 2. Shrink-wrap + min/max
 * 3. Stretch + aspect ratio
 * 4. Baseline alignment
 *
 * Run: bun test tests/cache-stress.test.ts
 */

import { describe, expect, it } from "vitest"
import {
  ALIGN_BASELINE,
  ALIGN_STRETCH,
  DIRECTION_LTR,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_ROW,
  GUTTER_ALL,
  MEASURE_MODE_EXACTLY,
  Node,
  WRAP_WRAP,
} from "../src/index.js"

describe("Measure cache recency", () => {
  /**
   * @failure A frequently used constraint is evicted, repeating text measurement.
   * @level l0
   * @consumer Node.cachedMeasure callers in layout and intrinsic sizing.
   * Geometry alone stays correct under FIFO, so assert callback work as well.
   */
  it("retains hot measurements without growing the cache and clears them when dirty", () => {
    const node = Node.create()
    let calls = 0
    node.setMeasureFunc((width, _widthMode, height) => {
      calls++
      return { width, height }
    })
    const measure = (width: number) => {
      const result = node.cachedMeasure(width, MEASURE_MODE_EXACTLY, 10, MEASURE_MODE_EXACTLY)
      expect(result).toEqual({ width, height: 10 })
      return result
    }
    try {
      const result = measure(1)
      for (const width of [2, 3, 4]) measure(width)
      for (const width of [3, 2, 1]) measure(width)
      measure(5)
      expect(measure(1)).toBe(result)
      expect(calls).toBe(5)

      measure(4)
      expect(calls).toBe(6)
      node.markDirty()
      expect(measure(1)).toBe(result)
      expect(calls).toBe(7)
    } finally {
      node.free()
    }
  })
})

// ============================================================================
// Helper: Get full layout tree for comparison
// ============================================================================

interface LayoutResult {
  left: number
  top: number
  width: number
  height: number
  children: LayoutResult[]
}

function getLayout(node: Node): LayoutResult {
  return {
    left: node.getComputedLeft(),
    top: node.getComputedTop(),
    width: node.getComputedWidth(),
    height: node.getComputedHeight(),
    children: Array.from({ length: node.getChildCount() }, (_, i) => getLayout(node.getChild(i)!)),
  }
}

function layoutsEqual(a: LayoutResult, b: LayoutResult, tolerance = 0.001): boolean {
  if (
    Math.abs(a.left - b.left) > tolerance ||
    Math.abs(a.top - b.top) > tolerance ||
    Math.abs(a.width - b.width) > tolerance ||
    Math.abs(a.height - b.height) > tolerance
  ) {
    return false
  }
  if (a.children.length !== b.children.length) return false
  return a.children.every((child, i) => layoutsEqual(child, b.children[i]!, tolerance))
}

function formatLayout(layout: LayoutResult, indent = 0): string {
  const pad = "  ".repeat(indent)
  let result = `${pad}{ left: ${layout.left}, top: ${layout.top}, width: ${layout.width}, height: ${layout.height} }`
  if (layout.children.length > 0) {
    result += ` [\n${layout.children.map((c) => formatLayout(c, indent + 1)).join(",\n")}\n${pad}]`
  }
  return result
}

/**
 * Verifies cache consistency: markDirty + recalculate should match previous layout.
 * This is the core assertion pattern for cache stress tests.
 */
function expectCachingConsistency(root: Node, expectedLayout: LayoutResult, width: number, height: number): void {
  root.markDirty()
  root.calculateLayout(width, height, DIRECTION_LTR)
  expect(layoutsEqual(expectedLayout, getLayout(root))).toBe(true)
}

interface RootConfig {
  width?: number
  height?: number
  direction?: number
  wrap?: number
  alignItems?: number
  gap?: number
}

/**
 * Creates a root node with common settings.
 */
function createRoot(config: RootConfig = {}): Node {
  const root = Node.create()
  if (config.width !== undefined) root.setWidth(config.width)
  if (config.height !== undefined) root.setHeight(config.height)
  if (config.direction !== undefined) root.setFlexDirection(config.direction)
  if (config.wrap !== undefined) root.setFlexWrap(config.wrap)
  if (config.alignItems !== undefined) root.setAlignItems(config.alignItems)
  if (config.gap !== undefined) root.setGap(GUTTER_ALL, config.gap)
  return root
}

/**
 * Creates a child node with width and height.
 */
function createChild(width: number, height: number): Node {
  const child = Node.create()
  child.setWidth(width)
  child.setHeight(height)
  return child
}

// ============================================================================
// Test Suite: Percent + Wrap Combinations
// ============================================================================

describe("Cache Stress: Percent + Wrap", () => {
  it("percent width with flex-wrap should invalidate on parent resize", () => {
    const root = createRoot({
      width: 100,
      height: 100,
      direction: FLEX_DIRECTION_ROW,
      wrap: WRAP_WRAP,
    })

    // Children with percent width (40% of 100 = 40, so 2 fit per line)
    for (let i = 0; i < 3; i++) {
      const child = Node.create()
      child.setWidthPercent(40)
      child.setHeight(20)
      root.insertChild(child, i)
    }

    root.calculateLayout(100, 100, DIRECTION_LTR)

    // Resize parent (percent values should recalculate)
    root.setWidth(200)
    root.calculateLayout(200, 100, DIRECTION_LTR)
    const layout = getLayout(root)

    // Children should now be 80px wide (40% of 200)
    expect(layout.children[0]!.width).toBe(80)
    expectCachingConsistency(root, layout, 200, 100)
  })

  it("nested percent values should cascade correctly", () => {
    const root = createRoot({ width: 100, height: 100 })

    const outer = Node.create()
    outer.setWidthPercent(50) // 50px
    outer.setHeightPercent(50) // 50px
    root.insertChild(outer, 0)

    const inner = Node.create()
    inner.setWidthPercent(50) // 50% of 50 = 25px
    inner.setHeightPercent(50)
    outer.insertChild(inner, 0)

    root.calculateLayout(100, 100, DIRECTION_LTR)
    expect(inner.getComputedWidth()).toBe(25)
    expect(inner.getComputedHeight()).toBe(25)

    // Change root size - inner should be 50% of 50% of 200 = 50px
    root.setWidth(200)
    root.setHeight(200)
    root.calculateLayout(200, 200, DIRECTION_LTR)
    expect(outer.getComputedWidth()).toBe(100)
    expect(inner.getComputedWidth()).toBe(50)

    expectCachingConsistency(root, getLayout(root), 200, 200)
  })

  it("percent margin with wrap should recalculate on resize", () => {
    const root = createRoot({
      width: 100,
      height: 100,
      direction: FLEX_DIRECTION_ROW,
      wrap: WRAP_WRAP,
    })

    const child = createChild(30, 20)
    child.setMarginPercent(0, 10) // 10% left margin
    root.insertChild(child, 0)

    root.calculateLayout(100, 100, DIRECTION_LTR)
    expect(child.getComputedLeft()).toBe(10) // 10% of 100

    // Resize - margin should recalculate
    root.setWidth(200)
    root.calculateLayout(200, 100, DIRECTION_LTR)
    expect(child.getComputedLeft()).toBe(20) // 10% of 200
  })
})

// ============================================================================
// Test Suite: Shrink-wrap + Min/Max
// ============================================================================

describe("Cache Stress: Shrink-wrap + Min/Max", () => {
  it("auto-sized parent with min-constrained children should recalculate", () => {
    const root = createRoot({ height: 100, direction: FLEX_DIRECTION_ROW })

    const child1 = createChild(50, 20)
    child1.setMinWidth(30)
    root.insertChild(child1, 0)

    const child2 = createChild(50, 20)
    root.insertChild(child2, 1)

    root.calculateLayout(200, 100, DIRECTION_LTR)
    expect(root.getComputedWidth()).toBe(100) // 50 + 50

    // Change child width below min (should clamp to 30)
    child1.setWidth(20)
    root.calculateLayout(200, 100, DIRECTION_LTR)
    const layout = getLayout(root)

    // Root should shrink-wrap to 30 + 50 = 80
    expect(root.getComputedWidth()).toBe(80)
    expect(child1.getComputedWidth()).toBe(30)
    expectCachingConsistency(root, layout, 200, 100)
  })

  it("children intrinsic size changes should invalidate parent shrink-wrap", () => {
    const root = createRoot({ height: 100, direction: FLEX_DIRECTION_ROW })

    let intrinsicWidth = 50
    const child = Node.create()
    child.setMeasureFunc((maxW) => ({
      width: Math.min(intrinsicWidth, maxW),
      height: 20,
    }))
    root.insertChild(child, 0)

    root.calculateLayout(200, 100, DIRECTION_LTR)
    expect(root.getComputedWidth()).toBe(50)
    expect(child.getComputedWidth()).toBe(50)

    // Change intrinsic size and mark dirty
    intrinsicWidth = 80
    child.markDirty()
    root.calculateLayout(200, 100, DIRECTION_LTR)
    expect(root.getComputedWidth()).toBe(80)
    expect(child.getComputedWidth()).toBe(80)
  })

  it("min/max constraints on shrink-wrap containers", () => {
    const root = createRoot({ height: 100, direction: FLEX_DIRECTION_ROW })
    root.setMinWidth(60)
    root.setMaxWidth(120)

    const child = createChild(40, 20)
    root.insertChild(child, 0)

    // Content is 40, but min is 60
    root.calculateLayout(200, 100, DIRECTION_LTR)
    expect(root.getComputedWidth()).toBe(60)

    // Increase child width beyond max
    child.setWidth(150)
    root.calculateLayout(200, 100, DIRECTION_LTR)
    expect(root.getComputedWidth()).toBe(120)
  })
})

// ============================================================================
// Test Suite: Stretch + Aspect Ratio
// ============================================================================

describe("Cache Stress: Stretch + Aspect Ratio", () => {
  it("cross-axis stretch with aspect-ratio should recalculate on cross size change", () => {
    const root = createRoot({
      width: 100,
      height: 100,
      direction: FLEX_DIRECTION_ROW,
      alignItems: ALIGN_STRETCH,
    })

    const child = createChild(40, 0)
    child.setAspectRatio(2) // width:height = 2:1
    root.insertChild(child, 0)

    root.calculateLayout(100, 100, DIRECTION_LTR)

    // Change cross size
    root.setHeight(80)
    root.calculateLayout(100, 80, DIRECTION_LTR)
    expectCachingConsistency(root, getLayout(root), 100, 80)
  })

  it("multi-line stretch behavior", () => {
    const root = createRoot({
      width: 100,
      height: 100,
      direction: FLEX_DIRECTION_ROW,
      wrap: WRAP_WRAP,
      alignItems: ALIGN_STRETCH,
    })

    // 4 children that wrap into 2 lines
    for (let i = 0; i < 4; i++) {
      const child = Node.create()
      child.setWidth(40)
      root.insertChild(child, i)
    }

    root.calculateLayout(100, 100, DIRECTION_LTR)

    // Change container height
    root.setHeight(80)
    root.calculateLayout(100, 80, DIRECTION_LTR)
    expectCachingConsistency(root, getLayout(root), 100, 80)
  })

  it("stretch with min/max constraints", () => {
    const root = createRoot({
      width: 100,
      height: 100,
      direction: FLEX_DIRECTION_ROW,
      alignItems: ALIGN_STRETCH,
    })

    const child = Node.create()
    child.setWidth(40)
    child.setMinHeight(30)
    child.setMaxHeight(60)
    root.insertChild(child, 0)

    // Cross size 100 would stretch to 100, but max is 60
    root.calculateLayout(100, 100, DIRECTION_LTR)
    expect(child.getComputedHeight()).toBe(60)

    // Reduce cross size below min
    root.setHeight(20)
    root.calculateLayout(100, 20, DIRECTION_LTR)
    expect(child.getComputedHeight()).toBe(30)
  })
})

// ============================================================================
// Test Suite: Baseline Alignment
// ============================================================================

describe("Cache Stress: Baseline Alignment", () => {
  it("baseline alignment with different child heights", () => {
    const root = createRoot({
      width: 100,
      height: 100,
      direction: FLEX_DIRECTION_ROW,
      alignItems: ALIGN_BASELINE,
    })

    const child1 = createChild(30, 20)
    root.insertChild(child1, 0)

    const child2 = createChild(30, 40)
    root.insertChild(child2, 1)

    root.calculateLayout(100, 100, DIRECTION_LTR)
    const layout1 = getLayout(root)

    // Change child1 height (affects baseline calculation)
    child1.setHeight(30)
    root.calculateLayout(100, 100, DIRECTION_LTR)
    const layout2 = getLayout(root)

    // Layouts should differ due to baseline recalculation
    expect(layoutsEqual(layout1, layout2)).toBe(false)
    expectCachingConsistency(root, layout2, 100, 100)
  })

  it("baseline with custom baselineFunc", () => {
    const root = createRoot({
      width: 100,
      height: 100,
      direction: FLEX_DIRECTION_ROW,
      alignItems: ALIGN_BASELINE,
    })

    const child1 = createChild(30, 40)
    child1.setBaselineFunc(() => 30) // Custom baseline at 30px from top
    root.insertChild(child1, 0)

    const child2 = createChild(30, 20) // Default baseline at bottom (20px)
    root.insertChild(child2, 1)

    root.calculateLayout(100, 100, DIRECTION_LTR)

    // Child2 positioned so its baseline (20) aligns with child1's (30)
    expect(child2.getComputedTop()).toBe(10) // 30 - 20 = 10

    // Change baselineFunc - now both at 20
    child1.setBaselineFunc(() => 20)
    root.calculateLayout(100, 100, DIRECTION_LTR)
    expect(child2.getComputedTop()).toBe(0)
  })

  it("baseline alignment with wrap", () => {
    const root = createRoot({
      width: 80,
      height: 100,
      direction: FLEX_DIRECTION_ROW,
      wrap: WRAP_WRAP,
      alignItems: ALIGN_BASELINE,
    })

    // Line 1: child1 and child2
    root.insertChild(createChild(40, 20), 0)
    root.insertChild(createChild(40, 30), 1)
    // Line 2: child3 (wraps)
    root.insertChild(createChild(40, 25), 2)

    root.calculateLayout(80, 100, DIRECTION_LTR)
    expectCachingConsistency(root, getLayout(root), 80, 100)
  })
})

// ============================================================================
// Test Suite: Combined Edge Cases
// ============================================================================

describe("Cache Stress: Combined Edge Cases", () => {
  it("percent + shrink-wrap + nested", () => {
    // Percent resolves against available width constraint.
    // Changing constraint triggers re-layout.
    const root = createRoot({
      width: 200,
      height: 100,
      direction: FLEX_DIRECTION_COLUMN,
    })

    const container = Node.create()
    container.setWidthPercent(50) // 50% of 200 = 100
    container.setHeight(30)
    root.insertChild(container, 0)

    container.insertChild(createChild(80, 20), 0)

    root.calculateLayout(200, 100, DIRECTION_LTR)
    expect(container.getComputedWidth()).toBe(100)
    expect(root.getComputedWidth()).toBe(200)

    // Change root width - container should become 50% of 400 = 200
    root.setWidth(400)
    root.calculateLayout(400, 100, DIRECTION_LTR)
    expect(container.getComputedWidth()).toBe(200)

    expectCachingConsistency(root, getLayout(root), 400, 100)
  })

  it("stretch + gap + multiple lines", () => {
    const root = createRoot({
      width: 100,
      height: 100,
      direction: FLEX_DIRECTION_ROW,
      wrap: WRAP_WRAP,
      alignItems: ALIGN_STRETCH,
      gap: 10,
    })

    // 3 children: 2 on first line (40+10+40=90), 1 on second
    for (let i = 0; i < 3; i++) {
      const child = Node.create()
      child.setWidth(40)
      root.insertChild(child, i)
    }

    root.calculateLayout(100, 100, DIRECTION_LTR)

    // Change gap - line heights should update
    root.setGap(GUTTER_ALL, 20)
    root.calculateLayout(100, 100, DIRECTION_LTR)
    expectCachingConsistency(root, getLayout(root), 100, 100)
  })

  it("measure func + percent parent + cache invalidation", () => {
    const root = createRoot({
      width: 100,
      height: 100,
      direction: FLEX_DIRECTION_COLUMN,
    })

    const container = Node.create()
    container.setWidthPercent(80) // 80px
    container.setHeight(50)
    root.insertChild(container, 0)

    let textWidth = 60
    const text = Node.create()
    text.setMeasureFunc((maxW) => ({
      width: Math.min(textWidth, maxW),
      height: 20,
    }))
    container.insertChild(text, 0)

    root.calculateLayout(100, 100, DIRECTION_LTR)
    expect(text.getComputedWidth()).toBe(60)

    // Reduce container percent - text constrained to 50
    container.setWidthPercent(50)
    root.calculateLayout(100, 100, DIRECTION_LTR)
    expect(text.getComputedWidth()).toBe(50)

    // Reduce text intrinsic
    textWidth = 30
    text.markDirty()
    root.calculateLayout(100, 100, DIRECTION_LTR)
    expect(text.getComputedWidth()).toBe(30)
  })
})

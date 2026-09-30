/**
 * Re-layout Consistency Tests
 *
 * Tests that re-layout of partially-dirty trees produces identical results
 * to fresh layout of the same tree. Uses a differential oracle pattern:
 * build tree → layout → mark dirty → re-layout → compare against fresh layout.
 *
 * Bug classes caught:
 * 1. measureNode overwriting layout.width/height on clean nodes (km-10mat)
 * 2. NaN cache sentinel: resetLayoutCache used NaN to "invalidate" entries,
 *    but NaN is a legitimate "unconstrained" query — Object.is(NaN,NaN)===true
 *    caused false cache hits returning stale computed values (km-frod5)
 * 3. Fingerprint mismatch with parent override: auto-sized children get NaN
 *    as availableWidth from parent, but parent overrides layout after layoutNode
 *    returns (flex shrinkage). When shrinkage changes between passes, the stale
 *    overridden value is preserved because NaN===NaN fingerprint matches (km-frod5)
 *
 * Run: bun vitest run vendor/flexily/tests/relayout-consistency.test.ts
 */

import { describe, expect, it } from "vitest"
import * as C from "../src/constants.js"
import {
  DIRECTION_LTR,
  DIRECTION_RTL,
  EDGE_ALL,
  EDGE_LEFT,
  EDGE_TOP,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_COLUMN_REVERSE,
  FLEX_DIRECTION_ROW,
  FLEX_DIRECTION_ROW_REVERSE,
  GUTTER_ALL,
  MEASURE_MODE_AT_MOST,
  MEASURE_MODE_EXACTLY,
  Node,
  POSITION_TYPE_ABSOLUTE,
  WRAP_WRAP,
} from "../src/index.js"
import {
  assertLayoutSanity,
  diffLayouts,
  expectIdempotent,
  expectRelayoutMatchesFresh,
  expectResizeRoundTrip,
  formatLayout,
  getLayout,
  textMeasure,
  type BuildTreeResult,
} from "../src/testing.js"
import {
  buildNestedColumns,
  mountRow,
  nestedColumnsSpec,
  type NestedColumns,
  type NestedColumnsSpec,
} from "./nested-columns-fixture.js"

// ============================================================================
// Test-local helpers
// ============================================================================

// Mulberry32 seeded RNG (from differential-fuzz.fuzz.ts)
function createRng(seed: number): () => number {
  return function () {
    let t = (seed += 0x6d2b79f5)
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ============================================================================
// Group 1: Re-layout Consistency (targeted scenarios)
// ============================================================================

describe("Re-layout Consistency: targeted scenarios", () => {
  it("partial dirty: text sibling preserves height", () => {
    // The exact km-10mat bug: row with fixed child + wrapping text,
    // mark only fixed child dirty.
    function buildTree(): BuildTreeResult {
      const root = Node.create()
      root.setWidth(40)

      const row = Node.create()
      row.setFlexDirection(FLEX_DIRECTION_ROW)
      root.insertChild(row, 0)

      const fixed = Node.create()
      fixed.setWidth(10)
      fixed.setHeight(1)
      row.insertChild(fixed, 0)

      const flex = Node.create()
      flex.setFlexGrow(1)
      flex.setFlexShrink(1)
      flex.setMeasureFunc(textMeasure(50))
      row.insertChild(flex, 1)

      return { root, dirtyTargets: [fixed] }
    }

    expectRelayoutMatchesFresh(buildTree, 40, NaN)
  })

  it("partial dirty: bordered card structure", () => {
    // Real-world silvery card: border > row > prefix(fixed) + content(flexGrow>text)
    // Mark prefix dirty.
    function buildTree(): BuildTreeResult {
      const root = Node.create()
      root.setWidth(40)

      const bordered = Node.create()
      bordered.setBorder(0, 1) // left
      bordered.setBorder(1, 1) // top
      bordered.setBorder(2, 1) // right
      bordered.setBorder(3, 1) // bottom
      bordered.setPadding(2, 1) // paddingRight
      root.insertChild(bordered, 0)

      const row = Node.create()
      row.setFlexDirection(FLEX_DIRECTION_ROW)
      bordered.insertChild(row, 0)

      const prefix = Node.create()
      prefix.setWidth(3)
      prefix.setFlexShrink(0)
      row.insertChild(prefix, 0)

      const prefixText = Node.create()
      prefixText.setMeasureFunc(textMeasure(3))
      prefix.insertChild(prefixText, 0)

      const content = Node.create()
      content.setFlexGrow(1)
      content.setFlexShrink(1)
      row.insertChild(content, 1)

      const contentText = Node.create()
      contentText.setMeasureFunc(textMeasure(50))
      content.insertChild(contentText, 0)

      return { root, dirtyTargets: [prefix] }
    }

    expectRelayoutMatchesFresh(buildTree, 40, NaN)
  })

  it("partial dirty: deep tree, dirty leaf, clean wrapping sibling", () => {
    // 3+ nesting levels, dirty node far from the text node
    function buildTree(): BuildTreeResult {
      const root = Node.create()
      root.setWidth(60)

      const level1 = Node.create()
      level1.setFlexDirection(FLEX_DIRECTION_COLUMN)
      root.insertChild(level1, 0)

      const level2a = Node.create()
      level2a.setFlexDirection(FLEX_DIRECTION_ROW)
      level1.insertChild(level2a, 0)

      const deepFixed = Node.create()
      deepFixed.setWidth(8)
      deepFixed.setHeight(1)
      level2a.insertChild(deepFixed, 0)

      const deepFlex = Node.create()
      deepFlex.setFlexGrow(1)
      deepFlex.setFlexShrink(1)
      deepFlex.setMeasureFunc(textMeasure(80))
      level2a.insertChild(deepFlex, 1)

      const level2b = Node.create()
      level2b.setFlexDirection(FLEX_DIRECTION_ROW)
      level1.insertChild(level2b, 1)

      const leaf = Node.create()
      leaf.setWidth(15)
      leaf.setHeight(2)
      level2b.insertChild(leaf, 0)

      return { root, dirtyTargets: [leaf] }
    }

    expectRelayoutMatchesFresh(buildTree, 60, NaN)
  })

  it("content change: dirty measure node gets correct new height", () => {
    // Change text width via closure, mark dirty, verify re-measurement works
    let currentTextWidth = 30

    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setWidth(40)

    const row = Node.create()
    row.setFlexDirection(FLEX_DIRECTION_ROW)
    root.insertChild(row, 0)

    const flex = Node.create()
    flex.setFlexGrow(1)
    flex.setMeasureFunc((w, wm, h, hm) => {
      if (wm === MEASURE_MODE_EXACTLY || wm === MEASURE_MODE_AT_MOST) {
        if (w >= currentTextWidth) return { width: currentTextWidth, height: 1 }
        return {
          width: Math.min(currentTextWidth, w),
          height: Math.ceil(currentTextWidth / w),
        }
      }
      return { width: currentTextWidth, height: 1 }
    })
    row.insertChild(flex, 0)

    // Initial layout — text fits in 1 line
    root.calculateLayout(40, NaN, DIRECTION_LTR)
    expect(flex.getComputedHeight()).toBe(1)

    // Change text to 80 chars — should wrap to 2 lines
    currentTextWidth = 80
    flex.markDirty()
    root.calculateLayout(40, NaN, DIRECTION_LTR)
    expect(flex.getComputedHeight()).toBe(2)
    expect(row.getComputedHeight()).toBe(2)
  })

  it("multiple dirty nodes in kanban-like structure", () => {
    function buildTree(): BuildTreeResult {
      const root = Node.create()
      root.setWidth(80)
      root.setFlexDirection(FLEX_DIRECTION_ROW)

      const dirtyTargets: Node[] = []

      for (let col = 0; col < 3; col++) {
        const column = Node.create()
        column.setFlexGrow(1)
        column.setFlexDirection(FLEX_DIRECTION_COLUMN)
        root.insertChild(column, col)

        for (let card = 0; card < 4; card++) {
          const cardNode = Node.create()
          cardNode.setBorder(0, 1)
          cardNode.setBorder(1, 1)
          cardNode.setBorder(2, 1)
          cardNode.setBorder(3, 1)
          column.insertChild(cardNode, card)

          const row = Node.create()
          row.setFlexDirection(FLEX_DIRECTION_ROW)
          cardNode.insertChild(row, 0)

          const prefix = Node.create()
          prefix.setWidth(3)
          prefix.setHeight(1)
          row.insertChild(prefix, 0)

          const text = Node.create()
          text.setFlexGrow(1)
          text.setFlexShrink(1)
          text.setMeasureFunc(textMeasure(20 + card * 10))
          row.insertChild(text, 1)

          // Scatter dirty marks across columns
          if ((col + card) % 3 === 0) {
            dirtyTargets.push(prefix)
          }
        }
      }

      return { root, dirtyTargets }
    }

    expectRelayoutMatchesFresh(buildTree, 80, NaN)
  })

  it("tree mutation: insert child then re-layout", () => {
    const root = Node.create()
    root.setWidth(40)
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)

    const child1 = Node.create()
    child1.setHeight(3)
    root.insertChild(child1, 0)

    const child2 = Node.create()
    child2.setFlexDirection(FLEX_DIRECTION_ROW)
    root.insertChild(child2, 1)

    const text = Node.create()
    text.setFlexGrow(1)
    text.setMeasureFunc(textMeasure(60))
    child2.insertChild(text, 0)

    // Initial layout
    root.calculateLayout(40, NaN, DIRECTION_LTR)
    const beforeChild2Height = child2.getComputedHeight()

    // Insert new child — triggers markDirty internally
    const child3 = Node.create()
    child3.setHeight(5)
    root.insertChild(child3, 2)

    // Re-layout
    root.calculateLayout(40, NaN, DIRECTION_LTR)

    // Existing siblings should retain their dimensions
    expect(child1.getComputedHeight()).toBe(3)
    expect(child2.getComputedHeight()).toBe(beforeChild2Height)
    expect(child3.getComputedHeight()).toBe(5)
  })
})

// ============================================================================
// Group 2: measureNode Isolation (white-box invariant)
// ============================================================================

describe("Re-layout Consistency: measureNode invariant", () => {
  it("layout.width/height unchanged for clean nodes after re-layout", () => {
    const root = Node.create()
    root.setWidth(40)

    const row = Node.create()
    row.setFlexDirection(FLEX_DIRECTION_ROW)
    root.insertChild(row, 0)

    const fixed = Node.create()
    fixed.setWidth(10)
    fixed.setHeight(1)
    row.insertChild(fixed, 0)

    const flex = Node.create()
    flex.setFlexGrow(1)
    flex.setFlexShrink(1)
    flex.setMeasureFunc(textMeasure(50))
    row.insertChild(flex, 1)

    // Initial layout
    root.calculateLayout(40, NaN, DIRECTION_LTR)

    // Record dimensions of every node
    const before = {
      root: { w: root.getComputedWidth(), h: root.getComputedHeight() },
      row: { w: row.getComputedWidth(), h: row.getComputedHeight() },
      fixed: { w: fixed.getComputedWidth(), h: fixed.getComputedHeight() },
      flex: { w: flex.getComputedWidth(), h: flex.getComputedHeight() },
    }

    // Mark only fixed dirty (nothing actually changed)
    fixed.markDirty()
    root.calculateLayout(40, NaN, DIRECTION_LTR)

    // All dimensions must be identical
    expect(root.getComputedWidth()).toBe(before.root.w)
    expect(root.getComputedHeight()).toBe(before.root.h)
    expect(row.getComputedWidth()).toBe(before.row.w)
    expect(row.getComputedHeight()).toBe(before.row.h)
    expect(fixed.getComputedWidth()).toBe(before.fixed.w)
    expect(fixed.getComputedHeight()).toBe(before.fixed.h)
    expect(flex.getComputedWidth()).toBe(before.flex.w)
    expect(flex.getComputedHeight()).toBe(before.flex.h)
  })
})

// ============================================================================
// Group 3: Snapshot Regression
// ============================================================================

describe("Re-layout Consistency: snapshot regression", () => {
  it("idempotency: layout twice with no changes", () => {
    const root = Node.create()
    root.setWidth(40)

    const bordered = Node.create()
    bordered.setBorder(0, 1)
    bordered.setBorder(1, 1)
    bordered.setBorder(2, 1)
    bordered.setBorder(3, 1)
    bordered.setPadding(2, 1)
    root.insertChild(bordered, 0)

    const row = Node.create()
    row.setFlexDirection(FLEX_DIRECTION_ROW)
    bordered.insertChild(row, 0)

    const prefix = Node.create()
    prefix.setWidth(3)
    prefix.setFlexShrink(0)
    row.insertChild(prefix, 0)

    const prefixText = Node.create()
    prefixText.setMeasureFunc(textMeasure(3))
    prefix.insertChild(prefixText, 0)

    const content = Node.create()
    content.setFlexGrow(1)
    content.setFlexShrink(1)
    row.insertChild(content, 1)

    const contentText = Node.create()
    contentText.setMeasureFunc(textMeasure(50))
    content.insertChild(contentText, 0)

    // Layout once
    root.calculateLayout(40, NaN, DIRECTION_LTR)
    const first = getLayout(root)

    // Layout again — identical constraints, no dirty marking
    root.calculateLayout(40, NaN, DIRECTION_LTR)
    const second = getLayout(root)

    expect(first).toEqual(second)
  })

  it("card tree geometry locked down", () => {
    // Exact expected dimensions for the km-10mat card structure
    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setWidth(40)

    const bordered = Node.create()
    bordered.setFlexDirection(FLEX_DIRECTION_COLUMN)
    bordered.setBorder(0, 1) // left
    bordered.setBorder(1, 1) // top
    bordered.setBorder(2, 1) // right
    bordered.setBorder(3, 1) // bottom
    bordered.setPadding(2, 1) // paddingRight
    root.insertChild(bordered, 0)

    const row = Node.create()
    row.setFlexDirection(FLEX_DIRECTION_ROW)
    bordered.insertChild(row, 0)

    const prefix = Node.create()
    prefix.setWidth(3)
    prefix.setFlexShrink(0)
    row.insertChild(prefix, 0)

    const prefixText = Node.create()
    prefixText.setMeasureFunc(textMeasure(3))
    prefix.insertChild(prefixText, 0)

    const content = Node.create()
    content.setFlexGrow(1)
    content.setFlexShrink(1)
    row.insertChild(content, 1)

    const contentText = Node.create()
    contentText.setMeasureFunc(textMeasure(50))
    content.insertChild(contentText, 0)

    // Initial layout
    root.calculateLayout(40, NaN, DIRECTION_LTR)

    // Content area: 40 - 1(left border) - 1(right border) - 1(paddingRight) = 37
    // Row width: 37
    // prefix: 3, content: 37 - 3 = 34
    // text: 50 chars at 34 wide → ceil(50/34) = 2 lines
    expect(contentText.getComputedWidth()).toBe(34)
    expect(contentText.getComputedHeight()).toBe(2)
    expect(content.getComputedWidth()).toBe(34)
    expect(content.getComputedHeight()).toBe(2)
    expect(row.getComputedWidth()).toBe(37)
    expect(row.getComputedHeight()).toBe(2)
    // bordered: row(2) + top(1) + bottom(1) = 4
    expect(bordered.getComputedWidth()).toBe(40)
    expect(bordered.getComputedHeight()).toBe(4)

    // Now mark prefix dirty and re-layout — should be identical
    prefix.markDirty()
    root.calculateLayout(40, NaN, DIRECTION_LTR)

    expect(contentText.getComputedWidth()).toBe(34)
    expect(contentText.getComputedHeight()).toBe(2)
    expect(content.getComputedWidth()).toBe(34)
    expect(content.getComputedHeight()).toBe(2)
    expect(row.getComputedHeight()).toBe(2)
    expect(bordered.getComputedHeight()).toBe(4)
  })
})

// ============================================================================
// Group 4: Resize Stability
// ============================================================================

describe("Re-layout Consistency: resize stability", () => {
  it("resize sweep: layout at W, resize to W', back to W", () => {
    const root = Node.create()
    root.setWidth(80)

    const bordered = Node.create()
    bordered.setBorder(0, 1)
    bordered.setBorder(1, 1)
    bordered.setBorder(2, 1)
    bordered.setBorder(3, 1)
    root.insertChild(bordered, 0)

    const row = Node.create()
    row.setFlexDirection(FLEX_DIRECTION_ROW)
    bordered.insertChild(row, 0)

    const prefix = Node.create()
    prefix.setWidth(3)
    prefix.setFlexShrink(0)
    row.insertChild(prefix, 0)

    const prefixText = Node.create()
    prefixText.setMeasureFunc(textMeasure(3))
    prefix.insertChild(prefixText, 0)

    const content = Node.create()
    content.setFlexGrow(1)
    content.setFlexShrink(1)
    row.insertChild(content, 1)

    const contentText = Node.create()
    contentText.setMeasureFunc(textMeasure(50))
    content.insertChild(contentText, 0)

    // Layout at 80
    root.calculateLayout(80, NaN, DIRECTION_LTR)
    const layout80 = getLayout(root)

    // Resize to 60
    root.setWidth(60)
    root.calculateLayout(60, NaN, DIRECTION_LTR)

    // Resize back to 80
    root.setWidth(80)
    root.calculateLayout(80, NaN, DIRECTION_LTR)
    const layout80Again = getLayout(root)

    // Must match the initial layout at 80
    expect(layout80Again).toEqual(layout80)
  })

  it("column direction: measure function height constrained by parent", () => {
    // km-flexily.measure-height regression: in column layouts, measure func
    // height should be constrained by parent main axis size
    const root = Node.create()
    root.setWidth(40)
    root.setHeight(10)
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)

    const child = Node.create()
    child.setMeasureFunc((_w, wm, _h, hm) => {
      // Return a large height — should be constrained
      if (wm === MEASURE_MODE_EXACTLY || wm === MEASURE_MODE_AT_MOST) {
        const w = Math.min(40, _w)
        if (hm === MEASURE_MODE_EXACTLY || hm === MEASURE_MODE_AT_MOST) {
          return { width: w, height: Math.min(20, _h) }
        }
        return { width: w, height: 20 }
      }
      return { width: 40, height: 20 }
    })
    root.insertChild(child, 0)

    root.calculateLayout(40, 10, DIRECTION_LTR)

    // Child height should not exceed parent height
    expect(child.getComputedHeight()).toBeLessThanOrEqual(10)
  })
})

// ============================================================================
// Group 5: Fuzz — Re-layout vs Fresh
// ============================================================================

const FLEX_DIRECTIONS = [
  FLEX_DIRECTION_ROW,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_ROW_REVERSE,
  FLEX_DIRECTION_COLUMN_REVERSE,
]

function buildRandomTree(rng: () => number): () => BuildTreeResult {
  // Capture the seed state by building a spec first, then replaying
  const nodeCount = 3 + Math.floor(rng() * 8)
  const specs: Array<{
    width?: number
    height?: number
    flexGrow?: number
    flexShrink?: number
    hasMeasure: boolean
    measureWidth: number
    isBordered: boolean
    flexDirection: number
    padding?: number
    gap?: number
    isAbsolute: boolean
    posLeft?: number
    posTop?: number
    isWrap: boolean
    minWidth?: number
    maxWidth?: number
    children: number[] // indices of children
  }> = []

  // Generate flat-ish spec with broader style distribution
  for (let i = 0; i < nodeCount; i++) {
    const isLeaf = i >= nodeCount / 2
    const hasMeasure = isLeaf && rng() < 0.4
    const isAbsolute = i > 0 && !hasMeasure && rng() < 0.1 // 10% chance of absolute
    specs.push({
      width: !hasMeasure && rng() < 0.5 ? 5 + Math.floor(rng() * 20) : undefined,
      height: !hasMeasure && rng() < 0.3 ? 1 + Math.floor(rng() * 5) : undefined,
      flexGrow: !isAbsolute && rng() < 0.4 ? 1 : undefined,
      flexShrink: !isAbsolute && rng() < 0.3 ? 1 : undefined,
      hasMeasure,
      measureWidth: 10 + Math.floor(rng() * 60),
      isBordered: !isLeaf && rng() < 0.2,
      flexDirection: FLEX_DIRECTIONS[Math.floor(rng() * FLEX_DIRECTIONS.length)]!,
      padding: !isLeaf && rng() < 0.2 ? 1 + Math.floor(rng() * 5) : undefined,
      gap: !isLeaf && rng() < 0.15 ? 1 + Math.floor(rng() * 4) : undefined,
      isAbsolute,
      posLeft: isAbsolute && rng() < 0.5 ? Math.floor(rng() * 20) : undefined,
      posTop: isAbsolute && rng() < 0.5 ? Math.floor(rng() * 10) : undefined,
      isWrap: !isLeaf && !isAbsolute && rng() < 0.1, // 10% chance of wrap
      minWidth: !hasMeasure && rng() < 0.1 ? 3 + Math.floor(rng() * 10) : undefined,
      maxWidth: !hasMeasure && rng() < 0.1 ? 15 + Math.floor(rng() * 30) : undefined,
      children: [],
    })
  }

  // Build parent-child relationships (simple: each non-root attaches to a random earlier node)
  for (let i = 1; i < nodeCount; i++) {
    const parentIdx = Math.floor(rng() * i)
    // Don't attach children to measure nodes
    if (!specs[parentIdx]!.hasMeasure) {
      specs[parentIdx]!.children.push(i)
    } else {
      // Attach to root instead
      specs[0]!.children.push(i)
    }
  }

  // Pick random dirty targets (1-3 non-root nodes)
  const dirtyCount = 1 + Math.floor(rng() * 3)
  const dirtyIndices: number[] = []
  for (let d = 0; d < dirtyCount && d < nodeCount - 1; d++) {
    const idx = 1 + Math.floor(rng() * (nodeCount - 1))
    if (!dirtyIndices.includes(idx)) dirtyIndices.push(idx)
  }

  // Randomly use RTL direction (~15% of trees)
  const direction = rng() < 0.15 ? DIRECTION_RTL : DIRECTION_LTR

  return function buildTree(): BuildTreeResult {
    const nodes: Node[] = []
    const dirtyTargets: Node[] = []

    for (let i = 0; i < nodeCount; i++) {
      const spec = specs[i]!
      const node = Node.create()
      if (i === 0) {
        node.setWidth(80)
        node.setFlexDirection(spec.flexDirection)
      } else {
        if (spec.width !== undefined) node.setWidth(spec.width)
        if (spec.height !== undefined) node.setHeight(spec.height)
        if (spec.flexGrow !== undefined) node.setFlexGrow(spec.flexGrow)
        if (spec.flexShrink !== undefined) node.setFlexShrink(spec.flexShrink)
        node.setFlexDirection(spec.flexDirection)
      }
      if (spec.isBordered) {
        node.setBorder(0, 1)
        node.setBorder(1, 1)
        node.setBorder(2, 1)
        node.setBorder(3, 1)
      }
      if (spec.padding !== undefined) {
        node.setPadding(EDGE_ALL, spec.padding)
      }
      if (spec.gap !== undefined) {
        node.setGap(GUTTER_ALL, spec.gap)
      }
      if (spec.isAbsolute) {
        node.setPositionType(POSITION_TYPE_ABSOLUTE)
        if (spec.posLeft !== undefined) node.setPosition(EDGE_LEFT, spec.posLeft)
        if (spec.posTop !== undefined) node.setPosition(EDGE_TOP, spec.posTop)
      }
      if (spec.isWrap) {
        node.setFlexWrap(WRAP_WRAP)
      }
      if (spec.minWidth !== undefined) {
        node.setMinWidth(spec.minWidth)
      }
      if (spec.maxWidth !== undefined) {
        node.setMaxWidth(spec.maxWidth)
      }
      if (spec.hasMeasure) {
        node.setMeasureFunc(textMeasure(spec.measureWidth))
      }
      nodes.push(node)

      if (dirtyIndices.includes(i)) {
        dirtyTargets.push(node)
      }
    }

    // Wire parent-child
    for (let i = 0; i < nodeCount; i++) {
      const spec = specs[i]!
      for (let c = 0; c < spec.children.length; c++) {
        nodes[i]!.insertChild(nodes[spec.children[c]!]!, c)
      }
    }

    return { root: nodes[0]!, dirtyTargets, direction }
  }
}

describe("Re-layout Consistency: fuzz", () => {
  for (let seed = 0; seed < 500; seed++) {
    it(`seed=${seed}: re-layout matches fresh`, () => {
      const rng = createRng(seed * 997 + 42)
      const buildTree = buildRandomTree(rng)
      expectRelayoutMatchesFresh(buildTree, 80, NaN)
    })
  }

  it("structural invariant: layout values are finite and non-negative after re-layout", () => {
    for (let seed = 0; seed < 50; seed++) {
      const rng = createRng(seed * 1009 + 7)
      const buildTree = buildRandomTree(rng)
      const { root, dirtyTargets, direction: dir } = buildTree()
      const layoutDir = dir ?? DIRECTION_LTR
      root.calculateLayout(80, NaN, layoutDir)
      for (const t of dirtyTargets) t.markDirty()
      root.calculateLayout(80, NaN, layoutDir)
      assertLayoutSanity(root)
    }
  })
})

describe("Fuzz: cache invalidation stress", () => {
  // Targeted test for the resetLayoutCache NaN sentinel bug:
  // Layout caches use NaN as "unconstrained" dimension. If cache invalidation
  // also uses NaN, getCachedLayout(NaN, NaN) falsely matches invalidated entries,
  // returning stale computed values from a previous pass with different constraints.
  //
  // Tests re-layout at multiple root widths using the SAME node tree to exercise
  // cache rotation: entries from width=W1 must not leak into width=W2 queries.
  for (let seed = 0; seed < 100; seed++) {
    it(`seed=${seed}: re-layout on same tree at different widths`, () => {
      const rng = createRng(seed * 1013 + 73)
      const buildTree = buildRandomTree(rng)

      // Build a SINGLE tree and re-layout at multiple widths
      const { root, dirtyTargets, direction: dir } = buildTree()
      const layoutDir = dir ?? DIRECTION_LTR
      const widths = [60, 80, 100, 80] // include a return to 80 to test round-trip

      for (const w of widths) {
        root.setWidth(w)
        root.calculateLayout(w, NaN, layoutDir)
        const incremental = getLayout(root)

        // Fresh reference at same width
        const fresh = buildTree()
        fresh.root.setWidth(w)
        fresh.root.calculateLayout(w, NaN, layoutDir)
        const reference = getLayout(fresh.root)

        expect(incremental).toEqual(reference)
      }

      // Also test: mark dirty + re-layout at final width
      for (const t of dirtyTargets) t.markDirty()
      root.calculateLayout(80, NaN, layoutDir)
      const incremental = getLayout(root)

      const fresh = buildTree()
      fresh.root.calculateLayout(80, NaN, layoutDir)
      const reference = getLayout(fresh.root)

      expect(incremental).toEqual(reference)
    })
  }
})

// ============================================================================
// Group 6: Idempotency — layout twice with no changes
// ============================================================================

describe("Fuzz: idempotency", () => {
  // Layout the same tree twice with identical constraints. The second pass
  // should produce bit-identical results. Catches non-determinism from
  // uninitialized state or cache corruption within a single layout pass.
  for (let seed = 0; seed < 200; seed++) {
    it(`seed=${seed}: layout twice produces identical results`, () => {
      const rng = createRng(seed * 1021 + 31)
      const buildTree = buildRandomTree(rng)
      expectIdempotent(buildTree, 80, NaN)
    })
  }
})

// ============================================================================
// Group 7: Resize round-trip — layout at W, resize to W', back to W
// ============================================================================

describe("Fuzz: resize round-trip", () => {
  // Layout at width W1, then W2, then W1 again. Final result must match
  // a fresh layout at W1. Catches stale cache entries that persist across
  // constraint changes (e.g. the NaN sentinel bug, fingerprint override bug).
  for (let seed = 0; seed < 200; seed++) {
    it(`seed=${seed}: resize round-trip matches fresh`, () => {
      const rng = createRng(seed * 1031 + 53)
      const buildTree = buildRandomTree(rng)
      // Pick random width sequence: start → different → back to start
      const w1 = 40 + Math.floor(rng() * 80) // 40-119
      const w2 = 40 + Math.floor(rng() * 80)
      expectResizeRoundTrip(buildTree, [w1, w2, w1])
    })
  }
})

// ============================================================================
// Group 8: Multi-step constraint sweep
// ============================================================================

describe("Fuzz: multi-step constraint sweep", () => {
  // Exercise the full lifecycle: layout → resize → dirty → resize → re-layout.
  // Combines width changes with dirty marking to stress all cache layers.
  for (let seed = 0; seed < 100; seed++) {
    it(`seed=${seed}: full lifecycle matches fresh`, () => {
      const rng = createRng(seed * 1039 + 97)
      const buildTree = buildRandomTree(rng)

      const { root, dirtyTargets, direction: dir } = buildTree()
      const layoutDir = dir ?? DIRECTION_LTR
      const widths = [40 + Math.floor(rng() * 80), 40 + Math.floor(rng() * 80), 40 + Math.floor(rng() * 80)]

      // Phase 1: layout at varying widths
      for (const w of widths) {
        root.setWidth(w)
        root.calculateLayout(w, NaN, layoutDir)
      }

      // Phase 2: mark dirty + re-layout at a new width
      const finalWidth = 40 + Math.floor(rng() * 80)
      for (const t of dirtyTargets) t.markDirty()
      root.setWidth(finalWidth)
      root.calculateLayout(finalWidth, NaN, layoutDir)
      const incremental = getLayout(root)

      // Fresh reference
      const fresh = buildTree()
      fresh.root.setWidth(finalWidth)
      fresh.root.calculateLayout(finalWidth, NaN, layoutDir)
      const reference = getLayout(fresh.root)

      const diffs = diffLayouts(reference, incremental)
      if (diffs.length > 0) {
        const detail = diffs.map((d) => `  ${d}`).join("\n")
        expect.unreachable(
          `Full lifecycle differs at finalWidth=${finalWidth} (widths: ${widths.join("→")}, ${diffs.length} diffs):\n${detail}`,
        )
      }
    })
  }
})

describe("Fuzz: container query resize", () => {
  // Existing random trees never generate CQ or math widths. Keep a CQ ancestor
  // above a fixed-size intermediate node so unchanged child constraints cannot
  // hide a stale query-size cache entry.
  for (let seed = 0; seed < 64; seed++) {
    it(`seed=${seed}: cqi and math descendants match fresh layout after shrink`, () => {
      const rng = createRng(seed * 1049 + 23)
      const initialWidth = 120 + Math.floor(rng() * 80)
      const finalWidth = 30 + Math.floor(rng() * 60)
      const percentage = 10 + Math.floor(rng() * 11)
      const formula = seed % 4

      function build(width: number) {
        const cq = Node.create()
        cq.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
        cq.setWidth(width)
        const box = Node.create()
        box.setWidth(60)
        const leaf = Node.create()
        const cqi = { value: percentage, unit: C.UNIT_CQI }
        const point = { value: formula === 2 ? 50 : 1, unit: C.UNIT_POINT }
        if (formula === 0) leaf.setWidthCqi(percentage)
        else {
          leaf.style.width = {
            value: 0,
            unit: C.UNIT_CALC,
            expr:
              formula === 1
                ? { fn: "max", args: [point, cqi] }
                : formula === 2
                  ? { fn: "min", args: [point, cqi] }
                  : { fn: "clamp", args: [point, cqi, { value: 60, unit: C.UNIT_POINT }] },
          }
        }
        box.insertChild(leaf, 0)
        cq.insertChild(box, 0)
        return cq
      }

      const reused = build(initialWidth)
      reused.calculateLayout(initialWidth, NaN, DIRECTION_LTR)
      reused.setWidth(finalWidth)
      reused.calculateLayout(finalWidth, NaN, DIRECTION_LTR)

      const fresh = build(finalWidth)
      fresh.calculateLayout(finalWidth, NaN, DIRECTION_LTR)
      expect(diffLayouts(getLayout(fresh), getLayout(reused))).toEqual([])
    })
  }
})

// ============================================================================
// Group 9: Content change — mutable measure functions
// ============================================================================

describe("Re-layout Consistency: content change", () => {
  it("measure function content change: text grows", () => {
    // Simulates user editing text — measure function returns different values
    let currentWidth = 30

    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setWidth(40)
    const row = Node.create()
    row.setFlexDirection(FLEX_DIRECTION_ROW)
    root.insertChild(row, 0)

    const text = Node.create()
    text.setFlexGrow(1)
    text.setFlexShrink(1)
    text.setMeasureFunc((w, wm, h, hm) => textMeasure(currentWidth)(w, wm, h, hm))
    row.insertChild(text, 0)

    // Initial: 30 chars at width 40 → fits in 1 line
    root.calculateLayout(40, NaN, DIRECTION_LTR)
    expect(text.getComputedHeight()).toBe(1)

    // Content grows to 100 chars → wraps to 3 lines at width 40
    currentWidth = 100
    text.markDirty()
    root.calculateLayout(40, NaN, DIRECTION_LTR)
    expect(text.getComputedHeight()).toBe(3) // ceil(100/40) = 3

    // Compare against fresh
    const fresh = Node.create()
    fresh.setFlexDirection(FLEX_DIRECTION_COLUMN)
    fresh.setWidth(40)
    const freshRow = Node.create()
    freshRow.setFlexDirection(FLEX_DIRECTION_ROW)
    fresh.insertChild(freshRow, 0)
    const freshText = Node.create()
    freshText.setFlexGrow(1)
    freshText.setFlexShrink(1)
    freshText.setMeasureFunc(textMeasure(100))
    freshRow.insertChild(freshText, 0)
    fresh.calculateLayout(40, NaN, DIRECTION_LTR)

    expect(getLayout(root)).toEqual(getLayout(fresh))
  })

  it("measure function content change: text shrinks", () => {
    let currentWidth = 100

    const root = Node.create()
    root.setWidth(40)
    const text = Node.create()
    text.setMeasureFunc((w, wm, h, hm) => textMeasure(currentWidth)(w, wm, h, hm))
    root.insertChild(text, 0)

    root.calculateLayout(40, NaN, DIRECTION_LTR)
    expect(text.getComputedHeight()).toBe(3) // ceil(100/40)

    // Content shrinks to 20 chars → fits in 1 line
    currentWidth = 20
    text.markDirty()
    root.calculateLayout(40, NaN, DIRECTION_LTR)
    expect(text.getComputedHeight()).toBe(1)
  })

  it("content change + resize combined", () => {
    let currentWidth = 50

    const root = Node.create()
    root.setWidth(80)
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)

    const card = Node.create()
    card.setBorder(0, 1)
    card.setBorder(1, 1)
    card.setBorder(2, 1)
    card.setBorder(3, 1)
    root.insertChild(card, 0)

    const row = Node.create()
    row.setFlexDirection(FLEX_DIRECTION_ROW)
    card.insertChild(row, 0)

    const prefix = Node.create()
    prefix.setWidth(3)
    prefix.setFlexShrink(0)
    row.insertChild(prefix, 0)

    const content = Node.create()
    content.setFlexGrow(1)
    content.setFlexShrink(1)
    content.setMeasureFunc((w, wm, h, hm) => textMeasure(currentWidth)(w, wm, h, hm))
    row.insertChild(content, 1)

    // Initial: 50 chars at ~75 content width → 1 line
    root.calculateLayout(80, NaN, DIRECTION_LTR)

    // Change content AND resize
    currentWidth = 200
    content.markDirty()
    root.setWidth(40)
    root.calculateLayout(40, NaN, DIRECTION_LTR)
    const incremental = getLayout(root)

    // Fresh at same final state
    const fresh = Node.create()
    fresh.setWidth(40)
    fresh.setFlexDirection(FLEX_DIRECTION_COLUMN)
    const freshCard = Node.create()
    freshCard.setBorder(0, 1)
    freshCard.setBorder(1, 1)
    freshCard.setBorder(2, 1)
    freshCard.setBorder(3, 1)
    fresh.insertChild(freshCard, 0)
    const freshRow = Node.create()
    freshRow.setFlexDirection(FLEX_DIRECTION_ROW)
    freshCard.insertChild(freshRow, 0)
    const freshPrefix = Node.create()
    freshPrefix.setWidth(3)
    freshPrefix.setFlexShrink(0)
    freshRow.insertChild(freshPrefix, 0)
    const freshContent = Node.create()
    freshContent.setFlexGrow(1)
    freshContent.setFlexShrink(1)
    freshContent.setMeasureFunc(textMeasure(200))
    freshRow.insertChild(freshContent, 1)
    fresh.calculateLayout(40, NaN, DIRECTION_LTR)
    const reference = getLayout(fresh)

    const diffs = diffLayouts(reference, incremental)
    if (diffs.length > 0) {
      const detail = diffs.map((d) => `  ${d}`).join("\n")
      expect.unreachable(
        `Content change + resize differs:\n${detail}\n\nFresh:\n${formatLayout(reference)}\n\nIncremental:\n${formatLayout(incremental)}`,
      )
    }
  })
})

// ============================================================================
// Group 10: Content change fuzz — mutable measure functions
// ============================================================================

describe("Fuzz: content change", () => {
  // Verify that changing a measure function's output + markDirty produces
  // the same layout as a fresh tree with the new content. This tests the
  // real-world scenario of user editing text in a TUI.
  for (let seed = 0; seed < 100; seed++) {
    it(`seed=${seed}: content change matches fresh`, () => {
      const rng = createRng(seed * 1049 + 113)
      const nodeCount = 3 + Math.floor(rng() * 6)

      // Track which nodes have mutable measure functions
      const measureWidths: number[] = []
      const specs: Array<{
        width?: number
        height?: number
        flexGrow?: number
        flexShrink?: number
        hasMeasure: boolean
        measureIdx: number // index into measureWidths, -1 if no measure
        isBordered: boolean
        flexDirection: number
        children: number[]
      }> = []

      for (let i = 0; i < nodeCount; i++) {
        const isLeaf = i >= nodeCount / 2
        const hasMeasure = isLeaf && rng() < 0.5
        let measureIdx = -1
        if (hasMeasure) {
          measureIdx = measureWidths.length
          measureWidths.push(10 + Math.floor(rng() * 60))
        }
        specs.push({
          width: !hasMeasure && rng() < 0.5 ? 5 + Math.floor(rng() * 20) : undefined,
          height: !hasMeasure && rng() < 0.3 ? 1 + Math.floor(rng() * 5) : undefined,
          flexGrow: rng() < 0.4 ? 1 : undefined,
          flexShrink: rng() < 0.3 ? 1 : undefined,
          hasMeasure,
          measureIdx,
          isBordered: !isLeaf && rng() < 0.2,
          flexDirection: rng() < 0.5 ? FLEX_DIRECTION_ROW : FLEX_DIRECTION_COLUMN,
          children: [],
        })
      }

      // Build parent-child relationships
      for (let i = 1; i < nodeCount; i++) {
        const parentIdx = Math.floor(rng() * i)
        if (!specs[parentIdx]!.hasMeasure) {
          specs[parentIdx]!.children.push(i)
        } else {
          specs[0]!.children.push(i)
        }
      }

      // Pick 1-2 measure nodes to change content
      const measureIndices = specs.map((s, i) => (s.hasMeasure ? i : -1)).filter((i) => i >= 0)
      if (measureIndices.length === 0) return // skip if no measure nodes

      const changeCount = 1 + Math.floor(rng() * Math.min(2, measureIndices.length))
      const changingNodes: number[] = []
      for (let c = 0; c < changeCount; c++) {
        const idx = measureIndices[Math.floor(rng() * measureIndices.length)]!
        if (!changingNodes.includes(idx)) changingNodes.push(idx)
      }

      function buildTree(useNewWidths: boolean): { root: Node; measureNodes: Node[] } {
        const nodes: Node[] = []
        const measureNodes: Node[] = []
        for (let i = 0; i < nodeCount; i++) {
          const spec = specs[i]!
          const node = Node.create()
          if (i === 0) {
            node.setWidth(80)
            node.setFlexDirection(spec.flexDirection)
          } else {
            if (spec.width !== undefined) node.setWidth(spec.width)
            if (spec.height !== undefined) node.setHeight(spec.height)
            if (spec.flexGrow !== undefined) node.setFlexGrow(spec.flexGrow)
            if (spec.flexShrink !== undefined) node.setFlexShrink(spec.flexShrink)
            node.setFlexDirection(spec.flexDirection)
          }
          if (spec.isBordered) {
            node.setBorder(0, 1)
            node.setBorder(1, 1)
            node.setBorder(2, 1)
            node.setBorder(3, 1)
          }
          if (spec.hasMeasure) {
            const w = useNewWidths ? measureWidths[spec.measureIdx]! : measureWidths[spec.measureIdx]!
            node.setMeasureFunc(textMeasure(w))
            measureNodes.push(node)
          }
          nodes.push(node)
        }
        for (let i = 0; i < nodeCount; i++) {
          const spec = specs[i]!
          for (let c = 0; c < spec.children.length; c++) {
            nodes[i]!.insertChild(nodes[spec.children[c]!]!, c)
          }
        }
        return { root: nodes[0]!, measureNodes }
      }

      // New widths for changed nodes
      const newWidths = [...measureWidths]
      for (const idx of changingNodes) {
        const spec = specs[idx]!
        newWidths[spec.measureIdx] = 10 + Math.floor(rng() * 100)
      }

      // Build mutable tree with closures referencing measureWidths
      const mutableNodes: Node[] = []
      const mutableMeasureNodes: Map<number, Node> = new Map()
      const allNodes: Node[] = []

      for (let i = 0; i < nodeCount; i++) {
        const spec = specs[i]!
        const node = Node.create()
        if (i === 0) {
          node.setWidth(80)
          node.setFlexDirection(spec.flexDirection)
        } else {
          if (spec.width !== undefined) node.setWidth(spec.width)
          if (spec.height !== undefined) node.setHeight(spec.height)
          if (spec.flexGrow !== undefined) node.setFlexGrow(spec.flexGrow)
          if (spec.flexShrink !== undefined) node.setFlexShrink(spec.flexShrink)
          node.setFlexDirection(spec.flexDirection)
        }
        if (spec.isBordered) {
          node.setBorder(0, 1)
          node.setBorder(1, 1)
          node.setBorder(2, 1)
          node.setBorder(3, 1)
        }
        if (spec.hasMeasure) {
          // Use closure that references measureWidths (mutable)
          const mIdx = spec.measureIdx
          node.setMeasureFunc((w, wm, h, hm) => textMeasure(measureWidths[mIdx]!)(w, wm, h, hm))
          mutableMeasureNodes.set(i, node)
        }
        allNodes.push(node)
      }
      for (let i = 0; i < nodeCount; i++) {
        const spec = specs[i]!
        for (let c = 0; c < spec.children.length; c++) {
          allNodes[i]!.insertChild(allNodes[spec.children[c]!]!, c)
        }
      }

      const root = allNodes[0]!

      // Phase 1: layout with original content
      root.calculateLayout(80, NaN, DIRECTION_LTR)

      // Phase 2: change content and mark dirty
      for (const idx of changingNodes) {
        const spec = specs[idx]!
        measureWidths[spec.measureIdx] = newWidths[spec.measureIdx]!
        mutableMeasureNodes.get(idx)!.markDirty()
      }
      root.calculateLayout(80, NaN, DIRECTION_LTR)
      const incremental = getLayout(root)

      // Fresh reference with new widths
      const freshNodes: Node[] = []
      for (let i = 0; i < nodeCount; i++) {
        const spec = specs[i]!
        const node = Node.create()
        if (i === 0) {
          node.setWidth(80)
          node.setFlexDirection(spec.flexDirection)
        } else {
          if (spec.width !== undefined) node.setWidth(spec.width)
          if (spec.height !== undefined) node.setHeight(spec.height)
          if (spec.flexGrow !== undefined) node.setFlexGrow(spec.flexGrow)
          if (spec.flexShrink !== undefined) node.setFlexShrink(spec.flexShrink)
          node.setFlexDirection(spec.flexDirection)
        }
        if (spec.isBordered) {
          node.setBorder(0, 1)
          node.setBorder(1, 1)
          node.setBorder(2, 1)
          node.setBorder(3, 1)
        }
        if (spec.hasMeasure) {
          node.setMeasureFunc(textMeasure(measureWidths[spec.measureIdx]!))
        }
        freshNodes.push(node)
      }
      for (let i = 0; i < nodeCount; i++) {
        const spec = specs[i]!
        for (let c = 0; c < spec.children.length; c++) {
          freshNodes[i]!.insertChild(freshNodes[spec.children[c]!]!, c)
        }
      }
      freshNodes[0]!.calculateLayout(80, NaN, DIRECTION_LTR)
      const reference = getLayout(freshNodes[0]!)

      const diffs = diffLayouts(reference, incremental)
      if (diffs.length > 0) {
        const detail = diffs.map((d) => `  ${d}`).join("\n")
        expect.unreachable(
          `Content change differs (changed nodes: ${changingNodes.join(",")}; ${diffs.length} diffs):\n${detail}`,
        )
      }
    })
  }
})

// ============================================================================
// MEASURE-only sizing pass (#26840)
// ============================================================================
//
// The sizing pass (layout-zero.ts sizeByLayout) answers from each node's layout
// cache, which now lives across passes, and leaves no fingerprint, leaf
// constraint, child box or container-query freeze behind. Each step below
// edits the spec, applies the same edit to the live tree, lays it out
// incrementally, and compares every box against a tree built fresh from the
// spec.

interface NestedColumnsStep {
  name: string
  width?: number
  apply: (spec: NestedColumnsSpec, live: NestedColumns) => void
}

function expectNestedColumnsStepsMatchFresh(spec: NestedColumnsSpec, steps: NestedColumnsStep[]): void {
  let width = 220
  const live = buildNestedColumns(Node, spec, width)
  live.root.calculateLayout(width, 50, DIRECTION_LTR)
  live.root.calculateLayout(width, 50, DIRECTION_LTR)
  for (const step of steps) {
    step.apply(spec, live)
    if (step.width !== undefined) {
      width = step.width
      live.root.setWidth(width)
    }
    live.root.calculateLayout(width, 50, DIRECTION_LTR)
    const fresh = buildNestedColumns(Node, spec, width)
    fresh.root.calculateLayout(width, 50, DIRECTION_LTR)
    const diffs = diffLayouts(getLayout(fresh.root), getLayout(live.root))
    fresh.root.freeRecursive()
    if (diffs.length > 0) {
      expect.unreachable(`step "${step.name}" differs from fresh (${diffs.length} diffs):\n  ${diffs.join("\n  ")}`)
    }
  }
  live.root.freeRecursive()
}

describe("Re-layout Consistency: MEASURE-only sizing pass (#26840)", () => {
  it("Fx(4,10,2): leaf edits, a resize, a query-container resize and a mount each match fresh", () => {
    const spec = nestedColumnsSpec(4, 10, 2)
    spec.queryColumn = 1
    spec.labelCqi = 12
    expectNestedColumnsStepsMatchFresh(spec, [
      {
        name: "a prose wraps differently",
        apply: (s, live) => {
          s.proseLengths[3]![1] = 470
          live.proses[3]![1]!.markDirty()
        },
      },
      {
        name: "the last label narrows",
        apply: (s, live) => {
          s.labelWidths[9] = 7
          live.labels[9]!.markDirty()
        },
      },
      {
        name: "the first prose shrinks to one line",
        apply: (s, live) => {
          s.proseLengths[0]![0] = 40
          live.proses[0]![0]!.markDirty()
        },
      },
      {
        name: "a middle label widens",
        apply: (s, live) => {
          s.labelWidths[5] = 55
          live.labels[5]!.markDirty()
        },
      },
      { name: "the root narrows 220 -> 180", width: 180, apply: () => {} },
      { name: "the query container widens 180 -> 200", width: 200, apply: () => {} },
      {
        name: "a dirty row mounts mid-chain",
        apply: (s, live) => {
          s.mounts.push({ depth: 2, proseLength: 390 })
          mountRow(Node, s, live, s.mounts.length - 1)
        },
      },
      {
        name: "a prose under the mount changes after it",
        apply: (s, live) => {
          s.proseLengths[7]![0] = 12
          live.proses[7]![0]!.markDirty()
        },
      },
    ])
  })

  for (let seed = 1; seed <= 50; seed++) {
    it(`seeded nested columns ${seed}: random leaf edits match fresh`, () => {
      const rng = createRng(seed * 1051 + 29)
      const pick = (lo: number, hi: number) => lo + Math.floor(rng() * (hi - lo + 1))
      const depth = pick(1, 6)
      const rows = pick(1, 12)
      const spec = nestedColumnsSpec(depth, rows, pick(1, 4))
      for (let k = 0; k < rows; k++) {
        spec.labelWidths[k] = pick(1, 60)
        for (let j = 0; j < spec.proseBoxes; j++) spec.proseLengths[k]![j] = pick(1, 600)
      }
      const steps: NestedColumnsStep[] = []
      for (let n = 0; n < 4; n++) {
        const k = pick(0, rows - 1)
        if (rng() < 0.5) {
          const labelWidth = pick(1, 60)
          steps.push({
            name: `label ${k} -> ${labelWidth}`,
            apply: (s, live) => {
              s.labelWidths[k] = labelWidth
              live.labels[k]!.markDirty()
            },
          })
        } else {
          const j = pick(0, spec.proseBoxes - 1)
          const length = pick(1, 600)
          steps.push({
            name: `prose ${k}.${j} -> ${length}`,
            apply: (s, live) => {
              s.proseLengths[k]![j] = length
              live.proses[k]![j]!.markDirty()
            },
          })
        }
      }
      expectNestedColumnsStepsMatchFresh(spec, steps)
    })
  }
})

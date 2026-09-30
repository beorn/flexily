/**
 * Performance Regression Tests
 *
 * Timing-based tests that verify layout performance stays within acceptable bounds.
 * These run in CI and catch performance regressions.
 *
 * Thresholds are ~10x typical dev machine performance to avoid CI flakiness
 * while still catching O(n^2) regressions and major performance bugs.
 *
 * Baseline measurements (M-series Mac, 2026-03):
 *   Small tree (10 nodes):     ~0.03ms
 *   Medium tree (50 nodes):    ~0.10ms
 *   Large tree (100 nodes):    ~0.19ms
 *   Nested tree (105 nodes):   ~0.31ms
 *   Dirty leaf relayout:       ~0.015ms
 *   No-change relayout:        ~0.0001ms
 *   Large dirty leaf:          ~0.11ms
 */

import { describe, expect, it } from "vitest"
import { Node, DIRECTION_LTR, FLEX_DIRECTION_ROW, FLEX_DIRECTION_COLUMN, EDGE_ALL } from "../src/index.js"
import * as C from "../src/constants.js"

/** Measure median time of a function over N iterations (ms). */
function measureMs(fn: () => void, iterations: number): number {
  // Warmup
  for (let i = 0; i < Math.min(10, iterations); i++) {
    fn()
  }

  const times: number[] = []
  for (let i = 0; i < iterations; i++) {
    const start = performance.now()
    fn()
    times.push(performance.now() - start)
  }

  // Return median to avoid outlier influence
  times.sort((a, b) => a - b)
  return times[Math.floor(times.length / 2)]!
}

describe("Performance Regression: Single Layout Pass", () => {
  it("should layout a small tree (10 nodes) under 0.5ms", () => {
    const median = measureMs(() => {
      const root = Node.create()
      root.setWidth(100)
      root.setHeight(100)
      root.setFlexDirection(FLEX_DIRECTION_COLUMN)

      for (let i = 0; i < 9; i++) {
        const child = Node.create()
        child.setHeight(10)
        child.setFlexGrow(1)
        root.insertChild(child, i)
      }

      root.calculateLayout(100, 100, DIRECTION_LTR)
    }, 100)

    expect(median).toBeLessThan(0.5)
  })

  it("should layout a medium tree (50 nodes) under 1.5ms", () => {
    const median = measureMs(() => {
      const root = Node.create()
      root.setWidth(200)
      root.setHeight(500)
      root.setFlexDirection(FLEX_DIRECTION_COLUMN)

      for (let i = 0; i < 49; i++) {
        const child = Node.create()
        child.setHeight(10)
        child.setFlexGrow(1)
        root.insertChild(child, i)
      }

      root.calculateLayout(200, 500, DIRECTION_LTR)
    }, 50)

    expect(median).toBeLessThan(1.5)
  })
})

describe("Performance Regression: Repeated Layout with Dirty Nodes", () => {
  it("should re-layout with single dirty leaf under 0.2ms (10-node tree)", () => {
    // Build tree once
    const root = Node.create()
    root.setWidth(100)
    root.setHeight(100)
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)

    const children: Node[] = []
    for (let i = 0; i < 9; i++) {
      const child = Node.create()
      child.setHeight(10)
      child.setFlexGrow(1)
      root.insertChild(child, i)
      children.push(child)
    }

    // Initial layout
    root.calculateLayout(100, 100, DIRECTION_LTR)

    // Measure re-layout with dirty leaf
    const median = measureMs(() => {
      children[4]!.markDirty()
      root.calculateLayout(100, 100, DIRECTION_LTR)
    }, 200)

    expect(median).toBeLessThan(0.2)
  })

  it("should skip no-change re-layout nearly instantly (under 0.01ms)", () => {
    const root = Node.create()
    root.setWidth(100)
    root.setHeight(100)
    root.setFlexDirection(FLEX_DIRECTION_ROW)

    for (let i = 0; i < 9; i++) {
      const child = Node.create()
      child.setWidth(10)
      child.setHeight(10)
      root.insertChild(child, i)
    }

    root.calculateLayout(100, 100, DIRECTION_LTR)

    // No-change should be near-free (fingerprint cache hit at root)
    const median = measureMs(() => {
      root.calculateLayout(100, 100, DIRECTION_LTR)
    }, 1000)

    expect(median).toBeLessThan(0.01)
  })
})

describe("Performance Regression: Large Tree", () => {
  it("should layout 100+ nodes under 2ms", () => {
    const median = measureMs(() => {
      const root = Node.create()
      root.setWidth(500)
      root.setHeight(1000)
      root.setFlexDirection(FLEX_DIRECTION_COLUMN)

      for (let i = 0; i < 100; i++) {
        const child = Node.create()
        child.setHeight(10)
        child.setFlexGrow(1)
        root.insertChild(child, i)
      }

      root.calculateLayout(500, 1000, DIRECTION_LTR)
    }, 20)

    expect(median).toBeLessThan(2)
  })

  it("should layout 100+ nodes with nested structure under 3ms", () => {
    const median = measureMs(() => {
      const root = Node.create()
      root.setWidth(500)
      root.setHeight(1000)
      root.setFlexDirection(FLEX_DIRECTION_ROW)

      // 5 columns x 20 rows = 105 nodes (including columns and root)
      for (let col = 0; col < 5; col++) {
        const column = Node.create()
        column.setFlexGrow(1)
        column.setFlexDirection(FLEX_DIRECTION_COLUMN)
        root.insertChild(column, col)

        for (let row = 0; row < 20; row++) {
          const cell = Node.create()
          cell.setHeight(10)
          cell.setFlexGrow(1)
          column.insertChild(cell, row)
        }
      }

      root.calculateLayout(500, 1000, DIRECTION_LTR)
    }, 20)

    expect(median).toBeLessThan(3)
  })

  it("should re-layout large tree with dirty leaf at under half the cost of a cold layout", () => {
    // Build tree: 5 columns x 20 rows with measure functions
    function buildCardTree(): { root: Node; leaf: Node } {
      const root = Node.create()
      root.setWidth(120)
      root.setHeight(40)
      root.setFlexDirection(FLEX_DIRECTION_ROW)
      root.setGap(C.GUTTER_ALL, 1)

      let leaf: Node | undefined
      for (let col = 0; col < 5; col++) {
        const column = Node.create()
        column.setFlexGrow(1)
        column.setFlexShrink(1)
        column.setFlexDirection(FLEX_DIRECTION_COLUMN)
        root.insertChild(column, col)

        for (let row = 0; row < 20; row++) {
          const card = Node.create()
          card.setFlexDirection(FLEX_DIRECTION_COLUMN)
          card.setBorder(EDGE_ALL, 1)

          const text = Node.create()
          const textLen = 15 + (row % 20)
          text.setMeasureFunc((width: number) => {
            const maxW = Number.isNaN(width) ? Infinity : width
            const lines = Math.ceil(textLen / Math.max(1, maxW))
            return { width: Math.min(textLen, maxW), height: lines }
          })
          card.insertChild(text, 0)
          column.insertChild(card, row)

          if (col === 2 && row === 10) {
            leaf = text
          }
        }
      }
      return { root, leaf: leaf! }
    }

    const { root, leaf } = buildCardTree()
    root.calculateLayout(120, 40, DIRECTION_LTR)

    const dirty = measureMs(() => {
      leaf.markDirty()
      root.calculateLayout(120, 40, DIRECTION_LTR)
    }, 100)

    // The baseline is measured in this run, on this machine: the first layout of identical fresh trees.
    // An absolute limit here flaked on shared CI runners (1.16ms and 1.10ms against 1ms, 26784),
    // which run several times slower than a workstation. The property is relative: re-laying out one
    // dirty leaf must cost a fraction of a full layout. Measured 0.08-0.21 of it; a dirty path that
    // degrades to a full re-layout reads about 1.
    const trees = Array.from({ length: 40 }, () => buildCardTree().root)
    let next = 0
    const cold = measureMs(() => {
      trees[next++]!.calculateLayout(120, 40, DIRECTION_LTR)
    }, 30)

    expect(dirty).toBeLessThan(cold * 0.5)
  })
})

describe("Performance Regression: Scaling", () => {
  it("should scale linearly (200 nodes should be under 3x time of 100 nodes)", () => {
    function buildAndLayout(count: number): void {
      const root = Node.create()
      root.setWidth(500)
      root.setHeight(count * 10)
      root.setFlexDirection(FLEX_DIRECTION_COLUMN)

      for (let i = 0; i < count; i++) {
        const child = Node.create()
        child.setHeight(10)
        child.setFlexGrow(1)
        root.insertChild(child, i)
      }

      root.calculateLayout(500, count * 10, DIRECTION_LTR)
    }

    const time100 = measureMs(() => buildAndLayout(100), 20)
    const time200 = measureMs(() => buildAndLayout(200), 20)

    // 200 nodes should take at most 3x the time of 100 nodes
    // (generous bound to avoid flakiness on CI)
    expect(time200).toBeLessThan(time100 * 3 + 1) // +1ms for noise floor
  })
})

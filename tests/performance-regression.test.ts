/**
 * Performance Regression Tests
 *
 * Timing-based tests that verify layout performance stays within acceptable bounds.
 * These run in CI and catch performance regressions.
 *
 * Baselines are generous (10-50x slower than typical) to avoid flaky failures
 * on slow CI machines. The point is catching O(n^2) regressions, not micro-benchmarks.
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
  it("should layout a small tree (10 nodes) under 2ms", () => {
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

    expect(median).toBeLessThan(2)
  })

  it("should layout a medium tree (50 nodes) under 5ms", () => {
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

    expect(median).toBeLessThan(5)
  })
})

describe("Performance Regression: Repeated Layout with Dirty Nodes", () => {
  it("should re-layout with single dirty leaf under 1ms (10-node tree)", () => {
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

    expect(median).toBeLessThan(1)
  })

  it("should skip no-change re-layout nearly instantly (under 0.1ms)", () => {
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

    expect(median).toBeLessThan(0.1)
  })
})

describe("Performance Regression: Large Tree", () => {
  it("should layout 100+ nodes under 10ms", () => {
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

    expect(median).toBeLessThan(10)
  })

  it("should layout 100+ nodes with nested structure under 15ms", () => {
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

    expect(median).toBeLessThan(15)
  })

  it("should re-layout large tree with dirty leaf under 5ms", () => {
    // Build tree: 5 columns x 20 rows with measure functions
    const root = Node.create()
    root.setWidth(120)
    root.setHeight(40)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setGap(C.GUTTER_ALL, 1)

    let leafToMark: Node | undefined
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
          leafToMark = text
        }
      }
    }

    root.calculateLayout(120, 40, DIRECTION_LTR)

    const median = measureMs(() => {
      leafToMark!.markDirty()
      root.calculateLayout(120, 40, DIRECTION_LTR)
    }, 100)

    expect(median).toBeLessThan(5)
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

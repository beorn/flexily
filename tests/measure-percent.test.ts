/**
 * Tests for measure-function nodes with percent sizing on the cross axis.
 *
 * Captures scenarios where Flexily differs from Yoga when measure-function
 * leaves use percent dimensions in the cross axis.
 *
 * Bugs:
 *   1. Column: percent width measure func not called with resolved width.
 *   2. Nested: percent measure leaves inside flexGrow containers get wrong
 *      cross-axis sizes, leading to incorrect container heights and overflow.
 *
 * Bead: km-flexily.measure-percent-cross-axis
 */
import { describe, expect, it } from "vitest"
import {
  DIRECTION_LTR,
  FLEX_DIRECTION_ROW,
  FLEX_DIRECTION_COLUMN,
  GUTTER_COLUMN,
  GUTTER_ROW,
  MEASURE_MODE_EXACTLY,
  MEASURE_MODE_AT_MOST,
  Node,
} from "../src/index.js"
import { expectLayout } from "./test-utils.js"

// Use Yoga preset to match yoga-comparison.test.ts behavior
const YOGA_OPTS = { defaults: "yoga" as const }

describe("percent measure cross axis", () => {
  // Builds a measure func that returns customHeight=35 when available width
  // is less than contentWidth, else height=1.
  function buildMeasureFunc(contentWidth = 80) {
    return (_w: number, wm: number) => {
      if (wm === MEASURE_MODE_EXACTLY || wm === MEASURE_MODE_AT_MOST) {
        if (_w >= contentWidth) return { width: contentWidth, height: 1 }
        return { width: Math.min(contentWidth, _w), height: 35 }
      }
      return { width: contentWidth, height: 1 }
    }
  }

  // Bug: Column – percent width not resolved before measure call.
  // 30% of 100 = 30 < 80 → measure should return height=35, not default 1.
  it("should call measure func with resolved percent width in column", () => {
    const root = Node.create(YOGA_OPTS)
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setWidth(100)
    root.setHeight(100)

    const child = Node.create(YOGA_OPTS)
    child.setWidthPercent(30)
    child.setMeasureFunc(buildMeasureFunc(80))
    root.insertChild(child, 0)

    root.calculateLayout(100, 100, DIRECTION_LTR)
    expectLayout(child, { left: 0, top: 0, width: 30, height: 35 })
  })

  // Bug: Row – stretch not applied on cross axis for percent-width measure.
  // height should = container height (100), not ceil(80/30)=3.
  it("should stretch percent-width measure leaf on cross axis in row", () => {
    const root = Node.create(YOGA_OPTS)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setWidth(100)
    root.setHeight(100)

    const child = Node.create(YOGA_OPTS)
    child.setWidthPercent(30)
    child.setMeasureFunc((_w: number, _wm: number, _h: number, hm: number) => {
      const derivedHeight = _w >= 80 ? 1 : Math.ceil(80 / Math.max(_w, 1))
      return { width: _w, height: derivedHeight }
    })
    root.insertChild(child, 0)

    root.calculateLayout(100, 100, DIRECTION_LTR)
    expectLayout(child, { left: 0, top: 0, width: 30, height: 100 })
  })

  // Bug: Row – multiple percent-width measure leaves not stretched.
  // c1/c2 heights should = 200 (stretch), not [7, 2] from measure.
  it("should stretch multiple percent-width measure leaves in row", () => {
    const root = Node.create(YOGA_OPTS)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setWidth(300)
    root.setHeight(200)

    const c1 = Node.create(YOGA_OPTS)
    c1.setWidthPercent(30)
    c1.setMeasureFunc((_w: number) => {
      if (_w >= 200) return { width: 200, height: 1 }
      return { width: Math.min(200, _w), height: Math.ceil(200 / Math.max(_w, 1)) }
    })
    root.insertChild(c1, 0)

    const c2 = Node.create(YOGA_OPTS)
    c2.setWidthPercent(50)
    c2.setMeasureFunc((_w: number) => {
      if (_w >= 80) return { width: 80, height: 1 }
      return { width: Math.min(80, _w), height: Math.ceil(80 / Math.max(_w, 1)) }
    })
    root.insertChild(c2, 1)

    const c3 = Node.create(YOGA_OPTS)
    c3.setWidth(60)
    c3.setHeight(40)
    root.insertChild(c3, 2)

    root.calculateLayout(300, 200, DIRECTION_LTR)
    expectLayout(c1, { left: 0, top: 0, width: 90, height: 200 })
    expectLayout(c2, { left: 90, top: 0, width: 150, height: 200 })
    expectLayout(c3, { left: 240, top: 0, width: 60, height: 40 })
  })

  // Column – percent-width measure leaves with correct heights.
  it("should compute correct heights for percent-width measure leaves in column", () => {
    const root = Node.create(YOGA_OPTS)
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setWidth(300)
    root.setHeight(200)

    const c1 = Node.create(YOGA_OPTS)
    c1.setWidthPercent(30)
    c1.setMeasureFunc((_w: number) => {
      if (_w >= 200) return { width: 200, height: 1 }
      return { width: Math.min(200, _w), height: Math.ceil(200 / Math.max(_w, 1)) }
    })
    root.insertChild(c1, 0)

    const c2 = Node.create(YOGA_OPTS)
    c2.setWidthPercent(50)
    c2.setMeasureFunc((_w: number) => {
      if (_w >= 80) return { width: 80, height: 1 }
      return { width: Math.min(80, _w), height: Math.ceil(80 / Math.max(_w, 1)) }
    })
    root.insertChild(c2, 1)

    const c3 = Node.create(YOGA_OPTS)
    c3.setWidth(60)
    c3.setHeight(40)
    root.insertChild(c3, 2)

    root.calculateLayout(300, 200, DIRECTION_LTR)
    expectLayout(c1, { left: 0, top: 0, width: 90, height: 3 })
    expectLayout(c2, { left: 0, top: 3, width: 150, height: 1 })
    expectLayout(c3, { left: 0, top: 4, width: 60, height: 40 })
  })

  // Bug: Nested – 2 containers flexGrow:1 in row, each column with 2
  // percent-width measure leaves. Tests cross-axis percent resolution
  // inside flexGrow containers.
  it("should correctly measure percent-width leaves inside flexGrow containers (2x2 nested)", () => {
    const root = Node.create(YOGA_OPTS)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setWidth(400)
    root.setHeight(200)
    root.setGap(GUTTER_COLUMN, 10)

    const outer1 = Node.create(YOGA_OPTS)
    outer1.setFlexGrow(1)
    outer1.setFlexDirection(FLEX_DIRECTION_COLUMN)
    outer1.setGap(GUTTER_ROW, 5)
    root.insertChild(outer1, 0)

    const l1 = Node.create(YOGA_OPTS)
    l1.setWidthPercent(30)
    l1.setMeasureFunc((_w: number) => {
      if (_w >= 200) return { width: 200, height: 1 }
      return { width: Math.min(200, _w), height: Math.ceil(200 / Math.max(_w, 1)) }
    })
    outer1.insertChild(l1, 0)

    const l2 = Node.create(YOGA_OPTS)
    l2.setWidthPercent(50)
    l2.setMeasureFunc((_w: number) => {
      if (_w >= 80) return { width: 80, height: 1 }
      return { width: Math.min(80, _w), height: Math.ceil(80 / Math.max(_w, 1)) }
    })
    outer1.insertChild(l2, 1)

    const outer2 = Node.create(YOGA_OPTS)
    outer2.setFlexGrow(1)
    outer2.setFlexDirection(FLEX_DIRECTION_COLUMN)
    outer2.setGap(GUTTER_ROW, 5)
    root.insertChild(outer2, 1)

    const l3 = Node.create(YOGA_OPTS)
    l3.setWidthPercent(40)
    l3.setMeasureFunc((_w: number) => {
      if (_w >= 120) return { width: 120, height: 1 }
      return { width: Math.min(120, _w), height: Math.ceil(120 / Math.max(_w, 1)) }
    })
    outer2.insertChild(l3, 0)

    const l4 = Node.create(YOGA_OPTS)
    l4.setWidthPercent(60)
    l4.setMeasureFunc((_w: number) => {
      if (_w >= 90) return { width: 90, height: 1 }
      return { width: Math.min(90, _w), height: Math.ceil(90 / Math.max(_w, 1)) }
    })
    outer2.insertChild(l4, 1)

    root.calculateLayout(400, 200, DIRECTION_LTR)
    expectLayout(outer1, { left: 0, top: 0, width: 195, height: 200 })
    expectLayout(l1, { left: 0, top: 0, width: 59, height: 4 })
    expectLayout(l2, { left: 0, top: 9, width: 98, height: 1 })
    expectLayout(outer2, { left: 205, top: 0, width: 195, height: 200 })
    expectLayout(l3, { left: 0, top: 0, width: 78, height: 2 })
    expectLayout(l4, { left: 0, top: 7, width: 117, height: 1 })
  })

  // Bug: Deeply nested – column root(500×300) gap(10) with 3 flexGrow rows,
  // each with 3 percent-width measure leaves. Flexily overflows (top+height > 300).
  it("should correctly size percent-width measure leaves in 3x3 nested grid", () => {
    const root = Node.create(YOGA_OPTS)
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setWidth(500)
    root.setHeight(300)
    root.setGap(GUTTER_ROW, 10)

    const children: Array<{ wPct: number; content: number }> = [
      { wPct: 20, content: 180 },
      { wPct: 40, content: 250 },
      { wPct: 60, content: 100 },
    ]

    const rows: Array<{ row: Node; cells: Node[] }> = []

    for (let i = 0; i < 3; i++) {
      const outer = Node.create(YOGA_OPTS)
      outer.setFlexGrow(1)
      outer.setFlexDirection(FLEX_DIRECTION_ROW)
      outer.setGap(GUTTER_COLUMN, 5)
      root.insertChild(outer, i)

      const cells: Node[] = []
      for (let j = 0; j < 3; j++) {
        const leaf = Node.create(YOGA_OPTS)
        const idx = (i + j) % 3
        const { wPct, content } = children[idx]!
        leaf.setWidthPercent(wPct)
        leaf.setMeasureFunc((_w: number) => {
          if (_w >= content) return { width: content, height: 1 }
          return { width: Math.min(content, _w), height: Math.ceil(content / Math.max(_w, 1)) }
        })
        outer.insertChild(leaf, j)
        cells.push(leaf)
      }
      rows.push({ row: outer, cells })
    }

    root.calculateLayout(500, 300, DIRECTION_LTR)

    expectLayout(root, { width: 500, height: 300 })

    // All rows must fit within 300px height
    for (const { row } of rows) {
      expect(row.getComputedTop()).toBeGreaterThanOrEqual(0)
      expect(row.getComputedTop() + row.getComputedHeight()).toBeLessThanOrEqual(300)
    }

    // Row 0 children must be positioned within bounds
    const row0 = rows[0]!
    for (const cell of row0.cells) {
      expect(cell.getComputedTop()).toBe(0)
      expect(cell.getComputedHeight()).toBeGreaterThanOrEqual(1)
      expect(cell.getComputedLeft() + cell.getComputedWidth()).toBeLessThanOrEqual(500)
    }
  })
})
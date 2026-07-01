/**
 * Regression: a measure-func leaf with a PERCENT width (e.g. width="30%")
 * was laid out against the PARENT's full mainAxisSize instead of the child's
 * resolved 30% width. This made the leaf measure unconstrained (or at parent
 * width) → no wrapping → height=1 instead of the correct wrapped height.
 *
 * Root cause (layout-zero.ts Phase 8 passWidthToChild):
 *   The `mainIsPercentForLayoutCall → mainAxisSize` case fires before the
 *   `isRow ? mainSizeToPass : childWidth` terminal fallback that commit
 *   e398ac1 added. For measure-func leaves, `mainSizeToPass` already carries
 *   the correct `childWidth` (resolved percent), but execution never reaches it.
 *
 * Fix: add `hasMeasureLeaf ? mainSizeToPass` before `mainIsPercentForLayoutCall`.
 */
import { describe, expect, test } from "vitest"
import {
  ALIGN_FLEX_START,
  DIRECTION_LTR,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_ROW,
  MEASURE_MODE_AT_MOST,
  MEASURE_MODE_EXACTLY,
  MEASURE_MODE_UNDEFINED,
  Node,
} from "../src/index.js"

describe("percent width on measure-func leaf: wraps at resolved percent width", () => {
  test("measure-func leaf with width=30% in a row uses resolved 30% of parent width for wrapping", () => {
    // contentWidth is 80 units. At 30px (30% of 100) → wraps to 3 lines.
    // At 100px (parent width) → fits in 1 line.
    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setWidth(100)
    root.setHeight(50)

    const child = Node.create()
    child.setWidthPercent(30) // 30% of 100 = 30px
    child.setMeasureFunc((_w: number, wm: number) => {
      const contentWidth = 80
      if (wm === MEASURE_MODE_EXACTLY || wm === MEASURE_MODE_AT_MOST) {
        if (_w >= contentWidth) {
          return { width: contentWidth, height: 1 }
        }
        const lines = Math.ceil(contentWidth / _w)
        return { width: Math.min(contentWidth, _w), height: lines }
      }
      return { width: contentWidth, height: 1 }
    })
    root.insertChild(child, 0)

    root.calculateLayout(100, 50, DIRECTION_LTR)

    // BUG: child gets width=100 (parent full width) instead of 30
    expect(child.getComputedWidth()).toBe(30)
    // BUG: measure-func wraps at 100 instead of 30 → height=1 instead of 3
    expect(child.getComputedHeight()).toBe(3)
  })

  test("measure-func leaf with width=30% in a column uses resolved 30% of parent width for wrapping", () => {
    // Column variant: width=30% should resolve against parent's width=100 = 30
    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setWidth(100)
    root.setHeight(100)

    const child = Node.create()
    child.setWidthPercent(30) // 30% of 100 = 30px
    child.setMeasureFunc((_w: number, wm: number) => {
      const contentWidth = 80
      if (wm === MEASURE_MODE_EXACTLY || wm === MEASURE_MODE_AT_MOST) {
        if (_w >= contentWidth) {
          return { width: contentWidth, height: 1 }
        }
        const lines = Math.ceil(contentWidth / _w)
        return { width: Math.min(contentWidth, _w), height: lines }
      }
      return { width: contentWidth, height: 1 }
    })
    root.insertChild(child, 0)

    root.calculateLayout(100, 100, DIRECTION_LTR)

    // In a column, width is cross-axis. But width=30% still resolves against
    // parent width = 100. The measureFunc receives width=30.
    expect(child.getComputedWidth()).toBe(30)
    expect(child.getComputedHeight()).toBe(3)
  })

  test("flexGrow measure-func leaf with widthPercent and a sibling gets correct wrapping", () => {
    // Row: [sibling(40)] [child flexGrow=1 width=30%]
    // Remaining: 100 - 40 = 60 → child flexGrow gets all → 60
    // But width=30% resolves to 30 during flex basis. After flex distribution,
    // child width = 60 (flexGrow wins over percent width in main axis).
    // Test: child still wraps at 60, not at 100.
    // Use alignItems=flex-start to avoid stretch overriding wrapped content height.
    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setWidth(100)
    root.setHeight(50)
    root.setAlignItems(ALIGN_FLEX_START)

    const sibling = Node.create()
    sibling.setWidth(40)
    sibling.setFlexShrink(0)
    root.insertChild(sibling, 0)

    const child = Node.create()
    child.setWidthPercent(30)
    child.setFlexGrow(1)
    child.setMeasureFunc((_w: number, wm: number) => {
      const contentWidth = 80
      if (wm === MEASURE_MODE_EXACTLY || wm === MEASURE_MODE_AT_MOST) {
        if (_w >= contentWidth) {
          return { width: contentWidth, height: 1 }
        }
        const lines = Math.ceil(contentWidth / _w)
        return { width: Math.min(contentWidth, _w), height: lines }
      }
      return { width: contentWidth, height: 1 }
    })
    root.insertChild(child, 1)

    root.calculateLayout(100, 50, DIRECTION_LTR)

    // flexGrow wins: child gets 60 (100 - 40)
    expect(child.getComputedWidth()).toBe(60)
    // 80 units at 60 → 2 lines
    expect(child.getComputedHeight()).toBe(2)
  })

  test("measure-func leaf with width=30%, no flexGrow, inside column flexGrow parent", () => {
    // More realistic: outer column flexGrow . child row . leaf width=30%
    // The leaf should wrap at 30% of the resolved column width.
    // Per column spec example from doc — multi-pass measurement
    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setWidth(200)
    root.setHeight(100)

    const col = Node.create()
    col.setFlexDirection(FLEX_DIRECTION_COLUMN)
    col.setFlexGrow(1)
    root.insertChild(col, 0)

    const row = Node.create()
    row.setFlexDirection(FLEX_DIRECTION_ROW)
    col.insertChild(row, 0)

    const child = Node.create()
    child.setWidthPercent(30) // 30% of col width (200 - 0 = 200) → 60
    child.setMeasureFunc((_w: number, wm: number) => {
      const contentWidth = 120
      if (wm === MEASURE_MODE_EXACTLY || wm === MEASURE_MODE_AT_MOST) {
        if (_w >= contentWidth) {
          return { width: contentWidth, height: 1 }
        }
        const lines = Math.ceil(contentWidth / _w)
        return { width: Math.min(contentWidth, _w), height: lines }
      }
      return { width: contentWidth, height: 1 }
    })
    row.insertChild(child, 0)

    root.calculateLayout(200, 100, DIRECTION_LTR)

    // col gets 200 (flexGrow in 200-wide row)
    expect(col.getComputedWidth()).toBe(200)
    // 30% of 200 = 60
    expect(child.getComputedWidth()).toBe(60)
    // 120 units at 60 → 2 lines
    expect(child.getComputedHeight()).toBe(2)
  })
})

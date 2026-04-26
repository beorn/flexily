/**
 * Recursive intrinsic min-content for container nodes.
 *
 * Every Node — leaf or container — exposes its own min-content size along
 * a given axis as a property of itself, computed recursively from its
 * content. This eliminates the Box-wrapper foot-gun where wrapping a
 * `<Text wrap="wrap">` in a `<Box>` previously caused the Box to report
 * max-content (instead of true CSS min-content == longest unbreakable
 * token), pinning rows wider than necessary.
 *
 * Recursive definition:
 *  - Leaf with measureFunc: query measurer with MEASURE_MODE_MIN_CONTENT
 *  - Container, direction == flexDirection (main axis):
 *      padding + border + sum(child.getMinContent(direction)) + total gap
 *  - Container, direction != flexDirection (cross axis):
 *      padding + border + max(child.getMinContent(direction))
 *  - Empty leaf: padding + border only
 *
 * Tracks bead km-flexily.recursive-min-content.
 */

import { describe, expect, test } from "vitest"
import {
  DIRECTION_LTR,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_ROW,
  MEASURE_MODE_AT_MOST,
  MEASURE_MODE_MIN_CONTENT,
  MEASURE_MODE_UNDEFINED,
  Node,
  EDGE_LEFT,
  EDGE_RIGHT,
  EDGE_TOP,
  EDGE_BOTTOM,
  GUTTER_ALL,
} from "../src/index.js"

/**
 * Wrap-text measurer that mirrors silvery's Text node behavior:
 * - MIN_CONTENT mode: returns longest unbreakable token width
 * - AT_MOST/EXACTLY: wraps text into the available width and returns that
 * - UNDEFINED: returns natural full-line width (max-content)
 */
function makeWrapTextMeasurer(text: string) {
  const tokens = text.split(/\s+/).filter(Boolean)
  const naturalWidth = text.length
  const longestToken = tokens.reduce((m, t) => Math.max(m, t.length), 0)

  return (w: number, wMode: number, _h: number, _hMode: number) => {
    if (wMode === MEASURE_MODE_MIN_CONTENT) {
      return { width: longestToken, height: 1 }
    }
    if (wMode === MEASURE_MODE_UNDEFINED) {
      return { width: naturalWidth, height: 1 }
    }
    // AT_MOST / EXACTLY: wrap into the available width
    if (w >= naturalWidth) return { width: naturalWidth, height: 1 }
    if (w <= 0) return { width: longestToken, height: tokens.length }
    // Greedy line break
    let lines = 1
    let lineW = 0
    for (const tok of tokens) {
      const cost = lineW === 0 ? tok.length : tok.length + 1
      if (lineW + cost <= w) {
        lineW += cost
      } else {
        lines++
        lineW = tok.length
      }
    }
    return { width: Math.min(naturalWidth, w), height: lines }
  }
}

describe("recursive min-content (Node.getMinContent)", () => {
  describe("leaf measureFunc nodes", () => {
    test("wrappable text: min-content == longest unbreakable token", () => {
      const node = Node.create()
      node.setMeasureFunc(makeWrapTextMeasurer("hello world there"))
      // longest token = "there" (5)
      expect(node.getMinContent(FLEX_DIRECTION_ROW)).toBe(5)
    })

    test("non-wrappable text: min-content == natural width", () => {
      const node = Node.create()
      node.setMeasureFunc(makeWrapTextMeasurer("hello-world"))
      expect(node.getMinContent(FLEX_DIRECTION_ROW)).toBe(11)
    })
  })

  describe("empty leaf without measureFunc", () => {
    test("padding+border only", () => {
      const node = Node.create()
      node.setPadding(EDGE_LEFT, 2)
      node.setPadding(EDGE_RIGHT, 3)
      node.setBorder(EDGE_LEFT, 1)
      node.setBorder(EDGE_RIGHT, 1)
      // 2 + 3 + 1 + 1 = 7
      expect(node.getMinContent(FLEX_DIRECTION_ROW)).toBe(7)
    })

    test("empty leaf with no padding/border returns 0", () => {
      const node = Node.create()
      expect(node.getMinContent(FLEX_DIRECTION_ROW)).toBe(0)
      expect(node.getMinContent(FLEX_DIRECTION_COLUMN)).toBe(0)
    })
  })

  describe("container with single child", () => {
    test("Box wrapping wrap-Text exposes Text's min-content (longest token)", () => {
      const box = Node.create()
      box.setFlexDirection(FLEX_DIRECTION_ROW)
      const text = Node.create()
      text.setMeasureFunc(makeWrapTextMeasurer("alpha bravo charlie"))
      box.insertChild(text, 0)

      // longest token "charlie" = 7. Box wraps it → min-content propagates.
      expect(box.getMinContent(FLEX_DIRECTION_ROW)).toBe(7)
    })

    test("nested Box(Box(Text)) propagates min-content through both levels", () => {
      const outer = Node.create()
      outer.setFlexDirection(FLEX_DIRECTION_ROW)
      const inner = Node.create()
      inner.setFlexDirection(FLEX_DIRECTION_ROW)
      const text = Node.create()
      text.setMeasureFunc(makeWrapTextMeasurer("foo barbaz qux"))
      inner.insertChild(text, 0)
      outer.insertChild(inner, 0)
      // longest token = "barbaz" (6)
      expect(outer.getMinContent(FLEX_DIRECTION_ROW)).toBe(6)
    })

    test("Box adds its own padding+border to inner min-content", () => {
      const box = Node.create()
      box.setFlexDirection(FLEX_DIRECTION_ROW)
      box.setPadding(EDGE_LEFT, 2)
      box.setPadding(EDGE_RIGHT, 2)
      box.setBorder(EDGE_LEFT, 1)
      box.setBorder(EDGE_RIGHT, 1)
      const text = Node.create()
      text.setMeasureFunc(makeWrapTextMeasurer("ab cd ef"))
      box.insertChild(text, 0)
      // longest token = 2; box adds 2+2+1+1 = 6; total = 8
      expect(box.getMinContent(FLEX_DIRECTION_ROW)).toBe(8)
    })
  })

  describe("container main axis: sum of children", () => {
    test("row container: sum of children's row min-content", () => {
      const row = Node.create()
      row.setFlexDirection(FLEX_DIRECTION_ROW)
      const a = Node.create()
      a.setMeasureFunc(makeWrapTextMeasurer("one two")) // longest 3
      const b = Node.create()
      b.setMeasureFunc(makeWrapTextMeasurer("alpha beta")) // longest 5
      row.insertChild(a, 0)
      row.insertChild(b, 1)
      // 3 + 5 = 8 (no gap)
      expect(row.getMinContent(FLEX_DIRECTION_ROW)).toBe(8)
    })

    test("row container with gap: sum + (n-1)*gap", () => {
      const row = Node.create()
      row.setFlexDirection(FLEX_DIRECTION_ROW)
      row.setGap(GUTTER_ALL, 2)
      for (let i = 0; i < 3; i++) {
        const c = Node.create()
        c.setMeasureFunc(makeWrapTextMeasurer("aa")) // min = 2
        row.insertChild(c, i)
      }
      // 2 + 2 + 2 + (2 gaps × 2) = 10
      expect(row.getMinContent(FLEX_DIRECTION_ROW)).toBe(10)
    })

    test("column container, column-axis query: sum of column min-contents", () => {
      const col = Node.create()
      col.setFlexDirection(FLEX_DIRECTION_COLUMN)
      const a = Node.create()
      a.setMeasureFunc(() => ({ width: 10, height: 3 }))
      const b = Node.create()
      b.setMeasureFunc(() => ({ width: 10, height: 4 }))
      col.insertChild(a, 0)
      col.insertChild(b, 1)
      // 3 + 4 = 7
      expect(col.getMinContent(FLEX_DIRECTION_COLUMN)).toBe(7)
    })
  })

  describe("container cross axis: max of children", () => {
    test("row container queried on column axis: max of children's column min-content", () => {
      const row = Node.create()
      row.setFlexDirection(FLEX_DIRECTION_ROW)
      const a = Node.create()
      a.setMeasureFunc(() => ({ width: 5, height: 2 }))
      const b = Node.create()
      b.setMeasureFunc(() => ({ width: 5, height: 5 }))
      row.insertChild(a, 0)
      row.insertChild(b, 1)
      // cross axis (column) of a row container = max(2, 5) = 5
      expect(row.getMinContent(FLEX_DIRECTION_COLUMN)).toBe(5)
    })

    test("column container queried on row axis: max of children's row min-content", () => {
      const col = Node.create()
      col.setFlexDirection(FLEX_DIRECTION_COLUMN)
      const a = Node.create()
      a.setMeasureFunc(makeWrapTextMeasurer("alpha beta")) // 5
      const b = Node.create()
      b.setMeasureFunc(makeWrapTextMeasurer("a bcde")) // 4
      col.insertChild(a, 0)
      col.insertChild(b, 1)
      // cross axis (row) of column container = max(5, 4) = 5
      expect(col.getMinContent(FLEX_DIRECTION_ROW)).toBe(5)
    })
  })

  describe("cache invalidation", () => {
    test("markDirty clears min-content cache", () => {
      const node = Node.create()
      node.setMeasureFunc(makeWrapTextMeasurer("foo bar"))
      const m1 = node.getMinContent(FLEX_DIRECTION_ROW)
      expect(m1).toBe(3)
      // Re-query — should hit cache (still 3)
      expect(node.getMinContent(FLEX_DIRECTION_ROW)).toBe(3)
      // Change content — markDirty clears cache
      node.setMeasureFunc(makeWrapTextMeasurer("a longerword"))
      // setMeasureFunc → markDirty → cache invalid; recomputes to 10
      expect(node.getMinContent(FLEX_DIRECTION_ROW)).toBe(10)
    })

    test("insertChild clears parent min-content cache", () => {
      const row = Node.create()
      row.setFlexDirection(FLEX_DIRECTION_ROW)
      const a = Node.create()
      a.setMeasureFunc(makeWrapTextMeasurer("hi")) // 2
      row.insertChild(a, 0)
      expect(row.getMinContent(FLEX_DIRECTION_ROW)).toBe(2)

      const b = Node.create()
      b.setMeasureFunc(makeWrapTextMeasurer("hello")) // 5
      row.insertChild(b, 1)
      // Sum = 2 + 5 = 7 (assuming insertChild → markDirty cleared cache)
      expect(row.getMinContent(FLEX_DIRECTION_ROW)).toBe(7)
    })

    test("removeChild clears parent min-content cache", () => {
      const row = Node.create()
      row.setFlexDirection(FLEX_DIRECTION_ROW)
      const a = Node.create()
      a.setMeasureFunc(makeWrapTextMeasurer("hi")) // 2
      const b = Node.create()
      b.setMeasureFunc(makeWrapTextMeasurer("hello")) // 5
      row.insertChild(a, 0)
      row.insertChild(b, 1)
      expect(row.getMinContent(FLEX_DIRECTION_ROW)).toBe(7)

      row.removeChild(b)
      expect(row.getMinContent(FLEX_DIRECTION_ROW)).toBe(2)
    })

    test("padding change invalidates min-content cache", () => {
      const box = Node.create()
      const text = Node.create()
      text.setMeasureFunc(makeWrapTextMeasurer("ab cd")) // 2
      box.insertChild(text, 0)
      expect(box.getMinContent(FLEX_DIRECTION_ROW)).toBe(2)

      box.setPadding(EDGE_LEFT, 3)
      box.setPadding(EDGE_RIGHT, 3)
      expect(box.getMinContent(FLEX_DIRECTION_ROW)).toBe(8)
    })
  })

  describe("CSS escape hatches via _getMinContentForParent", () => {
    test("overflow: hidden on child → 0 min-content from parent's POV", () => {
      const row = Node.create()
      row.setFlexDirection(FLEX_DIRECTION_ROW)
      const a = Node.create()
      a.setOverflow(/* OVERFLOW_HIDDEN */ 1)
      a.setMeasureFunc(makeWrapTextMeasurer("supercalifragilistic"))
      const b = Node.create()
      b.setMeasureFunc(makeWrapTextMeasurer("fixed")) // 5
      row.insertChild(a, 0)
      row.insertChild(b, 1)
      // a's min-content as seen by parent = 0 (overflow hides it)
      // b's min-content = 5
      // sum = 0 + 5 = 5
      expect(row.getMinContent(FLEX_DIRECTION_ROW)).toBe(5)
    })

    test("explicit minWidth=0 on child → 0 min-content from parent's POV", () => {
      const row = Node.create()
      row.setFlexDirection(FLEX_DIRECTION_ROW)
      const a = Node.create()
      a.setMinWidth(0) // canonical CSS escape hatch
      a.setMeasureFunc(makeWrapTextMeasurer("supercalifragilistic"))
      const b = Node.create()
      b.setMeasureFunc(makeWrapTextMeasurer("hi")) // 2
      row.insertChild(a, 0)
      row.insertChild(b, 1)
      // sum = 0 + 2 = 2
      expect(row.getMinContent(FLEX_DIRECTION_ROW)).toBe(2)
    })
  })

  describe("display:none and absolute children excluded", () => {
    test("display:none child contributes 0 to parent min-content", () => {
      const row = Node.create()
      row.setFlexDirection(FLEX_DIRECTION_ROW)
      const a = Node.create()
      a.setDisplay(/* DISPLAY_NONE */ 1)
      a.setMeasureFunc(makeWrapTextMeasurer("ignored content"))
      const b = Node.create()
      b.setMeasureFunc(makeWrapTextMeasurer("xy")) // 2
      row.insertChild(a, 0)
      row.insertChild(b, 1)
      expect(row.getMinContent(FLEX_DIRECTION_ROW)).toBe(2)
    })

    test("absolute-positioned child excluded", () => {
      const row = Node.create()
      row.setFlexDirection(FLEX_DIRECTION_ROW)
      const a = Node.create()
      a.setPositionType(/* POSITION_TYPE_ABSOLUTE */ 2)
      a.setMeasureFunc(makeWrapTextMeasurer("absolute content"))
      const b = Node.create()
      b.setMeasureFunc(makeWrapTextMeasurer("xy")) // 2
      row.insertChild(a, 0)
      row.insertChild(b, 1)
      expect(row.getMinContent(FLEX_DIRECTION_ROW)).toBe(2)
    })
  })
})

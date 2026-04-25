/**
 * Bug: km-silvery.wrap-measurement
 *
 * Nested flexGrow columns inside a row container break grandchild text wrap.
 * The grandchild Text gets measured against an unconstrained / max-content
 * width instead of the cross-axis width inherited via flex distribution.
 *
 * Repro pattern:
 *
 *   root (row, 120 x 30)
 *   ├── leftCol (column, flexGrow=1, overflow=hidden)
 *   │   └── inner (column, flexGrow=1, flexShrink=1, minWidth=0)
 *   │       └── text (measureFunc, wraps when constrained)
 *   └── side  (width=40)
 *
 * leftCol should occupy 80 cols; text should wrap at 80.
 *
 * The bug surfaces when nesting goes deeper (3+ flexGrow column levels) — the
 * silvercode card chain `screen-row → leftCol → rowWrap → perSession →
 * cardOuter → cardInner → text` is the production trigger.
 *
 * See:
 * - apps/silvercode/tests/wrap-regression.test.tsx (silvery-level regression)
 * - apps/silvercode/src/components/SessionCard.tsx
 */
import { describe, expect, it } from "vitest"
import {
  DIRECTION_LTR,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_ROW,
  Node,
  OVERFLOW_HIDDEN,
  WRAP_WRAP,
} from "../src/index.js"

const PARAGRAPH = "x".repeat(200) // 200 unbreakable chars — force wrap

/** Measure function for a wrappable text node.
 *  - mode UNDEFINED / very large → returns max-content (single line).
 *  - mode AT_MOST / EXACTLY with finite width → wraps to ceil(len/width). */
function measureWrappableText(
  text: string,
): (w: number, wm: number, h: number, hm: number) => { width: number; height: number } {
  return (w: number, _wm: number, _h: number, _hm: number) => {
    if (!Number.isFinite(w) || w <= 0 || w >= text.length) {
      return { width: text.length, height: 1 }
    }
    const cols = Math.floor(w)
    const lines = Math.ceil(text.length / cols)
    return { width: cols, height: lines }
  }
}

describe("wrap measurement: nested flexGrow columns + measureFunc text", () => {
  it("single nested flexGrow column wraps text at parent's available width", () => {
    // Simplest case: row container with leftCol(flexGrow=1, overflow=hidden)
    // containing a single measureFunc text. Text should wrap at 80.
    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setWidth(120)
    root.setHeight(30)

    const leftCol = Node.create()
    leftCol.setFlexDirection(FLEX_DIRECTION_COLUMN)
    leftCol.setFlexGrow(1)
    leftCol.setOverflow(OVERFLOW_HIDDEN)
    root.insertChild(leftCol, 0)

    const text = Node.create()
    text.setMeasureFunc(measureWrappableText(PARAGRAPH))
    leftCol.insertChild(text, 0)

    const side = Node.create()
    side.setWidth(40)
    root.insertChild(side, 1)

    root.calculateLayout(120, 30, DIRECTION_LTR)

    expect(leftCol.getComputedWidth()).toBe(80)
    expect(text.getComputedWidth()).toBe(80)
    // 200 chars / 80 = 3 lines.
    expect(text.getComputedHeight()).toBe(Math.ceil(PARAGRAPH.length / 80))
  })

  it("two nested flexGrow columns: text wraps at outer column's content width", () => {
    // outer + inner both flex-column with flexGrow=1.
    // Text should still wrap at 80 (= leftCol width = inner width via stretch).
    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setWidth(120)
    root.setHeight(30)

    const leftCol = Node.create()
    leftCol.setFlexDirection(FLEX_DIRECTION_COLUMN)
    leftCol.setFlexGrow(1)
    leftCol.setOverflow(OVERFLOW_HIDDEN)
    root.insertChild(leftCol, 0)

    const inner = Node.create()
    inner.setFlexDirection(FLEX_DIRECTION_COLUMN)
    inner.setFlexGrow(1)
    inner.setFlexShrink(1)
    inner.setMinWidth(0)
    leftCol.insertChild(inner, 0)

    const text = Node.create()
    text.setMeasureFunc(measureWrappableText(PARAGRAPH))
    inner.insertChild(text, 0)

    const side = Node.create()
    side.setWidth(40)
    root.insertChild(side, 1)

    root.calculateLayout(120, 30, DIRECTION_LTR)

    expect(leftCol.getComputedWidth()).toBe(80)
    expect(inner.getComputedWidth()).toBe(80)
    expect(text.getComputedWidth()).toBe(80)
    expect(text.getComputedHeight()).toBe(Math.ceil(PARAGRAPH.length / 80))
  })

  it("silvercode card chain: 5 nested flexGrow columns wrap text at card width", () => {
    // Mirrors the production failure case in apps/silvercode/src/App.tsx +
    // SessionCard.tsx. Three+ levels of flex-grow column nesting feed the
    // grandchild Text its outer max-content width instead of the constrained
    // available width. The silvercode wrap-regression test currently
    // documents this with `expect(hasMiddle).toBe(false)` (broken).
    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setWidth(160)
    root.setHeight(30)

    // Left column with overflow=hidden — the boundary that should clip wide
    // unwrappable content.
    const leftCol = Node.create()
    leftCol.setFlexDirection(FLEX_DIRECTION_COLUMN)
    leftCol.setFlexGrow(1)
    leftCol.setOverflow(OVERFLOW_HIDDEN)
    root.insertChild(leftCol, 0)

    // Row that wraps multiple sessions side-by-side.
    const rowWrap = Node.create()
    rowWrap.setFlexDirection(FLEX_DIRECTION_ROW)
    rowWrap.setFlexWrap(WRAP_WRAP)
    rowWrap.setFlexGrow(1)
    rowWrap.setFlexShrink(1)
    leftCol.insertChild(rowWrap, 0)

    // Per-session column wrapper.
    const perSession = Node.create()
    perSession.setFlexDirection(FLEX_DIRECTION_COLUMN)
    perSession.setFlexGrow(1)
    perSession.setFlexShrink(1)
    perSession.setMinWidth(0)
    rowWrap.insertChild(perSession, 0)

    // SessionCard outer.
    const cardOuter = Node.create()
    cardOuter.setFlexDirection(FLEX_DIRECTION_COLUMN)
    cardOuter.setFlexGrow(1)
    cardOuter.setFlexShrink(1)
    cardOuter.setMinWidth(0)
    cardOuter.setOverflow(OVERFLOW_HIDDEN)
    perSession.insertChild(cardOuter, 0)

    // SessionCard inner.
    const cardInner = Node.create()
    cardInner.setFlexDirection(FLEX_DIRECTION_COLUMN)
    cardInner.setFlexGrow(1)
    cardInner.setFlexShrink(1)
    cardInner.setMinWidth(0)
    cardOuter.insertChild(cardInner, 0)

    // The text that should wrap at the card boundary.
    const text = Node.create()
    text.setMeasureFunc(measureWrappableText(PARAGRAPH))
    cardInner.insertChild(text, 0)

    // Side panel (right).
    const side = Node.create()
    side.setWidth(40)
    root.insertChild(side, 1)

    root.calculateLayout(160, 30, DIRECTION_LTR)

    // leftCol should occupy total - sidePanel = 120.
    expect(leftCol.getComputedWidth()).toBe(120)
    // Each nested wrapper inherits the same width via stretch on cross axis.
    expect(perSession.getComputedWidth()).toBe(120)
    expect(cardOuter.getComputedWidth()).toBe(120)
    expect(cardInner.getComputedWidth()).toBe(120)
    // The grandchild text wraps at 120, NOT at 200 (max-content).
    expect(text.getComputedWidth()).toBeLessThanOrEqual(120)
    // 200 / 120 = 2 lines.
    expect(text.getComputedHeight()).toBeGreaterThanOrEqual(2)
  })
})

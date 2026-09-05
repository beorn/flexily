/**
 * @failure  A column distributes its free space from a stale flex base size:
 *           an auto-height container child whose content holds a ROW with a
 *           flexible child of wrapped text is pre-measured (Phase 5) with the
 *           row's children at an unconstrained width, so the text reports one
 *           line and the container's base size is (wrapped lines - 1) rows
 *           short. Phase 8 later lays the container out at its true height,
 *           but the flexGrow sibling has already been given those rows: every
 *           box below the container lands that many rows too low and the last
 *           ones fall off the frame. Seen 2026-09-05 in yrd watch at 120x30:
 *           the STATS border painted on the footer row and the status pills
 *           row was never on screen (silvery 0.24.1, flexily 0.7.3).
 * @level    l0 (flexily engine, no renderer)
 * @consumer any column whose auto-height children contain rows with wrapped
 *           text: silvery's yrd watch RUNNER box, its detail pane, every
 *           bordered card with a gutter + prose row
 */
import { describe, expect, it } from "vitest"
import {
  DIRECTION_LTR,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_ROW,
  MEASURE_MODE_AT_MOST,
  MEASURE_MODE_EXACTLY,
  MEASURE_MODE_MIN_CONTENT,
  Node,
} from "../src/index.js"
import * as stats from "../src/layout-stats.js"

const CSS = { defaults: "css" as const }

/** A one-line label: `width` cells, one row, at any constraint. */
function label(width: number): Node {
  const node = Node.create(CSS)
  node.setMeasureFunc((w, widthMode) => {
    if (widthMode === MEASURE_MODE_MIN_CONTENT) return { width: 1, height: 1 }
    if (widthMode === MEASURE_MODE_EXACTLY || widthMode === MEASURE_MODE_AT_MOST) {
      return { width: Math.min(width, w), height: 1 }
    }
    return { width, height: 1 }
  })
  return node
}

/**
 * Wrappable prose of `length` cells with words of `word` cells: at a definite
 * width it wraps to ceil(length / width) lines; unconstrained it is one line;
 * its min-content is one word (the silvery measure contract for wrap="wrap").
 */
function prose(length: number, word = 12): Node {
  const node = Node.create(CSS)
  node.setMinWidth(0)
  node.setMeasureFunc((w, widthMode) => {
    if (widthMode === MEASURE_MODE_MIN_CONTENT) return { width: word, height: 1 }
    if (widthMode === MEASURE_MODE_EXACTLY || widthMode === MEASURE_MODE_AT_MOST) {
      if (!Number.isFinite(w) || w >= length) return { width: length, height: 1 }
      const lines = Math.ceil(length / Math.max(1, w))
      return { width: Math.min(length, w), height: lines }
    }
    return { width: length, height: 1 }
  })
  return node
}

/** The yrd MarkerRow: a 2-cell gutter beside a flexGrow column holding the rail. */
function markerRow(rail: Node): Node {
  const row = Node.create(CSS)
  row.setFlexDirection(FLEX_DIRECTION_ROW)
  row.setWidthPercent(100)
  row.setMinWidth(0)
  const gutter = Node.create(CSS)
  gutter.setWidth(2)
  gutter.setFlexShrink(0)
  gutter.insertChild(label(1), 0)
  row.insertChild(gutter, 0)
  const column = Node.create(CSS)
  column.setFlexDirection(FLEX_DIRECTION_COLUMN)
  column.setFlexGrow(1)
  column.setFlexBasis(0)
  column.setMinWidth(0)
  column.insertChild(rail, 0)
  row.insertChild(column, 1)
  return row
}

/**
 * The yrd watch frame at 120x30: an auto-height head (flexShrink 0) holding a
 * title line, the rail, a bottom line; a header line; a flexGrow list; a pills
 * line; a fixed 9-row STATS box; a footer line.
 */
function frame(rail: Node, cols: number) {
  const root = Node.create(CSS)
  root.setFlexDirection(FLEX_DIRECTION_COLUMN)
  root.setWidth(cols)
  root.setHeight(30)

  const head = Node.create(CSS)
  head.setFlexDirection(FLEX_DIRECTION_COLUMN)
  head.setFlexShrink(0)
  head.insertChild(label(10), 0)
  head.insertChild(rail, 1)
  head.insertChild(label(13), 2)
  root.insertChild(head, 0)

  const header = label(6)
  root.insertChild(header, 1)

  const list = Node.create(CSS)
  list.setFlexDirection(FLEX_DIRECTION_COLUMN)
  list.setFlexGrow(1)
  list.setMinHeight(0)
  for (let i = 0; i < 40; i++) list.insertChild(label(6), i)
  root.insertChild(list, 2)

  const pills = label(5)
  root.insertChild(pills, 3)

  const stats = Node.create(CSS)
  stats.setFlexDirection(FLEX_DIRECTION_COLUMN)
  stats.setHeight(9)
  stats.setFlexShrink(0)
  stats.insertChild(label(5), 0)
  root.insertChild(stats, 4)

  const footer = label(6)
  root.insertChild(footer, 5)

  root.calculateLayout(cols, 30, DIRECTION_LTR)
  return { root, head, header, list, pills, stats, footer }
}

/**
 * The same head in a frame that distributes nothing: an INDEFINITE main axis,
 * so there is no free space for anyone to absorb, no wrap and no justify
 * offset. Nothing here reads the summed base sizes, so the approximate one is
 * invisible — Phase 8 lays the head out for real and Phase 9 shrink-wraps the
 * column from its children's actual sizes.
 */
function calmFrame(rail: Node, cols: number) {
  const root = Node.create(CSS)
  root.setFlexDirection(FLEX_DIRECTION_COLUMN)
  root.setWidth(cols)

  const head = Node.create(CSS)
  head.setFlexDirection(FLEX_DIRECTION_COLUMN)
  head.setFlexShrink(0)
  head.insertChild(label(10), 0)
  head.insertChild(rail, 1)
  head.insertChild(label(13), 2)
  root.insertChild(head, 0)

  const footer = label(6)
  root.insertChild(footer, 1)

  root.calculateLayout(cols, NaN, DIRECTION_LTR)
  return { root, head, footer }
}

/**
 * A fixed-height column with no flexGrow child that FITS under the
 * approximation — head 3 plus body 6 of 10 rows — and overflows once the head
 * is measured exactly, at 5 plus 6. The deficit has to come out of the
 * shrinkable body, which only happens if the base size was made exact before
 * the distribution ran. Summing the approximate base sizes cannot predict
 * this: they are the under-estimates in question.
 */
function tightFrame(rail: Node) {
  const root = Node.create(CSS)
  root.setFlexDirection(FLEX_DIRECTION_COLUMN)
  root.setWidth(120)
  root.setHeight(10)

  const head = Node.create(CSS)
  head.setFlexDirection(FLEX_DIRECTION_COLUMN)
  head.setFlexShrink(0)
  head.insertChild(label(10), 0)
  head.insertChild(rail, 1)
  head.insertChild(label(13), 2)
  root.insertChild(head, 0)

  const body = Node.create(CSS)
  body.setFlexDirection(FLEX_DIRECTION_COLUMN)
  body.setMinHeight(0)
  for (let i = 0; i < 6; i++) body.insertChild(label(6), i)
  root.insertChild(body, 1)

  root.calculateLayout(120, 10, DIRECTION_LTR)
  return { root, head, body }
}

function tops(f: ReturnType<typeof frame>) {
  return {
    head: f.head.getComputedHeight(),
    header: f.header.getComputedTop(),
    list: f.list.getComputedHeight(),
    pills: f.pills.getComputedTop(),
    stats: f.stats.getComputedTop(),
    footer: f.footer.getComputedTop(),
  }
}

describe("a column's flex base size for a child holding a row with wrapped text", () => {
  // 300 cells of prose: 3 lines at 116 cells (120 - 2 gutter - 2 rounding), 2 at 236.
  const LENGTH = 300

  it("control: the rail directly in the head column (no nested row) fits the frame", () => {
    const f = frame(prose(LENGTH), 120)
    expect(tops(f)).toEqual({ head: 5, header: 5, list: 13, pills: 19, stats: 20, footer: 29 })
  })

  it("control: a one-line rail inside the marker row fits the frame", () => {
    const f = frame(markerRow(prose(40)), 120)
    expect(tops(f)).toEqual({ head: 3, header: 3, list: 15, pills: 19, stats: 20, footer: 29 })
  })

  it("the wrapped rail inside the marker row: the head is 5 rows and the frame still fits", () => {
    const f = frame(markerRow(prose(LENGTH)), 120)
    // Measured 2026-09-05 on flexily 0.7.3: head 5, header 5, list 15, pills 21, stats 22, footer 31.
    expect(tops(f)).toEqual({ head: 5, header: 5, list: 13, pills: 19, stats: 20, footer: 29 })
  })

  it("at 240 columns the rail wraps to two lines and the frame still fits", () => {
    const f = frame(markerRow(prose(LENGTH)), 240)
    // Measured 2026-09-05 on flexily 0.7.3: list 14, pills 20, stats 21, footer 30.
    expect(tops(f)).toEqual({ head: 4, header: 4, list: 14, pills: 19, stats: 20, footer: 29 })
  })

  it("a column that distributes nothing keeps the fast path", () => {
    // The rail wraps here too, but this frame hands the base size to nothing:
    // no flexGrow sibling, no wrap, justify-content flex-start, and it fits.
    // The head is still the right height, and flexily must not pay for a
    // sizing pass to get there — the same count as a rail that never wrapped.
    const wrapped = calmFrame(markerRow(prose(LENGTH)), 120)
    const wrappedSizingCalls = stats.layoutSizingCalls
    expect(wrapped.head.getComputedHeight()).toBe(5)
    expect(wrapped.footer.getComputedTop()).toBe(5)

    const flat = calmFrame(markerRow(prose(40)), 120)
    const flatSizingCalls = stats.layoutSizingCalls
    expect(flat.head.getComputedHeight()).toBe(3)
    expect(wrappedSizingCalls).toBe(flatSizingCalls)
  })

  it("a column that does distribute pays for the exact base size", () => {
    // Same rail, same wrap, but now a flexGrow sibling consumes the free space
    // derived from the head's base size, so the approximate one would reach the
    // output. flexily re-derives it through the real algorithm, which costs
    // sizing passes the non-wrapping control never runs.
    frame(markerRow(prose(LENGTH)), 120)
    const wrappedSizingCalls = stats.layoutSizingCalls
    frame(markerRow(prose(40)), 120)
    const flatSizingCalls = stats.layoutSizingCalls
    expect(wrappedSizingCalls).toBeGreaterThan(flatSizingCalls)
  })

  it("a fixed-height column that only overflows once the base size is exact", () => {
    // Head 3 + body 6 fits the 10 rows under the approximation; head 5 + body 6
    // does not. The shrinkable body must give up the row, and nothing may land
    // below the frame. Before the fix the column saw 9 of 10, distributed
    // nothing, and let the body run one row past the bottom.
    const f = tightFrame(markerRow(prose(LENGTH)))
    expect(f.head.getComputedHeight()).toBe(5)
    expect(f.body.getComputedTop()).toBe(5)
    expect(f.body.getComputedHeight()).toBe(5)
    expect(f.body.getComputedTop() + f.body.getComputedHeight()).toBe(10)
  })
})

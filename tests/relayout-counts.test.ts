/**
 * Relayout cost of one leaf edit (#26840).
 *
 * The sizing pass used to lay a subtree out for real and then wipe the
 * fingerprints of the whole subtree and every ancestor, so one dirty leaf cost
 * a relayout of every clean row beside it: 405 layoutNode calls on Fx(4,10,2),
 * growing with the size of the clean rows. The sizing pass is now MEASURE-only
 * and answers from the layout cache, so the cost is linear in depth and rows
 * and does not depend on what the clean rows contain.
 *
 * Only the zero engine counts calls; classic has no layout cache.
 *
 * @failure  One dirty leaf relayouts every clean row beside it again: yrd
 *           watch at 220x50 spent 87 ms of layout a second (8,197 layoutNode
 *           calls per pass) on a 1-row update before #26840.
 * @level    l0 (flexily engine, no renderer)
 * @consumer silvery's incremental layout of deep auto-height columns: yrd
 *           watch, its detail pane, km board views
 * @testonly none
 */
import { describe, expect, it } from "vitest"
import { DIRECTION_LTR, Node } from "../src/index.js"
import * as stats from "../src/layout-stats.js"
import { buildNestedColumns, nestedColumnsSpec } from "./nested-columns-fixture.js"

function leafEditCost(depth: number, rows: number, proseBoxes: number) {
  const fx = buildNestedColumns(Node, nestedColumnsSpec(depth, rows, proseBoxes))
  const dirty = fx.labels[rows - 1]!
  fx.root.calculateLayout(220, 50, DIRECTION_LTR)
  for (let warm = 0; warm < 2; warm++) {
    dirty.markDirty()
    fx.root.calculateLayout(220, 50, DIRECTION_LTR)
  }
  dirty.markDirty()
  fx.root.calculateLayout(220, 50, DIRECTION_LTR)
  const cost = { layoutNodeCalls: stats.layoutNodeCalls, measureNodeCalls: stats.measureNodeCalls }
  fx.root.freeRecursive()
  return cost
}

// Derivation of the layoutNode bound, for D >= 2 (each call counts, a cache or
// fingerprint hit included):
// - the root: 1 LAYOUT;
// - column 0: 1 MEASURE (the root's Phase 5b) + 1 LAYOUT = 2;
// - column 1: + 1 MEASURE with an allocated width, from Phase 8 inside
//   column 0's MEASURE = 3;
// - every deeper column: a Phase 5b MEASURE (allocation NaN), a Phase 8 MEASURE
//   (allocated width) that misses, the same Phase 8 MEASURE reached again
//   through the other ancestor MEASURE, which hits, and 1 LAYOUT = 4;
// - the innermost column is measured under both keys, and each visits every
//   row: 2 MEASURE hits; its LAYOUT then re-derives each approximate row in
//   Phase 5b (the flex-basis estimate is approximate), an exact-entry hit; and
//   the row's LAYOUT is a fingerprint hit: a clean row costs 4;
// - the dirty row and its subtree cost a constant 13.
// Total 1 + 2 + 3 + 4(D-2) + 4(K-1) + 13 = 4D + 4K + 7.
const layoutBound = (depth: number, rows: number) => 4 * depth + 4 * rows + 7
// measureNode: 5 per column level and 3 per row plus 2 (measured on the same
// grid; estimates are cached apart from exact entries, so the estimate probes
// of the dirty path miss and every clean row's probes hit).
const measureBound = (depth: number, rows: number) => 5 * depth + 3 * rows + 2

describe("relayout cost of one leaf edit (#26840)", () => {
  it("Fx(4,10,2) costs exactly 63 layoutNode calls (main before #26840: 405)", () => {
    expect(leafEditCost(4, 10, 2).layoutNodeCalls).toBe(63)
  })

  it.each([
    [2, 10],
    [4, 10],
    [6, 10],
    [8, 10],
    [2, 20],
    [4, 20],
    [8, 20],
  ])("Fx(%i,%i,2) stays within 4D+4K+7 layoutNode and 5D+3K+2 measureNode calls", (depth, rows) => {
    const cost = leafEditCost(depth, rows, 2)
    expect(cost.layoutNodeCalls).toBeLessThanOrEqual(layoutBound(depth, rows))
    expect(cost.measureNodeCalls).toBeLessThanOrEqual(measureBound(depth, rows))
  })

  it("the size of the clean rows costs nothing", () => {
    // R=6 has more than twice the nodes of R=2 (145 against 65 at D=4, K=10).
    expect(leafEditCost(4, 10, 6).layoutNodeCalls).toBe(leafEditCost(4, 10, 2).layoutNodeCalls)
  })
})

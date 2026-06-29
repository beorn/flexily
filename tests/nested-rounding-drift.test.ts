/**
 * Regression: nested fractional panes must not drift one column.
 *
 * Edge-based rounding sizes a child from its rounded ABSOLUTE edges
 * (`round(absEnd) - round(absStart)`), but the stored relative position was
 * rounded from the LOCAL offset (`round(fractionalLeft)`). When the parent sits
 * at a fractional absolute position (any nested split), a renderer that
 * reconstructs absolute positions by ACCUMULATING the relative `getComputedLeft`
 * values lands a nested child one column off from the edge its size was rounded
 * against — a 1-col gap from its sibling and a 1-col overflow past its parent
 * (clipped pane chrome). Reported on Hab deck nested split panes around
 * content-width ~90 (bead @si/flexily/20565).
 *
 * Contract (what a correct layout/render reconciliation guarantees): when you
 * walk the tree accumulating relative lefts, every child tiles its parent's
 * content box exactly — last child's right == parent's right, and adjacent
 * children share an edge (no gap, no overlap).
 */
import { describe, expect, test } from "vitest"
import { DIRECTION_LTR, FLEX_DIRECTION_ROW, Node } from "../src/index.js"

/** root[ A | B[ B1 | B2 ] ], all flexGrow:1, row direction. */
function buildNestedSplit(width: number) {
  const root = Node.create()
  root.setWidth(width)
  root.setHeight(10)
  root.setFlexDirection(FLEX_DIRECTION_ROW)
  const A = Node.create()
  A.setFlexGrow(1)
  root.insertChild(A, 0)
  const B = Node.create()
  B.setFlexGrow(1)
  B.setFlexDirection(FLEX_DIRECTION_ROW)
  root.insertChild(B, 1)
  const B1 = Node.create()
  B1.setFlexGrow(1)
  B.insertChild(B1, 0)
  const B2 = Node.create()
  B2.setFlexGrow(1)
  B.insertChild(B2, 1)
  root.calculateLayout(width, 10, DIRECTION_LTR)
  return { root, A, B, B1, B2 }
}

describe("@si/flexily/20565 — nested fractional panes must not drift one column", () => {
  test("nested splits tile exactly under accumulated relative positions (widths 60..130)", () => {
    const drifts: string[] = []
    for (let width = 60; width <= 130; width++) {
      const { root, B, B1, B2 } = buildNestedSplit(width)
      // Renderer-style accumulation of RELATIVE positions down the tree.
      const bAbs = root.getComputedLeft() + B.getComputedLeft()
      const b1Abs = bAbs + B1.getComputedLeft()
      const b2Abs = bAbs + B2.getComputedLeft()
      const bRight = bAbs + B.getComputedWidth()
      const b1Right = b1Abs + B1.getComputedWidth()
      const b2Right = b2Abs + B2.getComputedWidth()
      const overflow = b2Right - bRight // last nested child must reach exactly the parent's right
      const innerGap = b2Abs - b1Right // adjacent nested children must share an edge
      if (overflow !== 0 || innerGap !== 0) {
        drifts.push(`width=${width}: overflow=${overflow} innerGap=${innerGap}`)
      }
    }
    expect(drifts, `nested panes drifted at:\n${drifts.join("\n")}`).toEqual([])
  })

  test("the bead's content-width ~90 case tiles cleanly (width=91)", () => {
    const { root, B, B1, B2 } = buildNestedSplit(91)
    const bAbs = root.getComputedLeft() + B.getComputedLeft()
    const b1Abs = bAbs + B1.getComputedLeft()
    const b2Abs = bAbs + B2.getComputedLeft()
    // B1 then B2 must tile B with no gap and no overflow.
    expect(b1Abs).toBe(bAbs)
    expect(b2Abs).toBe(b1Abs + B1.getComputedWidth()) // no gap/overlap between nested panes
    expect(b2Abs + B2.getComputedWidth()).toBe(bAbs + B.getComputedWidth()) // no overflow past parent
  })
})

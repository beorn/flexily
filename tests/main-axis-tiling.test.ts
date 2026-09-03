/**
 * Main-axis tiling invariant.
 *
 * A shrinking row hands its children fractional main-axis sizes, and the
 * rounding that turns those into integer cells has one job: adjacent siblings
 * must still tile. `child[i].left + child[i].width === child[i + 1].left`, with
 * no overlap and no unowned hole, at every container width.
 *
 * This is the invariant that edge-based rounding exists to provide, and it only
 * holds if each shared edge is rounded by exactly ONE function. Rounding a
 * child's SIZE against `round(absLeft)` while placing it at `floor(absLeft)`
 * breaks it for every child whose absolute start has a fractional part past 0.5
 * — the child lands one cell left of the edge its width was measured against.
 * The break is non-monotonic in container width, because which children are
 * past 0.5 changes as the deficit is redistributed, so a single hand-picked
 * width proves nothing. Hence the sweep.
 *
 * The consumer-visible harm is silent content loss: on a cell grid the later
 * sibling paints over the overlapped cell, and for elided text that cell holds
 * the "…", so the text is cut with no marker left to show it.
 *
 * The row deliberately MIXES measureFunc leaves with plain boxes. Rounding that
 * varies by node type cannot tile a mixed row no matter which function each
 * type picks, since the two nodes sharing an edge disagree about it.
 */
import { describe, expect, it } from "vitest"
import { DIRECTION_LTR, FLEX_DIRECTION_ROW, Node } from "../src/index.js"

/** Natural widths, alternating leaf / box / leaf / box … */
const NATURAL = [3, 1, 2, 1, 4, 1, 6, 1, 3, 1, 12]
const TOTAL_NATURAL = NATURAL.reduce((a, b) => a + b, 0)
/** Every child floors at 1 cell, so the row's own minimum is one cell each. */
const MIN_ROW = NATURAL.length

function buildRow(containerWidth: number): { root: Node; children: Node[] } {
  const root = Node.create()
  root.setWidth(containerWidth)
  root.setHeight(1)
  root.setFlexDirection(FLEX_DIRECTION_ROW)

  const children: Node[] = []
  for (const [index, natural] of NATURAL.entries()) {
    const child = Node.create()
    child.setHeight(1)
    child.setFlexShrink(1)
    child.setFlexGrow(0)
    child.setMinWidth(1)
    if (index % 2 === 0) {
      // measureFunc leaf — the "text" shape
      child.setMeasureFunc((width) => ({ width: Math.min(natural, width), height: 1 }))
    } else {
      child.setWidth(natural)
    }
    root.insertChild(child, index)
    children.push(child)
  }

  root.calculateLayout(containerWidth, 1, DIRECTION_LTR)
  return { root, children }
}

function tilingReport(containerWidth: number): string | null {
  const { children } = buildRow(containerWidth)
  const problems: string[] = []
  if (children[0]!.getComputedLeft() !== 0) {
    problems.push(`first child starts at ${children[0]!.getComputedLeft()}, expected 0`)
  }
  for (let i = 0; i < children.length - 1; i++) {
    const left = children[i]!.getComputedLeft()
    const right = left + children[i]!.getComputedWidth()
    const nextLeft = children[i + 1]!.getComputedLeft()
    if (right !== nextLeft) {
      problems.push(
        right > nextLeft
          ? `child ${i} ends at ${right} but child ${i + 1} starts at ${nextLeft} (overlap of ${right - nextLeft})`
          : `child ${i} ends at ${right} but child ${i + 1} starts at ${nextLeft} (hole of ${nextLeft - right})`,
      )
    }
  }
  const last = children[children.length - 1]!
  const rowRight = last.getComputedLeft() + last.getComputedWidth()
  if (rowRight > containerWidth) {
    problems.push(`row ends at ${rowRight}, past the container's ${containerWidth}`)
  }
  return problems.length > 0 ? problems.join("; ") : null
}

describe("main-axis tiling across a container-width sweep", () => {
  it("adjacent siblings tile exactly at every width from one-cell-each to natural", () => {
    const broken: string[] = []
    for (let width = MIN_ROW; width <= TOTAL_NATURAL + 20; width++) {
      const report = tilingReport(width)
      if (report) broken.push(`w=${width}: ${report}`)
    }
    expect(
      broken,
      `main-axis tiling broke at ${broken.length} of ${TOTAL_NATURAL + 21 - MIN_ROW} swept widths:\n${broken.join("\n")}`,
    ).toEqual([])
  })

  it("every cell of the container belongs to exactly one child while the row is shrinking", () => {
    // Widths below the natural total are the shrinking regime — the one that
    // produces fractional sizes and therefore exercises the rounding.
    for (let width = MIN_ROW; width < TOTAL_NATURAL; width++) {
      const { children } = buildRow(width)
      const total = children.reduce((sum, child) => sum + child.getComputedWidth(), 0)
      expect(total, `widths at container ${width} sum to ${total}`).toBe(width)
    }
  })
})

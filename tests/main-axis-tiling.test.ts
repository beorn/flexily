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
import { DIRECTION_LTR, FLEX_DIRECTION_COLUMN, FLEX_DIRECTION_ROW, Node, OVERFLOW_HIDDEN } from "../src/index.js"

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

/**
 * A child's committed main-axis box must stay inside the box its PARENT
 * committed, because that parent is what clips it when it overflows.
 *
 * A wrapper apportions its content against the size it committed, so the child
 * it measures never asks for more than that budget. The committed box is a
 * different question: if the child's own float edge is rounded
 * (`round(floatStart + size) - round(floatStart)`) while the parent's edge was
 * rounded from the parent's float origin, the parent's fractional part can push
 * the child's rounded end one cell past the parent's committed end. The parent
 * then clips that cell, and for elided text the clipped cell is the one holding
 * the "…" — the elision becomes a silent drop.
 *
 * The shape swept here is a breadcrumb: Box-wrapped truncating text, each
 * segment in a `minWidth: 0, flexShrink: 1, overflow: hidden` wrapper with a
 * one-cell separator between segments.
 */
const SEGMENTS = ["@hh", "km", "apps", "maddoc", "src", "file-app.tsx"]

function buildBreadcrumb(rowWidth: number, containerWidth: number): { wrappers: Node[]; leaves: Node[] } {
  const root = Node.create()
  root.setWidth(containerWidth)
  root.setHeight(1)
  root.setFlexDirection(FLEX_DIRECTION_COLUMN)

  const row = Node.create()
  row.setWidth(rowWidth)
  row.setHeight(1)
  row.setFlexDirection(FLEX_DIRECTION_ROW)
  row.setOverflow(OVERFLOW_HIDDEN)
  root.insertChild(row, 0)

  const wrappers: Node[] = []
  const leaves: Node[] = []
  let index = 0
  SEGMENTS.forEach((segment, i) => {
    if (i > 0) {
      const separator = Node.create()
      separator.setHeight(1)
      separator.setMeasureFunc((width) => ({ width: Math.min(1, width), height: 1 }))
      row.insertChild(separator, index++)
    }
    const wrapper = Node.create()
    wrapper.setHeight(1)
    wrapper.setFlexShrink(1)
    wrapper.setMinWidth(0)
    wrapper.setOverflow(OVERFLOW_HIDDEN)
    row.insertChild(wrapper, index++)
    const leaf = Node.create()
    leaf.setHeight(1)
    leaf.setMeasureFunc((width) => ({ width: Math.min(segment.length, width), height: 1 }))
    wrapper.insertChild(leaf, 0)
    wrappers.push(wrapper)
    leaves.push(leaf)
  })
  root.calculateLayout(containerWidth, 1, DIRECTION_LTR)
  return { wrappers, leaves }
}

describe("a committed child box stays inside the parent that clips it", () => {
  it("keeps every truncating segment inside its own wrapper at every swept width", () => {
    const broken: string[] = []
    for (let containerWidth = 4; containerWidth <= 80; containerWidth++) {
      for (let rowWidth = 2; rowWidth <= 24; rowWidth++) {
        const { wrappers, leaves } = buildBreadcrumb(rowWidth, containerWidth)
        wrappers.forEach((wrapper, i) => {
          const boxWidth = wrapper.getComputedWidth()
          const leafLeft = leaves[i]!.getComputedLeft()
          const leafRight = leafLeft + leaves[i]!.getComputedWidth()
          if (leafRight > boxWidth) {
            broken.push(
              `row=${rowWidth} container=${containerWidth} ${SEGMENTS[i]}: box=0..${boxWidth}, leaf=${leafLeft}..${leafRight}`,
            )
          }
        })
      }
    }
    expect(
      broken.slice(0, 20),
      `a committed child box escaped its wrapper at ${broken.length} of the swept shapes:\n${broken.slice(0, 20).join("\n")}`,
    ).toEqual([])
  })
})

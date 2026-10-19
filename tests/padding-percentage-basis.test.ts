/**
 * Percentage padding resolves against the CONTAINING BLOCK's width for every
 * edge, horizontal and vertical (CSS2 §8.4). A box whose own width differs from
 * its containing block is the case that distinguishes the two bases; the
 * existing yoga-comparison percent case uses a square root and cannot.
 *
 * #30346: before this, a definite-width child resolved its vertical padding
 * against its own width, so the same 25% produced 5/side at width 20 and
 * 10/side at width 40 inside the same 40-column parent.
 */
import { expect, it } from "vitest"
import { DIRECTION_LTR, EDGE_BOTTOM, EDGE_TOP, FLEX_DIRECTION_COLUMN, Node } from "../src/index.js"

function verticalPadding(childWidth: number): number {
  const root = Node.create()
  root.setWidth(40)
  root.setFlexDirection(FLEX_DIRECTION_COLUMN)

  const child = Node.create()
  child.setWidth(childWidth)
  child.setPaddingPercent(EDGE_TOP, 25)
  child.setPaddingPercent(EDGE_BOTTOM, 25)

  const content = Node.create()
  content.setHeight(1)

  child.insertChild(content, 0)
  root.insertChild(child, 0)
  root.calculateLayout(40, NaN, DIRECTION_LTR)

  const top = child.getComputedPadding(EDGE_TOP)
  const bottom = child.getComputedPadding(EDGE_BOTTOM)
  expect(top).toBe(bottom)
  root.freeRecursive()
  return top
}

it("resolves vertical padding percentages against the containing-block width", () => {
  // 25% of the 40-column parent, not of the child's own width.
  expect(verticalPadding(20)).toBe(10)
  expect(verticalPadding(40)).toBe(10)
})

it("keeps the laid-out height at content plus the containing-block percentage", () => {
  const root = Node.create()
  root.setWidth(40)
  root.setFlexDirection(FLEX_DIRECTION_COLUMN)

  const child = Node.create()
  child.setWidth(20)
  child.setPaddingPercent(EDGE_TOP, 25)
  child.setPaddingPercent(EDGE_BOTTOM, 25)

  const content = Node.create()
  content.setHeight(1)

  child.insertChild(content, 0)
  root.insertChild(child, 0)
  root.calculateLayout(40, NaN, DIRECTION_LTR)

  expect(child.layout.height).toBe(21)
  root.freeRecursive()
})

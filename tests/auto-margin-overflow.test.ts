/**
 * @si/content/22774 — does an auto margin give `safe center` semantics?
 *
 * CSS auto margins absorb POSITIVE free space, which centres an item, and
 * resolve to ZERO when free space is negative, which leaves it start-aligned.
 * That pair is exactly what CSS Box Alignment 3 later named `safe center`.
 *
 * Silvery needs this for a table row that is wider than its container: today
 * the row is centred with `alignSelf`, and centring an OVERFLOWING item pushes
 * it past both edges, so the first column loses its head and the last loses its
 * tail while the middle looks intact. Auto margins would fix that with no new
 * alignment vocabulary — IF the engine resolves them to zero under negative
 * free space rather than to a negative offset.
 *
 * This test answers that question directly at the engine, before anything is
 * plumbed through silvery's prop surface. Written because silvery's BoxProps
 * types margins as `number`, so the behaviour cannot be observed from above.
 */

import { describe, expect, test } from "vitest"
import { createFlexily } from "../src/index.ts"
import { EDGE_LEFT, EDGE_RIGHT, FLEX_DIRECTION_COLUMN } from "../src/constants.ts"

const CONTAINER = 20

/** Lay out one child of `childWidth` inside a `CONTAINER`-wide column, with auto side margins. */
function childLeftEdge(childWidth: number): number {
  const flex = createFlexily()
  const root = flex.createNode()
  root.setWidth(CONTAINER)
  root.setHeight(10)
  root.setFlexDirection(FLEX_DIRECTION_COLUMN)

  const child = flex.createNode()
  child.setWidth(childWidth)
  child.setHeight(1)
  child.setMarginAuto(EDGE_LEFT)
  child.setMarginAuto(EDGE_RIGHT)
  root.insertChild(child, 0)

  flex.calculateLayout(root, CONTAINER, 10)
  return child.getComputedLeft()
}

describe("@si/content/22774 — auto margins as safe-center", () => {
  test("a child that FITS is centred by auto margins", () => {
    // 20-wide container, 10-wide child -> 10 free -> 5 each side.
    expect(childLeftEdge(10)).toBe(5)
  })

  test("a child that OVERFLOWS starts at the container edge, not past it", () => {
    // 20-wide container, 28-wide child -> free space is NEGATIVE.
    // Centring would put left at -4. Safe behaviour is 0.
    expect(childLeftEdge(28)).toBe(0)
  })
})

/**
 * @failure  align-items on a wrapping container aligns each item against the
 *           container's cross size instead of its own flex line's cross size.
 *           With a definite cross size every line gets the container-sized
 *           offset added on top of its line offset; with a hug cross size the
 *           line offsets additionally come out 0, so the lines land on top of
 *           each other. align-content is correct and align-items: flex-start
 *           is unaffected, so only center/flex-end/baseline show it
 *           (CSS Flexbox 9.6). Reported externally as beorn/flexily#5 by
 *           @clearly-outsane, with Chrome 152 reference geometry.
 * @level    l0 (flexily engine, no renderer)
 * @consumer any wrapped row or column using align-items center/flex-end: every
 *           silvery card grid that wraps
 * @testonly none
 */
import { describe, expect, it } from "vitest"
import {
  ALIGN_CENTER,
  ALIGN_FLEX_START,
  DIRECTION_LTR,
  FLEX_DIRECTION_ROW,
  GUTTER_ALL,
  Node,
  WRAP_WRAP,
} from "../src/index.js"

describe("align-items uses the flex line's cross size when flex-wrap is wrap (#5)", () => {
  function layout(heights: number[], containerHeight: number | undefined) {
    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setFlexWrap(WRAP_WRAP)
    root.setGap(GUTTER_ALL, 8)
    root.setAlignItems(ALIGN_CENTER)
    root.setAlignContent(ALIGN_FLEX_START)
    root.setWidth(300)
    if (containerHeight !== undefined) root.setHeight(containerHeight)

    for (let i = 0; i < heights.length; i++) {
      const child = Node.create()
      child.setFlexShrink(0)
      child.setFlexGrow(0)
      child.setWidth(100)
      child.setHeight(heights[i]!)
      root.insertChild(child, i)
    }

    root.calculateLayout(300, containerHeight, DIRECTION_LTR)
    return {
      height: Math.round(root.getComputedHeight()),
      tops: heights.map((_, i) => Math.round(root.getChild(i)!.getComputedTop())),
    }
  }

  // Expected values are Chrome 152's reported geometry for the equivalent CSS,
  // supplied by the reporter of beorn/flexily#5 - measured, not derived from
  // flexily's own output.

  it("centers wrapped items inside their own line when the cross size is a hug", () => {
    expect(layout([50, 50, 50, 50], undefined)).toEqual({ height: 108, tops: [0, 0, 58, 58] })
  })

  it("centers wrapped items inside their own line when the cross size is definite", () => {
    expect(layout([50, 50, 50, 50], 200)).toEqual({ height: 200, tops: [0, 0, 58, 58] })
  })

  it("centers a shorter item inside its own line's cross size", () => {
    expect(layout([50, 20, 50, 20], undefined)).toEqual({ height: 108, tops: [0, 15, 58, 73] })
  })
})

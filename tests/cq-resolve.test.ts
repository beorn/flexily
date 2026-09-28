/**
 * A0.1 — Pass 2 resolution of CQ units in descendants.
 *
 * Validates the consumption side of the two-phase layout: a node with a
 * cqi/cqmin value resolves against the nearest CQ ancestor's frozen size
 * (set by Pass 1) — not against parent or available.
 *
 * Scope of this commit: node's OWN width/height resolution. Padding,
 * margin, position, and child main/cross-axis constraint resolution land
 * in Pass 2b (next commit).
 *
 * The walk skips self (a CQ container's own width does NOT resolve against
 * its OWN frozen size — it resolves against its parent's CQ context, with
 * the layout root providing the implicit fallback).
 */
import { describe, expect, test } from "vitest"
import * as C from "../src/constants.js"
import { createFlexily } from "../src/index.js"

describe("[A0.1 Pass 2] CQ descendant resolution — width/height", () => {
  test("shrinking a CQ container refreshes cqi in a nested descendant", () => {
    function build(width: number) {
      const flex = createFlexily()
      const cq = flex.createNode()
      cq.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
      cq.setWidth(width)

      const box = flex.createNode()
      box.setWidth(30)
      const leaf = flex.createNode()
      leaf.setWidthCqi(10)
      box.insertChild(leaf, 0)
      cq.insertChild(box, 0)
      return { flex, cq, leaf }
    }

    const reused = build(200)
    reused.flex.calculateLayout(reused.cq, 200, 100)
    expect(reused.leaf.getComputedWidth()).toBe(20)

    reused.cq.setWidth(100)
    reused.flex.calculateLayout(reused.cq, 100, 100)

    const fresh = build(100)
    fresh.flex.calculateLayout(fresh.cq, 100, 100)
    expect(reused.leaf.getComputedWidth()).toBe(fresh.leaf.getComputedWidth())
    expect(reused.leaf.getComputedWidth()).toBe(10)
  })

  test("child setWidthCqi(50) resolves against CQ ancestor's frozen 200 → 100", () => {
    const flex = createFlexily()
    const cq = flex.createNode()
    cq.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    cq.setWidth(200)

    const child = flex.createNode()
    child.setWidthCqi(50) // 50% of 200 = 100

    cq.insertChild(child, 0)
    flex.calculateLayout(cq, 200, 100)

    expect(child.getComputedWidth()).toBe(100)
  })

  test("child setWidthCqi(100) resolves to full CQ inline-size", () => {
    const flex = createFlexily()
    const cq = flex.createNode()
    cq.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    cq.setWidth(88)

    const child = flex.createNode()
    child.setWidthCqi(100)

    cq.insertChild(child, 0)
    flex.calculateLayout(cq, 88, 100)

    expect(child.getComputedWidth()).toBe(88)
  })

  test("child setHeightCqi(50) resolves against CQ ancestor's inline-size", () => {
    // CSS: `height: 50cqi` is 50% of CQ container's INLINE-SIZE (still inline, used as height).
    const flex = createFlexily()
    const cq = flex.createNode()
    cq.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    cq.setWidth(160)
    cq.setHeight(200)

    const child = flex.createNode()
    child.setHeightCqi(50) // 50% of 160 = 80

    cq.insertChild(child, 0)
    flex.calculateLayout(cq, 160, 200)

    expect(child.getComputedHeight()).toBe(80)
  })

  test("deep descendant resolves against NEAREST CQ ancestor (not outermost)", () => {
    const flex = createFlexily()
    const outer = flex.createNode()
    outer.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    outer.setWidth(200)

    const middle = flex.createNode()
    middle.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    middle.setWidth(80)

    const child = flex.createNode()
    child.setWidthCqi(50) // 50% of NEAREST = 80 → 40 (not 100 from outer)

    outer.insertChild(middle, 0)
    middle.insertChild(child, 0)
    flex.calculateLayout(outer, 200, 100)

    expect(child.getComputedWidth()).toBe(40)
  })

  test("descendant without explicit CQ ancestor resolves against the layout root inline-size", () => {
    const flex = createFlexily()
    const parent = flex.createNode()
    parent.setWidth(150)

    const child = flex.createNode()
    child.setWidthCqi(50) // Implicit root: 50% of 150 = 75, despite available width 200

    parent.insertChild(child, 0)
    flex.calculateLayout(parent, 200, 100)

    expect(child.getComputedWidth()).toBe(75)
  })

  test("CQ container's OWN cqi width resolves against its PARENT's CQ context (not self)", () => {
    // Outer is a CQ container at width 200. Inner is ALSO a CQ container with
    // width 50cqi — that resolves against OUTER's frozen 200 → 100. Inner is
    // then a CQ container at frozen 100 for its descendants.
    const flex = createFlexily()
    const outer = flex.createNode()
    outer.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    outer.setWidth(200)

    const inner = flex.createNode()
    inner.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    inner.setWidthCqi(50) // 50% of outer 200 = 100

    outer.insertChild(inner, 0)
    flex.calculateLayout(outer, 200, 100)

    expect(inner.getComputedWidth()).toBe(100)
    expect(inner.getFrozenQuerySize()).toBe(100)
  })

  test("cqmin and cqi resolve identically in Phase 1 (1D containment)", () => {
    const flex = createFlexily()
    const cq = flex.createNode()
    cq.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    cq.setWidth(120)

    // Create two children — one cqi, one cqmin — same percentage. Expect same width.
    const childA = flex.createNode()
    childA.setWidthCqi(50)
    const childB = flex.createNode()
    childB.setWidthCqi(50) // same as cqmin would resolve in 1D
    // Direct construction of UNIT_CQMIN for childB via setter — flexily exposes
    // setWidthCqi only; UNIT_CQMIN reaches via direct style mutation in tests.
    childB.style.width = { value: 50, unit: C.UNIT_CQMIN }

    cq.insertChild(childA, 0)
    cq.insertChild(childB, 1)
    flex.calculateLayout(cq, 200, 100)

    expect(childA.getComputedWidth()).toBe(childB.getComputedWidth())
    expect(childA.getComputedWidth()).toBe(60) // 50% of 120
  })
})

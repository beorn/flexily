/**
 * A0.1 — Pass 2 resolution of CQ units in descendants.
 *
 * Validates the consumption side of the two-phase layout: a node with a
 * cqi/cqmin value resolves against the nearest CQ ancestor's frozen size
 * (set by Pass 1) — not against parent or available.
 *
 * Covers dimensions and spacing against the owning node's query context.
 *
 * The walk skips self (a CQ container's own width does NOT resolve against
 * its OWN frozen size — it resolves against its parent's CQ context, with
 * the layout root providing the implicit fallback).
 */
import { describe, expect, test } from "vitest"
import * as C from "../src/constants.js"
import { createFlexily, LengthError, parseLength } from "../src/index.js"

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

/**
 * @failure Container-relative spacing produces invalid coordinates or retains
 * a previous container width after resize (26237).
 * @level l0
 * @consumer Production Flexily callers setting padding, margin, border or gap.
 */
describe("[26237] CQ spacing ownership and resize", () => {
  test.each(["number", "cqi"] as const)("%s spacing uses the owner's ancestor context", (kind) => {
    const flex = createFlexily()
    const root = flex.createNode()
    root.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    root.setHeight(80)

    const box = flex.createNode()
    box.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    box.setWidth(100)
    box.setHeight(40)
    const spacing = (points: number, cqi: number) => (kind === "number" ? points : { value: cqi, unit: C.UNIT_CQI })
    box.setMargin(C.EDGE_LEFT, spacing(20, 10))
    box.setPadding(C.EDGE_LEFT, spacing(20, 10))
    box.setBorder(C.EDGE_LEFT, spacing(4, 2))
    box.setGap(C.GUTTER_COLUMN, spacing(10, 5))

    const first = flex.createNode()
    const second = flex.createNode()
    for (const child of [first, second]) {
      child.setWidth(10)
      child.setHeight(10)
    }
    box.insertChild(first, 0)
    box.insertChild(second, 1)
    root.insertChild(box, 0)

    try {
      for (const width of [200, 100]) {
        root.setWidth(width)
        flex.calculateLayout(root, width, 80)
        // These are independent arithmetic expectations, not fresh/reused
        // comparisons: both executions could otherwise share a wrong context.
        const expected = kind === "number" || width === 200 ? [20, 24, 44] : [10, 12, 27]
        expect([box.getComputedLeft(), first.getComputedLeft(), second.getComputedLeft()]).toEqual(expected)
        expect(box.getComputedMargin(C.EDGE_LEFT)).toBe(kind === "number" ? 20 : width / 10)
        expect(box.getComputedPadding(C.EDGE_LEFT)).toBe(kind === "number" ? 20 : width / 10)
        expect(box.getComputedBorder(C.EDGE_LEFT)).toBe(kind === "number" ? 4 : width / 50)
      }
    } finally {
      root.freeRecursive()
    }
  })
})

/**
 * @failure CQ spacing is missing from intrinsic/fit-width or absolute consumers (26237).
 * @level l0
 * @consumer Flexily callers using intrinsic sizing and absolute children.
 */
describe("[26237] CQ spacing consumers", () => {
  test("intrinsic and fit-width spacing refresh against the ancestor after resize", () => {
    const flex = createFlexily()
    const root = flex.createNode()
    root.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    root.setAlignItems(C.ALIGN_FLEX_START)
    const box = flex.createNode()
    box.setFitWidth([40, 80])
    box.setPadding(C.EDGE_LEFT, { value: 10, unit: C.UNIT_CQI })
    box.setBorder(C.EDGE_LEFT, { value: 5, unit: C.UNIT_CQI })
    box.setGap(C.GUTTER_COLUMN, { value: 5, unit: C.UNIT_CQI })
    root.insertChild(box, 0)
    const first = flex.createNode()
    const second = flex.createNode()
    for (const child of [first, second]) {
      child.setWidth(10)
      child.setHeight(10)
      box.insertChild(child, box.getChildCount())
    }
    try {
      for (const [width, boxWidth, firstLeft, secondLeft, intrinsic] of [
        [200, 80, 30, 50, 60],
        [100, 40, 15, 30, 40],
      ] as const) {
        root.setWidth(width)
        flex.calculateLayout(root, width, 80)
        expect([box.getComputedWidth(), first.getComputedLeft(), second.getComputedLeft()]).toEqual([
          boxWidth,
          firstLeft,
          secondLeft,
        ])
        expect(box.getMinContent(C.FLEX_DIRECTION_ROW)).toBe(intrinsic)
      }
    } finally {
      root.freeRecursive()
    }
  })

  test("absolute logical margin uses the parent query and refreshes on resize", () => {
    const flex = createFlexily()
    const root = flex.createNode()
    root.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    const child = flex.createNode()
    child.setPositionType(C.POSITION_TYPE_ABSOLUTE)
    child.setPosition(C.EDGE_LEFT, 0)
    child.setWidth(20)
    child.setHeight(10)
    child.setMargin(C.EDGE_START, { value: 10, unit: C.UNIT_CQI })
    root.insertChild(child, 0)
    try {
      for (const width of [200, 100]) {
        root.setWidth(width)
        flex.calculateLayout(root, width, 80)
        expect(child.getComputedLeft()).toBe(width / 10)
      }
    } finally {
      root.freeRecursive()
    }
  })
})

/**
 * @failure A grouped spacing setter partly mutates before an axis refusal or strips a stored unit (26237).
 * @level l0
 * @consumer Public spacing setters and numeric style getters.
 */
describe("[26237] spacing Value boundaries", () => {
  test("all-edge and all-gutter axis refusals leave the prior numeric style intact", () => {
    const node = createFlexily().createNode()
    try {
      node.setPadding(C.EDGE_ALL, 3)
      node.setMargin(C.EDGE_ALL, 4)
      node.setBorder(C.EDGE_ALL, 2)
      node.setGap(C.GUTTER_ALL, 5)
      const inline = parseLength("2ch", { ch: 1, lh: 1 })
      expect(() => node.setPadding(C.EDGE_ALL, inline)).toThrow(LengthError)
      expect(() => node.setMargin(C.EDGE_ALL, inline)).toThrow(LengthError)
      expect(() => node.setBorder(C.EDGE_ALL, inline)).toThrow(LengthError)
      expect(() => node.setGap(C.GUTTER_ALL, inline)).toThrow(LengthError)
      expect(node.getPadding(C.EDGE_LEFT)).toEqual({ value: 3, unit: C.UNIT_POINT })
      expect(node.getMargin(C.EDGE_LEFT)).toEqual({ value: 4, unit: C.UNIT_POINT })
      expect(node.getBorder(C.EDGE_LEFT)).toBe(2)
      expect(node.getGap(C.GUTTER_COLUMN)).toBe(5)
      expect(() => node.setPadding(C.EDGE_LEFT, parseLength("2lh", { ch: 1, lh: 1 }))).toThrow(LengthError)
      expect(() => node.setGap(C.GUTTER_ROW, { value: 10, unit: C.UNIT_CQI })).toThrow(LengthError)
    } finally {
      node.free()
    }
  })

  test("border percentages refuse, while numeric defaults and non-point getter diagnostics remain explicit", () => {
    const node = createFlexily().createNode()
    try {
      expect(node.getBorder(C.EDGE_START)).toBeNaN()
      expect(node.getGap(C.GUTTER_COLUMN)).toBe(0)
      expect(() => node.setBorder(C.EDGE_LEFT, { value: 10, unit: C.UNIT_PERCENT })).toThrow(LengthError)
      expect(() => node.setBorder(C.EDGE_LEFT, parseLength("calc(10% + 2ch)", { ch: 1, lh: 1 }))).toThrow(LengthError)
      node.setBorder(C.EDGE_LEFT, { value: 5, unit: C.UNIT_CQI })
      node.setGap(C.GUTTER_COLUMN, { value: 5, unit: C.UNIT_CQI })
      expect(() => node.getBorder(C.EDGE_LEFT)).toThrow(/getBorder:.*node.style.border/)
      expect(() => node.getGap(C.GUTTER_COLUMN)).toThrow(/getGap:.*node.style.gap/)
    } finally {
      node.free()
    }
  })
})

/**
 * @failure Leaf exits discard the root query width or RTL direction used by computed spacing getters (26237).
 * @level l0
 * @consumer Callers reading computed CQ spacing on empty or measured leaf nodes.
 */
describe("[26237] leaf spacing context", () => {
  test.each([false, true])("root leaf computed spacing retains the supplied viewport, measured=%s", (measured) => {
    const flex = createFlexily()
    const root = flex.createNode()
    root.setPadding(C.EDGE_LEFT, { value: 10, unit: C.UNIT_CQI })
    root.setBorder(C.EDGE_LEFT, { value: 5, unit: C.UNIT_CQI })
    if (measured) root.setMeasureFunc(() => ({ width: 20, height: 10 }))
    try {
      for (const width of [200, 100]) {
        flex.calculateLayout(root, width, 80)
        expect(root.getComputedPadding(C.EDGE_LEFT)).toBe(width / 10)
        expect(root.getComputedBorder(C.EDGE_LEFT)).toBe(width / 20)
        if (!measured) expect(root.getMinContent(C.FLEX_DIRECTION_ROW)).toBe(width * 0.15)
      }
    } finally {
      root.free()
    }
  })

  test("RTL child leaf computed border keeps the direction used by layout", () => {
    const flex = createFlexily()
    const root = flex.createNode()
    root.setWidth(200)
    const child = flex.createNode()
    child.setWidth(50)
    child.setHeight(20)
    child.setBorder(C.EDGE_START, { value: 10, unit: C.UNIT_CQI })
    root.insertChild(child, 0)
    try {
      flex.calculateLayout(root, 200, 80, C.DIRECTION_RTL)
      expect(child.getComputedBorder(C.EDGE_LEFT)).toBe(0)
      expect(child.getComputedBorder(C.EDGE_RIGHT)).toBe(20)
    } finally {
      root.freeRecursive()
    }
  })
})

/**
 * @failure Computed spacing getters lose the existing aggregate left-edge fallback (26237).
 * @level l0
 * @consumer Existing numeric spacing getter callers, including the public API guide.
 */
test("[26237] numeric aggregate computed getters keep their left-edge fallback", () => {
  const flex = createFlexily()
  const root = flex.createNode()
  root.setPadding(C.EDGE_ALL, 3)
  root.setMargin(C.EDGE_ALL, 4)
  root.setBorder(C.EDGE_ALL, 2)
  try {
    flex.calculateLayout(root, 100, 40)
    expect(root.getComputedPadding(C.EDGE_ALL)).toBe(3)
    expect(root.getComputedMargin(C.EDGE_ALL)).toBe(4)
    expect(root.getComputedBorder(C.EDGE_ALL)).toBe(2)
    expect(root.getComputedBorder(C.EDGE_START)).toBeNaN()
    root.setBorder(C.EDGE_START, 7)
    root.setBorder(C.EDGE_START, NaN)
    flex.calculateLayout(root, 100, 40)
    expect(root.getComputedBorder(C.EDGE_LEFT)).toBe(2)
    expect(root.getBorder(C.EDGE_START)).toBeNaN()
  } finally {
    root.free()
  }
})

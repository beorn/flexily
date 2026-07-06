/**
 * A0.1 — Pass 1 freeze of container-query inline-size.
 *
 * Validates that `layoutNode` captures a CQ container's inline-size BEFORE
 * descending into child layout, exposing it via `node.getFrozenQuerySize()`.
 *
 * What this commit ships:
 *
 *   - `CONTAINER_TYPE_INLINE_SIZE` flag triggers freeze
 *   - `CONTAINER_TYPE_NORMAL` (default) leaves the freeze cleared (NaN)
 *   - Frozen size equals the constraint-derived inline-size (not post-
 *     shrink-wrap from children)
 *   - Nested CQ containers each freeze independently
 *
 * What lands next (Pass 2 consumption):
 *
 *   - Descendants resolve their own `cqi`/`cqmin` against the nearest CQ
 *     ancestor's frozen size via `findContainerQuerySize` (a parent-walk
 *     traversal helper).
 *
 * Until Pass 2 lands, the freeze is observable but unconsumed: cqi values
 * on children continue to resolve to 0 (no ancestor walk yet).
 */
import { describe, expect, test } from "vitest"
import * as C from "../src/constants.js"
import { createFlexily } from "../src/index.js"

describe("[A0.1 Pass 1] CQ container freeze", () => {
  test("default node has no freeze (NaN)", () => {
    const flex = createFlexily()
    const node = flex.createNode()
    node.setWidth(200)
    flex.calculateLayout(node, 200, 100)
    expect(node.getFrozenQuerySize()).toBeNaN()
  })

  test("CONTAINER_TYPE_INLINE_SIZE freezes node's inline-size after layout", () => {
    const flex = createFlexily()
    const node = flex.createNode()
    node.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    node.setWidth(160)
    flex.calculateLayout(node, 200, 100)
    expect(node.getFrozenQuerySize()).toBe(160)
  })

  test("setContainerType(NORMAL) clears prior freeze on re-layout", () => {
    const flex = createFlexily()
    const node = flex.createNode()
    node.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    node.setWidth(100)
    flex.calculateLayout(node, 200, 100)
    expect(node.getFrozenQuerySize()).toBe(100)

    node.setContainerType(C.CONTAINER_TYPE_NORMAL)
    flex.calculateLayout(node, 200, 100)
    expect(node.getFrozenQuerySize()).toBeNaN()
  })

  test("CQ container with percent width freezes resolved value", () => {
    const flex = createFlexily()
    const parent = flex.createNode()
    parent.setWidth(200)

    const cqContainer = flex.createNode()
    cqContainer.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    cqContainer.setWidthPercent(50) // 50% of 200 = 100

    parent.insertChild(cqContainer, 0)
    flex.calculateLayout(parent, 200, 100)

    expect(cqContainer.getFrozenQuerySize()).toBe(100)
  })

  test("nested CQ containers each freeze independently", () => {
    const flex = createFlexily()
    const outer = flex.createNode()
    outer.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    outer.setWidth(200)

    const inner = flex.createNode()
    inner.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    inner.setWidth(100)

    outer.insertChild(inner, 0)
    flex.calculateLayout(outer, 200, 100)

    expect(outer.getFrozenQuerySize()).toBe(200)
    expect(inner.getFrozenQuerySize()).toBe(100)
  })

  test("non-CQ child of CQ container does NOT get its own freeze (remains NaN)", () => {
    const flex = createFlexily()
    const cq = flex.createNode()
    cq.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    cq.setWidth(160)

    const child = flex.createNode()
    child.setWidth(80)

    cq.insertChild(child, 0)
    flex.calculateLayout(cq, 200, 100)

    expect(cq.getFrozenQuerySize()).toBe(160)
    expect(child.getFrozenQuerySize()).toBeNaN()
  })

  test("freeze updates when CQ container is re-laid-out at a different size", () => {
    const flex = createFlexily()
    const node = flex.createNode()
    node.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    node.setWidth(160)
    flex.calculateLayout(node, 200, 100)
    expect(node.getFrozenQuerySize()).toBe(160)

    node.setWidth(240)
    flex.calculateLayout(node, 320, 100)
    expect(node.getFrozenQuerySize()).toBe(240)
  })

  test("CQ container with auto-width (unconstrained) freezes NaN — well-defined dead-end", () => {
    // When a CQ container has no explicit width AND no parent constraint, its
    // inline-size is unknown until shrink-wrap. We freeze NaN. Pass 2's
    // resolveValue(cqi, _, NaN) yields 0, so the user sees collapsed values —
    // they MUST set containSize=true OR set an explicit width to make their
    // CQ container useful. The intrinsic-leak invariant cannot compare sizes
    // until the frozen query size is finite.
    const flex = createFlexily()
    const node = flex.createNode()
    node.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    // No setWidth; calculateLayout with NaN parent → auto-sized.
    flex.calculateLayout(node, NaN, NaN)
    expect(node.getFrozenQuerySize()).toBeNaN()
  })
})

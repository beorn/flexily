/**
 * Tests for measureNode() receiving the correct direction parameter.
 *
 * measureNode() is called during Phase 5 (base size computation) and Phase 7
 * (baseline estimation) without passing the current direction parameter.
 * This means EDGE_START/EDGE_END margins and padding resolve as LTR even
 * when the layout is RTL.
 *
 * The impact is limited because:
 * - Total padding (left + right) is the same regardless of which side it's on
 * - measureNode only computes width/height, not positions
 * - layoutNode (Phase 8) re-computes with correct direction
 *
 * The bug DOES matter when both EDGE_START and a physical edge (EDGE_LEFT)
 * are set to different values, because wrong direction changes which one
 * takes precedence, changing the total padding and thus the baseSize.
 */

import { describe, expect, it } from "vitest"
import {
  DIRECTION_LTR,
  DIRECTION_RTL,
  EDGE_START,
  EDGE_LEFT,
  EDGE_RIGHT,
  FLEX_DIRECTION_ROW,
  Node,
} from "../src/index.js"
import { expectLayout } from "./test-utils.js"

describe("measureNode direction parameter", () => {
  it("measureNode resolves EDGE_START padding correctly in RTL for base size", () => {
    // This test creates a scenario where measureNode's direction affects baseSize:
    // - Container child with EDGE_LEFT=5 AND EDGE_START=20
    // - In LTR: EDGE_START(20) overrides EDGE_LEFT(5) → left=20, right=0 → total=20
    // - In RTL: EDGE_START(20) maps to right, EDGE_LEFT(5) stays → left=5, right=20 → total=25
    //
    // If measureNode uses wrong direction (LTR instead of RTL), it computes
    // total padding = 20 instead of 25, giving wrong baseSize.
    //
    // Two sibling containers compete for space via flex distribution.
    // Wrong baseSize means wrong space distribution.
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(50)
    root.setFlexDirection(FLEX_DIRECTION_ROW)

    // Container 1: asymmetric logical+physical padding
    const c1 = Node.create()
    c1.setPadding(EDGE_LEFT, 5) // Physical: always left
    c1.setPadding(EDGE_START, 20) // Logical: left in LTR, right in RTL
    root.insertChild(c1, 0)

    const leaf1 = Node.create()
    leaf1.setWidth(30)
    leaf1.setHeight(20)
    c1.insertChild(leaf1, 0)

    // Container 2: grows to fill remaining space
    const c2 = Node.create()
    c2.setFlexGrow(1)
    root.insertChild(c2, 1)

    // In RTL: c1 total padding = EDGE_LEFT(5) + EDGE_START→right(20) = 25
    // c1 intrinsic width = 25 + 30 = 55
    // c2 width = 200 - 55 = 145
    root.calculateLayout(200, 50, DIRECTION_RTL)
    expectLayout(c1, { width: 55 })
    expectLayout(c2, { width: 145 })
  })

  it("container child with only EDGE_START padding measures same in both directions", () => {
    // When only EDGE_START is set (no conflicting physical edge), total padding
    // is the same regardless of direction (it just goes on a different side).
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(50)
    root.setFlexDirection(FLEX_DIRECTION_ROW)

    const container = Node.create()
    container.setPadding(EDGE_START, 15)
    root.insertChild(container, 0)

    const leaf = Node.create()
    leaf.setWidth(30)
    leaf.setHeight(20)
    container.insertChild(leaf, 0)

    // In LTR: left padding 15. Width = 15 + 30 = 45.
    root.calculateLayout(200, 50, DIRECTION_LTR)
    const ltrWidth = container.getComputedWidth()

    // In RTL: right padding 15. Width = 30 + 15 = 45. Same total.
    root.calculateLayout(200, 50, DIRECTION_RTL)
    const rtlWidth = container.getComputedWidth()

    expect(ltrWidth).toBe(45)
    expect(rtlWidth).toBe(45)
  })

  it("RTL direction with EDGE_START and EDGE_RIGHT both set on container", () => {
    // EDGE_START in RTL maps to right. If EDGE_RIGHT is also set, EDGE_START
    // takes precedence for the right edge.
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(50)
    root.setFlexDirection(FLEX_DIRECTION_ROW)

    const container = Node.create()
    container.setPadding(EDGE_RIGHT, 5) // Physical: always right
    container.setPadding(EDGE_START, 20) // Logical: right in RTL (overrides EDGE_RIGHT)
    root.insertChild(container, 0)

    const leaf = Node.create()
    leaf.setWidth(30)
    leaf.setHeight(20)
    container.insertChild(leaf, 0)

    // In RTL: EDGE_START(20) overrides EDGE_RIGHT(5) → right=20, left=0 → total=20
    // Width = 30 + 20 = 50
    root.calculateLayout(200, 50, DIRECTION_RTL)
    expectLayout(container, { width: 50 })
  })
})

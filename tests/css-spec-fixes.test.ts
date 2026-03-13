/**
 * Tests for CSS spec compliance fixes:
 * 1. POSITION_TYPE_STATIC should ignore insets (top/left/right/bottom)
 * 2. Flex-wrap line breaking should use hypothetical main size (clamped to min/max)
 * 3. Wrapped auto-sized child containers should contribute to line cross-size
 */
import { describe, expect, it } from "vitest"
import {
  DIRECTION_LTR,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_ROW,
  Node,
  POSITION_TYPE_RELATIVE,
  POSITION_TYPE_STATIC,
  WRAP_WRAP,
  EDGE_LEFT,
  EDGE_TOP,
  EDGE_RIGHT,
  EDGE_BOTTOM,
} from "../src/index.js"
import { expectLayout } from "./test-utils.js"

describe("CSS spec: position static ignores insets", () => {
  it("should ignore top/left offsets for position:static children", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(200)
    root.setFlexDirection(FLEX_DIRECTION_ROW)

    // Child with position:static and insets — insets should be ignored
    const child = Node.create()
    child.setWidth(50)
    child.setHeight(50)
    child.setPositionType(POSITION_TYPE_STATIC)
    child.setPosition(EDGE_LEFT, 10)
    child.setPosition(EDGE_TOP, 20)
    root.insertChild(child, 0)

    root.calculateLayout(200, 200, DIRECTION_LTR)

    // Static children should be at (0, 0) — insets ignored
    expectLayout(child, { left: 0, top: 0, width: 50, height: 50 })
  })

  it("should apply top/left offsets for position:relative children", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(200)
    root.setFlexDirection(FLEX_DIRECTION_ROW)

    // Child with position:relative and insets — insets should apply
    const child = Node.create()
    child.setWidth(50)
    child.setHeight(50)
    child.setPositionType(POSITION_TYPE_RELATIVE)
    child.setPosition(EDGE_LEFT, 10)
    child.setPosition(EDGE_TOP, 20)
    root.insertChild(child, 0)

    root.calculateLayout(200, 200, DIRECTION_LTR)

    // Relative children should be offset by (10, 20)
    expectLayout(child, { left: 10, top: 20, width: 50, height: 50 })
  })

  it("should ignore right/bottom offsets for position:static children", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(200)
    root.setFlexDirection(FLEX_DIRECTION_ROW)

    const child = Node.create()
    child.setWidth(50)
    child.setHeight(50)
    child.setPositionType(POSITION_TYPE_STATIC)
    child.setPosition(EDGE_RIGHT, 10)
    child.setPosition(EDGE_BOTTOM, 20)
    root.insertChild(child, 0)

    root.calculateLayout(200, 200, DIRECTION_LTR)

    // Static children should be at (0, 0) — insets ignored
    expectLayout(child, { left: 0, top: 0, width: 50, height: 50 })
  })

  it("should ignore insets on the parent node itself when position:static", () => {
    // When the parent node (not a child) has position:static,
    // its own position offsets should not affect children's absolute positions
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(200)

    const parent = Node.create()
    parent.setWidth(100)
    parent.setHeight(100)
    parent.setPositionType(POSITION_TYPE_STATIC)
    parent.setPosition(EDGE_LEFT, 15)
    parent.setPosition(EDGE_TOP, 25)
    root.insertChild(parent, 0)

    const child = Node.create()
    child.setWidth(30)
    child.setHeight(30)
    parent.insertChild(child, 0)

    root.calculateLayout(200, 200, DIRECTION_LTR)

    // Parent itself should be at (0, 0) since static ignores offsets
    expectLayout(parent, { left: 0, top: 0, width: 100, height: 100 })
    // Child should be at (0, 0) relative to parent
    expectLayout(child, { left: 0, top: 0, width: 30, height: 30 })
  })
})

describe("CSS spec: flex-wrap uses hypothetical main size", () => {
  it("should use clamped size (hypothetical) for line breaking, not unclamped base size", () => {
    // A child with flexBasis:60 but maxWidth:30 should use 30 for line breaking
    const root = Node.create()
    root.setWidth(100)
    root.setHeight(200)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setFlexWrap(WRAP_WRAP)

    // Child A: baseSize=60, maxWidth=30 → hypothetical=30
    const childA = Node.create()
    childA.setFlexBasis(60)
    childA.setMaxWidth(30)
    childA.setHeight(20)
    root.insertChild(childA, 0)

    // Child B: baseSize=60, maxWidth=30 → hypothetical=30
    const childB = Node.create()
    childB.setFlexBasis(60)
    childB.setMaxWidth(30)
    childB.setHeight(20)
    root.insertChild(childB, 1)

    // Child C: baseSize=60, maxWidth=30 → hypothetical=30
    const childC = Node.create()
    childC.setFlexBasis(60)
    childC.setMaxWidth(30)
    childC.setHeight(20)
    root.insertChild(childC, 2)

    root.calculateLayout(100, 200, DIRECTION_LTR)

    // With hypothetical sizes of 30 each, all three fit on one line (30+30+30 = 90 < 100)
    // With unclamped base sizes of 60, only one fits per line (60+60 = 120 > 100)
    // CSS spec says to use hypothetical — all should be on line 0 (top=0)
    expect(childA.getComputedTop()).toBe(0)
    expect(childB.getComputedTop()).toBe(0)
    expect(childC.getComputedTop()).toBe(0)
    // All children should be clamped to max width of 30
    expect(childA.getComputedWidth()).toBe(30)
    expect(childB.getComputedWidth()).toBe(30)
    expect(childC.getComputedWidth()).toBe(30)
  })

  it("should use minWidth-clamped size for line breaking", () => {
    // A child with flexBasis:10 but minWidth:40 should use 40 for line breaking
    const root = Node.create()
    root.setWidth(100)
    root.setHeight(200)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setFlexWrap(WRAP_WRAP)

    // Child A: baseSize=10, minWidth=40 → hypothetical=40
    const childA = Node.create()
    childA.setFlexBasis(10)
    childA.setMinWidth(40)
    childA.setHeight(20)
    root.insertChild(childA, 0)

    // Child B: baseSize=10, minWidth=40 → hypothetical=40
    const childB = Node.create()
    childB.setFlexBasis(10)
    childB.setMinWidth(40)
    childB.setHeight(20)
    root.insertChild(childB, 1)

    // Child C: baseSize=10, minWidth=40 → hypothetical=40
    const childC = Node.create()
    childC.setFlexBasis(10)
    childC.setMinWidth(40)
    childC.setHeight(20)
    root.insertChild(childC, 2)

    root.calculateLayout(100, 200, DIRECTION_LTR)

    // With hypothetical sizes of 40 each, only two fit per line (40+40 = 80 < 100, 40+40+40 = 120 > 100)
    // With unclamped base sizes of 10, all three would fit (10+10+10 = 30 < 100)
    // CSS spec says to use hypothetical — childC should wrap to a new line
    expect(childA.getComputedTop()).toBe(0)
    expect(childB.getComputedTop()).toBe(0)
    expect(childC.getComputedTop()).toBe(20) // Wrapped to second line
  })

  it("should work correctly in column direction with maxHeight", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(100)
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setFlexWrap(WRAP_WRAP)

    // Child A: baseSize=60, maxHeight=30 → hypothetical=30
    const childA = Node.create()
    childA.setFlexBasis(60)
    childA.setMaxHeight(30)
    childA.setWidth(20)
    root.insertChild(childA, 0)

    // Child B: baseSize=60, maxHeight=30 → hypothetical=30
    const childB = Node.create()
    childB.setFlexBasis(60)
    childB.setMaxHeight(30)
    childB.setWidth(20)
    root.insertChild(childB, 1)

    // Child C: baseSize=60, maxHeight=30 → hypothetical=30
    const childC = Node.create()
    childC.setFlexBasis(60)
    childC.setMaxHeight(30)
    childC.setWidth(20)
    root.insertChild(childC, 2)

    root.calculateLayout(200, 100, DIRECTION_LTR)

    // With hypothetical sizes of 30, all three fit on one column (30+30+30 = 90 < 100)
    // All should be on the same column line (left=0)
    expect(childA.getComputedLeft()).toBe(0)
    expect(childB.getComputedLeft()).toBe(0)
    expect(childC.getComputedLeft()).toBe(0)
  })
})

describe("CSS spec: wrapped auto-sized containers get proper line cross-size", () => {
  it("should compute line cross-size from auto-sized container children", () => {
    const root = Node.create()
    root.setWidth(100)
    root.setHeight(200)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setFlexWrap(WRAP_WRAP)

    // Child A: auto-sized container with a grandchild of height 40
    const childA = Node.create()
    childA.setWidth(60)
    // No explicit height — auto-sized
    root.insertChild(childA, 0)

    const grandchildA = Node.create()
    grandchildA.setWidth(60)
    grandchildA.setHeight(40)
    childA.insertChild(grandchildA, 0)

    // Child B: auto-sized container with a grandchild of height 30
    // Forces wrap to second line (60+60 > 100)
    const childB = Node.create()
    childB.setWidth(60)
    // No explicit height — auto-sized
    root.insertChild(childB, 1)

    const grandchildB = Node.create()
    grandchildB.setWidth(60)
    grandchildB.setHeight(30)
    childB.insertChild(grandchildB, 0)

    root.calculateLayout(100, 200, DIRECTION_LTR)

    // childA should have height 40 (from its grandchild)
    expect(childA.getComputedHeight()).toBe(40)
    // childB should be on the second line, starting at top=40 (line 1 cross-size = 40)
    expect(childB.getComputedTop()).toBe(40)
    // childB should have height 30 (from its grandchild)
    expect(childB.getComputedHeight()).toBe(30)
  })

  it("should handle all auto-sized containers on the same line", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(200)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setFlexWrap(WRAP_WRAP)

    // Two auto-sized container children on the same line
    const childA = Node.create()
    childA.setWidth(80)
    root.insertChild(childA, 0)

    const grandchildA = Node.create()
    grandchildA.setWidth(80)
    grandchildA.setHeight(50)
    childA.insertChild(grandchildA, 0)

    const childB = Node.create()
    childB.setWidth(80)
    root.insertChild(childB, 1)

    const grandchildB = Node.create()
    grandchildB.setWidth(80)
    grandchildB.setHeight(30)
    childB.insertChild(grandchildB, 0)

    // Third child forces a second line
    const childC = Node.create()
    childC.setWidth(80)
    root.insertChild(childC, 2)

    const grandchildC = Node.create()
    grandchildC.setWidth(80)
    grandchildC.setHeight(25)
    childC.insertChild(grandchildC, 0)

    root.calculateLayout(200, 200, DIRECTION_LTR)

    // Line 1: childA (intrinsic h=50) and childB (intrinsic h=30)
    // Line cross-size = max(50, 30) = 50
    // With default alignItems:stretch, both children stretch to 50
    // childC should start at top=50
    expect(childA.getComputedHeight()).toBe(50)
    expect(childB.getComputedHeight()).toBe(50) // Stretched to line cross-size
    expect(childC.getComputedTop()).toBe(50)
  })

  it("should handle column direction with auto-width containers", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(100)
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setFlexWrap(WRAP_WRAP)

    // Child A: auto-width container with grandchild of width 40
    const childA = Node.create()
    childA.setHeight(60)
    // No explicit width — auto-sized on cross axis
    root.insertChild(childA, 0)

    const grandchildA = Node.create()
    grandchildA.setWidth(40)
    grandchildA.setHeight(60)
    childA.insertChild(grandchildA, 0)

    // Child B: auto-width container, forces wrap (60+60 > 100)
    const childB = Node.create()
    childB.setHeight(60)
    root.insertChild(childB, 1)

    const grandchildB = Node.create()
    grandchildB.setWidth(35)
    grandchildB.setHeight(60)
    childB.insertChild(grandchildB, 0)

    root.calculateLayout(200, 100, DIRECTION_LTR)

    // childA's computed width should be 40 (from grandchild)
    expect(childA.getComputedWidth()).toBe(40)
    // childB should be on second line, starting at left=40
    expect(childB.getComputedLeft()).toBe(40)
  })
})

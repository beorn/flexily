/**
 * Tests for alignContent behavior with negative free space.
 *
 * When flex lines overflow the container's cross axis (negative free space),
 * alignContent should still apply offset calculations for flex-end and center.
 *
 * Note: We first verify Yoga's behavior via the comparison test infrastructure,
 * then test Flexily matches.
 */

import { describe, expect, it, beforeAll } from "vitest"
import * as Flexily from "../src/index.js"

// First, test Flexily behavior directly
describe("alignContent with negative free space", () => {
  // Setup: container with cross-axis smaller than total line cross sizes
  // Row direction, wrap enabled, 3 children of height 20 each = 60 total
  // Container height = 40 → free space = 40 - 60 = -20

  function createOverflowLayout(alignContent: number) {
    const root = Flexily.Node.create()
    root.setWidth(60)
    root.setHeight(40) // Smaller than total children cross size (60)
    root.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)
    root.setFlexWrap(Flexily.WRAP_WRAP)
    root.setAlignContent(alignContent)

    // 3 children, each 30px wide (2 per row) and 20px tall
    // Line 1: children 0,1 → cross size 20, offset 0
    // Line 2: child 2 → cross size 20, offset 20
    // Total cross = 40 in 2 lines → actually fits. Need 3 lines.
    // Use 20px wide children: 3 per row doesn't fit in 60px...
    // Actually: 3 children of width 30 each, container width 60
    // Line 1: child0 (30) + child1 (30) = 60 → fits
    // Line 2: child2 (30) = 30 → fits
    // Total cross = 20 + 20 = 40 → fits in height 40, no negative space

    // Need more children to create overflow
    for (let i = 0; i < 6; i++) {
      const child = Flexily.Node.create()
      child.setWidth(30)
      child.setHeight(20)
      root.insertChild(child, i)
    }
    // Line 1: child0, child1 → height 20
    // Line 2: child2, child3 → height 20
    // Line 3: child4, child5 → height 20
    // Total cross = 60, container = 40 → free space = -20

    root.calculateLayout(60, 40, Flexily.DIRECTION_LTR)
    return root
  }

  it("flex-start with negative space: lines start at 0", () => {
    const root = createOverflowLayout(Flexily.ALIGN_FLEX_START)
    // Lines should start at top (0) and overflow at bottom
    const child0 = root.getChild(0)!
    const child2 = root.getChild(2)!
    const child4 = root.getChild(4)!
    expect(child0.getComputedTop()).toBe(0)
    expect(child2.getComputedTop()).toBe(20)
    expect(child4.getComputedTop()).toBe(40)
  })

  it("flex-end with negative space: lines shifted by negative free space", () => {
    const root = createOverflowLayout(Flexily.ALIGN_FLEX_END)
    // Lines should be shifted up by freeSpace (-20)
    // All lines shift by -20
    const child0 = root.getChild(0)!
    const child2 = root.getChild(2)!
    const child4 = root.getChild(4)!
    expect(child0.getComputedTop()).toBe(-20) // 0 + (-20) = -20
    expect(child2.getComputedTop()).toBe(0) // 20 + (-20) = 0
    expect(child4.getComputedTop()).toBe(20) // 40 + (-20) = 20
  })

  it("center with negative space: lines centered with negative offset", () => {
    const root = createOverflowLayout(Flexily.ALIGN_CENTER)
    // Center offset = -20/2 = -10
    const child0 = root.getChild(0)!
    const child2 = root.getChild(2)!
    const child4 = root.getChild(4)!
    expect(child0.getComputedTop()).toBe(-10) // 0 + (-10) = -10
    expect(child2.getComputedTop()).toBe(10) // 20 + (-10) = 10
    expect(child4.getComputedTop()).toBe(30) // 40 + (-10) = 30
  })

  it("space-between with negative space: collapses to flex-start", () => {
    // CSS spec: space-between with negative free space behaves like flex-start
    const root = createOverflowLayout(Flexily.ALIGN_SPACE_BETWEEN)
    const child0 = root.getChild(0)!
    const child2 = root.getChild(2)!
    const child4 = root.getChild(4)!
    expect(child0.getComputedTop()).toBe(0)
    expect(child2.getComputedTop()).toBe(20)
    expect(child4.getComputedTop()).toBe(40)
  })

  it("space-around with negative space: collapses to center", () => {
    // CSS spec + Yoga: space-around with negative free space behaves like center
    const root = createOverflowLayout(Flexily.ALIGN_SPACE_AROUND)
    const child0 = root.getChild(0)!
    const child2 = root.getChild(2)!
    const child4 = root.getChild(4)!
    expect(child0.getComputedTop()).toBe(-10) // Same as center
    expect(child2.getComputedTop()).toBe(10)
    expect(child4.getComputedTop()).toBe(30)
  })

  it("space-evenly with negative space: collapses to center (CSS spec)", () => {
    // CSS spec: space-evenly with negative free space behaves like center
    // Note: Yoga doesn't support ALIGN_SPACE_EVENLY, so this follows CSS spec only
    const root = createOverflowLayout(Flexily.ALIGN_SPACE_EVENLY)
    const child0 = root.getChild(0)!
    const child2 = root.getChild(2)!
    const child4 = root.getChild(4)!
    expect(child0.getComputedTop()).toBe(-10) // Same as center
    expect(child2.getComputedTop()).toBe(10)
    expect(child4.getComputedTop()).toBe(30)
  })

  it("stretch with negative space: no extra distribution", () => {
    // Stretch can't distribute negative space — lines stay at natural positions
    const root = createOverflowLayout(Flexily.ALIGN_STRETCH)
    const child0 = root.getChild(0)!
    const child2 = root.getChild(2)!
    const child4 = root.getChild(4)!
    expect(child0.getComputedTop()).toBe(0)
    expect(child2.getComputedTop()).toBe(20)
    expect(child4.getComputedTop()).toBe(40)
  })
})

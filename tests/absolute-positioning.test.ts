/**
 * Tests for absolute positioning edge cases.
 *
 * Covers three bugs found during code review:
 * 1. Absolute children use wrong fallback alignment axis in row containers
 * 2. Absolute percent offsets resolve against border box instead of content box
 * 3. Cross-axis alignment drops negative offsets for oversized children
 */

import { describe, expect, it } from "vitest"
import {
  ALIGN_CENTER,
  ALIGN_FLEX_END,
  ALIGN_FLEX_START,
  DIRECTION_LTR,
  EDGE_ALL,
  EDGE_LEFT,
  EDGE_TOP,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_ROW,
  JUSTIFY_CENTER,
  JUSTIFY_FLEX_END,
  Node,
  POSITION_TYPE_ABSOLUTE,
} from "../src/index.js"
import { expectLayout } from "./test-utils.js"

describe("absolute alignment axis", () => {
  it("row container: alignItems=center centers absolute child vertically (cross axis)", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(100)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setAlignItems(ALIGN_CENTER)

    const child = Node.create()
    child.setPositionType(POSITION_TYPE_ABSOLUTE)
    child.setWidth(40)
    child.setHeight(20)
    root.insertChild(child, 0)

    root.calculateLayout(200, 100, DIRECTION_LTR)

    // In row: cross axis = vertical. alignItems=center should center Y.
    // top = (100 - 20) / 2 = 40
    // left should be 0 (main axis default = flex-start via justifyContent)
    expectLayout(child, { left: 0, top: 40, width: 40, height: 20 })

    root.free()
  })

  it("row container: alignItems=flex_end pushes absolute child to bottom (cross axis)", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(100)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setAlignItems(ALIGN_FLEX_END)

    const child = Node.create()
    child.setPositionType(POSITION_TYPE_ABSOLUTE)
    child.setWidth(40)
    child.setHeight(20)
    root.insertChild(child, 0)

    root.calculateLayout(200, 100, DIRECTION_LTR)

    // In row: cross axis = vertical. alignItems=flex_end should push to bottom.
    // top = 100 - 20 = 80
    expectLayout(child, { left: 0, top: 80, width: 40, height: 20 })

    root.free()
  })

  it("row container: justifyContent=center centers absolute child horizontally (main axis)", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(100)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setJustifyContent(JUSTIFY_CENTER)

    const child = Node.create()
    child.setPositionType(POSITION_TYPE_ABSOLUTE)
    child.setWidth(40)
    child.setHeight(20)
    root.insertChild(child, 0)

    root.calculateLayout(200, 100, DIRECTION_LTR)

    // In row: main axis = horizontal. justifyContent=center should center X.
    // left = (200 - 40) / 2 = 80
    expectLayout(child, { left: 80, top: 0, width: 40, height: 20 })

    root.free()
  })

  it("row container: justifyContent=flex_end pushes absolute child to right (main axis)", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(100)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setJustifyContent(JUSTIFY_FLEX_END)

    const child = Node.create()
    child.setPositionType(POSITION_TYPE_ABSOLUTE)
    child.setWidth(40)
    child.setHeight(20)
    root.insertChild(child, 0)

    root.calculateLayout(200, 100, DIRECTION_LTR)

    // In row: main axis = horizontal. justifyContent=flex_end should push right.
    // left = 200 - 40 = 160
    expectLayout(child, { left: 160, top: 0, width: 40, height: 20 })

    root.free()
  })

  it("column container: alignItems=center centers absolute child horizontally (cross axis)", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(100)
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setAlignItems(ALIGN_CENTER)

    const child = Node.create()
    child.setPositionType(POSITION_TYPE_ABSOLUTE)
    child.setWidth(40)
    child.setHeight(20)
    root.insertChild(child, 0)

    root.calculateLayout(200, 100, DIRECTION_LTR)

    // In column: cross axis = horizontal. alignItems=center should center X.
    // left = (200 - 40) / 2 = 80
    expectLayout(child, { left: 80, top: 0, width: 40, height: 20 })

    root.free()
  })

  it("column container: justifyContent=center centers absolute child vertically (main axis)", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(100)
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setJustifyContent(JUSTIFY_CENTER)

    const child = Node.create()
    child.setPositionType(POSITION_TYPE_ABSOLUTE)
    child.setWidth(40)
    child.setHeight(20)
    root.insertChild(child, 0)

    root.calculateLayout(200, 100, DIRECTION_LTR)

    // In column: main axis = vertical. justifyContent=center should center Y.
    // top = (100 - 20) / 2 = 40
    expectLayout(child, { left: 0, top: 40, width: 40, height: 20 })

    root.free()
  })

  it("row container: both alignItems and justifyContent center absolute child", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(100)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setAlignItems(ALIGN_CENTER)
    root.setJustifyContent(JUSTIFY_CENTER)

    const child = Node.create()
    child.setPositionType(POSITION_TYPE_ABSOLUTE)
    child.setWidth(40)
    child.setHeight(20)
    root.insertChild(child, 0)

    root.calculateLayout(200, 100, DIRECTION_LTR)

    // Row: justifyContent=center centers X, alignItems=center centers Y
    expectLayout(child, { left: 80, top: 40, width: 40, height: 20 })

    root.free()
  })
})

describe("absolute percent offsets", () => {
  it("percent position resolves against content box (with border and padding)", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(200)
    root.setBorder(EDGE_ALL, 10)
    root.setPadding(EDGE_ALL, 20)

    const child = Node.create()
    child.setPositionType(POSITION_TYPE_ABSOLUTE)
    child.setWidth(40)
    child.setHeight(40)
    child.setPositionPercent(EDGE_LEFT, 50)
    child.setPositionPercent(EDGE_TOP, 50)
    root.insertChild(child, 0)

    root.calculateLayout(200, 200, DIRECTION_LTR)

    // Content box = 200 - 10*2 - 20*2 = 140
    // 50% of 140 = 70
    // Position within padding box starts at border: left = 10 + 70 = 80
    expectLayout(child, { left: 80, top: 80, width: 40, height: 40 })

    root.free()
  })

  it("percent position resolves against content box (border only)", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(200)
    root.setBorder(EDGE_ALL, 10)

    const child = Node.create()
    child.setPositionType(POSITION_TYPE_ABSOLUTE)
    child.setWidth(10)
    child.setHeight(10)
    child.setPositionPercent(EDGE_LEFT, 100)
    root.insertChild(child, 0)

    root.calculateLayout(200, 200, DIRECTION_LTR)

    // Content box = 200 - 10*2 = 180 (no padding)
    // 100% of 180 = 180
    // left = 10 (border) + 180 = 190
    expectLayout(child, { left: 190 })

    root.free()
  })

  it("percent position resolves against content box (padding only)", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(200)
    root.setPadding(EDGE_ALL, 20)

    const child = Node.create()
    child.setPositionType(POSITION_TYPE_ABSOLUTE)
    child.setWidth(10)
    child.setHeight(10)
    child.setPositionPercent(EDGE_LEFT, 100)
    root.insertChild(child, 0)

    root.calculateLayout(200, 200, DIRECTION_LTR)

    // Content box = 200 - 20*2 = 160 (no border)
    // 100% of 160 = 160
    // left = 0 (no border) + 160 = 160
    expectLayout(child, { left: 160 })

    root.free()
  })
})

describe("cross-axis negative offset", () => {
  it("row: center alignment with oversized child produces negative top", () => {
    const root = Node.create()
    root.setWidth(100)
    root.setHeight(50)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setAlignItems(ALIGN_CENTER)

    const child = Node.create()
    child.setWidth(30)
    child.setHeight(80) // bigger than container's 50
    root.insertChild(child, 0)

    root.calculateLayout(100, 50, DIRECTION_LTR)

    // availableCrossSpace = 50 - 80 = -30
    // crossOffset = -30 / 2 = -15
    expectLayout(child, { left: 0, top: -15, width: 30, height: 80 })

    root.free()
  })

  it("row: flex-end alignment with oversized child produces negative top", () => {
    const root = Node.create()
    root.setWidth(100)
    root.setHeight(50)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setAlignItems(ALIGN_FLEX_END)

    const child = Node.create()
    child.setWidth(30)
    child.setHeight(80)
    root.insertChild(child, 0)

    root.calculateLayout(100, 50, DIRECTION_LTR)

    // availableCrossSpace = 50 - 80 = -30
    // crossOffset = -30
    expectLayout(child, { left: 0, top: -30, width: 30, height: 80 })

    root.free()
  })

  it("column: center alignment with oversized child produces negative left", () => {
    const root = Node.create()
    root.setWidth(50)
    root.setHeight(100)
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setAlignItems(ALIGN_CENTER)

    const child = Node.create()
    child.setWidth(80) // bigger than container's 50
    child.setHeight(30)
    root.insertChild(child, 0)

    root.calculateLayout(50, 100, DIRECTION_LTR)

    // availableCrossSpace = 50 - 80 = -30
    // crossOffset = -30 / 2 = -15
    expectLayout(child, { left: -15, top: 0, width: 80, height: 30 })

    root.free()
  })

  it("row: flex-start alignment with oversized child keeps top at 0", () => {
    const root = Node.create()
    root.setWidth(100)
    root.setHeight(50)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setAlignItems(ALIGN_FLEX_START)

    const child = Node.create()
    child.setWidth(30)
    child.setHeight(80)
    root.insertChild(child, 0)

    root.calculateLayout(100, 50, DIRECTION_LTR)

    // flex-start: crossOffset = 0 regardless of size
    expectLayout(child, { left: 0, top: 0, width: 30, height: 80 })

    root.free()
  })
})

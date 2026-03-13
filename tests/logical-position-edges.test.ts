/**
 * Tests for EDGE_START/EDGE_END position resolution.
 *
 * setPosition(EDGE_START, value) should resolve to left in LTR, right in RTL.
 * setPosition(EDGE_END, value) should resolve to right in LTR, left in RTL.
 */

import { describe, expect, it } from "vitest"
import {
  DIRECTION_LTR,
  DIRECTION_RTL,
  EDGE_END,
  EDGE_LEFT,
  EDGE_START,
  FLEX_DIRECTION_ROW,
  FLEX_DIRECTION_COLUMN,
  Node,
  POSITION_TYPE_ABSOLUTE,
  POSITION_TYPE_RELATIVE,
} from "../src/index.js"
import { expectLayout } from "./test-utils.js"

describe("EDGE_START/EDGE_END position resolution", () => {
  describe("absolute positioning", () => {
    it("EDGE_START resolves to left in LTR", () => {
      const root = Node.create()
      root.setWidth(100)
      root.setHeight(100)

      const child = Node.create()
      child.setPositionType(POSITION_TYPE_ABSOLUTE)
      child.setPosition(EDGE_START, 10)
      child.setWidth(20)
      child.setHeight(20)
      root.insertChild(child, 0)

      root.calculateLayout(100, 100, DIRECTION_LTR)

      // EDGE_START in LTR = left: 10
      expectLayout(child, { left: 10, top: 0, width: 20, height: 20 })
    })

    it("EDGE_START resolves to right in RTL", () => {
      const root = Node.create()
      root.setWidth(100)
      root.setHeight(100)

      const child = Node.create()
      child.setPositionType(POSITION_TYPE_ABSOLUTE)
      child.setPosition(EDGE_START, 10)
      child.setWidth(20)
      child.setHeight(20)
      root.insertChild(child, 0)

      root.calculateLayout(100, 100, DIRECTION_RTL)

      // EDGE_START in RTL = right: 10, so left = 100 - 20 - 10 = 70
      expectLayout(child, { left: 70, top: 0, width: 20, height: 20 })
    })

    it("EDGE_END resolves to right in LTR", () => {
      const root = Node.create()
      root.setWidth(100)
      root.setHeight(100)

      const child = Node.create()
      child.setPositionType(POSITION_TYPE_ABSOLUTE)
      child.setPosition(EDGE_END, 10)
      child.setWidth(20)
      child.setHeight(20)
      root.insertChild(child, 0)

      root.calculateLayout(100, 100, DIRECTION_LTR)

      // EDGE_END in LTR = right: 10, so left = 100 - 20 - 10 = 70
      expectLayout(child, { left: 70, top: 0, width: 20, height: 20 })
    })

    it("EDGE_END resolves to left in RTL", () => {
      const root = Node.create()
      root.setWidth(100)
      root.setHeight(100)

      const child = Node.create()
      child.setPositionType(POSITION_TYPE_ABSOLUTE)
      child.setPosition(EDGE_END, 10)
      child.setWidth(20)
      child.setHeight(20)
      root.insertChild(child, 0)

      root.calculateLayout(100, 100, DIRECTION_RTL)

      // EDGE_END in RTL = left: 10
      expectLayout(child, { left: 10, top: 0, width: 20, height: 20 })
    })
  })

  describe("relative positioning", () => {
    it("EDGE_START offsets relatively in LTR", () => {
      const root = Node.create()
      root.setWidth(100)
      root.setHeight(100)
      root.setFlexDirection(FLEX_DIRECTION_ROW)

      const child = Node.create()
      child.setPositionType(POSITION_TYPE_RELATIVE)
      child.setPosition(EDGE_START, 5)
      child.setWidth(20)
      child.setHeight(20)
      root.insertChild(child, 0)

      root.calculateLayout(100, 100, DIRECTION_LTR)

      // EDGE_START in LTR = left: 5 relative offset
      expectLayout(child, { left: 5, top: 0, width: 20, height: 20 })
    })

    it("EDGE_START offsets relatively in RTL (opposite direction)", () => {
      const root = Node.create()
      root.setWidth(100)
      root.setHeight(100)
      root.setFlexDirection(FLEX_DIRECTION_ROW)

      const child = Node.create()
      child.setPositionType(POSITION_TYPE_RELATIVE)
      child.setPosition(EDGE_START, 5)
      child.setWidth(20)
      child.setHeight(20)
      root.insertChild(child, 0)

      root.calculateLayout(100, 100, DIRECTION_RTL)

      // In RTL row, child is positioned from the right.
      // EDGE_START in RTL = right offset, so child moves left by 5
      // Base position: right-aligned at left=80 (100-20), then right:5 means left=80-5=75
      expectLayout(child, { left: 75, width: 20, height: 20 })
    })
  })

  describe("parent relative position with EDGE_START/END", () => {
    it("parent EDGE_START position offsets children in LTR", () => {
      const root = Node.create()
      root.setWidth(100)
      root.setHeight(100)
      root.setFlexDirection(FLEX_DIRECTION_COLUMN)
      root.setPositionType(POSITION_TYPE_RELATIVE)
      root.setPosition(EDGE_START, 10)

      const child = Node.create()
      child.setWidth(20)
      child.setHeight(20)
      root.insertChild(child, 0)

      root.calculateLayout(100, 100, DIRECTION_LTR)

      // Parent has EDGE_START=10 in LTR = left offset of 10
      expectLayout(root, { left: 10 })
      expectLayout(child, { left: 0, top: 0, width: 20, height: 20 })
    })
  })
})

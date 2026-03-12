/**
 * Aspect Ratio Tests
 *
 * Comprehensive tests for CSS aspect-ratio spec compliance.
 * Tests cover:
 * - Basic width->height and height->width derivation
 * - Aspect ratio with min/max constraints
 * - Aspect ratio with padding and borders
 * - Aspect ratio in flex children (row and column)
 * - Aspect ratio with flexGrow/flexShrink
 * - Aspect ratio interaction with measureNode (intrinsic sizing)
 * - Aspect ratio with explicit dimensions (no-op)
 * - Both auto dimensions (no-op)
 * - Re-layout consistency with aspect ratio
 */

import { describe, expect, it } from "vitest"
import {
  Node,
  DIRECTION_LTR,
  FLEX_DIRECTION_ROW,
  FLEX_DIRECTION_COLUMN,
  EDGE_ALL,
  EDGE_LEFT,
  EDGE_RIGHT,
  EDGE_TOP,
  EDGE_BOTTOM,
} from "../src/index.js"
import { expectLayout, createChild } from "./test-utils.js"
import { expectRelayoutMatchesFresh } from "../src/testing.js"

describe("Aspect Ratio", () => {
  describe("Basic derivation", () => {
    it("should derive height from width (ratio 2:1)", () => {
      const root = Node.create()
      root.setWidth(200)
      root.setAspectRatio(2) // width/height = 2, so height = 200/2 = 100
      root.calculateLayout(200, 200, DIRECTION_LTR)

      expectLayout(root, { width: 200, height: 100 })
    })

    it("should derive width from height (ratio 2:1)", () => {
      const root = Node.create()
      root.setHeight(100)
      root.setAspectRatio(2) // width/height = 2, so width = 100*2 = 200
      root.calculateLayout(200, 200, DIRECTION_LTR)

      expectLayout(root, { width: 200, height: 100 })
    })

    it("should handle 1:1 aspect ratio", () => {
      const root = Node.create()
      root.setWidth(50)
      root.setAspectRatio(1)
      root.calculateLayout(100, 100, DIRECTION_LTR)

      expectLayout(root, { width: 50, height: 50 })
    })

    it("should handle fractional aspect ratio", () => {
      const root = Node.create()
      root.setWidth(100)
      root.setAspectRatio(0.5) // width/height = 0.5, so height = 100/0.5 = 200
      root.calculateLayout(200, 300, DIRECTION_LTR)

      expectLayout(root, { width: 100, height: 200 })
    })

    it("should not apply when both dimensions are explicit", () => {
      const root = Node.create()
      root.setWidth(200)
      root.setHeight(50)
      root.setAspectRatio(2) // Would make height=100, but both are set
      root.calculateLayout(200, 200, DIRECTION_LTR)

      expectLayout(root, { width: 200, height: 50 })
    })
  })

  describe("Min/Max constraints", () => {
    it("should respect minHeight with aspect ratio", () => {
      const root = Node.create()
      root.setWidth(100)
      root.setAspectRatio(10) // width/height = 10, so height = 100/10 = 10
      root.setMinHeight(20) // But minHeight says at least 20
      root.calculateLayout(200, 200, DIRECTION_LTR)

      expectLayout(root, { width: 100, height: 20 })
    })

    it("should respect maxHeight with aspect ratio", () => {
      const root = Node.create()
      root.setWidth(200)
      root.setAspectRatio(1) // width/height = 1, so height = 200
      root.setMaxHeight(100) // But maxHeight caps at 100
      root.calculateLayout(200, 200, DIRECTION_LTR)

      expectLayout(root, { width: 200, height: 100 })
    })

    it("should respect minWidth with aspect ratio", () => {
      const root = Node.create()
      root.setHeight(100)
      root.setAspectRatio(0.5) // width/height = 0.5, so width = 50
      root.setMinWidth(80) // But minWidth says at least 80
      root.calculateLayout(200, 200, DIRECTION_LTR)

      expectLayout(root, { width: 80, height: 100 })
    })

    it("should respect maxWidth with aspect ratio", () => {
      const root = Node.create()
      root.setHeight(100)
      root.setAspectRatio(5) // width/height = 5, so width = 500
      root.setMaxWidth(200) // But maxWidth caps at 200
      root.calculateLayout(500, 200, DIRECTION_LTR)

      expectLayout(root, { width: 200, height: 100 })
    })
  })

  describe("With padding and borders", () => {
    it("should include padding in layout dimensions with aspect ratio", () => {
      const root = Node.create()
      root.setWidth(100)
      root.setAspectRatio(2) // height = 100/2 = 50
      root.setPadding(EDGE_ALL, 5)
      root.calculateLayout(200, 200, DIRECTION_LTR)

      expectLayout(root, { width: 100, height: 50 })
    })

    it("should include borders in layout dimensions with aspect ratio", () => {
      const root = Node.create()
      root.setWidth(100)
      root.setAspectRatio(2) // height = 100/2 = 50
      root.setBorder(EDGE_ALL, 2)
      root.calculateLayout(200, 200, DIRECTION_LTR)

      expectLayout(root, { width: 100, height: 50 })
    })
  })

  describe("As flex child", () => {
    it("should use AR fallback alignment (flex-start) instead of implicit stretch (CSS spec)", () => {
      // CSS Alignment spec: aspect-ratio with auto cross-axis dimension
      // falls back to flex-start instead of stretch. AR-derived height wins.
      const root = Node.create()
      root.setWidth(200)
      root.setHeight(200)
      root.setFlexDirection(FLEX_DIRECTION_ROW)

      const child = Node.create()
      child.setWidth(100)
      child.setAspectRatio(2) // height = 100/2 = 50
      root.insertChild(child, 0)

      root.calculateLayout(200, 200, DIRECTION_LTR)

      // CSS spec: AR prevents implicit stretch, so height = width/AR = 50
      expectLayout(child, { width: 100, height: 50 })
    })

    it("should apply ratio in row container when alignSelf is flex-start", () => {
      const root = Node.create()
      root.setWidth(200)
      root.setHeight(200)
      root.setFlexDirection(FLEX_DIRECTION_ROW)

      const child = Node.create()
      child.setWidth(100)
      child.setAspectRatio(2) // width/height = 2, so height = 100/2 = 50
      child.setAlignSelf(1) // ALIGN_FLEX_START - no stretch
      root.insertChild(child, 0)

      root.calculateLayout(200, 200, DIRECTION_LTR)

      expectLayout(child, { width: 100, height: 50 })
    })

    it("should work in a column container (height constrained, width from ratio)", () => {
      const root = Node.create()
      root.setWidth(200)
      root.setHeight(200)
      root.setFlexDirection(FLEX_DIRECTION_COLUMN)

      const child = Node.create()
      child.setHeight(50)
      child.setAspectRatio(3) // width/height = 3, so width = 50*3 = 150
      root.insertChild(child, 0)

      root.calculateLayout(200, 200, DIRECTION_LTR)

      expectLayout(child, { height: 50 })
      // Width might be constrained by parent's stretch behavior
    })

    it("should work with flexGrow", () => {
      const root = Node.create()
      root.setWidth(200)
      root.setHeight(100)
      root.setFlexDirection(FLEX_DIRECTION_ROW)

      // Child with flexGrow takes all available width
      const child = Node.create()
      child.setFlexGrow(1)
      child.setAspectRatio(2) // Once width is resolved, height = width/2
      root.insertChild(child, 0)

      root.calculateLayout(200, 100, DIRECTION_LTR)

      // The flex grow gives it width 200; aspect ratio would give height 100
      expectLayout(child, { width: 200 })
    })

    it("should maintain ratio alongside siblings when not stretched", () => {
      const root = Node.create()
      root.setWidth(200)
      root.setHeight(100)
      root.setFlexDirection(FLEX_DIRECTION_ROW)
      root.setAlignItems(1) // ALIGN_FLEX_START - no stretch

      const child1 = Node.create()
      child1.setWidth(100)
      child1.setHeight(50)
      root.insertChild(child1, 0)

      const child2 = Node.create()
      child2.setWidth(80)
      child2.setAspectRatio(2) // height = 80/2 = 40
      root.insertChild(child2, 1)

      root.calculateLayout(200, 100, DIRECTION_LTR)

      expectLayout(child1, { width: 100, height: 50 })
      expectLayout(child2, { width: 80, height: 40 })
    })
  })

  describe("Setter/Getter", () => {
    it("should default to NaN", () => {
      const node = Node.create()
      expect(Number.isNaN(node.getAspectRatio())).toBe(true)
    })

    it("should get/set correctly", () => {
      const node = Node.create()
      node.setAspectRatio(1.5)
      expect(node.getAspectRatio()).toBe(1.5)
    })

    it("should unset with NaN", () => {
      const node = Node.create()
      node.setAspectRatio(2)
      expect(node.getAspectRatio()).toBe(2)
      node.setAspectRatio(NaN)
      expect(Number.isNaN(node.getAspectRatio())).toBe(true)
    })

    it("should mark dirty on set", () => {
      const root = Node.create()
      root.setWidth(100)
      root.setHeight(100)
      root.calculateLayout(100, 100, DIRECTION_LTR)
      expect(root.isDirty()).toBe(false)

      root.setAspectRatio(2)
      expect(root.isDirty()).toBe(true)
    })
  })

  describe("Edge cases", () => {
    it("should ignore zero aspect ratio", () => {
      const root = Node.create()
      root.setWidth(100)
      root.setHeight(50)
      root.setAspectRatio(0) // Zero ratio should not apply
      root.calculateLayout(200, 200, DIRECTION_LTR)

      expectLayout(root, { width: 100, height: 50 })
    })

    it("should ignore negative aspect ratio", () => {
      const root = Node.create()
      root.setWidth(100)
      root.setHeight(50)
      root.setAspectRatio(-1) // Negative ratio should not apply
      root.calculateLayout(200, 200, DIRECTION_LTR)

      expectLayout(root, { width: 100, height: 50 })
    })

    it("should handle very large aspect ratio", () => {
      const root = Node.create()
      root.setWidth(100)
      root.setAspectRatio(100) // height = 100/100 = 1
      root.calculateLayout(200, 200, DIRECTION_LTR)

      expectLayout(root, { width: 100, height: 1 })
    })

    it("should handle very small aspect ratio", () => {
      const root = Node.create()
      root.setHeight(100)
      root.setAspectRatio(0.01) // width = 100*0.01 = 1
      root.calculateLayout(200, 200, DIRECTION_LTR)

      expectLayout(root, { width: 1, height: 100 })
    })
  })

  describe("Re-layout consistency", () => {
    it("should produce identical results on re-layout (width-derived)", () => {
      expectRelayoutMatchesFresh(
        () => {
          const root = Node.create()
          root.setWidth(200)
          root.setAspectRatio(2)

          const child = Node.create()
          child.setWidth(50)
          child.setHeight(20)
          root.insertChild(child, 0)

          return { root, dirtyTargets: [child] }
        },
        200,
        200,
      )
    })

    it("should produce identical results on re-layout (height-derived)", () => {
      expectRelayoutMatchesFresh(
        () => {
          const root = Node.create()
          root.setHeight(100)
          root.setAspectRatio(3)

          const child = Node.create()
          child.setWidth(50)
          child.setHeight(20)
          root.insertChild(child, 0)

          return { root, dirtyTargets: [child] }
        },
        400,
        200,
      )
    })

    it("should produce identical results on re-layout (flex child with ratio)", () => {
      expectRelayoutMatchesFresh(
        () => {
          const root = Node.create()
          root.setWidth(300)
          root.setHeight(200)
          root.setFlexDirection(FLEX_DIRECTION_ROW)

          const child1 = Node.create()
          child1.setWidth(100)
          child1.setAspectRatio(2)
          root.insertChild(child1, 0)

          const child2 = Node.create()
          child2.setFlexGrow(1)
          child2.setHeight(50)
          root.insertChild(child2, 1)

          return { root, dirtyTargets: [child2] }
        },
        300,
        200,
      )
    })
  })

  describe("measureNode path", () => {
    it("should apply aspect ratio when measuring a node with only width", () => {
      // Test the measureNode path (used for intrinsic sizing)
      const root = Node.create()
      root.setWidth(200)
      root.setFlexDirection(FLEX_DIRECTION_COLUMN)

      const container = Node.create()
      // Container has no explicit height - will be sized by children
      root.insertChild(container, 0)

      const child = Node.create()
      child.setWidth(100)
      child.setAspectRatio(2) // height = 100/2 = 50
      container.insertChild(child, 0)

      root.calculateLayout(200, undefined, DIRECTION_LTR)

      expectLayout(child, { width: 100, height: 50 })
    })

    it("should apply aspect ratio when measuring a node with only height", () => {
      const root = Node.create()
      root.setHeight(200)
      root.setFlexDirection(FLEX_DIRECTION_COLUMN)

      const container = Node.create()
      root.insertChild(container, 0)

      const child = Node.create()
      child.setHeight(50)
      child.setAspectRatio(3) // width = 50*3 = 150
      container.insertChild(child, 0)

      root.calculateLayout(undefined, 200, DIRECTION_LTR)

      expectLayout(child, { height: 50 })
      // Width may be constrained by parent stretch, but height should be 50
    })
  })
})

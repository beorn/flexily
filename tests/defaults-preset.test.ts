/**
 * Defaults preset — `"css"` vs `"yoga"`.
 *
 * Verifies the preset selector wires through `createDefaultStyle`,
 * `Node.create()`, and `createFlexily()` correctly. Phase 1 of the
 * `km-silvery.flexshrink-default` migration: config landing only,
 * no behavior flip yet.
 *
 * No module-level state: every preset is passed explicitly. The engine-level
 * preset is captured in `createFlexily`'s closure, not a shared variable.
 */

import { describe, expect, test } from "vitest"
import {
  ALIGN_FLEX_START,
  ALIGN_STRETCH,
  DEFAULT_PRESET,
  Node,
  createDefaultStyle,
  createFlexily,
} from "../src/index.js"

describe("defaults preset", () => {
  describe("createDefaultStyle", () => {
    test("default arg → DEFAULT_PRESET (yoga; current behavior)", () => {
      const style = createDefaultStyle()
      expect(DEFAULT_PRESET).toBe("yoga")
      expect(style.flexShrink).toBe(0)
      expect(style.alignContent).toBe(ALIGN_FLEX_START)
    })

    test("yoga preset → flexShrink:0, alignContent:FLEX_START", () => {
      const style = createDefaultStyle("yoga")
      expect(style.flexShrink).toBe(0)
      expect(style.alignContent).toBe(ALIGN_FLEX_START)
    })

    test("css preset → flexShrink:1, alignContent:STRETCH", () => {
      const style = createDefaultStyle("css")
      expect(style.flexShrink).toBe(1)
      expect(style.alignContent).toBe(ALIGN_STRETCH)
    })

    test("flexDirection stays row in both presets", () => {
      // Strict-Yoga consumers can override per-tree if they need column.
      expect(createDefaultStyle("yoga").flexDirection).toBe(2) // ROW
      expect(createDefaultStyle("css").flexDirection).toBe(2) // ROW
    })
  })

  describe("Node.create", () => {
    test("default Node uses DEFAULT_PRESET (yoga)", () => {
      expect(Node.create().getFlexShrink()).toBe(0)
    })

    test("Node.create({ defaults: 'css' }) → CSS defaults", () => {
      const node = Node.create({ defaults: "css" })
      expect(node.getFlexShrink()).toBe(1)
    })

    test("Node.create({ defaults: 'yoga' }) → Yoga defaults (explicit)", () => {
      const node = Node.create({ defaults: "yoga" })
      expect(node.getFlexShrink()).toBe(0)
    })
  })

  describe("createFlexily", () => {
    test("createFlexily({ defaults: 'css' }) → CSS defaults for new nodes", () => {
      const flex = createFlexily({ defaults: "css" })
      const node = flex.createNode()
      expect(node.getFlexShrink()).toBe(1)
    })

    test("createFlexily({ defaults: 'yoga' }) → Yoga defaults", () => {
      const flex = createFlexily({ defaults: "yoga" })
      const node = flex.createNode()
      expect(node.getFlexShrink()).toBe(0)
    })

    test("createFlexily() (no preset) → DEFAULT_PRESET (yoga)", () => {
      const flex = createFlexily()
      expect(flex.createNode().getFlexShrink()).toBe(0)
    })

    test("preset persists across nodes from same engine (closure-captured)", () => {
      const flex = createFlexily({ defaults: "css" })
      const a = flex.createNode()
      const b = flex.createNode()
      expect(a.getFlexShrink()).toBe(1)
      expect(b.getFlexShrink()).toBe(1)
    })

    test("two engines can coexist with different presets", () => {
      // No shared module state: each engine's preset is independent.
      const cssFlex = createFlexily({ defaults: "css" })
      const yogaFlex = createFlexily({ defaults: "yoga" })
      expect(cssFlex.createNode().getFlexShrink()).toBe(1)
      expect(yogaFlex.createNode().getFlexShrink()).toBe(0)
    })

    test("createFlexily preset doesn't leak to bare Node.create()", () => {
      // Bare Node.create() always uses DEFAULT_PRESET regardless of any
      // engine instances that exist.
      createFlexily({ defaults: "css" })
      expect(Node.create().getFlexShrink()).toBe(0) // Still yoga
    })
  })
})

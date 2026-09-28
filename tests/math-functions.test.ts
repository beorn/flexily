/**
 * A0.3 — CSS math functions: min() / max() / clamp().
 *
 * Late-bound per the contract in vendor/flexily/docs/two-phase-layout.md:
 * math functions evaluate at the SAME epoch as their leaf units. A min(1, 2cqi)
 * resolves at Pass 2 because cqi is a Pass-2 unit — eager Pass-1 evaluation
 * would see cqi = 0 and collapse the function to 1 in small containers, the
 * exact trap A0.3 exists to prevent.
 *
 * Tests cover:
 *   - Seven public dimension setters × five layout contexts, with numeric controls
 *   - Edge: clamp degenerates to min when min > max (CSS spec)
 *   - Edge: empty min/max fall back to 0 (defensive)
 *   - Nesting: math inside math
 *   - Raw evaluator with no query context; implicit-root fallback in real layout
 *   - Engine integration: a Box with style.width = min(80, 200cqi) lays out
 *     correctly under a CQ container
 */
import { describe, expect, test } from "vitest"
import * as C from "../src/constants.js"
import * as Flexily from "../src/index.js"
import { createFlexily } from "../src/index.js"
import type { MathExpr, Value } from "../src/types.js"
import { evaluateMathExpr, resolveValue } from "../src/utils.js"

const pt = (n: number): Value => ({ value: n, unit: C.UNIT_POINT })
const cqi = (n: number): Value => ({ value: n, unit: C.UNIT_CQI })

describe("[A0.3a] public length grammar and style setters", () => {
  const scale = { ch: 3, lh: 5 }

  test.each([
    ["2ch", 6],
    ["2lh", 10],
    ["50%", 40],
    ["10cqi", 20],
    ["calc((10ch + 2ch)*2/3)", 24],
    ["MIN(10CH, 50%)", 30],
    ["max(1ch, 10cqi)", 20],
    ["clamp(20ch, 50%, 10ch)", 60],
  ])("parses %s with explicit adapter scale and late-bound context", (input, expected) => {
    const value = Flexily.parseLength(input, scale)
    expect(resolveValue(value, 80, 200)).toBe(expected)
    expect(Object.isFrozen(value)).toBe(true)
  })

  test.each([
    ["calc(100%-2ch)", /spaces.*-/],
    ["calc(100%+2ch)", /spaces.*\+/],
    ["100% - 2ch", /wrap it: calc\(100% - 2ch\)/],
    ["max(50%, 2)", /unitless/],
    ["calc(2)", /unitless/],
    ["calc(2ch*3ch)", /constant/],
    ["calc(2ch/0)", /zero/],
    ["calc(2ch/1ch)", /constant/],
    ["min(1ch,)", /length/],
    ["1px", /ch.*lh/],
    ["max(1ch, 5cqmin)", /26239/],
    ["1cqb", /26239/],
    ["1cqmax", /26239/],
    ["-1ch", /negative/],
    ["-1%", /negative/],
    ["10%junk", /unexpected/],
  ])("refuses %s with a typed teaching error", (input, reason) => {
    expect(() => Flexily.parseLength(input, scale)).toThrow(expect.objectContaining({ name: "LengthError", input }))
    expect(() => Flexily.parseLength(input, scale)).toThrow(reason)
  })

  test.each([
    { ch: 0, lh: 1 },
    { ch: -1, lh: 1 },
    { ch: Infinity, lh: 1 },
    { ch: 1, lh: NaN },
  ])("refuses an invalid adapter scale", (invalid) => {
    expect(() => Flexily.parseLength("1ch", invalid)).toThrow(
      expect.objectContaining({ name: "LengthError", input: "1ch" }),
    )
  })

  test("a changed expression dirties the node; the identical frozen value does not", () => {
    const flex = createFlexily()
    const root = flex.createNode()
    const first = Flexily.parseLength("max(10ch, 50%)", { ch: 1, lh: 1 })
    root.setWidth(first)
    flex.calculateLayout(root, 80, 10)
    expect(root.getComputedWidth()).toBe(40)
    root.setWidth(first)
    expect(root.isDirty()).toBe(false)
    root.setWidth(Flexily.parseLength("max(10ch, 25%)", { ch: 1, lh: 1 }))
    expect(root.isDirty()).toBe(true)
    flex.calculateLayout(root, 80, 10)
    expect(root.getComputedWidth()).toBe(20)
  })

  test("fixed-axis setters refuse mismatched units and name the property and input", () => {
    const node = createFlexily().createNode()
    expect(() => node.setWidth(Flexily.parseLength("2lh", scale))).toThrow(/width.*2lh/)
    expect(() => node.setHeight(Flexily.parseLength("2ch", scale))).toThrow(/height.*2ch/)
    expect(() => node.setMaxHeight(Flexily.parseLength("10cqi", scale))).toThrow(/maxHeight.*10cqi/)
  })

  test.each([
    ["2lh", C.FLEX_DIRECTION_ROW],
    ["2ch", C.FLEX_DIRECTION_COLUMN],
  ])("flexBasis %s defers its axis refusal until the parent's first layout", (input, direction) => {
    const flex = createFlexily()
    const parent = flex.createNode()
    const child = flex.createNode()
    child.setFlexBasis(Flexily.parseLength(input, scale))
    parent.setFlexDirection(direction)
    parent.insertChild(child, 0)
    expect(() => flex.calculateLayout(parent, 80, 10)).toThrow(new RegExp(`flexBasis.*${input}`))
  })
})

describe("[A0.3] evaluateMathExpr — min / max / clamp", () => {
  test("min returns smallest", () => {
    expect(evaluateMathExpr({ fn: "min", args: [pt(80), pt(120), pt(40)] }, NaN, NaN)).toBe(40)
  })

  test("max returns largest", () => {
    expect(evaluateMathExpr({ fn: "max", args: [pt(80), pt(120), pt(40)] }, NaN, NaN)).toBe(120)
  })

  test("clamp returns val when in range", () => {
    const expr: MathExpr = { fn: "clamp", args: [pt(10), pt(50), pt(100)] }
    expect(evaluateMathExpr(expr, NaN, NaN)).toBe(50)
  })

  test("clamp returns min when val < min", () => {
    const expr: MathExpr = { fn: "clamp", args: [pt(10), pt(5), pt(100)] }
    expect(evaluateMathExpr(expr, NaN, NaN)).toBe(10)
  })

  test("clamp returns max when val > max", () => {
    const expr: MathExpr = { fn: "clamp", args: [pt(10), pt(200), pt(100)] }
    expect(evaluateMathExpr(expr, NaN, NaN)).toBe(100)
  })

  test("clamp(min > max, val, max): min wins (CSS spec)", () => {
    // CSS: when minimum > maximum, minimum dominates.
    const expr: MathExpr = { fn: "clamp", args: [pt(80), pt(50), pt(40)] }
    expect(evaluateMathExpr(expr, NaN, NaN)).toBe(80)
  })

  test("empty min args fall back to 0 (defensive — CSS disallows)", () => {
    expect(evaluateMathExpr({ fn: "min", args: [] }, NaN, NaN)).toBe(0)
  })

  test("empty max args fall back to 0 (defensive — CSS disallows)", () => {
    expect(evaluateMathExpr({ fn: "max", args: [] }, NaN, NaN)).toBe(0)
  })

  test("nested: max(10, min(20, 30)) === max(10, 20) === 20", () => {
    const expr: MathExpr = {
      fn: "max",
      args: [pt(10), { fn: "min", args: [pt(20), pt(30)] }],
    }
    expect(evaluateMathExpr(expr, NaN, NaN)).toBe(20)
  })

  test("deeply nested: clamp(min(5, 10), max(15, 20), min(50, 100))", () => {
    const expr: MathExpr = {
      fn: "clamp",
      args: [
        { fn: "min", args: [pt(5), pt(10)] }, // 5
        { fn: "max", args: [pt(15), pt(20)] }, // 20
        { fn: "min", args: [pt(50), pt(100)] }, // 50
      ],
    }
    expect(evaluateMathExpr(expr, NaN, NaN)).toBe(20) // 5 ≤ 20 ≤ 50
  })

  test("min args resolve at the same epoch — cqi without CQ ancestor → 0; min(1, 0) = 0", () => {
    // The classic collapse trap the dragon bead calls out. Without A0.3,
    // padding="2cqi" in a small container collapses to floor(0.something) = 0.
    // With A0.3 + max(1, 2cqi), padding stays at least 1 in small containers.
    // Here we test the COLLAPSE path: min(1, 2cqi) in a no-CQ context →
    // 2cqi resolves to 0 → min(1, 0) = 0. The fix is max(1, 2cqi).
    const collapse: MathExpr = { fn: "min", args: [pt(1), cqi(2)] }
    expect(evaluateMathExpr(collapse, NaN, NaN)).toBe(0)
  })

  test("max args resolve at the same epoch — max(1, 2cqi) protects against cqi collapse", () => {
    // This is THE point of A0.3: collapse-safety for cqi in small containers.
    const protected_: MathExpr = { fn: "max", args: [pt(1), cqi(2)] }
    expect(evaluateMathExpr(protected_, NaN, NaN)).toBe(1)
  })

  test("cqi args resolve against queryInlineSize when CQ ancestor exists", () => {
    // queryInlineSize=100 → cqi(2) = 2 cells (2% of 100). max(1, 2) = 2.
    const expr: MathExpr = { fn: "max", args: [pt(1), cqi(2)] }
    expect(evaluateMathExpr(expr, NaN, 100)).toBe(2)
  })
})

describe("[A0.3] resolveValue with UNIT_CALC", () => {
  test("Value with unit=CALC + expr evaluates via evaluateMathExpr", () => {
    const v: Value = {
      value: 0, // ignored for CALC
      unit: C.UNIT_CALC,
      expr: { fn: "max", args: [pt(10), pt(20)] },
    }
    expect(resolveValue(v, NaN, NaN)).toBe(20)
  })

  test("Value with unit=CALC but no expr resolves to 0 (defensive)", () => {
    const v: Value = { value: 0, unit: C.UNIT_CALC }
    expect(resolveValue(v, NaN, NaN)).toBe(0)
  })

  test("CALC with cqi children resolves with queryInlineSize threading", () => {
    const v: Value = {
      value: 0,
      unit: C.UNIT_CALC,
      expr: { fn: "max", args: [pt(1), cqi(50)] },
    }
    // queryInlineSize=80 → cqi(50) = 40. max(1, 40) = 40.
    expect(resolveValue(v, NaN, 80)).toBe(40)
  })
})

describe("[A0.3] engine integration — Box.width with min/max", () => {
  test("Box width = max(80, 2cqi) inside CQ ancestor uses larger value", () => {
    // Direct construction of a CALC value on width (silvery's parser will do this
    // at the React seam in a follow-up commit).
    const flex = createFlexily()
    const outer = flex.createNode()
    outer.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    outer.setContainSize(true)
    outer.setWidth(200)

    const box = flex.createNode()
    // width = max(80, 50cqi) → max(80, 100) = 100
    box.style.width = {
      value: 0,
      unit: C.UNIT_CALC,
      expr: { fn: "max", args: [pt(80), cqi(50)] },
    }

    outer.insertChild(box, 0)
    flex.calculateLayout(outer, 200, 100)

    expect(box.getComputedWidth()).toBe(100) // max(80, 100) = 100
  })

  test("Box width = min(80, 200cqi) caps via numeric arg", () => {
    const flex = createFlexily()
    const outer = flex.createNode()
    outer.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    outer.setContainSize(true)
    outer.setWidth(200)

    const box = flex.createNode()
    box.style.width = {
      value: 0,
      unit: C.UNIT_CALC,
      expr: { fn: "min", args: [pt(80), cqi(100)] }, // min(80, 200) = 80
    }

    outer.insertChild(box, 0)
    flex.calculateLayout(outer, 200, 100)

    expect(box.getComputedWidth()).toBe(80)
  })

  test("Box width = clamp(40, 50cqi, 120) bounded", () => {
    const flex = createFlexily()
    const outer = flex.createNode()
    outer.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    outer.setContainSize(true)
    outer.setWidth(200)

    const box = flex.createNode()
    box.style.width = {
      value: 0,
      unit: C.UNIT_CALC,
      expr: {
        fn: "clamp",
        args: [pt(40), cqi(50), pt(120)], // clamp(40, 100, 120) = 100
      },
    }

    outer.insertChild(box, 0)
    flex.calculateLayout(outer, 200, 100)

    expect(box.getComputedWidth()).toBe(100)
  })
})

describe("[A0.3a] recursive CSS intrinsic length equivalence", () => {
  // AC4: the default-Yoga table below has no recursive CSS auto-min pressure.
  // Numeric controls prove explicit sizes, min floors and the zero-min escape.
  test.each([
    { property: "width", row: true, value: 20 },
    { property: "height", row: false, value: 20 },
    { property: "minWidth", row: true, value: 20 },
    { property: "minHeight", row: false, value: 20 },
    { property: "minWidth", row: true, value: 0 },
    { property: "minHeight", row: false, value: 0 },
  ] as const)("$property=$value preserves recursive intrinsic sizing", ({ property, row, value }) => {
    const direction = row ? C.FLEX_DIRECTION_ROW : C.FLEX_DIRECTION_COLUMN
    const unit = row ? "ch" : "lh"
    const layout = (input: number | string) => {
      const flex = createFlexily({ defaults: "css" })
      const root = flex.createNode()
      root.setWidth(row ? 12 : 4)
      root.setHeight(row ? 4 : 12)
      root.setFlexDirection(direction)
      root.setAlignItems(C.ALIGN_FLEX_START)
      const wrapper = flex.createNode()
      wrapper.setFlexDirection(direction)
      wrapper.setAlignItems(C.ALIGN_FLEX_START)
      const leaf = flex.createNode()
      leaf.setWidth(row ? (value === 0 ? 20 : 0) : 1)
      leaf.setHeight(row ? 1 : value === 0 ? 20 : 0)
      if (property.startsWith("min") && value !== 0) {
        if (row) leaf.setWidthAuto()
        else leaf.setHeightAuto()
      }
      const parsed = typeof input === "string" ? Flexily.parseLength(input, { ch: 1, lh: 1 }) : input
      const setters = {
        width: leaf.setWidth,
        height: leaf.setHeight,
        minWidth: leaf.setMinWidth,
        minHeight: leaf.setMinHeight,
      }
      setters[property].call(leaf, parsed)
      wrapper.insertChild(leaf, 0)
      root.insertChild(wrapper, 0)
      const sibling = flex.createNode()
      sibling.setWidth(row ? 10 : 1)
      sibling.setHeight(row ? 1 : 10)
      root.insertChild(sibling, 1)
      flex.calculateLayout(root, row ? 12 : 4, row ? 4 : 12)
      return {
        intrinsic: wrapper.getMinContent(direction),
        mainSizes: [wrapper, leaf, sibling].map((node) => (row ? node.getComputedWidth() : node.getComputedHeight())),
      }
    }
    const numeric = layout(value)
    expect(numeric.intrinsic).toBe(value)
    expect(numeric.mainSizes).toEqual(value === 0 ? [8, 8, 4] : property.startsWith("min") ? [20, 20, 10] : [20, 20, 0])
    for (const input of [`${value}${unit}`, `calc(${value}${unit} * 1)`, `max(0${unit}, ${value}${unit})`]) {
      expect(layout(input), input).toEqual(numeric)
    }
  })
})

describe("[A0.3a] CQ intrinsic resize", () => {
  // AC4/26247: numeric mutation dirties the leaf, whereas an unchanged CQ
  // expression must refresh its cached intrinsic size when the root resizes.
  test.each(["25cqi", "max(1ch, 25cqi)"].flatMap((input) => [false, true].map((nested) => ({ input, nested }))))(
    "$input refreshes recursive min-content (nested=$nested)",
    ({ input, nested }) => {
      const create = (input: number | string) => {
        const flex = createFlexily({ defaults: "css" })
        const root = flex.createNode()
        root.setWidth(nested ? 100 : 80)
        root.setHeight(4)
        root.setFlexDirection(C.FLEX_DIRECTION_ROW)
        root.setAlignItems(C.ALIGN_FLEX_START)
        root.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
        root.setContainSize(true)
        const queryRoot = nested ? flex.createNode() : root
        if (nested) {
          queryRoot.setWidth(80)
          queryRoot.setHeight(4)
          queryRoot.setFlexDirection(C.FLEX_DIRECTION_ROW)
          queryRoot.setAlignItems(C.ALIGN_FLEX_START)
          queryRoot.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
          queryRoot.setContainSize(true)
          root.insertChild(queryRoot, 0)
        }
        const wrapper = flex.createNode()
        wrapper.setFlexDirection(C.FLEX_DIRECTION_ROW)
        const leaf = flex.createNode()
        leaf.setMinWidth(typeof input === "number" ? input : Flexily.parseLength(input, { ch: 1, lh: 1 }))
        leaf.setHeight(1)
        const content = flex.createNode()
        content.setWidth(3)
        content.setHeight(1)
        leaf.insertChild(content, 0)
        wrapper.insertChild(leaf, 0)
        queryRoot.insertChild(wrapper, 0)
        const sibling = flex.createNode()
        sibling.setWidth(30)
        sibling.setHeight(1)
        queryRoot.insertChild(sibling, 1)
        const snapshot = (width: number) => {
          queryRoot.setWidth(width)
          flex.calculateLayout(root, nested ? 100 : width, 4)
          return {
            intrinsic: [wrapper, leaf].map((node) => node.getMinContent(C.FLEX_DIRECTION_ROW)),
            geometry: [queryRoot, wrapper, leaf, sibling].map((node) => [
              node.getComputedLeft(),
              node.getComputedWidth(),
              node.getComputedHeight(),
            ]),
          }
        }
        return { leaf, snapshot }
      }
      const numeric = create(20)
      const parsed = create(input)
      const first = numeric.snapshot(80)
      expect(first.intrinsic).toEqual([20, 20])
      expect(parsed.snapshot(80)).toEqual(first)
      numeric.leaf.setMinWidth(10)
      const resized = numeric.snapshot(40)
      expect(resized.intrinsic).toEqual([10, 10])
      expect(resized.geometry.map((box) => box[1])).toEqual([40, 10, 10, 30])
      expect(parsed.snapshot(40)).toEqual(resized)
      expect(create(input).snapshot(40)).toEqual(resized)
    },
  )
})

describe("[A0.3a] seven-property layout equivalence", () => {
  const properties = ["width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight", "flexBasis"] as const
  const contexts = ["row main", "column main", "cross axis", "CQ container", "auto parent"] as const
  const cases = properties.flatMap((property) => contexts.map((context) => ({ property, context })))

  test.each(cases)("$property in $context matches its numeric length", ({ property, context }) => {
    const row =
      context === "column main" || context === "auto parent"
        ? false
        : context === "cross axis"
          ? property.includes("Height") || property === "height"
          : true
    const inline = property === "flexBasis" ? row : property.includes("Width") || property === "width"
    const expected = inline ? 20 : 6
    const unit = inline ? "ch" : "lh"
    const inputs =
      context === "CQ container" && inline
        ? ["25cqi", "calc(25cqi + 0ch)", "max(10ch, 25cqi)"]
        : context === "auto parent"
          ? [`${expected}${unit}`, `calc(${expected}${unit} * 1)`, `max(1${unit}, ${expected}${unit})`]
          : [`${expected}${unit}`, `calc(25% + 0${unit})`, `max(1${unit}, 25%)`]

    const layout = (input: number | string) => {
      const flex = createFlexily()
      const root = flex.createNode()
      root.setWidth(80)
      root.setHeight(24)
      root.setAlignItems(C.ALIGN_FLEX_START)
      const parent = context === "auto parent" ? flex.createNode() : root
      parent.setFlexDirection(row ? C.FLEX_DIRECTION_ROW : C.FLEX_DIRECTION_COLUMN)
      parent.setAlignItems(C.ALIGN_FLEX_START)
      if (parent !== root) root.insertChild(parent, 0)
      if (context === "CQ container") {
        root.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
        root.setContainSize(true)
      }
      const child = flex.createNode()
      child.setFlexShrink(0)
      child.setWidth(property === "minWidth" ? 4 : 40)
      child.setHeight(property === "minHeight" ? 1 : 12)
      if (context === "auto parent" && property === "flexBasis") child.setHeightAuto()
      if (context === "CQ container") {
        // Its own dimension queries the ancestor, not its own frozen size.
        child.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
        child.setContainSize(true)
      }
      const value = typeof input === "string" ? Flexily.parseLength(input, { ch: 1, lh: 1 }) : input
      const setters = {
        width: child.setWidth,
        height: child.setHeight,
        minWidth: child.setMinWidth,
        minHeight: child.setMinHeight,
        maxWidth: child.setMaxWidth,
        maxHeight: child.setMaxHeight,
        flexBasis: child.setFlexBasis,
      }
      setters[property].call(child, value)
      const content = flex.createNode()
      content.setWidth(3)
      content.setHeight(1)
      child.insertChild(content, 0)
      parent.insertChild(child, 0)
      flex.calculateLayout(root, 80, 24)
      const dimensions = [child.getComputedWidth(), child.getComputedHeight()]
      return {
        dimensions,
        geometry: [root, parent, child, content].map((node) => [
          node.getComputedLeft(),
          node.getComputedTop(),
          node.getComputedWidth(),
          node.getComputedHeight(),
        ]),
      }
    }

    const numeric = layout(expected)
    expect(numeric.dimensions[inline ? 0 : 1]).toBe(expected)
    for (const input of inputs) expect(layout(input), input).toEqual(numeric)
    if (context === "auto parent" && (property.startsWith("min") || property.startsWith("max"))) {
      // #26246: percentage-containing constraints have the same indefinite
      // parent semantics as plain percentages, even with a constant operand.
      const unconstrained = layout(property.startsWith("max") ? Infinity : 0)
      expect(unconstrained.dimensions[inline ? 0 : 1]).toBe(
        property.startsWith("min") ? (inline ? 4 : 1) : inline ? 40 : 12,
      )
      expect(layout(`max(10${unit}, 100%)`)).toEqual(unconstrained)
    }
  })

  test("the implicit query root resizes cqi through an unchanged-width wrapper", () => {
    const flex = createFlexily()
    const root = flex.createNode()
    root.setWidth(80)
    root.setHeight(24)
    const wrapper = flex.createNode()
    wrapper.setWidth(30)
    wrapper.setHeight(12)
    wrapper.setAlignItems(C.ALIGN_FLEX_START)
    const child = flex.createNode()
    child.setWidth(Flexily.parseLength("max(1ch, 25cqi)", { ch: 1, lh: 1 }))
    child.setHeight(1)
    wrapper.insertChild(child, 0)
    root.insertChild(wrapper, 0)
    flex.calculateLayout(root, 80, 24)
    expect(child.getComputedWidth()).toBe(20)
    root.setWidth(40)
    flex.calculateLayout(root, 40, 24)
    expect(wrapper.getComputedWidth()).toBe(30)
    expect(child.getComputedWidth()).toBe(10)
  })
})

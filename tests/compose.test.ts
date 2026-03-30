import { describe, test, expect } from "bun:test"
import {
  createFlexily,
  createBareFlexily,
  pipe,
  withMonospace,
  withTestMeasurer,
  createTestMeasurer,
  createMonospaceMeasurer,
  FLEX_DIRECTION_ROW,
  FLEX_DIRECTION_COLUMN,
  ALIGN_CENTER,
  EDGE_ALL,
} from "../src/index.js"

// Shared test style for deterministic measurer tests
const STYLE_16PX = {
  fontShorthand: "16px Inter",
  fontFamily: "Inter",
  fontSize: 16,
  fontWeight: 400,
  fontStyle: "normal",
  lineHeight: 20,
}

const STYLE_MONO = {
  fontShorthand: "1ch monospace",
  fontFamily: "monospace",
  fontSize: 1,
  fontWeight: 400,
  fontStyle: "normal",
  lineHeight: 1,
}

// ============================================================================
// createFlexily() — batteries-included
// ============================================================================

describe("createFlexily", () => {
  test("creates an engine with createNode and calculateLayout", () => {
    const flex = createFlexily()
    expect(flex.createNode).toBeDefined()
    expect(flex.calculateLayout).toBeDefined()
    expect(flex.textLayout).toBeDefined()
  })

  test("basic layout works", () => {
    const flex = createFlexily()
    const root = flex.createNode()
    root.setWidth(100)
    root.setHeight(50)
    root.setFlexDirection(FLEX_DIRECTION_ROW)

    const child = flex.createNode()
    child.setFlexGrow(1)
    root.insertChild(child, 0)

    flex.calculateLayout(root, 100, 50)

    expect(child.getComputedWidth()).toBe(100)
    expect(child.getComputedHeight()).toBe(50)
  })

  test("text content with monospace measurement", () => {
    const flex = createFlexily()
    const root = flex.createNode()
    root.setWidth(80)
    root.setHeight(24)

    const text = flex.createNode()
    text.setTextContent("Hello")
    root.insertChild(text, 0)

    flex.calculateLayout(root, 80, 24)

    // Monospace: 5 chars * 1 = 5 width
    expect(text.getComputedWidth()).toBe(5)
    expect(text.getComputedHeight()).toBe(1)
  })

  test("text content updates", () => {
    const flex = createFlexily()
    const root = flex.createNode()
    root.setWidth(80)
    root.setHeight(24)

    const text = flex.createNode()
    text.setTextContent("Hi")
    root.insertChild(text, 0)

    flex.calculateLayout(root, 80, 24)
    expect(text.getComputedWidth()).toBe(2)

    text.setTextContent("Hello world")
    flex.calculateLayout(root, 80, 24)
    expect(text.getComputedWidth()).toBe(11)
  })

  test("getTextContent returns current text", () => {
    const flex = createFlexily()
    const node = flex.createNode()

    expect(node.getTextContent()).toBeNull()
    node.setTextContent("Hello")
    expect(node.getTextContent()).toBe("Hello")
  })

  test("setMeasureFunc clears text content", () => {
    const flex = createFlexily()
    const node = flex.createNode()

    node.setTextContent("Hello")
    expect(node.getTextContent()).toBe("Hello")

    node.setMeasureFunc(() => ({ width: 10, height: 5 }))
    expect(node.getTextContent()).toBeNull()
  })

  test("custom charWidth/charHeight", () => {
    const flex = createFlexily({ charWidth: 8, charHeight: 16 })
    const root = flex.createNode()
    root.setWidth(640)
    root.setHeight(480)

    const text = flex.createNode()
    text.setTextContent("Hello")
    root.insertChild(text, 0)

    flex.calculateLayout(root, 640, 480)

    // 5 chars * 8 = 40 width
    expect(text.getComputedWidth()).toBe(40)
    expect(text.getComputedHeight()).toBe(16)
  })
})

// ============================================================================
// createBareFlexily() + pipe()
// ============================================================================

describe("createBareFlexily", () => {
  test("creates a minimal engine without text layout", () => {
    const flex = createBareFlexily()
    expect(flex.createNode).toBeDefined()
    expect(flex.calculateLayout).toBeDefined()
    expect(flex.textLayout).toBeUndefined()
  })

  test("setTextContent throws without text layout plugin", () => {
    const flex = createBareFlexily()
    const node = flex.createNode()

    expect(() => node.setTextContent("Hello")).toThrow(/No TextLayoutService/)
  })

  test("low-level measureFunc still works", () => {
    const flex = createBareFlexily()
    const root = flex.createNode()
    root.setWidth(100)
    root.setHeight(50)

    const leaf = flex.createNode()
    leaf.setMeasureFunc(() => ({ width: 30, height: 10 }))
    root.insertChild(leaf, 0)

    flex.calculateLayout(root, 100, 50)

    expect(leaf.getComputedWidth()).toBe(30)
    expect(leaf.getComputedHeight()).toBe(10)
  })
})

describe("pipe", () => {
  test("applies plugins left to right", () => {
    const flex = pipe(createBareFlexily(), withMonospace())
    expect(flex.textLayout).toBeDefined()
  })

  test("later plugins override earlier ones", () => {
    const flex = pipe(createBareFlexily(), withMonospace(1, 1), withMonospace(8, 16))

    const root = flex.createNode()
    root.setWidth(640)
    root.setHeight(480)

    const text = flex.createNode()
    text.setTextContent("Hi")
    root.insertChild(text, 0)

    flex.calculateLayout(root, 640, 480)

    // Last plugin wins: 2 chars * 8 = 16
    expect(text.getComputedWidth()).toBe(16)
  })

  test("no plugins returns same engine", () => {
    const base = createBareFlexily()
    const result = pipe(base)
    expect(result).toBe(base)
  })
})

// ============================================================================
// withMonospace
// ============================================================================

describe("withMonospace", () => {
  test("measures ASCII text correctly", () => {
    const measurer = createMonospaceMeasurer(1, 1)
    const prepared = measurer.prepare({ text: "Hello", style: STYLE_MONO })

    const sizes = prepared.intrinsicSizes()
    expect(sizes.maxContentWidth).toBe(5)
    expect(sizes.minContentWidth).toBe(5)

    const layout = prepared.layout({ maxWidth: 100 })
    expect(layout.width).toBe(5)
    expect(layout.height).toBe(1)
    expect(layout.lineCount).toBe(1)
  })

  test("handles emoji correctly", () => {
    const measurer = createMonospaceMeasurer(1, 1)
    const prepared = measurer.prepare({ text: "Hi 👋", style: STYLE_MONO })

    const sizes = prepared.intrinsicSizes()
    // "H", "i", " ", "👋" = 4 grapheme clusters
    expect(sizes.maxContentWidth).toBe(4)
  })

  test("reports truncation when text exceeds maxWidth", () => {
    const measurer = createMonospaceMeasurer(1, 1)
    const prepared = measurer.prepare({ text: "Hello world", style: STYLE_MONO })

    const layout = prepared.layout({ maxWidth: 5 })
    expect(layout.width).toBe(5)
    expect(layout.truncated).toBe(true)
  })
})

// ============================================================================
// withTestMeasurer — deterministic
// ============================================================================

describe("withTestMeasurer", () => {
  test("measures Latin text at 0.8 * fontSize", () => {
    const measurer = createTestMeasurer()
    const prepared = measurer.prepare({ text: "Hello", style: STYLE_16PX })

    const sizes = prepared.intrinsicSizes()
    // 5 Latin graphemes * 0.8 * 16 = 64
    expect(sizes.maxContentWidth).toBe(64)
  })

  test("word wrapping produces multiple lines", () => {
    const measurer = createTestMeasurer()
    const prepared = measurer.prepare({ text: "Hello world", style: STYLE_16PX })

    // "Hello" = 5*0.8*16 = 64, " " = 0.8*16 = 12.8, "world" = 5*0.8*16 = 64
    // Total: 140.8
    const sizes = prepared.intrinsicSizes()
    expect(sizes.maxContentWidth).toBeCloseTo(140.8, 1)

    // Wrap at 80px — "Hello" fits (64), " world" doesn't (64+12.8+64 > 80)
    const layout = prepared.layout({ maxWidth: 80 })
    expect(layout.lineCount).toBe(2)
    expect(layout.height).toBe(40) // 2 lines * 20 lineHeight
  })

  test("includes lines when requested", () => {
    const measurer = createTestMeasurer()
    const prepared = measurer.prepare({ text: "Hello world", style: STYLE_16PX })

    const layout = prepared.layout({ maxWidth: 80 }, { includeLines: true })
    expect(layout.lines).toBeDefined()
    expect(layout.lines!.length).toBe(2)
    expect(layout.lines![0]!.text).toBe("Hello")
    expect(layout.lines![1]!.text).toBe("world")
  })

  test("no wrapping when wrap is 'none'", () => {
    const measurer = createTestMeasurer()
    const prepared = measurer.prepare({ text: "Hello world", style: STYLE_16PX })

    const layout = prepared.layout({ maxWidth: 50, wrap: "none" })
    expect(layout.lineCount).toBe(1)
    expect(layout.truncated).toBe(true)
  })

  test("min-content width is widest word", () => {
    const measurer = createTestMeasurer()
    const prepared = measurer.prepare({ text: "Hi world", style: STYLE_16PX })

    const sizes = prepared.intrinsicSizes()
    // "world" = 5*0.8*16 = 64 (widest word)
    expect(sizes.minContentWidth).toBe(64)
  })

  test("deterministic across calls", () => {
    const measurer = createTestMeasurer()
    const p1 = measurer.prepare({ text: "Hello", style: STYLE_16PX })
    const p2 = measurer.prepare({ text: "Hello", style: STYLE_16PX })

    expect(p1.intrinsicSizes()).toEqual(p2.intrinsicSizes())
    expect(p1.layout({ maxWidth: 100 })).toEqual(p2.layout({ maxWidth: 100 }))
  })

  test("works in composed engine", () => {
    const flex = pipe(createBareFlexily(), withTestMeasurer())

    const root = flex.createNode()
    root.setWidth(200)
    root.setHeight(100)

    const text = flex.createNode()
    text.setTextContent("Hello", STYLE_16PX)
    root.insertChild(text, 0)

    flex.calculateLayout(root, 200, 100)

    // 5 * 0.8 * 16 = 64
    expect(text.getComputedWidth()).toBe(64)
    expect(text.getComputedHeight()).toBe(20)
  })
})

// ============================================================================
// FlexilyNode is a real Node — all Node methods work directly
// ============================================================================

describe("FlexilyNode as Node", () => {
  test("insertChild and getChild", () => {
    const flex = createFlexily()
    const parent = flex.createNode()
    const child1 = flex.createNode()
    const child2 = flex.createNode()

    parent.insertChild(child1, 0)
    parent.insertChild(child2, 1)

    expect(parent.getChildCount()).toBe(2)
    expect(parent.getChild(0)).toBe(child1)
    expect(parent.getChild(1)).toBe(child2)
  })

  test("removeChild", () => {
    const flex = createFlexily()
    const parent = flex.createNode()
    const child = flex.createNode()

    parent.insertChild(child, 0)
    expect(parent.getChildCount()).toBe(1)

    parent.removeChild(child)
    expect(parent.getChildCount()).toBe(0)
  })

  test("getParent", () => {
    const flex = createFlexily()
    const parent = flex.createNode()
    const child = flex.createNode()

    expect(child.getParent()).toBeNull()
    parent.insertChild(child, 0)
    expect(child.getParent()).toBe(parent)
  })

  test("style setters/getters work directly", () => {
    const flex = createFlexily()
    const node = flex.createNode()

    node.setFlexDirection(FLEX_DIRECTION_COLUMN)
    expect(node.getFlexDirection()).toBe(FLEX_DIRECTION_COLUMN)

    node.setFlexGrow(2)
    node.setFlexShrink(3)
    expect(node.getFlexGrow()).toBe(2)
    expect(node.getFlexShrink()).toBe(3)

    node.setAlignItems(ALIGN_CENTER)
    expect(node.getAlignItems()).toBe(ALIGN_CENTER)
  })

  test("dirty tracking", () => {
    const flex = createFlexily()
    const root = flex.createNode()
    root.setWidth(100)
    root.setHeight(50)

    flex.calculateLayout(root, 100, 50)
    expect(root.isDirty()).toBe(false)

    root.setWidth(200)
    expect(root.isDirty()).toBe(true)
  })
})

// ============================================================================
// Complex layout with text
// ============================================================================

describe("complex layouts with text", () => {
  test("horizontal layout with two text nodes", () => {
    const flex = createFlexily()
    const root = flex.createNode()
    root.setWidth(80)
    root.setHeight(1)
    root.setFlexDirection(FLEX_DIRECTION_ROW)

    const left = flex.createNode()
    left.setTextContent("Hello")
    root.insertChild(left, 0)

    const right = flex.createNode()
    right.setTextContent("World")
    root.insertChild(right, 1)

    flex.calculateLayout(root, 80, 1)

    expect(left.getComputedWidth()).toBe(5)
    expect(right.getComputedWidth()).toBe(5)
    expect(right.getComputedLeft()).toBe(5)
  })

  test("text with padding and border", () => {
    const flex = createFlexily()
    const root = flex.createNode()
    root.setWidth(80)
    root.setHeight(10)

    const box = flex.createNode()
    box.setPadding(EDGE_ALL, 1)
    box.setBorder(EDGE_ALL, 1)

    const text = flex.createNode()
    text.setTextContent("Hi")
    box.insertChild(text, 0)
    root.insertChild(box, 0)

    flex.calculateLayout(root, 80, 10)

    // Text: 2 chars = 2 width
    // Box: 2 + padding(1+1) + border(1+1) = 6 width
    expect(text.getComputedWidth()).toBe(2)
    expect(box.getComputedWidth()).toBe(6)
  })

  test("flexGrow with text nodes", () => {
    const flex = createFlexily()
    const root = flex.createNode()
    root.setWidth(80)
    root.setHeight(1)
    root.setFlexDirection(FLEX_DIRECTION_ROW)

    const fixed = flex.createNode()
    fixed.setTextContent("Label:")
    root.insertChild(fixed, 0)

    const flexible = flex.createNode()
    flexible.setFlexGrow(1)
    flexible.setTextContent("Value")
    root.insertChild(flexible, 1)

    flex.calculateLayout(root, 80, 1)

    expect(fixed.getComputedWidth()).toBe(6)
    expect(flexible.getComputedWidth()).toBe(74)
  })
})

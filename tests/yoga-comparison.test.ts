/**
 * Yoga Compatibility Tests
 *
 * Systematically compares Flexily output against Yoga (the reference implementation)
 * to identify discrepancies and edge cases.
 *
 * Run: bun test tests/yoga-comparison.test.ts
 */

import { describe, expect, it, beforeAll } from "vitest"
import { createLogger } from "loggily"

const log = createLogger("flexily:test:compat")
import * as Flexily from "../src/index.js"
import initYoga, { type Yoga, type Node as YogaNode } from "yoga-wasm-web"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// ============================================================================
// Setup
// ============================================================================

let yoga: Yoga
const __dirname = dirname(fileURLToPath(import.meta.url))
const wasmPath = join(__dirname, "../node_modules/yoga-wasm-web/dist/yoga.wasm")

beforeAll(async () => {
  const wasmBuffer = readFileSync(wasmPath)
  yoga = await initYoga(wasmBuffer)
})

// Pin Yoga preset on each Flexily.Node.create(YOGA_OPTS) call below so this suite
// keeps verifying Yoga-compat behavior after Phase 6 flips DEFAULT_PRESET.
// (See `createFlexilyNode` and the standalone Node.create sites.)
const YOGA_OPTS = { defaults: "yoga" as const }

// ============================================================================
// Types and Layout Extraction
// ============================================================================

interface LayoutResult {
  left: number
  top: number
  width: number
  height: number
}

interface NodeLayout extends LayoutResult {
  children: NodeLayout[]
}

function getFlexilyLayout(node: Flexily.Node): NodeLayout {
  return {
    left: node.getComputedLeft(),
    top: node.getComputedTop(),
    width: node.getComputedWidth(),
    height: node.getComputedHeight(),
    children: Array.from({ length: node.getChildCount() }, (_, i) => getFlexilyLayout(node.getChild(i)!)),
  }
}

function getYogaLayout(node: YogaNode): NodeLayout {
  return {
    left: node.getComputedLeft(),
    top: node.getComputedTop(),
    width: node.getComputedWidth(),
    height: node.getComputedHeight(),
    children: Array.from({ length: node.getChildCount() }, (_, i) => getYogaLayout(node.getChild(i))),
  }
}

function layoutsMatch(a: NodeLayout, b: NodeLayout, tolerance = 0.001): boolean {
  if (
    Math.abs(a.left - b.left) > tolerance ||
    Math.abs(a.top - b.top) > tolerance ||
    Math.abs(a.width - b.width) > tolerance ||
    Math.abs(a.height - b.height) > tolerance
  ) {
    return false
  }
  if (a.children.length !== b.children.length) return false
  return a.children.every((child, i) => layoutsMatch(child, b.children[i]!, tolerance))
}

function formatLayout(layout: NodeLayout, indent = 0): string {
  const pad = "  ".repeat(indent)
  let result = `${pad}{ left: ${layout.left}, top: ${layout.top}, width: ${layout.width}, height: ${layout.height} }`
  if (layout.children.length > 0) {
    result += ` [\n${layout.children.map((c) => formatLayout(c, indent + 1)).join(",\n")}\n${pad}]`
  }
  return result
}

// ============================================================================
// Test Results Tracking
// ============================================================================

interface TestResult {
  category: string
  name: string
  passed: boolean
  flexily?: NodeLayout
  yoga?: NodeLayout
  error?: string
}

const results: TestResult[] = []

function recordResult(result: TestResult) {
  results.push(result)
}

// ============================================================================
// Test Helpers
// ============================================================================

/** Node configuration for setup functions */
interface NodeConfig {
  width?: number
  height?: number
  widthPercent?: number
  heightPercent?: number
  flexDirection?: number
  flexWrap?: number
  alignContent?: number
  alignItems?: number
  justifyContent?: number
  flexGrow?: number
  flexShrink?: number
  flexBasis?: number
  gap?: { gutter: number; value: number }
  gapRow?: number
  gapColumn?: number
  padding?: number
  paddingPercent?: number
  margin?: { edge: number; value: number }
  marginPercent?: { edge: number; value: number }
  minWidth?: number
  maxWidth?: number
  minWidthPercent?: number
  maxWidthPercent?: number
  positionType?: number
  position?: { edge: number; value: number }[]
  positionPercent?: { edge: number; value: number }[]
}

/** Child configuration for creating multiple children */
interface ChildConfig extends NodeConfig {
  count?: number
}

/**
 * Creates and configures a Flexily node
 */
function createFlexilyNode(config: NodeConfig): Flexily.Node {
  const node = Flexily.Node.create(YOGA_OPTS)
  applyFlexilyConfig(node, config)
  return node
}

function applyFlexilyConfig(node: Flexily.Node, config: NodeConfig) {
  if (config.width !== undefined) {
    node.setWidth(config.width)
  }
  if (config.height !== undefined) {
    node.setHeight(config.height)
  }
  if (config.widthPercent !== undefined) {
    node.setWidthPercent(config.widthPercent)
  }
  if (config.heightPercent !== undefined) {
    node.setHeightPercent(config.heightPercent)
  }
  if (config.flexDirection !== undefined) {
    node.setFlexDirection(config.flexDirection)
  }
  if (config.flexWrap !== undefined) {
    node.setFlexWrap(config.flexWrap)
  }
  if (config.alignContent !== undefined) {
    node.setAlignContent(config.alignContent)
  }
  if (config.alignItems !== undefined) {
    node.setAlignItems(config.alignItems)
  }
  if (config.justifyContent !== undefined) {
    node.setJustifyContent(config.justifyContent)
  }
  if (config.flexGrow !== undefined) {
    node.setFlexGrow(config.flexGrow)
  }
  if (config.flexShrink !== undefined) {
    node.setFlexShrink(config.flexShrink)
  }
  if (config.flexBasis !== undefined) {
    node.setFlexBasis(config.flexBasis)
  }
  if (config.gap !== undefined) {
    node.setGap(config.gap.gutter, config.gap.value)
  }
  if (config.gapRow !== undefined) {
    node.setGap(Flexily.GUTTER_ROW, config.gapRow)
  }
  if (config.gapColumn !== undefined) {
    node.setGap(Flexily.GUTTER_COLUMN, config.gapColumn)
  }
  if (config.padding !== undefined) {
    node.setPadding(Flexily.EDGE_ALL, config.padding)
  }
  if (config.paddingPercent !== undefined) {
    node.setPaddingPercent(Flexily.EDGE_ALL, config.paddingPercent)
  }
  if (config.margin !== undefined) {
    node.setMargin(config.margin.edge, config.margin.value)
  }
  if (config.marginPercent !== undefined) {
    node.setMarginPercent(config.marginPercent.edge, config.marginPercent.value)
  }
  if (config.minWidth !== undefined) {
    node.setMinWidth(config.minWidth)
  }
  if (config.maxWidth !== undefined) {
    node.setMaxWidth(config.maxWidth)
  }
  if (config.minWidthPercent !== undefined) {
    node.setMinWidthPercent(config.minWidthPercent)
  }
  if (config.maxWidthPercent !== undefined) {
    node.setMaxWidthPercent(config.maxWidthPercent)
  }
  if (config.positionType !== undefined) {
    node.setPositionType(config.positionType)
  }
  if (config.position !== undefined) {
    for (const p of config.position) {
      node.setPosition(p.edge, p.value)
    }
  }
  if (config.positionPercent !== undefined) {
    for (const p of config.positionPercent) {
      node.setPositionPercent(p.edge, p.value)
    }
  }
}

/**
 * Creates and configures a Yoga node
 */
function createYogaNode(config: NodeConfig): YogaNode {
  const node = yoga.Node.create()
  applyYogaConfig(node, config)
  return node
}

function applyYogaConfig(node: YogaNode, config: NodeConfig) {
  if (config.width !== undefined) {
    node.setWidth(config.width)
  }
  if (config.height !== undefined) {
    node.setHeight(config.height)
  }
  if (config.widthPercent !== undefined) {
    node.setWidthPercent(config.widthPercent)
  }
  if (config.heightPercent !== undefined) {
    node.setHeightPercent(config.heightPercent)
  }
  // Yoga's API uses branded numeric types (FlexDirection, Wrap, etc.)
  // while NodeConfig uses plain numbers for cross-engine compatibility.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const n = node as any
  if (config.flexDirection !== undefined) {
    n.setFlexDirection(config.flexDirection)
  }
  if (config.flexWrap !== undefined) {
    n.setFlexWrap(config.flexWrap)
  }
  if (config.alignContent !== undefined) {
    n.setAlignContent(config.alignContent)
  }
  if (config.alignItems !== undefined) {
    n.setAlignItems(config.alignItems)
  }
  if (config.justifyContent !== undefined) {
    n.setJustifyContent(config.justifyContent)
  }
  if (config.flexGrow !== undefined) {
    n.setFlexGrow(config.flexGrow)
  }
  if (config.flexShrink !== undefined) {
    n.setFlexShrink(config.flexShrink)
  }
  if (config.flexBasis !== undefined) {
    n.setFlexBasis(config.flexBasis)
  }
  if (config.gap !== undefined) {
    n.setGap(config.gap.gutter, config.gap.value)
  }
  if (config.gapRow !== undefined) {
    n.setGap(yoga.GUTTER_ROW, config.gapRow)
  }
  if (config.gapColumn !== undefined) {
    n.setGap(yoga.GUTTER_COLUMN, config.gapColumn)
  }
  if (config.padding !== undefined) {
    n.setPadding(yoga.EDGE_ALL, config.padding)
  }
  if (config.paddingPercent !== undefined) {
    n.setPaddingPercent(yoga.EDGE_ALL, config.paddingPercent)
  }
  if (config.margin !== undefined) {
    n.setMargin(config.margin.edge, config.margin.value)
  }
  if (config.marginPercent !== undefined) {
    n.setMarginPercent(config.marginPercent.edge, config.marginPercent.value)
  }
  if (config.minWidth !== undefined) {
    n.setMinWidth(config.minWidth)
  }
  if (config.maxWidth !== undefined) {
    n.setMaxWidth(config.maxWidth)
  }
  if (config.minWidthPercent !== undefined) {
    n.setMinWidthPercent(config.minWidthPercent)
  }
  if (config.maxWidthPercent !== undefined) {
    n.setMaxWidthPercent(config.maxWidthPercent)
  }
  if (config.positionType !== undefined) {
    n.setPositionType(config.positionType)
  }
  if (config.position !== undefined) {
    for (const p of config.position) {
      n.setPosition(p.edge, p.value)
    }
  }
  if (config.positionPercent !== undefined) {
    for (const p of config.positionPercent) {
      n.setPositionPercent(p.edge, p.value)
    }
  }
}

interface CompareLayoutsOptions {
  category: string
  name: string
  rootConfig: NodeConfig
  childConfigs?: ChildConfig[]
  /** Custom setup for nodes that need special configuration */
  customSetup?: (fRoot: Flexily.Node, yRoot: YogaNode) => void
  layoutWidth?: number
  layoutHeight?: number
}

/**
 * Main comparison helper - creates Flexily and Yoga trees, compares layouts
 */
function compareLayouts(options: CompareLayoutsOptions): boolean {
  const { category, name, rootConfig, childConfigs = [], customSetup, layoutWidth = 100, layoutHeight = 100 } = options

  // Create Flexily tree
  const fRoot = createFlexilyNode(rootConfig)

  // Create children
  for (let i = 0; i < childConfigs.length; i++) {
    const childConfig = childConfigs[i]!
    const count = childConfig.count ?? 1
    for (let j = 0; j < count; j++) {
      const child = createFlexilyNode(childConfig)
      fRoot.insertChild(child, fRoot.getChildCount())
    }
  }

  // Create Yoga tree
  const yRoot = createYogaNode(rootConfig)

  for (let i = 0; i < childConfigs.length; i++) {
    const childConfig = childConfigs[i]!
    const count = childConfig.count ?? 1
    for (let j = 0; j < count; j++) {
      const child = createYogaNode(childConfig)
      yRoot.insertChild(child, yRoot.getChildCount())
    }
  }

  // Apply custom setup if provided
  if (customSetup) {
    customSetup(fRoot, yRoot)
  }

  // Calculate layouts
  fRoot.calculateLayout(layoutWidth, layoutHeight, Flexily.DIRECTION_LTR)
  yRoot.calculateLayout(layoutWidth, layoutHeight, yoga.DIRECTION_LTR)

  const flexilyLayout = getFlexilyLayout(fRoot)
  const yogaLayout = getYogaLayout(yRoot)

  yRoot.freeRecursive()

  const match = layoutsMatch(flexilyLayout, yogaLayout)
  recordResult({
    category,
    name,
    passed: match,
    flexily: flexilyLayout,
    yoga: yogaLayout,
  })

  return match
}

// ============================================================================
// Category: Flex Wrap Edge Cases
// ============================================================================

describe("Yoga Comparison: FlexWrap", () => {
  it.each([
    {
      name: "wrap-basic",
      description: "three items that need wrapping",
      childCount: 3,
      childWidth: 40,
      childHeight: 20,
      flexWrap: Flexily.WRAP_WRAP,
    },
    {
      name: "wrap-reverse",
      description: "wrap-reverse direction",
      childCount: 3,
      childWidth: 40,
      childHeight: 20,
      flexWrap: Flexily.WRAP_WRAP_REVERSE,
    },
  ])("$name: $description", ({ name, childCount, childWidth, childHeight, flexWrap }) => {
    const match = compareLayouts({
      category: "FlexWrap",
      name,
      rootConfig: {
        width: 100,
        height: 100,
        flexDirection: Flexily.FLEX_DIRECTION_ROW,
        flexWrap,
      },
      childConfigs: [{ width: childWidth, height: childHeight, count: childCount }],
    })
    expect(match).toBe(true)
  })

  it("wrap-with-gap: wrapping with row and column gap", () => {
    const match = compareLayouts({
      category: "FlexWrap",
      name: "wrap-with-gap",
      rootConfig: {
        width: 100,
        height: 100,
        flexDirection: Flexily.FLEX_DIRECTION_ROW,
        flexWrap: Flexily.WRAP_WRAP,
        gapColumn: 10,
        gapRow: 5,
      },
      childConfigs: [{ width: 40, height: 20, count: 4 }],
    })
    expect(match).toBe(true)
  })

  it("wrap-with-flexgrow: items with flex-grow on wrapped lines", () => {
    const match = compareLayouts({
      category: "FlexWrap",
      name: "wrap-with-flexgrow",
      rootConfig: {
        width: 100,
        height: 100,
        flexDirection: Flexily.FLEX_DIRECTION_ROW,
        flexWrap: Flexily.WRAP_WRAP,
      },
      childConfigs: [{ width: 40, height: 20, flexGrow: 1, count: 3 }],
    })
    expect(match).toBe(true)
  })

  it("wrap-column: column wrap", () => {
    const match = compareLayouts({
      category: "FlexWrap",
      name: "wrap-column",
      rootConfig: {
        width: 100,
        height: 100,
        flexDirection: Flexily.FLEX_DIRECTION_COLUMN,
        flexWrap: Flexily.WRAP_WRAP,
      },
      childConfigs: [{ width: 30, height: 40, count: 6 }],
    })
    expect(match).toBe(true)
  })
})

// ============================================================================
// Category: AlignContent
// ============================================================================

describe("Yoga Comparison: AlignContent", () => {
  const alignContentCases = [
    {
      name: "flex-start",
      align: Flexily.ALIGN_FLEX_START,
      description: "lines packed at start",
    },
    {
      name: "center",
      align: Flexily.ALIGN_CENTER,
      description: "lines packed at center",
    },
    {
      name: "flex-end",
      align: Flexily.ALIGN_FLEX_END,
      description: "lines packed at end",
    },
    {
      name: "space-between",
      align: Flexily.ALIGN_SPACE_BETWEEN,
      description: "lines spaced evenly",
    },
    {
      name: "space-around",
      align: Flexily.ALIGN_SPACE_AROUND,
      description: "lines with space around",
    },
    {
      name: "stretch",
      align: Flexily.ALIGN_STRETCH,
      description: "lines stretch to fill",
    },
  ]

  it.each(alignContentCases)("align-content-$name: $description", ({ name, align }) => {
    const match = compareLayouts({
      category: "AlignContent",
      name: `align-content-${name}`,
      rootConfig: {
        width: 100,
        height: 100,
        flexDirection: Flexily.FLEX_DIRECTION_ROW,
        flexWrap: Flexily.WRAP_WRAP,
        alignContent: align,
      },
      childConfigs: [{ width: 40, height: 20, count: 4 }],
    })
    expect(match).toBe(true)
  })
})

// ============================================================================
// Category: Absolute Positioning
// ============================================================================

describe("Yoga Comparison: AbsolutePositioning", () => {
  it("absolute-with-padding: absolute child in padded parent", () => {
    const match = compareLayouts({
      category: "AbsolutePositioning",
      name: "absolute-with-padding",
      rootConfig: {
        width: 100,
        height: 100,
        padding: 10,
      },
      childConfigs: [
        {
          positionType: Flexily.POSITION_TYPE_ABSOLUTE,
          position: [
            { edge: Flexily.EDGE_LEFT, value: 0 },
            { edge: Flexily.EDGE_TOP, value: 0 },
          ],
          width: 50,
          height: 50,
        },
      ],
    })
    expect(match).toBe(true)
  })

  it("absolute-all-edges: absolute with all edges set", () => {
    const match = compareLayouts({
      category: "AbsolutePositioning",
      name: "absolute-all-edges",
      rootConfig: { width: 100, height: 100 },
      childConfigs: [
        {
          positionType: Flexily.POSITION_TYPE_ABSOLUTE,
          position: [
            { edge: Flexily.EDGE_LEFT, value: 10 },
            { edge: Flexily.EDGE_TOP, value: 10 },
            { edge: Flexily.EDGE_RIGHT, value: 10 },
            { edge: Flexily.EDGE_BOTTOM, value: 10 },
          ],
        },
      ],
    })
    expect(match).toBe(true)
  })

  it("absolute-percent-position: absolute with percent positions", () => {
    const match = compareLayouts({
      category: "AbsolutePositioning",
      name: "absolute-percent-position",
      rootConfig: { width: 100, height: 100 },
      childConfigs: [
        {
          positionType: Flexily.POSITION_TYPE_ABSOLUTE,
          positionPercent: [
            { edge: Flexily.EDGE_LEFT, value: 10 },
            { edge: Flexily.EDGE_TOP, value: 10 },
          ],
          width: 50,
          height: 50,
        },
      ],
    })
    expect(match).toBe(true)
  })

  it("absolute-with-margin: absolute with margin offset", () => {
    // This test needs custom setup for setting margin on specific edges
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setHeight(100)

    const fChild = Flexily.Node.create(YOGA_OPTS)
    fChild.setPositionType(Flexily.POSITION_TYPE_ABSOLUTE)
    fChild.setPosition(Flexily.EDGE_LEFT, 0)
    fChild.setPosition(Flexily.EDGE_TOP, 0)
    fChild.setMargin(Flexily.EDGE_LEFT, 10)
    fChild.setMargin(Flexily.EDGE_TOP, 10)
    fChild.setWidth(50)
    fChild.setHeight(50)
    fRoot.insertChild(fChild, 0)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setHeight(100)

    const yChild = yoga.Node.create()
    yChild.setPositionType(yoga.POSITION_TYPE_ABSOLUTE)
    yChild.setPosition(yoga.EDGE_LEFT, 0)
    yChild.setPosition(yoga.EDGE_TOP, 0)
    yChild.setMargin(yoga.EDGE_LEFT, 10)
    yChild.setMargin(yoga.EDGE_TOP, 10)
    yChild.setWidth(50)
    yChild.setHeight(50)
    yRoot.insertChild(yChild, 0)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "AbsolutePositioning",
      name: "absolute-with-margin",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  // Note: Flexily centers absolute children with auto margins, Yoga does not.
  // This is a Flexily extension that follows CSS behavior more closely.
  it.skip("absolute-centering: center absolute child with auto margins (Flexily extension)", () => {
    // Intentionally skipped - documents known difference
  })
})

// ============================================================================
// Category: Min/Max Dimensions
// ============================================================================

describe("Yoga Comparison: MinMaxDimensions", () => {
  it("min-width-overrides-shrink: minWidth prevents shrinking", () => {
    // Custom setup needed for two children with different configs
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)

    const fChild1 = Flexily.Node.create(YOGA_OPTS)
    fChild1.setWidth(80)
    fChild1.setMinWidth(60)
    fChild1.setFlexShrink(1)
    fRoot.insertChild(fChild1, 0)

    const fChild2 = Flexily.Node.create(YOGA_OPTS)
    fChild2.setWidth(80)
    fChild2.setFlexShrink(1)
    fRoot.insertChild(fChild2, 1)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_ROW)

    const yChild1 = yoga.Node.create()
    yChild1.setWidth(80)
    yChild1.setMinWidth(60)
    yChild1.setFlexShrink(1)
    yRoot.insertChild(yChild1, 0)

    const yChild2 = yoga.Node.create()
    yChild2.setWidth(80)
    yChild2.setFlexShrink(1)
    yRoot.insertChild(yChild2, 1)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "MinMaxDimensions",
      name: "min-width-overrides-shrink",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  it("max-width-overrides-grow: maxWidth caps growth", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)

    const fChild1 = Flexily.Node.create(YOGA_OPTS)
    fChild1.setFlexGrow(1)
    fChild1.setMaxWidth(30)
    fRoot.insertChild(fChild1, 0)

    const fChild2 = Flexily.Node.create(YOGA_OPTS)
    fChild2.setFlexGrow(1)
    fRoot.insertChild(fChild2, 1)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_ROW)

    const yChild1 = yoga.Node.create()
    yChild1.setFlexGrow(1)
    yChild1.setMaxWidth(30)
    yRoot.insertChild(yChild1, 0)

    const yChild2 = yoga.Node.create()
    yChild2.setFlexGrow(1)
    yRoot.insertChild(yChild2, 1)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "MinMaxDimensions",
      name: "max-width-overrides-grow",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  it("min-max-percent: percent-based min/max constraints", () => {
    const match = compareLayouts({
      category: "MinMaxDimensions",
      name: "min-max-percent",
      rootConfig: {
        width: 100,
        height: 100,
        flexDirection: Flexily.FLEX_DIRECTION_ROW,
      },
      childConfigs: [
        {
          flexGrow: 1,
          minWidthPercent: 20,
          maxWidthPercent: 80,
        },
      ],
    })
    expect(match).toBe(true)
  })

  it("min-max-interaction: min > max scenario", () => {
    const match = compareLayouts({
      category: "MinMaxDimensions",
      name: "min-max-interaction",
      rootConfig: { width: 100, height: 100, flexDirection: Flexily.FLEX_DIRECTION_COLUMN },
      childConfigs: [
        {
          minWidth: 60,
          maxWidth: 40, // min > max (invalid, but needs to handle)
        },
      ],
    })
    expect(match).toBe(true)
  })

  it("nested-min-max: nested containers with constraints", () => {
    // Custom setup for nested structure
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setHeight(100)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)

    const fOuter = Flexily.Node.create(YOGA_OPTS)
    fOuter.setFlexGrow(1)
    fOuter.setMaxWidth(60)
    fRoot.insertChild(fOuter, 0)

    const fInner = Flexily.Node.create(YOGA_OPTS)
    fInner.setFlexGrow(1)
    fInner.setMinWidth(40)
    fOuter.insertChild(fInner, 0)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setHeight(100)
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_ROW)

    const yOuter = yoga.Node.create()
    yOuter.setFlexGrow(1)
    yOuter.setMaxWidth(60)
    yRoot.insertChild(yOuter, 0)

    const yInner = yoga.Node.create()
    yInner.setFlexGrow(1)
    yInner.setMinWidth(40)
    yOuter.insertChild(yInner, 0)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "MinMaxDimensions",
      name: "nested-min-max",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })
})

// ============================================================================
// Category: Gap
// ============================================================================

describe("Yoga Comparison: Gap", () => {
  it.each([
    {
      name: "row-gap-only",
      description: "gap between rows in wrapped content",
      gapRow: 10,
      flexWrap: Flexily.WRAP_WRAP,
      childCount: 4,
      childWidth: 40,
      childHeight: 30,
    },
    {
      name: "column-gap-only",
      description: "gap between columns",
      gapColumn: 10,
      childCount: 3,
      childWidth: 20,
      childHeight: 30,
    },
  ])("$name: $description", ({ name, gapRow, gapColumn, flexWrap, childCount, childWidth, childHeight }) => {
    const match = compareLayouts({
      category: "Gap",
      name,
      rootConfig: {
        width: 100,
        height: 100,
        flexDirection: Flexily.FLEX_DIRECTION_ROW,
        flexWrap,
        gapRow,
        gapColumn,
      },
      childConfigs: [{ width: childWidth, height: childHeight, count: childCount }],
    })
    expect(match).toBe(true)
  })

  it("gap-with-flexgrow: gap interacting with flex grow", () => {
    const match = compareLayouts({
      category: "Gap",
      name: "gap-with-flexgrow",
      rootConfig: {
        width: 100,
        height: 100,
        flexDirection: Flexily.FLEX_DIRECTION_ROW,
        gapColumn: 10,
      },
      childConfigs: [{ flexGrow: 1, height: 30, count: 3 }],
    })
    expect(match).toBe(true)
  })

  it("gap-all: both row and column gap", () => {
    const match = compareLayouts({
      category: "Gap",
      name: "gap-all",
      rootConfig: {
        width: 100,
        height: 100,
        flexDirection: Flexily.FLEX_DIRECTION_ROW,
        flexWrap: Flexily.WRAP_WRAP,
        gap: { gutter: Flexily.GUTTER_ALL, value: 10 },
      },
      childConfigs: [{ width: 25, height: 25, count: 6 }],
    })
    expect(match).toBe(true)
  })
})

// ============================================================================
// Category: Flex Shrink Edge Cases
// ============================================================================

describe("Yoga Comparison: FlexShrink", () => {
  it("shrink-with-basis: different basis values", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)

    const fChild1 = Flexily.Node.create(YOGA_OPTS)
    fChild1.setFlexBasis(100)
    fChild1.setFlexShrink(1)
    fRoot.insertChild(fChild1, 0)

    const fChild2 = Flexily.Node.create(YOGA_OPTS)
    fChild2.setFlexBasis(50)
    fChild2.setFlexShrink(1)
    fRoot.insertChild(fChild2, 1)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_ROW)

    const yChild1 = yoga.Node.create()
    yChild1.setFlexBasis(100)
    yChild1.setFlexShrink(1)
    yRoot.insertChild(yChild1, 0)

    const yChild2 = yoga.Node.create()
    yChild2.setFlexBasis(50)
    yChild2.setFlexShrink(1)
    yRoot.insertChild(yChild2, 1)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "FlexShrink",
      name: "shrink-with-basis",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  it("shrink-different-factors: unequal shrink factors", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)

    const fChild1 = Flexily.Node.create(YOGA_OPTS)
    fChild1.setWidth(100)
    fChild1.setFlexShrink(1)
    fRoot.insertChild(fChild1, 0)

    const fChild2 = Flexily.Node.create(YOGA_OPTS)
    fChild2.setWidth(100)
    fChild2.setFlexShrink(2)
    fRoot.insertChild(fChild2, 1)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_ROW)

    const yChild1 = yoga.Node.create()
    yChild1.setWidth(100)
    yChild1.setFlexShrink(1)
    yRoot.insertChild(yChild1, 0)

    const yChild2 = yoga.Node.create()
    yChild2.setWidth(100)
    yChild2.setFlexShrink(2)
    yRoot.insertChild(yChild2, 1)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "FlexShrink",
      name: "shrink-different-factors",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  it("shrink-zero-no-shrink: shrink 0 prevents shrinking", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)

    const fChild1 = Flexily.Node.create(YOGA_OPTS)
    fChild1.setWidth(80)
    fChild1.setFlexShrink(0)
    fRoot.insertChild(fChild1, 0)

    const fChild2 = Flexily.Node.create(YOGA_OPTS)
    fChild2.setWidth(80)
    fChild2.setFlexShrink(1)
    fRoot.insertChild(fChild2, 1)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_ROW)

    const yChild1 = yoga.Node.create()
    yChild1.setWidth(80)
    yChild1.setFlexShrink(0)
    yRoot.insertChild(yChild1, 0)

    const yChild2 = yoga.Node.create()
    yChild2.setWidth(80)
    yChild2.setFlexShrink(1)
    yRoot.insertChild(yChild2, 1)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "FlexShrink",
      name: "shrink-zero-no-shrink",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })
})

// ============================================================================
// Category: Flex Grow Edge Cases
// ============================================================================

describe("Yoga Comparison: FlexGrow", () => {
  it("grow-with-fixed-sibling: grow next to fixed width", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)

    const fChild1 = Flexily.Node.create(YOGA_OPTS)
    fChild1.setWidth(30)
    fRoot.insertChild(fChild1, 0)

    const fChild2 = Flexily.Node.create(YOGA_OPTS)
    fChild2.setFlexGrow(1)
    fRoot.insertChild(fChild2, 1)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_ROW)

    const yChild1 = yoga.Node.create()
    yChild1.setWidth(30)
    yRoot.insertChild(yChild1, 0)

    const yChild2 = yoga.Node.create()
    yChild2.setFlexGrow(1)
    yRoot.insertChild(yChild2, 1)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "FlexGrow",
      name: "grow-with-fixed-sibling",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  it("grow-unequal: unequal grow factors", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)

    const fChild1 = Flexily.Node.create(YOGA_OPTS)
    fChild1.setFlexGrow(1)
    fRoot.insertChild(fChild1, 0)

    const fChild2 = Flexily.Node.create(YOGA_OPTS)
    fChild2.setFlexGrow(2)
    fRoot.insertChild(fChild2, 1)

    const fChild3 = Flexily.Node.create(YOGA_OPTS)
    fChild3.setFlexGrow(1)
    fRoot.insertChild(fChild3, 2)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_ROW)

    const yChild1 = yoga.Node.create()
    yChild1.setFlexGrow(1)
    yRoot.insertChild(yChild1, 0)

    const yChild2 = yoga.Node.create()
    yChild2.setFlexGrow(2)
    yRoot.insertChild(yChild2, 1)

    const yChild3 = yoga.Node.create()
    yChild3.setFlexGrow(1)
    yRoot.insertChild(yChild3, 2)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "FlexGrow",
      name: "grow-unequal",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  it("grow-with-basis: flex-grow with flex-basis", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)

    const fChild1 = Flexily.Node.create(YOGA_OPTS)
    fChild1.setFlexBasis(20)
    fChild1.setFlexGrow(1)
    fRoot.insertChild(fChild1, 0)

    const fChild2 = Flexily.Node.create(YOGA_OPTS)
    fChild2.setFlexBasis(20)
    fChild2.setFlexGrow(1)
    fRoot.insertChild(fChild2, 1)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_ROW)

    const yChild1 = yoga.Node.create()
    yChild1.setFlexBasis(20)
    yChild1.setFlexGrow(1)
    yRoot.insertChild(yChild1, 0)

    const yChild2 = yoga.Node.create()
    yChild2.setFlexBasis(20)
    yChild2.setFlexGrow(1)
    yRoot.insertChild(yChild2, 1)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "FlexGrow",
      name: "grow-with-basis",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })
})

// ============================================================================
// Category: Complex Nested Layouts
// ============================================================================

describe("Yoga Comparison: NestedLayouts", () => {
  it.each([
    ["row", Flexily.FLEX_DIRECTION_ROW, "left", Flexily.EDGE_LEFT, -2],
    ["row", Flexily.FLEX_DIRECTION_ROW, "left", Flexily.EDGE_LEFT, 2],
    ["column", Flexily.FLEX_DIRECTION_COLUMN, "left", Flexily.EDGE_LEFT, -2],
    ["column", Flexily.FLEX_DIRECTION_COLUMN, "left", Flexily.EDGE_LEFT, 2],
    ["row", Flexily.FLEX_DIRECTION_ROW, "top", Flexily.EDGE_TOP, -2],
    ["row", Flexily.FLEX_DIRECTION_ROW, "top", Flexily.EDGE_TOP, 2],
    ["column", Flexily.FLEX_DIRECTION_COLUMN, "top", Flexily.EDGE_TOP, -2],
    ["column", Flexily.FLEX_DIRECTION_COLUMN, "top", Flexily.EDGE_TOP, 2],
  ] as const)(
    "allocated auto margins: %s (%i), %s (%i) margin %i",
    (_directionName, direction, _edgeName, edge, margin) => {
      // The parent's allocation is already a border box. Descendants must use
      // that box minus padding, not a width/height with the margin applied twice.
      const rootConfig = { width: 69, height: 69, flexDirection: direction }
      const childConfig = { flexGrow: 1, padding: 2, margin: { edge, value: margin } }
      const contentConfig = { widthPercent: 100, heightPercent: 100 }
      const fRoot = createFlexilyNode(rootConfig)
      const fChild = createFlexilyNode(childConfig)
      fChild.insertChild(createFlexilyNode(contentConfig), 0)
      fRoot.insertChild(fChild, 0)
      const yRoot = createYogaNode(rootConfig)
      const yChild = createYogaNode(childConfig)
      yChild.insertChild(createYogaNode(contentConfig), 0)
      yRoot.insertChild(yChild, 0)

      try {
        // Include a resize round trip: cached descendants must receive the same
        // content-box constraints as a first layout, in both axes.
        for (const size of [69, 47, 69]) {
          fRoot.setWidth(size)
          fRoot.setHeight(size)
          yRoot.setWidth(size)
          yRoot.setHeight(size)
          fRoot.calculateLayout(size, size, Flexily.DIRECTION_LTR)
          yRoot.calculateLayout(size, size, yoga.DIRECTION_LTR)
          expect(getFlexilyLayout(fRoot)).toEqual(getYogaLayout(yRoot))
        }
      } finally {
        yRoot.freeRecursive()
        fRoot.freeRecursive()
      }
    },
  )

  it("nested-flex: multiple nesting levels", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setHeight(100)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)

    const fLeft = Flexily.Node.create(YOGA_OPTS)
    fLeft.setFlexGrow(1)
    fLeft.setFlexDirection(Flexily.FLEX_DIRECTION_COLUMN)
    fRoot.insertChild(fLeft, 0)

    const fLeftTop = Flexily.Node.create(YOGA_OPTS)
    fLeftTop.setFlexGrow(1)
    fLeft.insertChild(fLeftTop, 0)

    const fLeftBottom = Flexily.Node.create(YOGA_OPTS)
    fLeftBottom.setFlexGrow(1)
    fLeft.insertChild(fLeftBottom, 1)

    const fRight = Flexily.Node.create(YOGA_OPTS)
    fRight.setFlexGrow(2)
    fRoot.insertChild(fRight, 1)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setHeight(100)
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_ROW)

    const yLeft = yoga.Node.create()
    yLeft.setFlexGrow(1)
    yLeft.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN)
    yRoot.insertChild(yLeft, 0)

    const yLeftTop = yoga.Node.create()
    yLeftTop.setFlexGrow(1)
    yLeft.insertChild(yLeftTop, 0)

    const yLeftBottom = yoga.Node.create()
    yLeftBottom.setFlexGrow(1)
    yLeft.insertChild(yLeftBottom, 1)

    const yRight = yoga.Node.create()
    yRight.setFlexGrow(2)
    yRoot.insertChild(yRight, 1)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "NestedLayouts",
      name: "nested-flex",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  it("mixed-constraints: nested with various constraints", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setHeight(100)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_COLUMN)
    fRoot.setPadding(Flexily.EDGE_ALL, 5)

    const fHeader = Flexily.Node.create(YOGA_OPTS)
    fHeader.setHeight(20)
    fRoot.insertChild(fHeader, 0)

    const fContent = Flexily.Node.create(YOGA_OPTS)
    fContent.setFlexGrow(1)
    fContent.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)
    fContent.setGap(Flexily.GUTTER_COLUMN, 5)
    fRoot.insertChild(fContent, 1)

    const fSidebar = Flexily.Node.create(YOGA_OPTS)
    fSidebar.setWidth(20)
    fContent.insertChild(fSidebar, 0)

    const fMain = Flexily.Node.create(YOGA_OPTS)
    fMain.setFlexGrow(1)
    fContent.insertChild(fMain, 1)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setHeight(100)
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN)
    yRoot.setPadding(yoga.EDGE_ALL, 5)

    const yHeader = yoga.Node.create()
    yHeader.setHeight(20)
    yRoot.insertChild(yHeader, 0)

    const yContent = yoga.Node.create()
    yContent.setFlexGrow(1)
    yContent.setFlexDirection(yoga.FLEX_DIRECTION_ROW)
    yContent.setGap(yoga.GUTTER_COLUMN, 5)
    yRoot.insertChild(yContent, 1)

    const ySidebar = yoga.Node.create()
    ySidebar.setWidth(20)
    yContent.insertChild(ySidebar, 0)

    const yMain = yoga.Node.create()
    yMain.setFlexGrow(1)
    yContent.insertChild(yMain, 1)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "NestedLayouts",
      name: "mixed-constraints",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })
})

// ============================================================================
// Category: Percent Values Edge Cases
// ============================================================================

describe("Yoga Comparison: PercentValues", () => {
  it("percent-nested: percent in nested container", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setHeight(100)

    const fOuter = Flexily.Node.create(YOGA_OPTS)
    fOuter.setWidthPercent(50)
    fOuter.setHeightPercent(50)
    fRoot.insertChild(fOuter, 0)

    const fInner = Flexily.Node.create(YOGA_OPTS)
    fInner.setWidthPercent(50)
    fInner.setHeightPercent(50)
    fOuter.insertChild(fInner, 0)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setHeight(100)

    const yOuter = yoga.Node.create()
    yOuter.setWidthPercent(50)
    yOuter.setHeightPercent(50)
    yRoot.insertChild(yOuter, 0)

    const yInner = yoga.Node.create()
    yInner.setWidthPercent(50)
    yInner.setHeightPercent(50)
    yOuter.insertChild(yInner, 0)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "PercentValues",
      name: "percent-nested",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  it("percent-margin: percent margin values", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setHeight(100)

    const fChild = Flexily.Node.create(YOGA_OPTS)
    fChild.setWidth(50)
    fChild.setHeight(50)
    fChild.setMarginPercent(Flexily.EDGE_LEFT, 10)
    fChild.setMarginPercent(Flexily.EDGE_TOP, 10)
    fRoot.insertChild(fChild, 0)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setHeight(100)

    const yChild = yoga.Node.create()
    yChild.setWidth(50)
    yChild.setHeight(50)
    yChild.setMarginPercent(yoga.EDGE_LEFT, 10)
    yChild.setMarginPercent(yoga.EDGE_TOP, 10)
    yRoot.insertChild(yChild, 0)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "PercentValues",
      name: "percent-margin",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  it("percent-padding: percent padding values", () => {
    const match = compareLayouts({
      category: "PercentValues",
      name: "percent-padding",
      rootConfig: {
        width: 100,
        height: 100,
        paddingPercent: 10,
      },
      childConfigs: [{ flexGrow: 1 }],
    })
    expect(match).toBe(true)
  })
})

// ============================================================================
// Category: Intentional Differences (documented as different)
// ============================================================================

describe("Yoga Comparison: IntentionalDifferences", () => {
  it("shrink-weighted-by-basis: CSS spec weighted shrink", () => {
    // Both Flexily and Yoga use CSS spec: shrink proportional to (flexShrink * flexBasis)
    // This test verifies Flexily matches Yoga's behavior.

    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)

    const fChild1 = Flexily.Node.create(YOGA_OPTS)
    fChild1.setFlexBasis(200) // Large basis
    fChild1.setFlexShrink(1)
    fRoot.insertChild(fChild1, 0)

    const fChild2 = Flexily.Node.create(YOGA_OPTS)
    fChild2.setFlexBasis(100) // Small basis
    fChild2.setFlexShrink(1)
    fRoot.insertChild(fChild2, 1)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_ROW)

    const yChild1 = yoga.Node.create()
    yChild1.setFlexBasis(200)
    yChild1.setFlexShrink(1)
    yRoot.insertChild(yChild1, 0)

    const yChild2 = yoga.Node.create()
    yChild2.setFlexBasis(100)
    yChild2.setFlexShrink(1)
    yRoot.insertChild(yChild2, 1)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "IntentionalDifferences",
      name: "shrink-weighted-by-basis",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    // This test documents the difference - we expect it MAY differ
    // Just recording the result, not asserting
    log.debug?.(`shrink-weighted-by-basis: ${match ? "MATCHES" : "DIFFERS (expected)"}`)
    if (!match) {
      log.debug?.(`  Yoga (CSS spec weighted shrink): ${JSON.stringify(yogaLayout.children.map((c) => c.width))}`)
      log.debug?.(`  Flexily (proportional shrink): ${JSON.stringify(flexilyLayout.children.map((c) => c.width))}`)
    }
  })
})

// ============================================================================
// Category: Additional Edge Cases
// ============================================================================

describe("Yoga Comparison: EdgeCases", () => {
  it("zero-size-container: layout in zero-size container", () => {
    const match = compareLayouts({
      category: "EdgeCases",
      name: "zero-size-container",
      rootConfig: {
        width: 0,
        height: 0,
        flexDirection: Flexily.FLEX_DIRECTION_ROW,
      },
      childConfigs: [{ width: 50, height: 50 }],
      layoutWidth: 0,
      layoutHeight: 0,
    })
    expect(match).toBe(true)
  })

  it("single-item-wrap: single item with wrap enabled", () => {
    const match = compareLayouts({
      category: "EdgeCases",
      name: "single-item-wrap",
      rootConfig: {
        width: 100,
        height: 100,
        flexDirection: Flexily.FLEX_DIRECTION_ROW,
        flexWrap: Flexily.WRAP_WRAP,
      },
      childConfigs: [{ width: 50, height: 50 }],
    })
    expect(match).toBe(true)
  })

  it("overflow-no-shrink: items overflow when shrink=0", () => {
    const match = compareLayouts({
      category: "EdgeCases",
      name: "overflow-no-shrink",
      rootConfig: {
        width: 100,
        flexDirection: Flexily.FLEX_DIRECTION_ROW,
      },
      childConfigs: [{ width: 50, height: 50, flexShrink: 0, count: 3 }],
    })
    expect(match).toBe(true)
  })

  it("mixed-absolute-relative: absolute and relative siblings", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setHeight(100)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_COLUMN)

    const fRel1 = Flexily.Node.create(YOGA_OPTS)
    fRel1.setHeight(30)
    fRoot.insertChild(fRel1, 0)

    const fAbs = Flexily.Node.create(YOGA_OPTS)
    fAbs.setPositionType(Flexily.POSITION_TYPE_ABSOLUTE)
    fAbs.setPosition(Flexily.EDGE_RIGHT, 10)
    fAbs.setPosition(Flexily.EDGE_TOP, 10)
    fAbs.setWidth(20)
    fAbs.setHeight(20)
    fRoot.insertChild(fAbs, 1)

    const fRel2 = Flexily.Node.create(YOGA_OPTS)
    fRel2.setFlexGrow(1)
    fRoot.insertChild(fRel2, 2)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setHeight(100)
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN)

    const yRel1 = yoga.Node.create()
    yRel1.setHeight(30)
    yRoot.insertChild(yRel1, 0)

    const yAbs = yoga.Node.create()
    yAbs.setPositionType(yoga.POSITION_TYPE_ABSOLUTE)
    yAbs.setPosition(yoga.EDGE_RIGHT, 10)
    yAbs.setPosition(yoga.EDGE_TOP, 10)
    yAbs.setWidth(20)
    yAbs.setHeight(20)
    yRoot.insertChild(yAbs, 1)

    const yRel2 = yoga.Node.create()
    yRel2.setFlexGrow(1)
    yRoot.insertChild(yRel2, 2)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "EdgeCases",
      name: "mixed-absolute-relative",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  it("deeply-nested: 5 levels of nesting", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setWidth(100)
    fRoot.setHeight(100)

    let fCurrent = fRoot
    for (let i = 0; i < 5; i++) {
      const child = Flexily.Node.create(YOGA_OPTS)
      child.setFlexGrow(1)
      child.setPadding(Flexily.EDGE_ALL, 5)
      fCurrent.insertChild(child, 0)
      fCurrent = child
    }

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setWidth(100)
    yRoot.setHeight(100)

    let yCurrent = yRoot
    for (let i = 0; i < 5; i++) {
      const child = yoga.Node.create()
      child.setFlexGrow(1)
      child.setPadding(yoga.EDGE_ALL, 5)
      yCurrent.insertChild(child, 0)
      yCurrent = child
    }

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout)
    recordResult({
      category: "EdgeCases",
      name: "deeply-nested",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })
})

// ============================================================================
// Category: MeasureFunc with Percent Sizing — cross-axis resolution
// ============================================================================

describe("Yoga Comparison: MeasureFuncPercent", () => {
  function buildMeasureFunc(contentWidth = 80): Flexily.MeasureFunc {
    return (_w: number, wm: number) => {
      if (wm === Flexily.MEASURE_MODE_EXACTLY || wm === Flexily.MEASURE_MODE_AT_MOST) {
        if (_w >= contentWidth) {
          return { width: contentWidth, height: 1 }
        }
        const customHeight = 35
        return { width: Math.min(contentWidth, _w), height: customHeight }
      }
      return { width: contentWidth, height: 1 }
    }
  }

  it("percent-width-in-column: 30% width measure leaf should resolve against parent width", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_COLUMN)
    fRoot.setWidth(100)
    fRoot.setHeight(100)

    const fChild = Flexily.Node.create(YOGA_OPTS)
    fChild.setWidthPercent(30)
    fChild.setMeasureFunc(buildMeasureFunc(80))
    fRoot.insertChild(fChild, 0)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN)
    yRoot.setWidth(100)
    yRoot.setHeight(100)

    const yChild = yoga.Node.create()
    yChild.setWidthPercent(30)
    yChild.setMeasureFunc(buildMeasureFunc(80))
    yRoot.insertChild(yChild, 0)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout, 0.001)
    recordResult({
      category: "MeasureFuncPercent",
      name: "percent-width-in-column",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  it("percent-width-stretch-in-row: 30% width measure leaf stretched to parent height in row", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)
    fRoot.setWidth(100)
    fRoot.setHeight(100)

    const fChild = Flexily.Node.create(YOGA_OPTS)
    fChild.setWidthPercent(30)
    fChild.setMeasureFunc((_w: number) => {
      const derivedHeight = _w >= 80 ? 1 : Math.ceil(80 / Math.max(_w, 1))
      return { width: _w, height: derivedHeight }
    })
    fRoot.insertChild(fChild, 0)

    fRoot.calculateLayout(100, 100, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_ROW)
    yRoot.setWidth(100)
    yRoot.setHeight(100)

    const yChild = yoga.Node.create()
    yChild.setWidthPercent(30)
    yChild.setMeasureFunc((_w: number) => {
      const derivedHeight = _w >= 80 ? 1 : Math.ceil(80 / Math.max(_w, 1))
      return { width: _w, height: derivedHeight }
    })
    yRoot.insertChild(yChild, 0)

    yRoot.calculateLayout(100, 100, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout, 0.001)
    recordResult({
      category: "MeasureFuncPercent",
      name: "percent-width-stretch-in-row",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  it("flexgrow-widthpercent: row leaf with flexGrow and widthPercent re-measures after distribution", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)
    fRoot.setWidth(100)
    fRoot.setHeight(50)
    fRoot.setAlignItems(Flexily.ALIGN_FLEX_START)

    const fSibling = Flexily.Node.create(YOGA_OPTS)
    fSibling.setWidth(40)
    fSibling.setFlexShrink(0)
    fRoot.insertChild(fSibling, 0)

    const fChild = Flexily.Node.create(YOGA_OPTS)
    fChild.setWidthPercent(30)
    fChild.setFlexGrow(1)
    fChild.setMeasureFunc(buildMeasureFunc(80))
    fRoot.insertChild(fChild, 1)

    fRoot.calculateLayout(100, 50, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_ROW)
    yRoot.setWidth(100)
    yRoot.setHeight(50)
    yRoot.setAlignItems(yoga.ALIGN_FLEX_START)

    const ySibling = yoga.Node.create()
    ySibling.setWidth(40)
    ySibling.setFlexShrink(0)
    yRoot.insertChild(ySibling, 0)

    const yChild = yoga.Node.create()
    yChild.setWidthPercent(30)
    yChild.setFlexGrow(1)
    yChild.setMeasureFunc(buildMeasureFunc(80))
    yRoot.insertChild(yChild, 1)

    yRoot.calculateLayout(100, 50, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout, 0.001)
    recordResult({
      category: "MeasureFuncPercent",
      name: "flexgrow-widthpercent",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  // ==========================================================================
  // Percent Measure Leaf — Flat and nested scenarios matching
  // tests/differential-fuzz.fuzz.ts > Percent Measure Leaf
  // ==========================================================================

  it("percent-measure-leaf-row: flat row with percent+measure leaf children", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)
    fRoot.setWidth(300)
    fRoot.setHeight(200)

    // Child 1: 30% width, measureFunc with 200 content width
    // width=90, measure returns height=ceil(200/90)=3, but stretch → height=200
    const fC1 = Flexily.Node.create(YOGA_OPTS)
    fC1.setWidthPercent(30)
    fC1.setMeasureFunc((_w: number) => {
      if (_w >= 200) return { width: 200, height: 1 }
      return { width: Math.min(200, _w), height: Math.ceil(200 / Math.max(_w, 1)) }
    })
    fRoot.insertChild(fC1, 0)

    // Child 2: 50% width, measureFunc with 80 content width (fits in 150px → height=1)
    const fC2 = Flexily.Node.create(YOGA_OPTS)
    fC2.setWidthPercent(50)
    fC2.setMeasureFunc((_w: number) => {
      if (_w >= 80) return { width: 80, height: 1 }
      return { width: Math.min(80, _w), height: Math.ceil(80 / Math.max(_w, 1)) }
    })
    fRoot.insertChild(fC2, 1)

    // Child 3: fixed 60×40 sibling (no stretch — explicit height=40)
    const fC3 = Flexily.Node.create(YOGA_OPTS)
    fC3.setWidth(60)
    fC3.setHeight(40)
    fRoot.insertChild(fC3, 2)

    fRoot.calculateLayout(300, 200, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_ROW)
    yRoot.setWidth(300)
    yRoot.setHeight(200)

    const yC1 = yoga.Node.create()
    yC1.setWidthPercent(30)
    yC1.setMeasureFunc((_w: number) => {
      if (_w >= 200) return { width: 200, height: 1 }
      return { width: Math.min(200, _w), height: Math.ceil(200 / Math.max(_w, 1)) }
    })
    yRoot.insertChild(yC1, 0)

    const yC2 = yoga.Node.create()
    yC2.setWidthPercent(50)
    yC2.setMeasureFunc((_w: number) => {
      if (_w >= 80) return { width: 80, height: 1 }
      return { width: Math.min(80, _w), height: Math.ceil(80 / Math.max(_w, 1)) }
    })
    yRoot.insertChild(yC2, 1)

    const yC3 = yoga.Node.create()
    yC3.setWidth(60)
    yC3.setHeight(40)
    yRoot.insertChild(yC3, 2)

    yRoot.calculateLayout(300, 200, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout, 0.001)
    recordResult({
      category: "MeasureFuncPercent",
      name: "percent-measure-leaf-row",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  it("percent-measure-leaf-column: flat column with percent+measure leaf children", () => {
    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_COLUMN)
    fRoot.setWidth(300)
    fRoot.setHeight(200)

    // Child 1: 30% width, measureFunc with 200 content width.
    // In column: width is auto (stretch cross-axis → 300), height is main axis (auto from measure).
    // measure called with w=300, content=200 fits in 300 → height=1
    const fC1 = Flexily.Node.create(YOGA_OPTS)
    fC1.setWidthPercent(30)
    fC1.setMeasureFunc((_w: number) => {
      if (_w >= 200) return { width: 200, height: 1 }
      return { width: Math.min(200, _w), height: Math.ceil(200 / Math.max(_w, 1)) }
    })
    fRoot.insertChild(fC1, 0)

    // Child 2: 50% width, measureFunc with 80 content (fits in any reasonable width → height=1)
    const fC2 = Flexily.Node.create(YOGA_OPTS)
    fC2.setWidthPercent(50)
    fC2.setMeasureFunc((_w: number) => {
      if (_w >= 80) return { width: 80, height: 1 }
      return { width: Math.min(80, _w), height: Math.ceil(80 / Math.max(_w, 1)) }
    })
    fRoot.insertChild(fC2, 1)

    // Child 3: fixed 60×40 sibling
    const fC3 = Flexily.Node.create(YOGA_OPTS)
    fC3.setWidth(60)
    fC3.setHeight(40)
    fRoot.insertChild(fC3, 2)

    fRoot.calculateLayout(300, 200, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN)
    yRoot.setWidth(300)
    yRoot.setHeight(200)

    const yC1 = yoga.Node.create()
    yC1.setWidthPercent(30)
    yC1.setMeasureFunc((_w: number) => {
      if (_w >= 200) return { width: 200, height: 1 }
      return { width: Math.min(200, _w), height: Math.ceil(200 / Math.max(_w, 1)) }
    })
    yRoot.insertChild(yC1, 0)

    const yC2 = yoga.Node.create()
    yC2.setWidthPercent(50)
    yC2.setMeasureFunc((_w: number) => {
      if (_w >= 80) return { width: 80, height: 1 }
      return { width: Math.min(80, _w), height: Math.ceil(80 / Math.max(_w, 1)) }
    })
    yRoot.insertChild(yC2, 1)

    const yC3 = yoga.Node.create()
    yC3.setWidth(60)
    yC3.setHeight(40)
    yRoot.insertChild(yC3, 2)

    yRoot.calculateLayout(300, 200, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout, 0.001)
    recordResult({
      category: "MeasureFuncPercent",
      name: "percent-measure-leaf-column",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  it("percent-measure-leaf-nested-2x2: flexGrow containers with percent+measure grandchildren", () => {
    // Root: Row(400×200) → [Container(flexGrow:1), Container(flexGrow:1)]
    // Each container is a Column with 2 percent+measure leaf children.
    // Container width = 200 (flexGrow divides 400 - gap(10) = 390/2 ≈ 195)
    // Each leaf resolves widthPercent(30) and widthPercent(50) relative to container's 195px.

    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)
    fRoot.setWidth(400)
    fRoot.setHeight(200)
    fRoot.setGap(Flexily.GUTTER_COLUMN, 10)

    const fOuter1 = Flexily.Node.create(YOGA_OPTS)
    fOuter1.setFlexGrow(1)
    fOuter1.setFlexDirection(Flexily.FLEX_DIRECTION_COLUMN)
    fOuter1.setGap(Flexily.GUTTER_ROW, 5)
    fRoot.insertChild(fOuter1, 0)

    const fL1 = Flexily.Node.create(YOGA_OPTS)
    fL1.setWidthPercent(30)
    fL1.setMeasureFunc((_w: number) => {
      if (_w >= 200) return { width: 200, height: 1 }
      return { width: Math.min(200, _w), height: Math.ceil(200 / Math.max(_w, 1)) }
    })
    fOuter1.insertChild(fL1, 0)

    const fL2 = Flexily.Node.create(YOGA_OPTS)
    fL2.setWidthPercent(50)
    fL2.setMeasureFunc((_w: number) => {
      if (_w >= 80) return { width: 80, height: 1 }
      return { width: Math.min(80, _w), height: Math.ceil(80 / Math.max(_w, 1)) }
    })
    fOuter1.insertChild(fL2, 1)

    const fOuter2 = Flexily.Node.create(YOGA_OPTS)
    fOuter2.setFlexGrow(1)
    fOuter2.setFlexDirection(Flexily.FLEX_DIRECTION_COLUMN)
    fOuter2.setGap(Flexily.GUTTER_ROW, 5)
    fRoot.insertChild(fOuter2, 1)

    const fL3 = Flexily.Node.create(YOGA_OPTS)
    fL3.setWidthPercent(40)
    fL3.setMeasureFunc((_w: number) => {
      if (_w >= 120) return { width: 120, height: 1 }
      return { width: Math.min(120, _w), height: Math.ceil(120 / Math.max(_w, 1)) }
    })
    fOuter2.insertChild(fL3, 0)

    const fL4 = Flexily.Node.create(YOGA_OPTS)
    fL4.setWidthPercent(60)
    fL4.setMeasureFunc((_w: number) => {
      if (_w >= 90) return { width: 90, height: 1 }
      return { width: Math.min(90, _w), height: Math.ceil(90 / Math.max(_w, 1)) }
    })
    fOuter2.insertChild(fL4, 1)

    fRoot.calculateLayout(400, 200, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_ROW)
    yRoot.setWidth(400)
    yRoot.setHeight(200)
    yRoot.setGap(yoga.GUTTER_COLUMN, 10)

    const yOuter1 = yoga.Node.create()
    yOuter1.setFlexGrow(1)
    yOuter1.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN)
    yOuter1.setGap(yoga.GUTTER_ROW, 5)
    yRoot.insertChild(yOuter1, 0)

    const yL1 = yoga.Node.create()
    yL1.setWidthPercent(30)
    yL1.setMeasureFunc((_w: number) => {
      if (_w >= 200) return { width: 200, height: 1 }
      return { width: Math.min(200, _w), height: Math.ceil(200 / Math.max(_w, 1)) }
    })
    yOuter1.insertChild(yL1, 0)

    const yL2 = yoga.Node.create()
    yL2.setWidthPercent(50)
    yL2.setMeasureFunc((_w: number) => {
      if (_w >= 80) return { width: 80, height: 1 }
      return { width: Math.min(80, _w), height: Math.ceil(80 / Math.max(_w, 1)) }
    })
    yOuter1.insertChild(yL2, 1)

    const yOuter2 = yoga.Node.create()
    yOuter2.setFlexGrow(1)
    yOuter2.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN)
    yOuter2.setGap(yoga.GUTTER_ROW, 5)
    yRoot.insertChild(yOuter2, 1)

    const yL3 = yoga.Node.create()
    yL3.setWidthPercent(40)
    yL3.setMeasureFunc((_w: number) => {
      if (_w >= 120) return { width: 120, height: 1 }
      return { width: Math.min(120, _w), height: Math.ceil(120 / Math.max(_w, 1)) }
    })
    yOuter2.insertChild(yL3, 0)

    const yL4 = yoga.Node.create()
    yL4.setWidthPercent(60)
    yL4.setMeasureFunc((_w: number) => {
      if (_w >= 90) return { width: 90, height: 1 }
      return { width: Math.min(90, _w), height: Math.ceil(90 / Math.max(_w, 1)) }
    })
    yOuter2.insertChild(yL4, 1)

    yRoot.calculateLayout(400, 200, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout, 0.001)
    recordResult({
      category: "MeasureFuncPercent",
      name: "percent-measure-leaf-nested-2x2",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })

  it("percent-measure-leaf-nested-3x3: flexGrow containers with percent+measure grandchildren", () => {
    // Root: Column(500×300) → [Container(flexGrow:1) ×3]
    // Each container is a Row with 3 percent+measure leaf children.
    // Container height = 300/3 - gaps ≈ 93px each

    const fRoot = Flexily.Node.create(YOGA_OPTS)
    fRoot.setFlexDirection(Flexily.FLEX_DIRECTION_COLUMN)
    fRoot.setWidth(500)
    fRoot.setHeight(300)
    fRoot.setGap(Flexily.GUTTER_ROW, 10)

    const children: Array<{ wPct: number; content: number }> = [
      { wPct: 20, content: 180 },
      { wPct: 40, content: 250 },
      { wPct: 60, content: 100 },
    ]

    for (let i = 0; i < 3; i++) {
      const outerCol = Flexily.Node.create(YOGA_OPTS)
      outerCol.setFlexGrow(1)
      outerCol.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)
      outerCol.setGap(Flexily.GUTTER_COLUMN, 5)
      fRoot.insertChild(outerCol, i)

      for (let j = 0; j < 3; j++) {
        const leaf = Flexily.Node.create(YOGA_OPTS)
        const idx = (i + j) % 3
        const { wPct, content } = children[idx]!
        leaf.setWidthPercent(wPct)
        leaf.setMeasureFunc((_w: number) => {
          if (_w >= content) return { width: content, height: 1 }
          return { width: Math.min(content, _w), height: Math.ceil(content / Math.max(_w, 1)) }
        })
        outerCol.insertChild(leaf, j)
      }
    }

    fRoot.calculateLayout(500, 300, Flexily.DIRECTION_LTR)
    const flexilyLayout = getFlexilyLayout(fRoot)

    const yRoot = yoga.Node.create()
    yRoot.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN)
    yRoot.setWidth(500)
    yRoot.setHeight(300)
    yRoot.setGap(yoga.GUTTER_ROW, 10)

    for (let i = 0; i < 3; i++) {
      const outerCol = yoga.Node.create()
      outerCol.setFlexGrow(1)
      outerCol.setFlexDirection(yoga.FLEX_DIRECTION_ROW)
      outerCol.setGap(yoga.GUTTER_COLUMN, 5)
      yRoot.insertChild(outerCol, i)

      for (let j = 0; j < 3; j++) {
        const leaf = yoga.Node.create()
        const idx = (i + j) % 3
        const { wPct, content } = children[idx]!
        leaf.setWidthPercent(wPct)
        leaf.setMeasureFunc((_w: number) => {
          if (_w >= content) return { width: content, height: 1 }
          return { width: Math.min(content, _w), height: Math.ceil(content / Math.max(_w, 1)) }
        })
        outerCol.insertChild(leaf, j)
      }
    }

    yRoot.calculateLayout(500, 300, yoga.DIRECTION_LTR)
    const yogaLayout = getYogaLayout(yRoot)
    yRoot.freeRecursive()

    const match = layoutsMatch(flexilyLayout, yogaLayout, 0.001)
    recordResult({
      category: "MeasureFuncPercent",
      name: "percent-measure-leaf-nested-3x3",
      passed: match,
      flexily: flexilyLayout,
      yoga: yogaLayout,
    })
    expect(match).toBe(true)
  })
})

// ============================================================================
// Generate Report
// ============================================================================

describe("Summary Report", () => {
  it("prints summary at end", () => {
    // This test runs last and prints the summary
    const passed = results.filter((r) => r.passed)
    const failed = results.filter((r) => !r.passed)

    const lines: string[] = []
    lines.push("=".repeat(80))
    lines.push("YOGA COMPATIBILITY TEST REPORT")
    lines.push("=".repeat(80))
    lines.push(`Total: ${results.length} tests`)
    lines.push(`Passed: ${passed.length}`)
    lines.push(`Failed: ${failed.length}`)

    if (failed.length > 0) {
      lines.push("-".repeat(80))
      lines.push("FAILED TESTS:")
      lines.push("-".repeat(80))

      // Group by category
      const byCategory = new Map<string, TestResult[]>()
      for (const r of failed) {
        const list = byCategory.get(r.category) || []
        list.push(r)
        byCategory.set(r.category, list)
      }

      for (const [category, tests] of byCategory) {
        lines.push(`\n### ${category}`)
        for (const test of tests) {
          lines.push(`\n**${test.name}**`)
          if (test.yoga && test.flexily) {
            lines.push("Expected (Yoga):")
            lines.push(formatLayout(test.yoga))
            lines.push("Actual (Flexily):")
            lines.push(formatLayout(test.flexily))
          }
          if (test.error) {
            lines.push(`Error: ${test.error}`)
          }
        }
      }

      lines.push("-".repeat(80))
      lines.push("TOP 10 HIGHEST-IMPACT FIXES:")
      lines.push("-".repeat(80))

      // Prioritize by category importance
      const categoryPriority: Record<string, number> = {
        FlexWrap: 10,
        AlignContent: 9,
        AbsolutePositioning: 8,
        MinMaxDimensions: 7,
        Gap: 6,
        FlexShrink: 5,
        FlexGrow: 4,
        NestedLayouts: 3,
        PercentValues: 2,
      }

      const sorted = [...failed].sort((a, b) => {
        const pa = categoryPriority[a.category] || 0
        const pb = categoryPriority[b.category] || 0
        return pb - pa
      })

      const top10 = sorted.slice(0, 10)
      top10.forEach((test, i) => {
        lines.push(`${i + 1}. [${test.category}] ${test.name}`)
      })
    }

    lines.push("=".repeat(80))
    log.debug?.(lines.join("\n"))
  })
})

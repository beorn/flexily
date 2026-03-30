/**
 * Composable Flexily engine — createFlexily, createBareFlexily, pipe.
 *
 * FlexilyNode = Node + { setTextContent, getTextContent }.
 * No wrapper — text methods are mixed directly onto the Node instance.
 */

import { Node } from "./node-zero.js"
import { DIRECTION_LTR, MEASURE_MODE_UNDEFINED, MEASURE_MODE_AT_MOST } from "./constants.js"
import type { TextLayoutService, ResolvedTextStyle, PreparedText } from "./text-layout.js"
import { createMonospaceMeasurer } from "./monospace-measurer.js"

// ============================================================================
// FlexilyNode — Node + text content mixin
// ============================================================================

/** A Node with text content methods. */
export interface FlexilyNode extends Node {
  setTextContent(text: string, style?: Partial<ResolvedTextStyle>): void
  getTextContent(): string | null
}

const DEFAULT_TEXT_STYLE: ResolvedTextStyle = {
  fontShorthand: "1ch monospace",
  fontFamily: "monospace",
  fontSize: 1,
  fontWeight: 400,
  fontStyle: "normal",
  lineHeight: 1,
}

/** Mix text content methods onto a Node. Returns the same node typed as FlexilyNode. */
function mixTextContent(node: Node, engine: FlexilyEngine): FlexilyNode {
  let textContent: string | null = null
  let prepared: PreparedText | null = null

  // Save originals before overriding — setTextContent needs to call the
  // original setMeasureFunc without triggering text state clearing.
  const origSetMeasure = node.setMeasureFunc.bind(node)
  const origUnsetMeasure = node.unsetMeasureFunc.bind(node)

  const flexNode = node as FlexilyNode

  flexNode.setTextContent = function (text: string, style?: Partial<ResolvedTextStyle>): void {
    if (!engine.textLayout) {
      throw new Error("No TextLayoutService. Add a text plugin (withMonospace, withPretext, withTestMeasurer).")
    }

    textContent = text
    const resolved: ResolvedTextStyle = { ...DEFAULT_TEXT_STYLE, ...style }
    prepared = engine.textLayout.prepare({ text, style: resolved })

    // Install a MeasureFunc via original (bypasses text-clearing override)
    const p = prepared
    origSetMeasure((width, widthMode) => {
      if (widthMode === MEASURE_MODE_UNDEFINED) {
        const sizes = p.intrinsicSizes()
        const result = p.layout({ maxWidth: sizes.maxContentWidth })
        return { width: result.width, height: result.height }
      }
      const result = p.layout({ maxWidth: width })
      const usedWidth = widthMode === MEASURE_MODE_AT_MOST ? Math.min(width, result.width) : width
      return { width: usedWidth, height: result.height }
    })
  }

  flexNode.getTextContent = function (): string | null {
    return textContent
  }

  // Override setMeasureFunc/unsetMeasureFunc to clear text state when
  // the user explicitly sets a custom measure function.
  flexNode.setMeasureFunc = function (fn) {
    textContent = null
    prepared = null
    origSetMeasure(fn)
  }

  flexNode.unsetMeasureFunc = function () {
    textContent = null
    prepared = null
    origUnsetMeasure()
  }

  return flexNode
}

// ============================================================================
// Engine
// ============================================================================

/** The composable Flexily engine. */
export interface FlexilyEngine {
  createNode(): FlexilyNode
  calculateLayout(root: FlexilyNode, width?: number, height?: number, direction?: number): void
  textLayout?: TextLayoutService
}

/** A plugin that extends or configures the engine. */
export type FlexilyPlugin = (engine: FlexilyEngine) => FlexilyEngine

/**
 * Create a bare Flexily engine — no plugins, just nodes and layout.
 * Add plugins via pipe() for text measurement.
 */
export function createBareFlexily(): FlexilyEngine {
  const engine: FlexilyEngine = {
    createNode(): FlexilyNode {
      return mixTextContent(Node.create(), engine)
    },
    calculateLayout(root: FlexilyNode, width?: number, height?: number, direction?: number): void {
      ;(root as Node).calculateLayout(width, height, direction ?? DIRECTION_LTR)
    },
  }
  return engine
}

/**
 * Apply plugins to an engine, left to right.
 *
 * @example
 * ```typescript
 * const flex = pipe(createBareFlexily(), withMonospace(), withTestMeasurer())
 * ```
 */
export function pipe(engine: FlexilyEngine, ...plugins: FlexilyPlugin[]): FlexilyEngine {
  let result = engine
  for (const plugin of plugins) {
    result = plugin(result)
  }
  return result
}

/**
 * Create a batteries-included Flexily engine.
 *
 * Includes monospace text measurement (1 char = charWidth units).
 * For terminal UIs, the default charWidth/charHeight of 1 maps to terminal cells.
 *
 * @example
 * ```typescript
 * import { createFlexily } from "flexily"
 * const flex = createFlexily()
 * const node = flex.createNode()
 * node.setTextContent("Hello world")
 * flex.calculateLayout(node, 80, 24)
 * ```
 */
export function createFlexily(options?: { charWidth?: number; charHeight?: number }): FlexilyEngine {
  const engine = createBareFlexily()
  engine.textLayout = createMonospaceMeasurer(options?.charWidth ?? 1, options?.charHeight ?? 1)
  return engine
}

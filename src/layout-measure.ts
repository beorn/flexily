/**
 * Node Measurement (Intrinsic Sizing)
 *
 * measureNode() computes a node's width and height without calculating positions.
 * It's a lightweight alternative to layoutNode() used during Phase 5 for
 * intrinsic sizing of auto-sized container children.
 *
 * IMPORTANT: measureNode() overwrites layout.width/layout.height as a side effect.
 * Callers MUST save/restore these fields around calls to avoid corrupting
 * the fingerprint cache (see "Bug 1: measureNode corruption" in CLAUDE.md).
 */

import * as C from "./constants.js"
import type { Node } from "./node-zero.js"
import { resolveValue, applyMinMax } from "./utils.js"
import { resolveEdgeValue, resolveEdgeBorderValue, isRowDirection } from "./layout-helpers.js"
import { incMeasureNodeCalls, incLayoutCacheHits } from "./layout-stats.js"

/**
 * Measure a node to get its intrinsic size without computing positions.
 * This is a lightweight alternative to layoutNode for sizing-only passes.
 *
 * Sets layout.width and layout.height but NOT layout.left/top.
 *
 * @param node - The node to measure
 * @param availableWidth - Available width (NaN for unconstrained)
 * @param availableHeight - Available height (NaN for unconstrained)
 * @param direction - Layout direction (LTR or RTL)
 * @returns Whether the result is APPROXIMATE — an under-estimate, because the
 *   shrink-wrap shortcut met an overflowing row at or below `node`. The caller
 *   decides what to do about it; `layout-zero.ts` Phase 5 re-derives such a
 *   base size through the real algorithm when it is about to distribute from
 *   it, and keeps the approximation when it is not. See the block below.
 */
export function measureNode(node: Node, availableWidth: number, availableHeight: number, direction: number): boolean {
  incMeasureNodeCalls()
  const style = node.style
  const layout = node.layout

  // Handle display: none
  if (style.display === C.DISPLAY_NONE) {
    layout.width = 0
    layout.height = 0
    return false
  }

  // Calculate spacing
  const marginLeft = resolveEdgeValue(style.margin, 0, style.flexDirection, availableWidth, direction)
  const marginTop = resolveEdgeValue(style.margin, 1, style.flexDirection, availableWidth, direction)
  const marginRight = resolveEdgeValue(style.margin, 2, style.flexDirection, availableWidth, direction)
  const marginBottom = resolveEdgeValue(style.margin, 3, style.flexDirection, availableWidth, direction)

  const paddingLeft = resolveEdgeValue(style.padding, 0, style.flexDirection, availableWidth, direction)
  const paddingTop = resolveEdgeValue(style.padding, 1, style.flexDirection, availableWidth, direction)
  const paddingRight = resolveEdgeValue(style.padding, 2, style.flexDirection, availableWidth, direction)
  const paddingBottom = resolveEdgeValue(style.padding, 3, style.flexDirection, availableWidth, direction)

  const borderLeft = resolveEdgeBorderValue(style.border, 0, style.flexDirection, direction)
  const borderTop = resolveEdgeBorderValue(style.border, 1, style.flexDirection, direction)
  const borderRight = resolveEdgeBorderValue(style.border, 2, style.flexDirection, direction)
  const borderBottom = resolveEdgeBorderValue(style.border, 3, style.flexDirection, direction)

  // Calculate node dimensions
  // FIT_CONTENT and SNUG_CONTENT resolve the same as AUTO — available - margins
  // (when constrained) or NaN (when unconstrained). The consuming layout pass
  // handles the shrink-wrap + clamp semantics.
  let nodeWidth: number
  if (style.width.unit === C.UNIT_POINT) {
    nodeWidth = style.width.value
  } else if (style.width.unit === C.UNIT_PERCENT) {
    nodeWidth = resolveValue(style.width, availableWidth)
  } else if (Number.isNaN(availableWidth)) {
    nodeWidth = NaN
  } else {
    nodeWidth = availableWidth - marginLeft - marginRight
  }
  nodeWidth = applyMinMax(nodeWidth, style.minWidth, style.maxWidth, availableWidth)

  let nodeHeight: number
  if (style.height.unit === C.UNIT_POINT) {
    nodeHeight = style.height.value
  } else if (style.height.unit === C.UNIT_PERCENT) {
    nodeHeight = resolveValue(style.height, availableHeight)
  } else if (Number.isNaN(availableHeight)) {
    nodeHeight = NaN
  } else {
    nodeHeight = availableHeight - marginTop - marginBottom
  }

  // Apply aspect ratio (CSS aspect-ratio spec)
  // Re-apply min/max on the derived dimension to respect CSS box model.
  const aspectRatio = style.aspectRatio
  if (!Number.isNaN(aspectRatio) && aspectRatio > 0) {
    const widthIsAuto = Number.isNaN(nodeWidth) || style.width.unit === C.UNIT_AUTO
    const heightIsAuto = Number.isNaN(nodeHeight) || style.height.unit === C.UNIT_AUTO
    if (widthIsAuto && !heightIsAuto && !Number.isNaN(nodeHeight)) {
      nodeWidth = nodeHeight * aspectRatio
      nodeWidth = applyMinMax(nodeWidth, style.minWidth, style.maxWidth, availableWidth)
    } else if (heightIsAuto && !widthIsAuto && !Number.isNaN(nodeWidth)) {
      nodeHeight = nodeWidth / aspectRatio
    }
  }

  nodeHeight = applyMinMax(nodeHeight, style.minHeight, style.maxHeight, availableHeight)

  // Content area
  const innerLeft = borderLeft + paddingLeft
  const innerTop = borderTop + paddingTop
  const innerRight = borderRight + paddingRight
  const innerBottom = borderBottom + paddingBottom

  const minInnerWidth = innerLeft + innerRight
  const minInnerHeight = innerTop + innerBottom
  if (!Number.isNaN(nodeWidth) && nodeWidth < minInnerWidth) {
    nodeWidth = minInnerWidth
  }
  if (!Number.isNaN(nodeHeight) && nodeHeight < minInnerHeight) {
    nodeHeight = minInnerHeight
  }

  const contentWidth = Number.isNaN(nodeWidth) ? NaN : Math.max(0, nodeWidth - innerLeft - innerRight)
  const contentHeight = Number.isNaN(nodeHeight) ? NaN : Math.max(0, nodeHeight - innerTop - innerBottom)

  // Handle measure function (text nodes)
  if (node.hasMeasureFunc() && node.children.length === 0) {
    const widthIsAuto =
      style.width.unit === C.UNIT_AUTO || style.width.unit === C.UNIT_UNDEFINED || Number.isNaN(nodeWidth)
    const heightIsAuto =
      style.height.unit === C.UNIT_AUTO || style.height.unit === C.UNIT_UNDEFINED || Number.isNaN(nodeHeight)
    const widthMode = widthIsAuto ? C.MEASURE_MODE_AT_MOST : C.MEASURE_MODE_EXACTLY
    const heightMode = heightIsAuto ? C.MEASURE_MODE_UNDEFINED : C.MEASURE_MODE_EXACTLY
    const measureWidth = Number.isNaN(contentWidth) ? Infinity : contentWidth
    const measureHeight = Number.isNaN(contentHeight) ? Infinity : contentHeight

    const measured = node.cachedMeasure(measureWidth, widthMode, measureHeight, heightMode)!

    if (widthIsAuto) {
      nodeWidth = measured.width + innerLeft + innerRight
    }
    if (heightIsAuto) {
      nodeHeight = measured.height + innerTop + innerBottom
    }

    layout.width = Math.round(nodeWidth)
    layout.height = Math.round(nodeHeight)
    return false
  }

  // Handle leaf nodes without measureFunc
  if (node.children.length === 0) {
    if (Number.isNaN(nodeWidth)) {
      nodeWidth = innerLeft + innerRight
    }
    if (Number.isNaN(nodeHeight)) {
      nodeHeight = innerTop + innerBottom
    }
    layout.width = Math.round(nodeWidth)
    layout.height = Math.round(nodeHeight)
    return false
  }

  // For container nodes, we need to measure children to compute intrinsic size
  // Zero-alloc: iterate children directly without collecting into temporary array

  // First pass: count relative children (skip absolute/hidden)
  let relativeChildCount = 0
  for (const c of node.children) {
    if (c.style.display === C.DISPLAY_NONE) continue
    if (c.style.positionType !== C.POSITION_TYPE_ABSOLUTE) {
      relativeChildCount++
    }
  }

  if (relativeChildCount === 0) {
    // No relative children - size is just padding+border
    if (Number.isNaN(nodeWidth)) nodeWidth = minInnerWidth
    if (Number.isNaN(nodeHeight)) nodeHeight = minInnerHeight
    layout.width = Math.round(nodeWidth)
    layout.height = Math.round(nodeHeight)
    return false
  }

  const isRow = isRowDirection(style.flexDirection)
  const mainAxisSize = isRow ? contentWidth : contentHeight
  const crossAxisSize = isRow ? contentHeight : contentWidth
  const mainGap = isRow ? style.gap[0] : style.gap[1]

  // Second pass: measure each child and sum for intrinsic size
  let totalMainSize = 0
  let maxCrossSize = 0
  let itemCount = 0
  // Set when this measurement, or any measurement below it, took the
  // shrink-wrap shortcut on a row that overflows a definite main size.
  let approx = false

  for (const child of node.children) {
    // Skip absolute/hidden children (same filter as count pass)
    if (child.style.display === C.DISPLAY_NONE) continue
    if (child.style.positionType === C.POSITION_TYPE_ABSOLUTE) continue

    const childStyle = child.style

    // Get child margins
    const childMarginMain = isRow
      ? resolveEdgeValue(childStyle.margin, 0, style.flexDirection, contentWidth, direction) +
        resolveEdgeValue(childStyle.margin, 2, style.flexDirection, contentWidth, direction)
      : resolveEdgeValue(childStyle.margin, 1, style.flexDirection, contentWidth, direction) +
        resolveEdgeValue(childStyle.margin, 3, style.flexDirection, contentWidth, direction)
    const childMarginCross = isRow
      ? resolveEdgeValue(childStyle.margin, 1, style.flexDirection, contentWidth, direction) +
        resolveEdgeValue(childStyle.margin, 3, style.flexDirection, contentWidth, direction)
      : resolveEdgeValue(childStyle.margin, 0, style.flexDirection, contentWidth, direction) +
        resolveEdgeValue(childStyle.margin, 2, style.flexDirection, contentWidth, direction)

    // Measure child with appropriate constraints
    // For shrink-wrap: pass NaN for main axis, cross axis constraint for cross
    const childAvailW = isRow ? NaN : crossAxisSize
    const childAvailH = isRow ? crossAxisSize : NaN

    // Check cache first
    let measuredW = 0
    let measuredH = 0
    const cached = child.getCachedLayout(childAvailW, childAvailH)
    if (cached) {
      incLayoutCacheHits()
      // The verdict rides in the cache entry, so a hit reports the same
      // approximate-ness the miss would have.
      if (cached.approx) approx = true
    } else {
      // Save/restore layout around measureNode — it overwrites node.layout
      const savedW = child.layout.width
      const savedH = child.layout.height
      const childApprox = measureNode(child, childAvailW, childAvailH, direction)
      measuredW = child.layout.width
      measuredH = child.layout.height
      child.layout.width = savedW
      child.layout.height = savedH
      child.setCachedLayout(childAvailW, childAvailH, measuredW, measuredH, childApprox)
      if (childApprox) approx = true
    }

    const childMainSize = cached ? (isRow ? cached.width : cached.height) : isRow ? measuredW : measuredH
    const childCrossSize = cached ? (isRow ? cached.height : cached.width) : isRow ? measuredH : measuredW

    totalMainSize += childMainSize + childMarginMain
    maxCrossSize = Math.max(maxCrossSize, childCrossSize + childMarginCross)
    itemCount++
  }

  // Add gaps
  if (itemCount > 1) {
    totalMainSize += mainGap * (itemCount - 1)
  }

  // The shortcut's one unsound case: a row overflowing a definite main size.
  //
  // The loop above measured every child at an UNCONSTRAINED main axis
  // (childAvailW = NaN), i.e. at max-content. That stands in for the child's
  // real main size only while the flex algorithm would leave it alone. When
  // this row has a DEFINITE main size and the children's max-content sum
  // overflows it, the real algorithm shrinks them (or breaks them across
  // lines), and wrappable text inside then needs MORE rows than it reported
  // here — max-content is its one-line floor, so this measurement can only
  // under-estimate the cross size.
  //
  // This function does not resolve that: there is exactly one flexible-length
  // resolution in the engine and it is layoutNode's. It reports the
  // under-estimate instead, and layout-zero.ts Phase 5 pays for the real
  // algorithm only when it is about to distribute free space from the number.
  //
  // Row-only by construction: line wrapping keys off the INLINE size, which
  // for a row is the main axis this function deliberately leaves NaN. A
  // column's children take their inline size from childAvailW = crossAxisSize,
  // definite whenever the column's own width is, so the shortcut holds there.
  //
  // `> 0` rather than `!Number.isNaN`: a `width: 100%` row measured against an
  // unconstrained parent resolves to 0 (resolveValue's percent-against-NaN
  // rule), which is an artifact of that approximation and not a real budget.
  // Laying such a row out for real would wrap its text at width 0; the
  // shrink-wrap answer (max-content, one line) is the better estimate there.
  if (isRow && mainAxisSize > 0 && totalMainSize > mainAxisSize) {
    approx = true
  }

  // Compute final node size
  if (Number.isNaN(nodeWidth)) {
    nodeWidth = (isRow ? totalMainSize : maxCrossSize) + innerLeft + innerRight
  }
  if (Number.isNaN(nodeHeight)) {
    nodeHeight = (isRow ? maxCrossSize : totalMainSize) + innerTop + innerBottom
  }

  // Apply min/max again after shrink-wrap
  nodeWidth = applyMinMax(nodeWidth, style.minWidth, style.maxWidth, availableWidth)
  nodeHeight = applyMinMax(nodeHeight, style.minHeight, style.maxHeight, availableHeight)

  layout.width = Math.round(nodeWidth)
  layout.height = Math.round(nodeHeight)
  return approx
}

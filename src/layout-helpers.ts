/**
 * Layout Helper Functions
 *
 * Edge resolution helpers for margins, padding, borders.
 * These are pure functions with no state — safe to extract.
 */

import * as C from "./constants.js"
import type { Value } from "./types.js"
import { resolveValue } from "./utils.js"

// Re-export edge constants (canonical definitions in constants.ts)
export { EDGE_LEFT, EDGE_TOP, EDGE_RIGHT, EDGE_BOTTOM } from "./constants.js"

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Check if flex direction is row-oriented (horizontal main axis).
 */
export function isRowDirection(flexDirection: number): boolean {
  return flexDirection === C.FLEX_DIRECTION_ROW || flexDirection === C.FLEX_DIRECTION_ROW_REVERSE
}

/**
 * Check if flex direction is reversed.
 */
export function isReverseDirection(flexDirection: number): boolean {
  return flexDirection === C.FLEX_DIRECTION_ROW_REVERSE || flexDirection === C.FLEX_DIRECTION_COLUMN_REVERSE
}

/**
 * Get the logical edge value (START/END) for a given physical index.
 * Returns undefined if no logical value applies to this physical edge.
 *
 * EDGE_START/EDGE_END always resolve along the inline (horizontal) axis,
 * regardless of flex direction. Direction (LTR/RTL) determines the mapping:
 * - LTR: START->left, END->right
 * - RTL: START->right, END->left
 */
function getLogicalEdgeValue(
  arr: [Value, Value, Value, Value, Value, Value],
  physicalIndex: number,
  _flexDirection: number,
  direction: number = C.DIRECTION_LTR,
): Value | undefined {
  const isRTL = direction === C.DIRECTION_RTL

  // START/END always map to left/right (inline direction)
  if (physicalIndex === 0) {
    return isRTL ? arr[5] : arr[4] // Left: START (LTR) or END (RTL)
  } else if (physicalIndex === 2) {
    return isRTL ? arr[4] : arr[5] // Right: END (LTR) or START (RTL)
  }
  return undefined
}

/**
 * Resolve logical (START/END) margins/padding to physical values.
 * EDGE_START/EDGE_END always resolve along the inline (horizontal) axis:
 * - LTR: START->left, END->right
 * - RTL: START->right, END->left
 *
 * Physical edges (LEFT/RIGHT/TOP/BOTTOM) are used directly.
 * When both physical and logical are set, logical takes precedence.
 */
export function resolveEdgeValue(
  arr: [Value, Value, Value, Value, Value, Value],
  physicalIndex: number, // 0=left, 1=top, 2=right, 3=bottom
  flexDirection: number,
  availableSize: number,
  direction: number = C.DIRECTION_LTR,
): number {
  const logicalValue = getLogicalEdgeValue(arr, physicalIndex, flexDirection, direction)

  // Logical takes precedence if defined
  if (logicalValue && logicalValue.unit !== C.UNIT_UNDEFINED) {
    return resolveValue(logicalValue, availableSize)
  }

  // Fall back to physical
  return resolveValue(arr[physicalIndex]!, availableSize)
}

/**
 * Check if a logical edge margin is set to auto.
 */
export function isEdgeAuto(
  arr: [Value, Value, Value, Value, Value, Value],
  physicalIndex: number,
  flexDirection: number,
  direction: number = C.DIRECTION_LTR,
): boolean {
  const logicalValue = getLogicalEdgeValue(arr, physicalIndex, flexDirection, direction)

  // Check logical first
  if (logicalValue && logicalValue.unit !== C.UNIT_UNDEFINED) {
    return logicalValue.unit === C.UNIT_AUTO
  }

  // Fall back to physical
  return arr[physicalIndex]!.unit === C.UNIT_AUTO
}

/**
 * Resolve logical (START/END) border widths to physical values.
 * Border values are plain numbers (always points), so resolution is simpler
 * than for margin/padding. Uses NaN as the "not set" sentinel for logical slots.
 * When both physical and logical are set, logical takes precedence.
 *
 * EDGE_START/EDGE_END always resolve along the inline (horizontal) axis,
 * regardless of flex direction. Direction (LTR/RTL) determines the mapping:
 * - LTR: START->left, END->right
 * - RTL: START->right, END->left
 */
/**
 * Resolve logical (START/END) position edges to physical values.
 * Returns the resolved Value for a physical position index, considering
 * logical EDGE_START/EDGE_END. Logical takes precedence over physical.
 *
 * EDGE_START/EDGE_END always resolve along the inline (horizontal) axis:
 * - LTR: START->left, END->right
 * - RTL: START->right, END->left
 */
export function resolvePositionEdge(
  arr: [Value, Value, Value, Value, Value, Value],
  physicalIndex: number, // 0=left, 1=top, 2=right, 3=bottom
  direction: number = C.DIRECTION_LTR,
): Value {
  const logicalValue = getLogicalEdgeValue(arr, physicalIndex, 0 /* unused */, direction)

  // Logical takes precedence if defined
  if (logicalValue && logicalValue.unit !== C.UNIT_UNDEFINED) {
    return logicalValue
  }

  // Fall back to physical
  return arr[physicalIndex]!
}

export function resolveEdgeBorderValue(
  arr: [number, number, number, number, number, number],
  physicalIndex: number, // 0=left, 1=top, 2=right, 3=bottom
  _flexDirection: number,
  direction: number = C.DIRECTION_LTR,
): number {
  const isRTL = direction === C.DIRECTION_RTL

  // START/END always map to left/right (inline direction)
  let logicalSlot: number | undefined
  if (physicalIndex === 0) logicalSlot = isRTL ? 5 : 4
  else if (physicalIndex === 2) logicalSlot = isRTL ? 4 : 5

  // Logical takes precedence if set (NaN = not set)
  if (logicalSlot !== undefined && !Number.isNaN(arr[logicalSlot])) {
    return arr[logicalSlot]
  }
  return arr[physicalIndex]
}

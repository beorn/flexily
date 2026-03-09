/**
 * Flexily Classic - Allocating Layout Engine
 *
 * The classic (allocating) variant of Flexily. Use for debugging, comparison,
 * or when you need reentrancy (concurrent layouts).
 *
 * The main export 'flexily' uses the faster zero-allocation algorithm.
 *
 * @example
 * ```typescript
 * import { Node, FLEX_DIRECTION_ROW, DIRECTION_LTR } from 'flexily/classic';
 *
 * const root = Node.create();
 * root.setWidth(80);
 * root.setFlexDirection(FLEX_DIRECTION_ROW);
 *
 * const child = Node.create();
 * child.setFlexGrow(1);
 * root.insertChild(child, 0);
 *
 * root.calculateLayout(80, 24, DIRECTION_LTR);
 * console.log(child.getComputedWidth()); // 80
 * ```
 */
export { Node } from "./classic/node.js";
export { FLEX_DIRECTION_COLUMN, FLEX_DIRECTION_COLUMN_REVERSE, FLEX_DIRECTION_ROW, FLEX_DIRECTION_ROW_REVERSE, WRAP_NO_WRAP, WRAP_WRAP, WRAP_WRAP_REVERSE, ALIGN_AUTO, ALIGN_FLEX_START, ALIGN_CENTER, ALIGN_FLEX_END, ALIGN_STRETCH, ALIGN_BASELINE, ALIGN_SPACE_BETWEEN, ALIGN_SPACE_AROUND, JUSTIFY_FLEX_START, JUSTIFY_CENTER, JUSTIFY_FLEX_END, JUSTIFY_SPACE_BETWEEN, JUSTIFY_SPACE_AROUND, JUSTIFY_SPACE_EVENLY, EDGE_LEFT, EDGE_TOP, EDGE_RIGHT, EDGE_BOTTOM, EDGE_START, EDGE_END, EDGE_HORIZONTAL, EDGE_VERTICAL, EDGE_ALL, GUTTER_COLUMN, GUTTER_ROW, GUTTER_ALL, DISPLAY_FLEX, DISPLAY_NONE, POSITION_TYPE_STATIC, POSITION_TYPE_RELATIVE, POSITION_TYPE_ABSOLUTE, OVERFLOW_VISIBLE, OVERFLOW_HIDDEN, OVERFLOW_SCROLL, DIRECTION_INHERIT, DIRECTION_LTR, DIRECTION_RTL, MEASURE_MODE_UNDEFINED, MEASURE_MODE_EXACTLY, MEASURE_MODE_AT_MOST, UNIT_UNDEFINED, UNIT_POINT, UNIT_PERCENT, UNIT_AUTO, } from "./constants.js";
export type { BaselineFunc, Layout, MeasureFunc, Style, Value } from "./types.js";
export { createDefaultStyle, createValue } from "./types.js";
export { layoutNodeCalls, resolveEdgeCalls, layoutSizingCalls, layoutPositioningCalls, layoutCacheHits, resetLayoutStats, } from "./classic/layout.js";
//# sourceMappingURL=index-classic.d.ts.map
/**
 * Flexily Layout Algorithm — Main Entry Point
 *
 * Core flexbox layout computation. This file contains:
 * - computeLayout(): top-level entry point
 * - layoutNode(): recursive layout algorithm (11 phases)
 *
 * Helper modules (split for maintainability, zero-allocation preserved):
 * - layout-helpers.ts: Edge resolution (margins, padding, borders)
 * - layout-traversal.ts: Tree traversal (markSubtreeLayoutSeen, countNodes)
 * - layout-flex-lines.ts: Pre-allocated arrays, line breaking, flex distribution
 * - layout-measure.ts: Intrinsic sizing (measureNode)
 * - layout-stats.ts: Debug/benchmark counters
 *
 * Based on Planning-nl/flexbox.js reference implementation.
 */
import type { Node } from "./node-zero.js";
export { isRowDirection, isReverseDirection, resolveEdgeValue, isEdgeAuto, resolveEdgeBorderValue, } from "./layout-helpers.js";
export { markSubtreeLayoutSeen, countNodes } from "./layout-traversal.js";
export { layoutNodeCalls, measureNodeCalls, resolveEdgeCalls, layoutSizingCalls, layoutPositioningCalls, layoutCacheHits, resetLayoutStats, } from "./layout-stats.js";
export { measureNode } from "./layout-measure.js";
/**
 * Compute layout for a node tree.
 */
export declare function computeLayout(root: Node, availableWidth: number, availableHeight: number, direction?: number): void;
//# sourceMappingURL=layout-zero.d.ts.map
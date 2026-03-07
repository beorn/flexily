/**
 * Flexture Layout Algorithm
 *
 * Core flexbox layout computation extracted from node.ts.
 * Based on Planning-nl/flexbox.js reference implementation.
 */
import type { Node } from "./node.js";
import type { Value } from "../types.js";
/**
 * Check if flex direction is row-oriented (horizontal main axis).
 */
export declare function isRowDirection(flexDirection: number): boolean;
/**
 * Check if flex direction is reversed.
 */
export declare function isReverseDirection(flexDirection: number): boolean;
/**
 * Resolve logical (START/END) margins/padding to physical values.
 * EDGE_START/EDGE_END always resolve along the inline (horizontal) axis:
 * - LTR: START→left, END→right
 * - RTL: START→right, END→left
 *
 * Physical edges (LEFT/RIGHT/TOP/BOTTOM) are used directly.
 * When both physical and logical are set, logical takes precedence.
 */
export declare function resolveEdgeValue(arr: [Value, Value, Value, Value, Value, Value], physicalIndex: number, // 0=left, 1=top, 2=right, 3=bottom
flexDirection: number, availableSize: number, direction?: number): number;
/**
 * Check if a logical edge margin is set to auto.
 */
export declare function isEdgeAuto(arr: [Value, Value, Value, Value, Value, Value], physicalIndex: number, flexDirection: number, direction?: number): boolean;
/**
 * Resolve logical (START/END) border widths to physical values.
 * Border values are plain numbers (always points), so resolution is simpler
 * than for margin/padding. Uses NaN as the "not set" sentinel for logical slots.
 * When both physical and logical are set, logical takes precedence.
 */
export declare function resolveEdgeBorderValue(arr: [number, number, number, number, number, number], physicalIndex: number, // 0=left, 1=top, 2=right, 3=bottom
_flexDirection: number, direction?: number): number;
export declare function markSubtreeLayoutSeen(node: Node): void;
export declare function countNodes(node: Node): number;
/**
 * Compute layout for a node tree.
 *
 * @param root - Root node of the tree
 * @param availableWidth - Available width for layout
 * @param availableHeight - Available height for layout
 * @param direction - Text direction (LTR or RTL), affects horizontal edge resolution
 */
export declare function computeLayout(root: Node, availableWidth: number, availableHeight: number, direction?: number): void;
export declare let layoutNodeCalls: number;
export declare let resolveEdgeCalls: number;
export declare let layoutSizingCalls: number;
export declare let layoutPositioningCalls: number;
export declare let layoutCacheHits: number;
export declare function resetLayoutStats(): void;
//# sourceMappingURL=layout.d.ts.map
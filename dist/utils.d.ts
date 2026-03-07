/**
 * Flexture Utility Functions
 *
 * Helper functions for edge value manipulation and value resolution.
 */
import type { Value } from "./types.js";
/**
 * Shared traversal stack for iterative tree operations.
 * Avoids recursion (prevents stack overflow on deep trees) and avoids
 * allocation during layout passes.
 */
export declare const traversalStack: unknown[];
/**
 * Set a value on an edge array (supports all edge types including logical START/END).
 */
export declare function setEdgeValue(arr: [Value, Value, Value, Value, Value, Value], edge: number, value: number, unit: number): void;
/**
 * Set a border value on an edge array.
 */
export declare function setEdgeBorder(arr: [number, number, number, number, number, number], edge: number, value: number): void;
/**
 * Get a value from an edge array.
 */
export declare function getEdgeValue(arr: [Value, Value, Value, Value, Value, Value], edge: number): Value;
/**
 * Get a border value from an edge array.
 */
export declare function getEdgeBorderValue(arr: [number, number, number, number, number, number], edge: number): number;
/**
 * Resolve a value (point or percent) to an absolute number.
 */
export declare function resolveValue(value: Value, availableSize: number): number;
/**
 * Apply min/max constraints to a size.
 *
 * When size is NaN (auto-sized), min constraints establish a floor.
 * This handles the case where a parent has minWidth/maxWidth but no explicit width -
 * children need to resolve percentages against the constrained size.
 */
export declare function applyMinMax(size: number, min: Value, max: Value, available: number): number;
//# sourceMappingURL=utils.d.ts.map
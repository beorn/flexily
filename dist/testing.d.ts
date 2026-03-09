/**
 * Flexily Testing Utilities
 *
 * Diagnostic helpers for verifying layout correctness, especially
 * incremental re-layout consistency. Used by downstream consumers
 * (silvery, km-tui) and flexily's own test suite.
 *
 * @example
 * ```typescript
 * import { Node, DIRECTION_LTR } from 'flexily';
 * import { getLayout, diffLayouts, assertLayoutSanity } from 'flexily/testing';
 *
 * const root = Node.create();
 * root.setWidth(80);
 * root.calculateLayout(80, 24, DIRECTION_LTR);
 * assertLayoutSanity(root);
 * const layout = getLayout(root);
 * ```
 */
import type { MeasureFunc } from "./types.js";
import { Node } from "./node-zero.js";
export interface LayoutResult {
    left: number;
    top: number;
    width: number;
    height: number;
    children: LayoutResult[];
}
export interface BuildTreeResult {
    root: Node;
    dirtyTargets: Node[];
}
/** Recursively extract computed layout from a node tree. */
export declare function getLayout(node: Node): LayoutResult;
/** Format a layout tree as an indented string for debugging. */
export declare function formatLayout(layout: LayoutResult, indent?: number): string;
/**
 * Collect node-by-node diffs between two layout trees.
 * Returns empty array if layouts match.
 */
export declare function diffLayouts(a: LayoutResult, b: LayoutResult, path?: string): string[];
/**
 * Wrapping text measure function factory.
 * Simulates text of given width that wraps to multiple lines when constrained.
 */
export declare function textMeasure(textWidth: number): MeasureFunc;
/**
 * Assert that all layout values are non-negative and width is finite.
 * Height may be NaN for auto-height trees with unconstrained height.
 * Throws a descriptive error on failure.
 */
export declare function assertLayoutSanity(node: Node, path?: string): void;
/**
 * Differential oracle: re-layout of partially-dirty tree must match fresh layout.
 * Throws a descriptive error with node-by-node diff on failure.
 */
export declare function expectRelayoutMatchesFresh(buildTree: () => BuildTreeResult, layoutWidth: number, layoutHeight: number): void;
/**
 * Assert that laying out twice with identical constraints produces identical results.
 * Catches non-determinism or state corruption from a single layout pass.
 */
export declare function expectIdempotent(buildTree: () => BuildTreeResult, layoutWidth: number, layoutHeight: number): void;
/**
 * Assert that layout at width W, then different width W', then back to W
 * produces the same result as fresh layout at W.
 * Catches stale cache entries that don't update on constraint change.
 */
export declare function expectResizeRoundTrip(buildTree: () => BuildTreeResult, widths: number[]): void;
//# sourceMappingURL=testing.d.ts.map
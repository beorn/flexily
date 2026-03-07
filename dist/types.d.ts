/**
 * Flexture Types
 *
 * TypeScript interfaces for the flexbox layout engine.
 */
/**
 * A value with a unit (point, percent, or auto).
 */
export interface Value {
    value: number;
    unit: number;
}
/**
 * Measure function signature for intrinsic sizing.
 * Called by the layout algorithm to determine a node's natural size.
 */
export type MeasureFunc = (width: number, widthMode: number, height: number, heightMode: number) => {
    width: number;
    height: number;
};
/**
 * Baseline function signature for baseline alignment.
 * Called by the layout algorithm to determine a node's baseline offset from its top edge.
 * Used with ALIGN_BASELINE to align text baselines across siblings.
 *
 * @param width - The computed width of the node
 * @param height - The computed height of the node
 * @returns The baseline offset from the top of the node (in points)
 */
export type BaselineFunc = (width: number, height: number) => number;
/**
 * Cache entry for measure results.
 * Stores input constraints (w, wm, h, hm) and output (rw, rh).
 */
export interface MeasureEntry {
    w: number;
    wm: number;
    h: number;
    hm: number;
    rw: number;
    rh: number;
}
/**
 * Cache entry for layout results.
 * Stores input available dimensions and computed size.
 * Used to avoid redundant recursive layout calls during a single pass.
 */
export interface LayoutCacheEntry {
    availW: number;
    availH: number;
    computedW: number;
    computedH: number;
}
/**
 * Per-node flex calculation state for zero-allocation layout.
 *
 * This interface enables the layout engine to avoid heap allocations during
 * layout passes by storing all intermediate calculation state directly on
 * each Node. Fields are mutated (not recreated) each pass.
 *
 * Design rationale:
 * - Eliminates ChildLayout object allocation (previously created per child per pass)
 * - Enables filtered iteration via relativeIndex (avoids temporary array allocation)
 * - Stores line membership for flex-wrap (avoids FlexLine[] allocation)
 *
 * All numeric fields use number (Float64 in V8) for precision. Boolean fields
 * track state that affects the CSS Flexbox algorithm's iterative distribution.
 *
 * @see layout.ts for usage in layoutNode() and distributeFlexSpaceForLine()
 */
export interface FlexInfo {
    /** Computed main-axis size after flex distribution */
    mainSize: number;
    /** Original base size before flex distribution (used for weighted shrink) */
    baseSize: number;
    /** Total main-axis margin (non-auto margins only) */
    mainMargin: number;
    /** flex-grow factor from style */
    flexGrow: number;
    /** flex-shrink factor from style */
    flexShrink: number;
    /** Resolved min-width/height constraint on main axis */
    minMain: number;
    /** Resolved max-width/height constraint on main axis (Infinity if none) */
    maxMain: number;
    /** Whether main-start margin is auto (absorbs free space) */
    mainStartMarginAuto: boolean;
    /** Whether main-end margin is auto (absorbs free space) */
    mainEndMarginAuto: boolean;
    /** Resolved main-start margin value (0 if auto, computed later) */
    mainStartMarginValue: number;
    /** Resolved main-end margin value (0 if auto, computed later) */
    mainEndMarginValue: number;
    /** Cached resolved margin values [left, top, right, bottom] */
    marginL: number;
    marginT: number;
    marginR: number;
    marginB: number;
    /** Frozen in flex distribution (clamped to min/max constraint) */
    frozen: boolean;
    /** Line index for flex-wrap (0-based, which line this child belongs to) */
    lineIndex: number;
    /**
     * Relative index for filtered iteration.
     * -1 = absolute positioned or display:none (skip in flex layout)
     * 0+ = index among relative children (participates in flex layout)
     */
    relativeIndex: number;
    /** Computed baseline offset for ALIGN_BASELINE (zero-alloc: avoids per-pass array) */
    baseline: number;
    /** Last availableWidth passed to layoutNode */
    lastAvailW: number;
    /** Last availableHeight passed to layoutNode */
    lastAvailH: number;
    /** Last offsetX passed to layoutNode */
    lastOffsetX: number;
    /** Last offsetY passed to layoutNode */
    lastOffsetY: number;
    /** Whether cached layout is valid (fingerprint matched, not dirty) */
    layoutValid: boolean;
    /** Last direction passed to layoutNode */
    lastDir: number;
}
/**
 * Computed layout result for a node.
 */
export interface Layout {
    left: number;
    top: number;
    width: number;
    height: number;
}
/**
 * Internal style properties for a node.
 */
export interface Style {
    display: number;
    positionType: number;
    position: [Value, Value, Value, Value, Value, Value];
    flexDirection: number;
    flexWrap: number;
    flexGrow: number;
    flexShrink: number;
    flexBasis: Value;
    alignItems: number;
    alignSelf: number;
    alignContent: number;
    justifyContent: number;
    width: Value;
    height: Value;
    minWidth: Value;
    minHeight: Value;
    maxWidth: Value;
    maxHeight: Value;
    aspectRatio: number;
    margin: [Value, Value, Value, Value, Value, Value];
    padding: [Value, Value, Value, Value, Value, Value];
    border: [number, number, number, number, number, number];
    gap: [number, number];
    overflow: number;
}
/**
 * Create a default Value (undefined).
 */
export declare function createValue(value?: number, unit?: number): Value;
/**
 * Create default style.
 */
export declare function createDefaultStyle(): Style;
//# sourceMappingURL=types.d.ts.map
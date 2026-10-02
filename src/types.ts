/**
 * Flexily Types
 *
 * TypeScript interfaces for the flexbox layout engine.
 */

import * as C from "./constants.js"
import { type DefaultsPreset, DEFAULT_PRESET } from "./defaults.js"

/**
 * A value with a unit (point, percent, cqi, auto, or calc).
 *
 * For `UNIT_CALC` values, `value` is ignored and `expr` carries the parsed
 * math-function tree (min/max/clamp). Other unit kinds leave `expr` undefined.
 */
export interface Value {
  value: number
  unit: number // UNIT_UNDEFINED | UNIT_POINT | UNIT_PERCENT | UNIT_AUTO | UNIT_CQI | UNIT_CQMIN | UNIT_CALC
  expr?: MathExpr
  /** Original parsed input, retained for deferred style/layout diagnostics. */
  source?: string
}

/**
 * Math-function expression tree (A0.3). Late-bound: evaluated at the same
 * resolveValue call site as plain leaves, against the same `availableSize`
 * and `queryInlineSize`. No epoch crossing.
 *
 *   - `Value` leaves: any non-CALC value (POINT, PERCENT, CQI, CQMIN, etc.)
 *   - `{ fn: "min", args }`: minimum of resolved args
 *   - `{ fn: "max", args }`: maximum of resolved args
 *   - `{ fn: "clamp", args: [min, val, max] }`: clamp val between min and max
 *
 * Nesting is allowed: a `MathExpr` arg can be another `MathExpr` (recursively
 * evaluated) or a `Value` leaf.
 */
export type MathExpr =
  | Value
  | { readonly fn: "min"; readonly args: readonly MathExpr[] }
  | { readonly fn: "max"; readonly args: readonly MathExpr[] }
  | { readonly fn: "clamp"; readonly args: readonly [MathExpr, MathExpr, MathExpr] }
  | { readonly op: "+" | "-" | "*" | "/"; readonly left: MathExpr; readonly right: MathExpr }

/**
 * Measure function signature for intrinsic sizing.
 * Called by the layout algorithm to determine a node's natural size.
 */
export type MeasureFunc = (
  width: number,
  widthMode: number,
  height: number,
  heightMode: number,
) => { width: number; height: number }

/**
 * Baseline function signature for baseline alignment.
 * Called by the layout algorithm to determine a node's baseline offset from its top edge.
 * Used with ALIGN_BASELINE to align text baselines across siblings.
 *
 * @param width - The computed width of the node
 * @param height - The computed height of the node
 * @returns The baseline offset from the top of the node (in points)
 */
export type BaselineFunc = (width: number, height: number) => number

/**
 * Cache entry for measure results.
 * Stores input constraints (w, wm, h, hm) and output (rw, rh).
 */
export interface MeasureEntry {
  w: number
  wm: number
  h: number
  hm: number
  rw: number
  rh: number
}

/**
 * Cache entry for layout results.
 * Stores the six input constraints and the computed size. Used to avoid
 * redundant recursive layout calls, within a pass and across passes (#26840).
 */
export interface LayoutCacheEntry {
  availW: number // Available width (may be NaN; -1 marks an invalidated entry)
  availH: number // Available height (may be NaN)
  containingW: number // Percentage base width passed with this query
  containingH: number // Percentage base height passed with this query
  allocatedW: number // Width the parent allocated (NaN when none)
  allocatedH: number // Height the parent allocated (NaN when none)
  computedW: number // Computed width
  computedH: number // Computed height
  // measureNode's shrink-wrap shortcut hit a row that overflows a definite
  // main size somewhere at or below this node, so the size above is an
  // under-estimate (see layout-measure.ts). Cached alongside the size because
  // it is a property of THIS query, not of the node: a hit must not report a
  // neighbouring query's verdict.
  approx: boolean
  // Written by a full layoutNode (layout-zero.ts MEASURE), not by measureNode's
  // shortcut. Only such an entry may stand in for a layoutNode call.
  exact: boolean
  // Percentage widths the writing descent counted without a base (#26660), so
  // a hit can replay the count the skipped descent would have added.
  unknownWidths: number
  // The layout pass that wrote this entry (layout-flex-lines.ts
  // layoutGeneration). A dirty node answers only from its own pass's entries.
  gen: number
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
  mainSize: number
  /** Original base size before flex distribution (used for weighted shrink) */
  baseSize: number
  /** Total main-axis margin (non-auto margins only) */
  mainMargin: number
  /** flex-grow factor from style */
  flexGrow: number
  /** flex-shrink factor from style */
  flexShrink: number
  /** Resolved min-width/height constraint on main axis */
  minMain: number
  /** Resolved max-width/height constraint on main axis (Infinity if none) */
  maxMain: number
  /** Whether main-start margin is auto (absorbs free space) */
  mainStartMarginAuto: boolean
  /** Whether main-end margin is auto (absorbs free space) */
  mainEndMarginAuto: boolean
  /** Resolved main-start margin value (0 if auto, computed later) */
  mainStartMarginValue: number
  /** Resolved main-end margin value (0 if auto, computed later) */
  mainEndMarginValue: number
  /** Cached resolved margin values [left, top, right, bottom] */
  marginL: number
  marginT: number
  marginR: number
  marginB: number
  /** Frozen in flex distribution (clamped to min/max constraint) */
  frozen: boolean
  /** Line index for flex-wrap (0-based, which line this child belongs to) */
  lineIndex: number
  /**
   * Relative index for filtered iteration.
   * -1 = absolute positioned or display:none (skip in flex layout)
   * 0+ = index among relative children (participates in flex layout)
   */
  relativeIndex: number
  /** Computed baseline offset for ALIGN_BASELINE (zero-alloc: avoids per-pass array) */
  baseline: number
  /**
   * Phase 5 derived this child's base size from `measureNode`, and the answer
   * is an under-estimate because the shrink-wrap shortcut met an overflowing
   * row somewhere below (see layout-measure.ts). Phase 5 re-derives the base
   * size through the real algorithm only if this container will actually
   * distribute from it.
   */
  baseApprox: boolean
  /**
   * The absolute origin (flow margin-box, as layoutNode's absX/absY) this
   * node's parent passed it in Phase 8, in either mode. Phase 9b re-lays a
   * stretched child at it. The fingerprint's lastAbsX/lastAbsY are not a
   * substitute: a MEASURE call writes no fingerprint (#26840).
   */
  passedAbsX: number
  passedAbsY: number

  // Constraint fingerprinting for layout caching
  /** Last availableWidth passed to layoutNode */
  lastAvailW: number
  /** Last availableHeight passed to layoutNode */
  lastAvailH: number
  /** @internal Percentage-containing context for the cached layout. */
  lastContainingW: number
  lastContainingH: number
  /** @internal Parent-committed border-box allocation, or NaN when intrinsic. */
  lastAllocatedW: number
  lastAllocatedH: number
  /** Last offsetX passed to layoutNode */
  lastOffsetX: number
  /** Last offsetY passed to layoutNode */
  lastOffsetY: number
  /** Last absX passed to layoutNode (affects edge-based rounding) */
  lastAbsX: number
  /** Last absY passed to layoutNode (affects edge-based rounding) */
  lastAbsY: number
  /** Whether cached layout is valid (fingerprint matched, not dirty) */
  layoutValid: boolean
  /**
   * Percentage widths the last LAYOUT pass under this fingerprint counted as
   * content (`unknownBaseWidthCount`). A fingerprint hit replays it, so a row
   * above still sees the #26660 rise the skipped descent would have made.
   */
  lastUnknownWidths: number
  /** Last direction passed to layoutNode */
  lastDir: number
}

/**
 * Computed layout result for a node.
 */
export interface Layout {
  left: number
  top: number
  width: number
  height: number
}

/**
 * Internal style properties for a node.
 */
export interface Style {
  // Display
  display: number

  // Position
  positionType: number
  position: [Value, Value, Value, Value, Value, Value] // [left, top, right, bottom, start, end]

  // Flex
  flexDirection: number
  flexWrap: number
  flexGrow: number
  flexShrink: number
  flexBasis: Value

  // Alignment
  alignItems: number
  alignSelf: number
  alignContent: number
  justifyContent: number

  // Size
  width: Value
  height: Value
  minWidth: Value
  minHeight: Value
  maxWidth: Value
  maxHeight: Value
  aspectRatio: number // NaN = undefined, otherwise width/height ratio

  // Spacing (per-edge: left, top, right, bottom, start, end)
  // Physical edges: [0]=left, [1]=top, [2]=right, [3]=bottom
  // Logical edges: [4]=start, [5]=end (resolved based on flex direction)
  margin: [Value, Value, Value, Value, Value, Value]
  padding: [Value, Value, Value, Value, Value, Value]
  border: [Value, Value, Value, Value, Value, Value] // [left, top, right, bottom, start, end]

  // Gap
  gap: [Value, Value] // [column, row]

  // Overflow
  overflow: number

  // Container queries (A0.1) — declares this node as a CQ container.
  // Phase 1 supports CONTAINER_TYPE_INLINE_SIZE; descendants' cqi/cqmin values
  // resolve against this container's frozen inline-size from Pass 1.
  containerType: number

  // CSS `contain: size` (A0.1) — children's intrinsic sizes do not propagate
  // into this node's size. Required for sound CQ containers (without it, child
  // sizes feed back into container size → CQ branch flip changes child sizes →
  // oscillation). Phase 1 implements inline-size containment only (paired with
  // containerType: inline-size).
  containSize: boolean

  // fit-width lanes (A0.2). CSS precedent: `width: fit-content(<length>)`
  // extended to a list. Used by silvery's `<Box fitWidth={[80, 120, "100cqi"]}>`
  // to snap a Box's inline-size to the smallest lane that still fits its
  // max-content children. Replaces the React-side `<AutoFit>` primitive.
  //
  // `undefined` means "no fit-width selection"; non-empty array activates the
  // single-pass lane-select algorithm in `layoutNode`. Each Value is a length
  // unit (UNIT_POINT for plain numbers, UNIT_CQI for cqi entries).
  fitWidth: readonly Value[] | undefined
}

/**
 * Create a default Value (undefined).
 */
export function createValue(value = 0, unit = 0): Value {
  return { value, unit }
}

const POINT_ZERO: Value = Object.freeze({ value: 0, unit: C.UNIT_POINT })
const UNSET_EDGE: Value = Object.freeze({ value: 0, unit: C.UNIT_UNDEFINED })

/**
 * Create default style.
 *
 * Two presets:
 * - `"css"` — `flexShrink: 1`, `alignContent: stretch` (browser-correct, multi-target).
 * - `"yoga"` — `flexShrink: 0`, `alignContent: flex-start` (drop-in for yoga-layout).
 *
 * `flexDirection` is `row` in both presets. Yoga's native default is `column`,
 * but flexily diverged to `row` (CSS-correct) before this preset system existed
 * and consumers have built around that. The "yoga" preset preserves Yoga's
 * `flexShrink: 0` + `alignContent: flex-start` divergences without flipping
 * direction. Strict-Yoga consumers can call `setFlexDirection(COLUMN)` per-tree.
 *
 * If `preset` is omitted, the module-level current preset is used (set via
 * `setDefaultsPreset()` or `createFlexily({ defaults })`). Default is `"yoga"`.
 */
export function createDefaultStyle(preset: DefaultsPreset = DEFAULT_PRESET): Style {
  const isCss = preset === "css"
  return {
    display: 0, // DISPLAY_FLEX (same in CSS and Yoga)
    positionType: 1, // POSITION_TYPE_RELATIVE (same in CSS and Yoga)
    position: [createValue(), createValue(), createValue(), createValue(), createValue(), createValue()],
    flexDirection: 2, // FLEX_DIRECTION_ROW — CSS default; Yoga defaults to COLUMN
    flexWrap: 0, // WRAP_NO_WRAP (same in CSS and Yoga)
    flexGrow: 0, // (same in CSS and Yoga)
    flexShrink: isCss ? 1 : 0, // CSS: 1 — Yoga: 0
    flexBasis: createValue(0, 3), // AUTO (same in CSS and Yoga)
    alignItems: 4, // ALIGN_STRETCH (same in CSS and Yoga)
    alignSelf: 0, // ALIGN_AUTO (same in CSS and Yoga)
    alignContent: isCss ? 4 : 1, // CSS: STRETCH — Yoga: FLEX_START
    justifyContent: 0, // JUSTIFY_FLEX_START (same in CSS and Yoga)
    width: createValue(0, 3), // AUTO (same in CSS and Yoga)
    height: createValue(0, 3), // AUTO (same in CSS and Yoga)
    // CSS §4.5: flex items default to `min-block-size: auto` and `min-inline-size: auto`.
    // The auto value resolves to a content-based minimum on the main axis (visible-
    // overflow items only) — see layout-zero.ts. Yoga preset preserves UNIT_UNDEFINED
    // (treated as 0) for drop-in compat with yoga-layout's looser semantics.
    minWidth: isCss ? createValue(0, 3) : createValue(), // CSS: AUTO — Yoga: undefined
    minHeight: isCss ? createValue(0, 3) : createValue(), // CSS: AUTO — Yoga: undefined
    maxWidth: createValue(),
    maxHeight: createValue(),
    aspectRatio: NaN, // undefined by default (same in CSS and Yoga)
    margin: [createValue(), createValue(), createValue(), createValue(), createValue(), createValue()],
    padding: [createValue(), createValue(), createValue(), createValue(), createValue(), createValue()],
    border: [POINT_ZERO, POINT_ZERO, POINT_ZERO, POINT_ZERO, UNSET_EDGE, UNSET_EDGE],
    gap: [POINT_ZERO, POINT_ZERO],
    overflow: 0, // OVERFLOW_VISIBLE (same in CSS and Yoga)
    containerType: 0, // CONTAINER_TYPE_NORMAL — not a CQ container by default (A0.1)
    containSize: false, // CSS contain: size — off by default (A0.1)
    fitWidth: undefined, // fit-width lanes — disabled by default (A0.2)
  }
}

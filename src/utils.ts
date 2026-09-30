/**
 * Flexily Utility Functions
 *
 * Helper functions for edge value manipulation and value resolution.
 */

import * as C from "./constants.js"
import { assertLengthAxis, LengthError } from "./length.js"
import type { Node } from "./node-zero.js"
import type { MathExpr, Value } from "./types.js"

// ============================================================================
// Shared Traversal Stack
// ============================================================================
// Pre-allocated stack array for iterative tree traversal. Shared across all
// layout functions to avoid multiple allocations. Using a single stack is safe
// because layout operations are synchronous (no concurrent traversals).

/**
 * Shared traversal stack for iterative tree operations.
 * Avoids recursion (prevents stack overflow on deep trees) and avoids
 * allocation during layout passes.
 */
export const traversalStack: unknown[] = []

export function styleValueMatches(current: Value, value: number, unit: number): boolean {
  return current.unit === unit && Object.is(current.value, value)
}

export function styleValuesEqual(current: Value, next: number | Value, unit = C.UNIT_POINT): boolean {
  return typeof next === "number"
    ? styleValueMatches(current, next, unit)
    : styleValueMatches(current, next.value, next.unit) && current.expr === next.expr
}

/** Validate all selected axes before changing any edge slot. */
export function assertEdgeLength(value: Value, edge: number, prop: string): void {
  if (edge !== C.EDGE_TOP && edge !== C.EDGE_BOTTOM && edge !== C.EDGE_VERTICAL) assertLengthAxis(value, "inline", prop)
  if (edge === C.EDGE_TOP || edge === C.EDGE_BOTTOM || edge === C.EDGE_VERTICAL || edge === C.EDGE_ALL)
    assertLengthAxis(value, "block", prop)
}

/** Numeric style getters cannot discard a user-set unit. */
export function pointSpacing(value: Value, getter: string, path: string): number {
  if (value.unit === C.UNIT_UNDEFINED) return NaN
  if (value.unit !== C.UNIT_POINT)
    throw new LengthError(value.source ?? "<Value>", `read the stored Value at ${path}`, getter)
  return value.value
}

/**
 * Return true when setEdgeValue would leave the edge array unchanged.
 */
export function edgeValueMatches(
  arr: [Value, Value, Value, Value, Value, Value],
  edge: number,
  value: number | Value,
  unit: number = C.UNIT_POINT,
): boolean {
  switch (edge) {
    case C.EDGE_LEFT:
      return styleValuesEqual(arr[0], value, unit)
    case C.EDGE_TOP:
      return styleValuesEqual(arr[1], value, unit)
    case C.EDGE_RIGHT:
      return styleValuesEqual(arr[2], value, unit)
    case C.EDGE_BOTTOM:
      return styleValuesEqual(arr[3], value, unit)
    case C.EDGE_HORIZONTAL:
      return styleValuesEqual(arr[0], value, unit) && styleValuesEqual(arr[2], value, unit)
    case C.EDGE_VERTICAL:
      return styleValuesEqual(arr[1], value, unit) && styleValuesEqual(arr[3], value, unit)
    case C.EDGE_ALL:
      return (
        styleValuesEqual(arr[0], value, unit) &&
        styleValuesEqual(arr[1], value, unit) &&
        styleValuesEqual(arr[2], value, unit) &&
        styleValuesEqual(arr[3], value, unit)
      )
    case C.EDGE_START:
      return styleValuesEqual(arr[4], value, unit)
    case C.EDGE_END:
      return styleValuesEqual(arr[5], value, unit)
    default:
      return true
  }
}

export function edgeBorderMatches(
  arr: [Value, Value, Value, Value, Value, Value],
  edge: number,
  value: number | Value,
): boolean {
  if (typeof value === "number" && Number.isNaN(value) && (edge === C.EDGE_START || edge === C.EDGE_END))
    return edgeValueMatches(arr, edge, 0, C.UNIT_UNDEFINED)
  return edgeValueMatches(arr, edge, value)
}

/**
 * Set a value on an edge array (supports all edge types including logical START/END).
 */
export function setEdgeValue(
  arr: [Value, Value, Value, Value, Value, Value],
  edge: number,
  value: number | Value,
  unit: number = C.UNIT_POINT,
): void {
  const v = typeof value === "number" ? { value, unit } : value
  switch (edge) {
    case C.EDGE_LEFT:
      arr[0] = v
      break
    case C.EDGE_TOP:
      arr[1] = v
      break
    case C.EDGE_RIGHT:
      arr[2] = v
      break
    case C.EDGE_BOTTOM:
      arr[3] = v
      break
    case C.EDGE_HORIZONTAL:
      arr[0] = v
      arr[2] = v
      break
    case C.EDGE_VERTICAL:
      arr[1] = v
      arr[3] = v
      break
    case C.EDGE_ALL:
      arr[0] = v
      arr[1] = v
      arr[2] = v
      arr[3] = v
      break
    case C.EDGE_START:
      // Store in logical START slot (resolved to physical at layout time)
      arr[4] = v
      break
    case C.EDGE_END:
      // Store in logical END slot (resolved to physical at layout time)
      arr[5] = v
      break
  }
}

/**
 * Set a border value on an edge array.
 */
export function setEdgeBorder(
  arr: [Value, Value, Value, Value, Value, Value],
  edge: number,
  value: number | Value,
): void {
  if (typeof value === "number" && Number.isNaN(value) && (edge === C.EDGE_START || edge === C.EDGE_END))
    setEdgeValue(arr, edge, 0, C.UNIT_UNDEFINED)
  else setEdgeValue(arr, edge, value)
}

/**
 * Normalize an edge getter to its stored slot. Aggregates use the left edge.
 */
export function getEdgeIndex(edge: number): number {
  switch (edge) {
    case C.EDGE_LEFT:
      return 0
    case C.EDGE_TOP:
      return 1
    case C.EDGE_RIGHT:
      return 2
    case C.EDGE_BOTTOM:
      return 3
    case C.EDGE_START:
      return 4
    case C.EDGE_END:
      return 5
    default:
      return 0 // Default to left
  }
}

/** Read a stored edge Value with the existing aggregate/unknown left fallback. */
export function getEdgeValue(arr: [Value, Value, Value, Value, Value, Value], edge: number): Value {
  return arr[getEdgeIndex(edge)]!
}

/**
 * Get a border value from an edge array.
 */
export function getEdgeBorderValue(arr: [Value, Value, Value, Value, Value, Value], edge: number): number {
  return pointSpacing(getEdgeValue(arr, edge), "getBorder", "node.style.border")
}

/**
 * Whether flexily's dev-mode runtime assertions should fire.
 *
 * Enabled when:
 *   - `process.env.NODE_ENV !== "production"` (typical dev/test contexts), OR
 *   - `process.env.SILVERY_STRICT` is set to any non-empty value (silvery's
 *     unified strict-mode knob — flexily honors it for cross-package parity
 *     since flexily ships under silvery)
 *
 * The check is intentionally permissive: production builds default to OFF
 * (zero runtime cost), and any explicit strict-mode signal forces ON.
 */
export function isDevModeAssertionsEnabled(): boolean {
  if (typeof process === "undefined" || typeof process.env === "undefined") return false
  const env = process.env
  if (env.SILVERY_STRICT !== undefined && env.SILVERY_STRICT !== "") return true
  return env.NODE_ENV !== "production"
}

/**
 * Walk up the parent chain from `node`, return the nearest ancestor's frozen
 * container-query inline-size (set by Pass 1 of layoutNode). The layout root
 * is the implicit viewport container. NaN if no ancestor has been frozen yet.
 *
 * Used at resolveValue call sites for cqi/cqmin units (A0.1 Pass 2 consumption).
 * The walk skips `node` itself — a CQ container's OWN width/height/padding values
 * resolve against its PARENT's queryInlineSize (the container is the queried
 * subject, not the query target). This matches CSS where `container-type: inline-size`
 * + `width: 50cqi` would create a self-referential cycle; CSS resolves this by
 * defining `cqi` against the *parent* containment context.
 *
 * O(tree depth), computed once for each node's own layout/measurement context.
 * Direct child resolutions reuse the context derived by their parent.
 */
export function findContainerQuerySize(node: Node): number {
  let cur: Node | null = node.getParent()
  while (cur !== null) {
    const size = cur.getFrozenQuerySize()
    if (!Number.isNaN(size)) return size
    cur = cur.getParent()
  }
  return NaN
}

/** Dimensional values; excludes auto, content-sizing keywords and scalar operands. */
export function isLength(unit: number): boolean {
  return (
    unit === C.UNIT_POINT ||
    unit === C.UNIT_PERCENT ||
    unit === C.UNIT_CQI ||
    unit === C.UNIT_CQMIN ||
    unit === C.UNIT_CALC ||
    unit === C.UNIT_CH ||
    unit === C.UNIT_LH
  )
}

/**
 * Resolve a value (point, percent, or container-query unit) to an absolute number.
 *
 * Container-query units (`UNIT_CQI`, `UNIT_CQMIN`) resolve against `queryInlineSize`,
 * which must be the **frozen** inline-size of the nearest CQ ancestor (Phase 1 of the
 * A0.1 two-phase layout). When no CQ ancestor exists (i.e. `queryInlineSize` is NaN),
 * cqi/cqmin resolve to 0 — same defensive convention as `UNIT_PERCENT` against NaN.
 *
 * In Phase 1, cqmin is identical to cqi because block-size queries aren't wired yet.
 * The constant is reserved for forward-compat.
 */
export function resolveValue(value: Value, availableSize: number, queryInlineSize = NaN): number {
  switch (value.unit) {
    case C.UNIT_POINT:
    case C.UNIT_CH:
    case C.UNIT_LH:
    case C.UNIT_NUMBER:
      return value.value
    case C.UNIT_PERCENT:
      // Percentage against NaN (auto-sized parent) resolves to 0
      if (Number.isNaN(availableSize)) {
        return 0
      }
      return availableSize * (value.value / 100)
    case C.UNIT_CQI:
    case C.UNIT_CQMIN:
      // cqi against an unfrozen / absent CQ container resolves to 0 — same shape as
      // percent against NaN. Throwing here would force every call site to handle the
      // "no CQ ancestor" case; defaulting to 0 lets `requireCapability("containerQueryUnits", ...)`
      // do the user-facing diagnostic at first paint instead (see EngineCapabilities).
      if (Number.isNaN(queryInlineSize)) {
        return 0
      }
      return queryInlineSize * (value.value / 100)
    case C.UNIT_CALC:
      // A0.3 math function. Late-bound per the contract in
      // docs/two-phase-layout.md — evaluates at the same epoch
      // as its leaf units (cqi → Pass 2). A defensively-malformed CALC value
      // without an `expr` payload resolves to 0 (same surface as UNDEFINED).
      if (!value.expr) return 0
      return evaluateMathExpr(value.expr, availableSize, queryInlineSize, value.source)
    default:
      // UNIT_UNDEFINED, UNIT_AUTO, UNIT_FIT_CONTENT, UNIT_SNUG_CONTENT all
      // resolve to 0 here. Callers that need auto-rule semantics (CSS §4.5
      // flex-item main-axis auto min-size = content-based minimum) must
      // handle UNIT_AUTO explicitly before calling resolveValue. See
      // layout-zero.ts:587 for that special case.
      return 0
  }
}

/**
 * Evaluate a math-function expression (A0.3) against the current resolution
 * context. Recursively resolves leaf `Value`s via `resolveValue` and applies
 * `min` / `max` / `clamp` semantics. CSS-aligned:
 *   - `min()` / `max()` with zero args fall back to 0 (defensive; spec disallows)
 *   - `clamp(min, val, max)` enforces `min ≤ result ≤ max`, with `min` winning
 *     ties when `min > max` (CSS clamp definition)
 */
export function evaluateMathExpr(
  expr: MathExpr,
  availableSize: number,
  queryInlineSize: number,
  source = "<MathExpr>",
): number {
  if ("unit" in expr) {
    return resolveValue(expr, availableSize, queryInlineSize)
  }
  if ("op" in expr) {
    const left = evaluateMathExpr(expr.left, availableSize, queryInlineSize, source)
    const right = evaluateMathExpr(expr.right, availableSize, queryInlineSize, source)
    if (expr.op === "/" && right === 0) throw new LengthError(source, "division by zero")
    const result =
      expr.op === "+" ? left + right : expr.op === "-" ? left - right : expr.op === "*" ? left * right : left / right
    if (!Number.isFinite(result)) throw new LengthError(source, "arithmetic must produce a finite length")
    return result
  }
  if (expr.fn === "min") {
    if (expr.args.length === 0) return 0
    let acc = Infinity
    for (const arg of expr.args) {
      const v = evaluateMathExpr(arg, availableSize, queryInlineSize, source)
      if (v < acc) acc = v
    }
    return acc
  }
  if (expr.fn === "max") {
    if (expr.args.length === 0) return 0
    let acc = -Infinity
    for (const arg of expr.args) {
      const v = evaluateMathExpr(arg, availableSize, queryInlineSize, source)
      if (v > acc) acc = v
    }
    return acc
  }
  // clamp(min, val, max)
  const minV = evaluateMathExpr(expr.args[0], availableSize, queryInlineSize, source)
  const val = evaluateMathExpr(expr.args[1], availableSize, queryInlineSize, source)
  const maxV = evaluateMathExpr(expr.args[2], availableSize, queryInlineSize, source)
  // CSS spec: when min > max, min wins (clamp degenerates to min). Apply this
  // BEFORE the val < minV check — otherwise a val > maxV in the unordered-bounds
  // case would erroneously return maxV (< minV), violating result >= minV.
  if (minV > maxV) return minV
  if (val < minV) return minV
  if (val > maxV) return maxV
  return val
}

// Width percentages met with an unknown base in this layout pass. A row reads
// it around one item's layout and repeats that layout once when it rose (#26660).
let unknownBaseWidths = 0

/** The pass count of width percentages sized as content for an unknown base. */
export function unknownBaseWidthCount(): number {
  return unknownBaseWidths
}

/** Set the pass count and return the previous one; a pass starts at 0 and restores the outer count. */
export function swapUnknownBaseWidthCount(value: number): number {
  const previous = unknownBaseWidths
  unknownBaseWidths = value
  return previous
}

/** Preferred width needs content when its percentage base is not known yet.
 * Alignment eligibility and parent allocation are separate questions.
 */
export function widthUsesContent(value: Value, available: number): boolean {
  if (!isLength(value.unit)) return true
  if (!pctIndefinite(value, available)) return false
  unknownBaseWidths++
  return true
}

/** True when a percentage or percentage-containing math constraint is indefinite. */
export function pctIndefinite(value: Value, available: number): boolean {
  return Number.isNaN(available) && containsPercent(value)
}

export function containsPercent(expr: MathExpr): boolean {
  if ("unit" in expr) return expr.unit === C.UNIT_PERCENT || (expr.expr !== undefined && containsPercent(expr.expr))
  if ("op" in expr) return containsPercent(expr.left) || containsPercent(expr.right)
  for (const arg of expr.args) if (containsPercent(arg)) return true
  return false
}

/**
 * Apply min/max constraints to a size.
 *
 * CSS behavior:
 * - min: Floor constraint. Does NOT affect children's layout — the container expands
 *   after shrink-wrap. When size is NaN (auto-sized), min is NOT applied here;
 *   the post-shrink-wrap applyMinMax call (Phase 9) handles it.
 * - max: Ceiling constraint. DOES affect children's layout — content wraps/clips
 *   within the max. When size is NaN (auto-sized), max constrains the container
 *   so children are laid out within the max bound.
 *
 * Percent constraints that can't resolve (available is NaN) are skipped entirely,
 * since resolveValue returns 0 for percent-against-NaN, which would incorrectly
 * clamp sizes to 0.
 */
export function applyMinMax(size: number, min: Value, max: Value, available: number, queryInlineSize = NaN): number {
  let result = size

  // Apply max first, then min. CSS spec: when min > max, min wins.
  // By applying max before min, Math.max(result, minValue) ensures min dominates.

  if (max.unit !== C.UNIT_UNDEFINED) {
    // Skip percent max when available is NaN — can't resolve meaningfully
    if (pctIndefinite(max, available)) {
      // Skip: percent against NaN resolves to 0, which would be wrong
    } else {
      const maxValue = resolveValue(max, available, queryInlineSize)
      if (!Number.isNaN(maxValue)) {
        // An unknown natural size remains unknown. Layout chooses a finite
        // ceiling only after intrinsic sizing proves that it binds.
        if (!Number.isNaN(result)) {
          result = Math.min(result, maxValue)
        }
      }
    }
  }

  if (min.unit !== C.UNIT_UNDEFINED) {
    // Skip percent min when available is NaN — can't resolve meaningfully
    if (pctIndefinite(min, available)) {
      // Skip: percent against NaN resolves to 0, which would be wrong
    } else {
      const minValue = resolveValue(min, available, queryInlineSize)
      if (!Number.isNaN(minValue)) {
        // Only apply min to definite sizes. When size is NaN (auto-sized),
        // skip — the post-shrink-wrap applyMinMax call will floor it.
        if (!Number.isNaN(result)) {
          result = Math.max(result, minValue)
        }
      }
    }
  }

  return result
}

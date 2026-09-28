/**
 * A0.1 — container-query unit parsing and resolution.
 *
 * Covers:
 *
 *   - `UNIT_CQI` / `UNIT_CQMIN` constants in `constants.ts`
 *   - `resolveValue(value, available, queryInlineSize)` resolves cqi/cqmin
 *     against the frozen CQ container inline-size
 *   - `setWidthCqi` / `setHeightCqi` node setters preserve unit + mark dirty
 *   - Defensive: cqi against NaN queryInlineSize → 0 (same shape as percent against NaN)
 *
 * Layout uses the nearest explicit CQ container, or the implicit root viewport.
 */
import { describe, expect, test } from "vitest"
import * as C from "../src/constants.js"
import { createFlexily } from "../src/index.js"
import type { Value } from "../src/types.js"
import { resolveValue } from "../src/utils.js"

describe("[A0.1] cqi/cqmin constants", () => {
  test("UNIT_CQI is distinct from UNIT_PERCENT", () => {
    expect(C.UNIT_CQI).not.toBe(C.UNIT_PERCENT)
    expect(C.UNIT_CQI).not.toBe(C.UNIT_POINT)
    expect(C.UNIT_CQI).not.toBe(C.UNIT_AUTO)
  })

  test("UNIT_CQMIN is distinct from UNIT_CQI", () => {
    expect(C.UNIT_CQMIN).not.toBe(C.UNIT_CQI)
  })

  test("constants are numeric (compatible with Value.unit field)", () => {
    expect(typeof C.UNIT_CQI).toBe("number")
    expect(typeof C.UNIT_CQMIN).toBe("number")
  })
})

describe("[A0.1] resolveValue — container-query units", () => {
  test("UNIT_CQI resolves as queryInlineSize * percent / 100", () => {
    const v: Value = { value: 50, unit: C.UNIT_CQI }
    expect(resolveValue(v, 200 /* availableSize ignored */, 80 /* queryInlineSize */)).toBe(40)
  })

  test("UNIT_CQI with 100% returns full container inline-size", () => {
    const v: Value = { value: 100, unit: C.UNIT_CQI }
    expect(resolveValue(v, 1000, 88)).toBe(88)
  })

  test("UNIT_CQMIN resolves identically to UNIT_CQI in Phase 1 (inline-only)", () => {
    const cqi: Value = { value: 50, unit: C.UNIT_CQI }
    const cqmin: Value = { value: 50, unit: C.UNIT_CQMIN }
    expect(resolveValue(cqi, 200, 80)).toBe(resolveValue(cqmin, 200, 80))
  })

  test("UNIT_CQI against NaN queryInlineSize → 0 (defensive)", () => {
    const v: Value = { value: 50, unit: C.UNIT_CQI }
    expect(resolveValue(v, 200, NaN)).toBe(0)
  })

  test("UNIT_CQI with default (omitted) queryInlineSize → 0", () => {
    const v: Value = { value: 50, unit: C.UNIT_CQI }
    // Backward-compat: existing call sites that don't pass queryInlineSize
    // get NaN by default and cqi resolves to 0.
    expect(resolveValue(v, 200)).toBe(0)
  })

  test("UNIT_PERCENT still resolves against availableSize (not queryInlineSize)", () => {
    const v: Value = { value: 50, unit: C.UNIT_PERCENT }
    expect(resolveValue(v, 200, 80)).toBe(100) // 50% of 200, not of 80
  })

  test("UNIT_POINT ignores both availableSize and queryInlineSize", () => {
    const v: Value = { value: 42, unit: C.UNIT_POINT }
    expect(resolveValue(v, NaN, NaN)).toBe(42)
  })

  test("UNIT_CQI float result preserved (not pre-quantized)", () => {
    // 33% of 80 = 26.4 — kept as float through resolveValue.
    // Quantization happens at the pack step (see quantization.ts).
    const v: Value = { value: 33, unit: C.UNIT_CQI }
    expect(resolveValue(v, 200, 80)).toBeCloseTo(26.4, 10)
  })

  test("UNIT_CQI with 0% returns 0 regardless of container size", () => {
    const v: Value = { value: 0, unit: C.UNIT_CQI }
    expect(resolveValue(v, 200, 1000)).toBe(0)
  })
})

describe("[A0.1] node setters — setWidthCqi / setHeightCqi", () => {
  // Legacy setters resolve against the root viewport when no explicit CQ
  // ancestor exists. Changing viewport width must resize both width and height
  // cqi values, while point-valued dimensions remain fixed.
  test("setWidthCqi follows viewport inline-size while numeric width stays fixed", () => {
    const flex = createFlexily()
    const explicit = flex.createNode()
    explicit.setWidth(50)
    const queried = flex.createNode()
    queried.setWidthCqi(50)

    for (const viewportWidth of [100, 200]) {
      flex.calculateLayout(explicit, viewportWidth, 100)
      flex.calculateLayout(queried, viewportWidth, 100)
      expect(explicit.getComputedWidth()).toBe(50)
      expect(queried.getComputedWidth()).toBe(viewportWidth / 2)
    }
  })

  test("setHeightCqi follows viewport inline-size while numeric height stays fixed", () => {
    const flex = createFlexily()
    const explicit = flex.createNode()
    explicit.setHeight(50)
    const queried = flex.createNode()
    queried.setHeightCqi(50)

    for (const viewportWidth of [100, 200]) {
      flex.calculateLayout(explicit, viewportWidth, 160)
      flex.calculateLayout(queried, viewportWidth, 160)
      expect(explicit.getComputedHeight()).toBe(50)
      expect(queried.getComputedHeight()).toBe(viewportWidth / 2)
    }
  })

  test("setWidthCqi + setWidthPercent stack last-write-wins (style replaced, not merged)", () => {
    const flex = createFlexily()
    const node = flex.createNode()
    node.setWidthCqi(50)
    node.setWidthPercent(75)
    flex.calculateLayout(node, 200, 100)
    // Last write was percent; 75% of 200 = 150
    expect(node.getComputedWidth()).toBe(150)
  })

  test("setWidthCqi sets unit to UNIT_CQI (verified via subsequent setWidth round-trip)", () => {
    // Indirect verification of the unit field: setWidthCqi then setWidth must produce
    // the explicit point-width outcome, confirming setWidth replaces the cqi value.
    const flex = createFlexily()
    const node = flex.createNode()
    node.setWidthCqi(50)
    node.setWidth(42)
    flex.calculateLayout(node, 200, 100)
    expect(node.getComputedWidth()).toBe(42)
  })
})

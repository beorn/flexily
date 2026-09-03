import { describe, expect, it } from "vitest"
import {
  ALIGN_CENTER,
  ALIGN_FLEX_START,
  ALIGN_STRETCH,
  CONTAINER_TYPE_INLINE_SIZE,
  DIRECTION_LTR,
  DISPLAY_FLEX,
  EDGE_ALL,
  EDGE_HORIZONTAL,
  EDGE_LEFT,
  EDGE_TOP,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_ROW,
  GUTTER_ALL,
  GUTTER_COLUMN,
  JUSTIFY_CENTER,
  Node,
  OVERFLOW_HIDDEN,
  POSITION_TYPE_ABSOLUTE,
  UNIT_CQI,
  UNIT_POINT,
  WRAP_WRAP,
} from "../src/index.js"

type SameValueCase = {
  name: string
  apply: (node: Node) => void
  reapply?: (node: Node) => void
}

function cleanChildWithStyle(apply: (node: Node) => void): { root: Node; child: Node } {
  const root = Node.create()
  root.setWidth(120)
  root.setHeight(40)
  root.setFlexDirection(FLEX_DIRECTION_ROW)

  const child = Node.create()
  apply(child)
  root.insertChild(child, 0)
  root.calculateLayout(120, 40, DIRECTION_LTR)

  expect(root.isDirty()).toBe(false)
  expect(child.isDirty()).toBe(false)

  return { root, child }
}

const sameValueCases: SameValueCase[] = [
  { name: "width point", apply: (node) => node.setWidth(24) },
  { name: "width percent", apply: (node) => node.setWidthPercent(50) },
  { name: "width auto", apply: (node) => node.setWidthAuto() },
  { name: "width cqi", apply: (node) => node.setWidthCqi(75) },
  { name: "width fit-content", apply: (node) => node.setWidthFitContent() },
  { name: "width snug-content", apply: (node) => node.setWidthSnugContent() },
  { name: "height point", apply: (node) => node.setHeight(8) },
  { name: "height percent", apply: (node) => node.setHeightPercent(25) },
  { name: "height cqi", apply: (node) => node.setHeightCqi(20) },
  { name: "height auto", apply: (node) => node.setHeightAuto() },
  { name: "min width", apply: (node) => node.setMinWidth(10) },
  { name: "min width percent", apply: (node) => node.setMinWidthPercent(30) },
  { name: "min height", apply: (node) => node.setMinHeight(5) },
  { name: "min height percent", apply: (node) => node.setMinHeightPercent(35) },
  { name: "max width", apply: (node) => node.setMaxWidth(80) },
  { name: "max width percent", apply: (node) => node.setMaxWidthPercent(90) },
  { name: "max height", apply: (node) => node.setMaxHeight(30) },
  { name: "max height percent", apply: (node) => node.setMaxHeightPercent(70) },
  { name: "aspect ratio", apply: (node) => node.setAspectRatio(16 / 9) },
  { name: "aspect ratio unset", apply: (node) => node.setAspectRatio(NaN) },
  { name: "flex grow", apply: (node) => node.setFlexGrow(1) },
  { name: "flex shrink explicit", apply: (node) => node.setFlexShrink(1) },
  { name: "flex basis point", apply: (node) => node.setFlexBasis(18) },
  { name: "flex basis percent", apply: (node) => node.setFlexBasisPercent(25) },
  { name: "flex basis auto", apply: (node) => node.setFlexBasisAuto() },
  { name: "flex direction", apply: (node) => node.setFlexDirection(FLEX_DIRECTION_COLUMN) },
  { name: "flex wrap", apply: (node) => node.setFlexWrap(WRAP_WRAP) },
  { name: "align items", apply: (node) => node.setAlignItems(ALIGN_CENTER) },
  { name: "align self", apply: (node) => node.setAlignSelf(ALIGN_FLEX_START) },
  { name: "align content", apply: (node) => node.setAlignContent(ALIGN_STRETCH) },
  { name: "justify content", apply: (node) => node.setJustifyContent(JUSTIFY_CENTER) },
  { name: "padding point", apply: (node) => node.setPadding(EDGE_ALL, 2) },
  { name: "padding percent", apply: (node) => node.setPaddingPercent(EDGE_HORIZONTAL, 5) },
  { name: "margin point", apply: (node) => node.setMargin(EDGE_LEFT, 3) },
  { name: "margin percent", apply: (node) => node.setMarginPercent(EDGE_HORIZONTAL, 4) },
  { name: "margin auto", apply: (node) => node.setMarginAuto(EDGE_HORIZONTAL) },
  { name: "border", apply: (node) => node.setBorder(EDGE_ALL, 1) },
  { name: "gap all", apply: (node) => node.setGap(GUTTER_ALL, 1) },
  { name: "gap column", apply: (node) => node.setGap(GUTTER_COLUMN, 2) },
  { name: "position type", apply: (node) => node.setPositionType(POSITION_TYPE_ABSOLUTE) },
  { name: "position point", apply: (node) => node.setPosition(EDGE_TOP, 2) },
  { name: "position auto", apply: (node) => node.setPosition(EDGE_TOP, NaN) },
  { name: "position percent", apply: (node) => node.setPositionPercent(EDGE_LEFT, 10) },
  { name: "display", apply: (node) => node.setDisplay(DISPLAY_FLEX) },
  { name: "overflow", apply: (node) => node.setOverflow(OVERFLOW_HIDDEN) },
  { name: "container type", apply: (node) => node.setContainerType(CONTAINER_TYPE_INLINE_SIZE) },
  { name: "contain size", apply: (node) => node.setContainSize(true) },
  {
    name: "fit width lanes",
    apply: (node) => node.setFitWidth([24, { value: 50, unit: UNIT_CQI }]),
    reapply: (node) => node.setFitWidth([24, { value: 50, unit: UNIT_CQI }]),
  },
]

describe("Node setter same-value guards", () => {
  for (const testCase of sameValueCases) {
    it(`does not dirty a clean tree when reapplying ${testCase.name}`, () => {
      const { root, child } = cleanChildWithStyle(testCase.apply)

      ;(testCase.reapply ?? testCase.apply)(child)

      expect(child.isDirty()).toBe(false)
      expect(root.isDirty()).toBe(false)
    })
  }

  it("still dirties the tree when a setter receives a changed value", () => {
    const { root, child } = cleanChildWithStyle((node) => node.setWidth(24))

    child.setWidth(25)

    expect(child.isDirty()).toBe(true)
    expect(root.isDirty()).toBe(true)
  })

  it("preserves the first explicit flex-shrink call even when it matches the default value", () => {
    const { root, child } = cleanChildWithStyle(() => {})

    expect(child.hasExplicitFlexShrink()).toBe(false)

    child.setFlexShrink(0)

    expect(child.hasExplicitFlexShrink()).toBe(true)
    expect(child.isDirty()).toBe(true)
    expect(root.isDirty()).toBe(true)

    root.calculateLayout(120, 40, DIRECTION_LTR)
    child.setFlexShrink(0)

    expect(child.hasExplicitFlexShrink()).toBe(true)
    expect(child.isDirty()).toBe(false)
    expect(root.isDirty()).toBe(false)
  })

  it("skips dirtying when identical callback setters are re-applied", () => {
    const measure = () => ({ width: 8, height: 1 })
    const baseline = (_width: number, height: number) => height
    const { root, child } = cleanChildWithStyle((node) => {
      node.setMeasureFunc(measure)
      node.setBaselineFunc(baseline)
    })

    child.setMeasureFunc(measure)
    child.setBaselineFunc(baseline)

    expect(child.isDirty()).toBe(false)
    expect(root.isDirty()).toBe(false)
  })

  it("skips dirtying when unset callback setters are already unset", () => {
    const { root, child } = cleanChildWithStyle(() => {})

    child.unsetMeasureFunc()
    child.unsetBaselineFunc()

    expect(child.isDirty()).toBe(false)
    expect(root.isDirty()).toBe(false)
  })

  it("skips dirtying when container query style overrides are unchanged", () => {
    const { root, child } = cleanChildWithStyle((node) => {
      node.setContainerQueryStyle({
        width: { value: 24, unit: UNIT_POINT },
        containSize: true,
        gap: [1, 2],
      })
    })

    child.setContainerQueryStyle({
      width: { value: 24, unit: UNIT_POINT },
      containSize: true,
      gap: [1, 2],
    })

    expect(child.isDirty()).toBe(false)
    expect(root.isDirty()).toBe(false)
  })
})

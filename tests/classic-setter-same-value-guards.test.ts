import { describe, expect, it } from "vitest"
import {
  ALIGN_CENTER,
  ALIGN_FLEX_START,
  ALIGN_STRETCH,
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
  WRAP_WRAP,
} from "../src/index-classic.js"

type SameValueCase = {
  name: string
  apply: (node: Node) => void
}

function cleanNodeWithStyle(apply: (node: Node) => void): Node {
  const node = Node.create()
  node.setWidth(120)
  node.setHeight(40)
  node.setFlexDirection(FLEX_DIRECTION_ROW)
  apply(node)
  node.calculateLayout(120, 40, DIRECTION_LTR)

  expect(node.isDirty()).toBe(false)

  return node
}

const sameValueCases: SameValueCase[] = [
  { name: "width point", apply: (node) => node.setWidth(24) },
  { name: "width percent", apply: (node) => node.setWidthPercent(50) },
  { name: "width auto", apply: (node) => node.setWidthAuto() },
  { name: "height point", apply: (node) => node.setHeight(8) },
  { name: "height percent", apply: (node) => node.setHeightPercent(25) },
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
  { name: "flex shrink", apply: (node) => node.setFlexShrink(1) },
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
]

describe("Classic Node setter same-value guards", () => {
  for (const testCase of sameValueCases) {
    it(`does not dirty a clean tree when reapplying ${testCase.name}`, () => {
      const node = cleanNodeWithStyle(testCase.apply)

      testCase.apply(node)

      expect(node.isDirty()).toBe(false)
    })
  }

  it("still dirties the tree when a setter receives a changed value", () => {
    const node = cleanNodeWithStyle((node) => node.setWidth(24))

    node.setWidth(25)

    expect(node.isDirty()).toBe(true)
  })

  it("skips dirtying when identical callback setters are re-applied", () => {
    const measure = () => ({ width: 8, height: 1 })
    const baseline = (_width: number, height: number) => height
    const node = cleanNodeWithStyle((node) => {
      node.setMeasureFunc(measure)
      node.setBaselineFunc(baseline)
    })

    node.setMeasureFunc(measure)
    node.setBaselineFunc(baseline)

    expect(node.isDirty()).toBe(false)
  })

  it("skips dirtying when unset callback setters are already unset", () => {
    const node = cleanNodeWithStyle(() => {})

    node.unsetMeasureFunc()
    node.unsetBaselineFunc()

    expect(node.isDirty()).toBe(false)
  })
})

/**
 * Test: Row cross-axis height must reflect post-flex child heights.
 *
 * When a flexGrow child in a row gets a narrower width after flex distribution,
 * its text may wrap to more lines (taller height). The row's cross-axis (height)
 * must grow to accommodate the taller child.
 *
 * Bug: A bordered box containing a row with a flexGrow child that has a measure
 * function — after flex distribution narrows the child, the measure function
 * returns a taller height, but the row doesn't grow to accommodate it.
 */
import { describe, expect, it } from "vitest"
import {
  ALIGN_FLEX_START,
  DIRECTION_LTR,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_ROW,
  MEASURE_MODE_AT_MOST,
  MEASURE_MODE_EXACTLY,
  MEASURE_MODE_UNDEFINED,
  Node,
} from "../src/index.js"
import { expectLayout } from "./test-utils.js"

describe("row cross-axis remeasure after flex distribution", () => {
  it("row height grows when flexGrow child text wraps", () => {
    // Simulates: bordered box > row > flexGrow child with text
    // The text is 50 chars wide. When constrained to 32 chars, it wraps to 2 lines.

    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setWidth(80)
    // Auto height — no explicit height set

    // Bordered container (simulates border with padding)
    const bordered = Node.create()
    bordered.setFlexDirection(FLEX_DIRECTION_COLUMN)
    bordered.setPadding(0 /* left */, 1) // border left
    bordered.setPadding(2 /* right */, 1) // border right
    bordered.setPadding(1 /* top */, 1) // border top
    bordered.setPadding(3 /* bottom */, 1) // border bottom
    // No explicit width/height — shrink-wraps
    root.insertChild(bordered, 0)

    // Row inside the border
    const row = Node.create()
    row.setFlexDirection(FLEX_DIRECTION_ROW)
    bordered.insertChild(row, 0)

    // FlexGrow child with measure function
    const flexChild = Node.create()
    flexChild.setFlexGrow(1)
    flexChild.setMeasureFunc((_width, widthMode, _height, _heightMode) => {
      // Simulates text: "Context: Found in inbox old DMV notices from 2019"
      // At unconstrained width: 50 chars x 1 line
      // At width <= 32: wraps to 2 lines
      const textWidth = 50
      if (widthMode === MEASURE_MODE_EXACTLY || widthMode === MEASURE_MODE_AT_MOST) {
        const maxW = _width
        if (maxW >= textWidth) {
          return { width: textWidth, height: 1 }
        }
        // Text wraps
        const lines = Math.ceil(textWidth / maxW)
        return { width: Math.min(textWidth, maxW), height: lines }
      }
      return { width: textWidth, height: 1 }
    })
    row.insertChild(flexChild, 0)

    root.calculateLayout(80, NaN, DIRECTION_LTR)

    // The flex child gets width = 80 - 2 (border) = 78
    // Text is 50 chars, fits in 1 line
    // So row height = 1, bordered height = 1 + 2 (border) = 3
    expect(flexChild.getComputedHeight()).toBe(1)
    expect(row.getComputedHeight()).toBe(1)
    expect(bordered.getComputedHeight()).toBe(3) // 1 + border top + border bottom
  })

  it("row height grows when constrained width causes text wrap", () => {
    // Same as above but the total width is narrower, forcing text to wrap

    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setWidth(36) // Narrow — after border, only 34 chars for content
    // Auto height

    const bordered = Node.create()
    bordered.setFlexDirection(FLEX_DIRECTION_COLUMN)
    bordered.setPadding(0, 1) // left border
    bordered.setPadding(2, 1) // right border
    bordered.setPadding(1, 1) // top border
    bordered.setPadding(3, 1) // bottom border
    root.insertChild(bordered, 0)

    const row = Node.create()
    row.setFlexDirection(FLEX_DIRECTION_ROW)
    bordered.insertChild(row, 0)

    const flexChild = Node.create()
    flexChild.setFlexGrow(1)
    flexChild.setMeasureFunc((_width, widthMode, _height, _heightMode) => {
      const textWidth = 50
      if (widthMode === MEASURE_MODE_EXACTLY || widthMode === MEASURE_MODE_AT_MOST) {
        const maxW = _width
        if (maxW >= textWidth) {
          return { width: textWidth, height: 1 }
        }
        const lines = Math.ceil(textWidth / maxW)
        return { width: Math.min(textWidth, maxW), height: lines }
      }
      return { width: textWidth, height: 1 }
    })
    row.insertChild(flexChild, 0)

    root.calculateLayout(36, NaN, DIRECTION_LTR)

    // Width: 36 - 2 (border) = 34 for content
    // 50 chars / 34 = ceil = 2 lines
    const childWidth = flexChild.getComputedWidth()
    const childHeight = flexChild.getComputedHeight()

    // Child should be 34 wide (row fills bordered content area)
    expect(childWidth).toBe(34)
    // Text wraps to 2 lines
    expect(childHeight).toBe(2)

    // Row should match the child's height
    expect(row.getComputedHeight()).toBe(2)

    // Bordered container should include border
    expect(bordered.getComputedHeight()).toBe(4) // 2 + top border + bottom border
  })

  it("row height grows with multiple children where one wraps", () => {
    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setWidth(40)

    const row = Node.create()
    row.setFlexDirection(FLEX_DIRECTION_ROW)
    root.insertChild(row, 0)

    // Fixed-width child: 10 wide, 1 tall (rigid sibling, doesn't shrink)
    const fixedChild = Node.create()
    fixedChild.setWidth(10)
    fixedChild.setHeight(1)
    fixedChild.setFlexShrink(0) // explicit so test passes under either preset
    row.insertChild(fixedChild, 0)

    // FlexGrow child with wrapping text
    const flexChild = Node.create()
    flexChild.setFlexGrow(1)
    flexChild.setMeasureFunc((_width, widthMode) => {
      const textWidth = 50
      if (widthMode === MEASURE_MODE_EXACTLY || widthMode === MEASURE_MODE_AT_MOST) {
        const maxW = _width
        if (maxW >= textWidth) {
          return { width: textWidth, height: 1 }
        }
        const lines = Math.ceil(textWidth / maxW)
        return { width: Math.min(textWidth, maxW), height: lines }
      }
      return { width: textWidth, height: 1 }
    })
    row.insertChild(flexChild, 1)

    root.calculateLayout(40, NaN, DIRECTION_LTR)

    // flexChild gets 40 - 10 = 30 width
    // 50 / 30 = ceil = 2 lines
    expect(flexChild.getComputedWidth()).toBe(30)
    expect(flexChild.getComputedHeight()).toBe(2)

    // Row must grow to accommodate the 2-line child
    expect(row.getComputedHeight()).toBe(2)
  })

  it("nested: card > column > row > flexGrow text (real card structure)", () => {
    // Simulates the actual Card component hierarchy:
    // Card (column, explicit width, border/padding)
    //   └── Column (children column)
    //         ├── Row (title: prefix + flexGrow text)
    //         └── Row (child: prefix + flexGrow text that wraps)

    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setWidth(40)

    // Card: column with border (simulated as padding)
    const card = Node.create()
    card.setFlexDirection(FLEX_DIRECTION_COLUMN)
    // border: 1 each side, paddingRight: 1
    card.setPadding(0, 1) // left
    card.setPadding(2, 2) // right (border + paddingRight)
    card.setPadding(1, 1) // top
    card.setPadding(3, 1) // bottom
    root.insertChild(card, 0)

    // Children column (auto width/height)
    const childrenCol = Node.create()
    childrenCol.setFlexDirection(FLEX_DIRECTION_ROW) // no wait, TreeNode root is a row
    // Actually TreeNode is: row(prefix, flexGrow column(text, children-column))
    // Let me model the exact structure

    // TreeNode root: row with prefix + content column
    const rootRow = Node.create()
    rootRow.setFlexDirection(FLEX_DIRECTION_ROW)
    rootRow.setAlignItems(ALIGN_FLEX_START)
    card.insertChild(rootRow, 0)

    // Prefix (rigid sibling, doesn't shrink)
    const prefix1 = Node.create()
    prefix1.setWidth(3)
    prefix1.setHeight(1)
    prefix1.setFlexShrink(0)
    rootRow.insertChild(prefix1, 0)

    // Content column (flexGrow)
    const contentCol = Node.create()
    contentCol.setFlexDirection(FLEX_DIRECTION_COLUMN)
    contentCol.setFlexGrow(1)
    contentCol.setFlexShrink(1)
    rootRow.insertChild(contentCol, 1)

    // Title text
    const titleText = Node.create()
    titleText.setMeasureFunc((_w, wm) => {
      const tw = 20 // Short title, fits easily
      if (wm === MEASURE_MODE_AT_MOST || wm === MEASURE_MODE_EXACTLY) {
        return { width: Math.min(tw, _w), height: 1 }
      }
      return { width: tw, height: 1 }
    })
    contentCol.insertChild(titleText, 0)

    // Children column inside content
    const nestedChildrenCol = Node.create()
    nestedChildrenCol.setFlexDirection(FLEX_DIRECTION_COLUMN)
    contentCol.insertChild(nestedChildrenCol, 1)

    // Child row 1: prefix + flexGrow text that wraps
    const childRow1 = Node.create()
    childRow1.setFlexDirection(FLEX_DIRECTION_ROW)
    childRow1.setAlignItems(ALIGN_FLEX_START)
    nestedChildrenCol.insertChild(childRow1, 0)

    const childPrefix1 = Node.create()
    childPrefix1.setWidth(4)
    childPrefix1.setHeight(1)
    childPrefix1.setFlexShrink(0)
    childRow1.insertChild(childPrefix1, 0)

    const childContent1 = Node.create()
    childContent1.setFlexGrow(1)
    childContent1.setFlexShrink(1)
    childRow1.insertChild(childContent1, 1)

    const childText1 = Node.create()
    childText1.setMeasureFunc((_w, wm) => {
      const tw = 50 // Long text that will wrap
      if (wm === MEASURE_MODE_AT_MOST || wm === MEASURE_MODE_EXACTLY) {
        if (_w >= tw) return { width: tw, height: 1 }
        return { width: Math.min(tw, _w), height: Math.ceil(tw / _w) }
      }
      return { width: tw, height: 1 }
    })
    childContent1.insertChild(childText1, 0)

    root.calculateLayout(40, NaN, DIRECTION_LTR)

    // Content width: 40 - 1 (left border) - 2 (right border+pad) = 37
    // rootRow: prefix(3) + contentCol(flexGrow: 37-3=34)
    // contentCol: title(1 line) + nestedChildrenCol
    // nestedChildrenCol > childRow1: childPrefix(4) + childContent(flexGrow: 34-4=30)
    // childText1: 50 chars at width 30 → ceil(50/30) = 2 lines
    expect(childText1.getComputedWidth()).toBe(30)
    expect(childText1.getComputedHeight()).toBe(2)

    // Child row must grow to height 2
    expect(childRow1.getComputedHeight()).toBe(2)

    // Content column: title(1) + childRow(2) = 3
    expect(contentCol.getComputedHeight()).toBe(3)

    // Root row: same as content column (prefix is only 1 tall)
    expect(rootRow.getComputedHeight()).toBe(3)

    // Card: 3 + top border(1) + bottom border(1) = 5
    expect(card.getComputedHeight()).toBe(5)
  })

  it("silvery-exact: root > bordered(setBorder) > row > prefix(measure) + content(flexGrow > text measure)", () => {
    // Mirrors EXACTLY what silvery creates for:
    // <Box borderStyle="single" width={40}>
    //   <Box flexDirection="row">
    //     <Box width={3} flexShrink={0}><Text>·  </Text></Box>
    //     <Box flexGrow={1} flexShrink={1}><Text wrap="wrap">Context: Found in inbox old DMV notices from 2019</Text></Box>
    //   </Box>
    // </Box>
    //
    // Key differences from previous tests:
    // - Uses setBorder (not setPadding) for the bordered box
    // - Has a root wrapper node (like silvery-root)
    // - prefix is a container with a measure-func child (not just a fixed-size box)
    // - content is a container with a measure-func child (not a direct measure leaf)

    // silvery-root wrapper
    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    // No explicit size — calculateLayout will set it

    // Bordered box: width=40, border=1 each side
    const bordered = Node.create()
    bordered.setFlexDirection(FLEX_DIRECTION_COLUMN)
    bordered.setWidth(40)
    bordered.setBorder(0, 1) // left
    bordered.setBorder(1, 1) // top
    bordered.setBorder(2, 1) // right
    bordered.setBorder(3, 1) // bottom
    root.insertChild(bordered, 0)

    // Row
    const row = Node.create()
    row.setFlexDirection(FLEX_DIRECTION_ROW)
    bordered.insertChild(row, 0)

    // Prefix container (width=3, flexShrink=0)
    const prefixBox = Node.create()
    prefixBox.setWidth(3)
    prefixBox.setFlexShrink(0)
    row.insertChild(prefixBox, 0)

    // Prefix text (measure func: "·  " = 3 chars, 1 line)
    const prefixText = Node.create()
    prefixText.setMeasureFunc((_w, wm) => {
      if (wm === MEASURE_MODE_AT_MOST || wm === MEASURE_MODE_EXACTLY) {
        return { width: Math.min(3, _w), height: 1 }
      }
      return { width: 3, height: 1 }
    })
    prefixBox.insertChild(prefixText, 0)

    // Content container (flexGrow=1, flexShrink=1)
    const contentBox = Node.create()
    contentBox.setFlexGrow(1)
    contentBox.setFlexShrink(1)
    row.insertChild(contentBox, 1)

    // Content text (measure func: wrapping text, 50 chars)
    const contentText = Node.create()
    contentText.setMeasureFunc((_w, wm) => {
      const tw = 50
      if (wm === MEASURE_MODE_AT_MOST || wm === MEASURE_MODE_EXACTLY) {
        if (_w >= tw) return { width: tw, height: 1 }
        return { width: Math.min(tw, _w), height: Math.ceil(tw / _w) }
      }
      return { width: tw, height: 1 }
    })
    contentBox.insertChild(contentText, 0)

    root.calculateLayout(40, 20, DIRECTION_LTR)

    // Content text should get width = 40 - 2(border) - 3(prefix) = 35
    // 50 chars at width 35 → ceil(50/35) = 2 lines
    expect(contentText.getComputedWidth()).toBe(35)
    expect(contentText.getComputedHeight()).toBe(2)

    // Content box should match its child
    expect(contentBox.getComputedHeight()).toBe(2)

    // Row must grow to accommodate the 2-line child
    expect(row.getComputedHeight()).toBe(2)

    // Bordered: row(2) + top border(1) + bottom border(1) = 4
    expect(bordered.getComputedHeight()).toBe(4)
  })

  it("auto-height column does not let flexGrow undermeasure wrapped grandchildren", () => {
    // Mirrors silvercode markdown inside a chat entry:
    //
    // row
    //   marker
    //   content column
    //     prose column flexGrow=1
    //       markdown body column
    //         many measured text/list rows
    //
    // The parent column has auto height. In that case flexGrow has no free
    // main-axis space to distribute and must not force its Phase-5 intrinsic
    // height back onto the child after recursive layout. The child may become
    // taller once wrapped descendants are laid out at their resolved width.
    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setWidth(88)

    const row = Node.create()
    row.setFlexDirection(FLEX_DIRECTION_ROW)
    row.setWidth(88)
    root.insertChild(row, 0)

    const marker = Node.create()
    marker.setWidth(1)
    marker.setHeight(1)
    marker.setFlexShrink(0)
    row.insertChild(marker, 0)

    const content = Node.create()
    content.setFlexDirection(FLEX_DIRECTION_COLUMN)
    content.setFlexGrow(1)
    content.setFlexShrink(1)
    row.insertChild(content, 1)

    const prose = Node.create()
    prose.setFlexDirection(FLEX_DIRECTION_COLUMN)
    prose.setFlexGrow(1)
    prose.setFlexShrink(1)
    content.insertChild(prose, 0)

    const body = Node.create()
    body.setFlexDirection(FLEX_DIRECTION_COLUMN)
    body.setFlexShrink(0)
    prose.insertChild(body, 0)

    const makeText = (textWidth: number): Node => {
      const node = Node.create()
      node.setMeasureFunc((width, widthMode) => {
        if (widthMode === MEASURE_MODE_AT_MOST || widthMode === MEASURE_MODE_EXACTLY) {
          return { width: Math.min(textWidth, width), height: Math.ceil(textWidth / width) }
        }
        return { width: textWidth, height: 1 }
      })
      return node
    }

    const makeSpacer = (): Node => {
      const node = Node.create()
      node.setHeight(1)
      node.setFlexShrink(0)
      return node
    }

    const makeBullet = (textWidth: number): Node => {
      const bulletRow = Node.create()
      bulletRow.setFlexDirection(FLEX_DIRECTION_ROW)
      bulletRow.setFlexShrink(0)

      const bulletMarker = Node.create()
      bulletMarker.setWidth(1)
      bulletMarker.setHeight(1)
      bulletMarker.setFlexShrink(0)
      bulletRow.insertChild(bulletMarker, 0)

      const bulletContent = Node.create()
      bulletContent.setFlexDirection(FLEX_DIRECTION_COLUMN)
      bulletContent.setFlexGrow(1)
      bulletContent.setFlexShrink(1)
      bulletRow.insertChild(bulletContent, 1)
      bulletContent.insertChild(makeText(textWidth), 0)

      return bulletRow
    }

    const children = [
      makeText(23),
      makeSpacer(),
      makeText(8),
      makeSpacer(),
      makeBullet(120),
      makeBullet(120),
      makeBullet(29),
      makeText(21),
      makeText(27),
      makeSpacer(),
      makeText(13),
      makeBullet(75),
      makeBullet(37),
      makeBullet(180),
    ]
    children.forEach((child, index) => body.insertChild(child, index))

    root.calculateLayout(88, NaN, DIRECTION_LTR)

    expect(body.getComputedHeight()).toBe(18)
    expect(prose.getComputedHeight()).toBe(body.getComputedHeight())
    expect(content.getComputedHeight()).toBe(body.getComputedHeight())
    expect(row.getComputedHeight()).toBe(body.getComputedHeight())
  })

  it("auto-style column with definite available height still lets flexGrow fill the budget", () => {
    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    root.setWidth(20)

    const child = Node.create()
    child.setFlexDirection(FLEX_DIRECTION_COLUMN)
    child.setFlexGrow(1)
    root.insertChild(child, 0)

    const leaf = Node.create()
    leaf.setHeight(2)
    child.insertChild(leaf, 0)

    root.calculateLayout(20, 10, DIRECTION_LTR)

    expect(root.getComputedHeight()).toBe(10)
    expect(child.getComputedHeight()).toBe(10)
    expect(leaf.getComputedHeight()).toBe(2)
  })
})

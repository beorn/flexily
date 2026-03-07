/**
 * Test: overflow containers with flexGrow should be constrained to flex-allocated size.
 * CSS spec §4.5: overflow:hidden/scroll items have automatic min-size = 0,
 * allowing them to shrink below content size.
 * Bug: km-hightea.scroll-flexgrow
 */
import { describe, test, expect } from "vitest"
import { Node } from "../src/index.js"
import * as C from "../src/constants.js"

describe("overflow + flexGrow", () => {
  test("overflow:hidden child with flexGrow=1 is constrained to parent height", () => {
    const root = Node.create()
    root.setFlexDirection(C.FLEX_DIRECTION_COLUMN)
    root.setHeight(10)
    root.setWidth(80)

    const container = Node.create()
    container.setFlexGrow(1)
    container.setOverflow(C.OVERFLOW_HIDDEN)

    for (let i = 0; i < 30; i++) {
      const line = Node.create()
      line.setHeight(1)
      container.insertChild(line, i)
    }

    root.insertChild(container, 0)
    root.calculateLayout(80, 10)

    expect(root.getComputedHeight()).toBe(10)
    expect(container.getComputedHeight()).toBe(10) // constrained, not 30
  })

  test("overflow:scroll child with flexGrow=1 is constrained to parent height", () => {
    const root = Node.create()
    root.setFlexDirection(C.FLEX_DIRECTION_COLUMN)
    root.setHeight(10)
    root.setWidth(80)

    const container = Node.create()
    container.setFlexGrow(1)
    container.setOverflow(C.OVERFLOW_SCROLL)

    for (let i = 0; i < 30; i++) {
      const line = Node.create()
      line.setHeight(1)
      container.insertChild(line, i)
    }

    root.insertChild(container, 0)
    root.calculateLayout(80, 10)

    expect(root.getComputedHeight()).toBe(10)
    expect(container.getComputedHeight()).toBe(10)
  })

  test("overflow:visible child with flexGrow=1 expands to content (Yoga default)", () => {
    const root = Node.create()
    root.setFlexDirection(C.FLEX_DIRECTION_COLUMN)
    root.setHeight(10)
    root.setWidth(80)

    const container = Node.create()
    container.setFlexGrow(1)
    // default overflow = visible

    for (let i = 0; i < 30; i++) {
      const line = Node.create()
      line.setHeight(1)
      container.insertChild(line, i)
    }

    root.insertChild(container, 0)
    root.calculateLayout(80, 10)

    expect(root.getComputedHeight()).toBe(10)
    // overflow:visible + flexShrink:0 means container stays at content size
    expect(container.getComputedHeight()).toBe(30)
  })

  test("overflow:hidden with explicit flexShrink=0 still shrinks (spec behavior)", () => {
    // CSS spec: overflow:hidden → min-size:auto=0 → item CAN shrink
    // Even when user explicitly sets flexShrink=0, overflow containers
    // get implicit shrink ability (per CSS §4.5)
    const root = Node.create()
    root.setFlexDirection(C.FLEX_DIRECTION_COLUMN)
    root.setHeight(10)
    root.setWidth(80)

    const container = Node.create()
    container.setFlexGrow(1)
    container.setFlexShrink(0) // explicitly 0
    container.setOverflow(C.OVERFLOW_HIDDEN)

    for (let i = 0; i < 30; i++) {
      const line = Node.create()
      line.setHeight(1)
      container.insertChild(line, i)
    }

    root.insertChild(container, 0)
    root.calculateLayout(80, 10)

    expect(root.getComputedHeight()).toBe(10)
    expect(container.getComputedHeight()).toBe(10)
  })

  test("overflow:hidden without flexGrow sizes to content (no grow, content fits)", () => {
    // When content fits, overflow:hidden doesn't change sizing
    const root = Node.create()
    root.setFlexDirection(C.FLEX_DIRECTION_COLUMN)
    root.setHeight(10)
    root.setWidth(80)

    const container = Node.create()
    // no flexGrow - default 0
    container.setOverflow(C.OVERFLOW_HIDDEN)

    for (let i = 0; i < 3; i++) {
      const line = Node.create()
      line.setHeight(1)
      container.insertChild(line, i)
    }

    root.insertChild(container, 0)
    root.calculateLayout(80, 10)

    expect(root.getComputedHeight()).toBe(10)
    expect(container.getComputedHeight()).toBe(3) // content size, fits fine
  })

  test("overflow:hidden without flexGrow shrinks when content exceeds parent", () => {
    // Even without flexGrow, overflow:hidden items should shrink to parent
    const root = Node.create()
    root.setFlexDirection(C.FLEX_DIRECTION_COLUMN)
    root.setHeight(10)
    root.setWidth(80)

    const container = Node.create()
    // no flexGrow - default 0
    container.setOverflow(C.OVERFLOW_HIDDEN)

    for (let i = 0; i < 30; i++) {
      const line = Node.create()
      line.setHeight(1)
      container.insertChild(line, i)
    }

    root.insertChild(container, 0)
    root.calculateLayout(80, 10)

    expect(root.getComputedHeight()).toBe(10)
    expect(container.getComputedHeight()).toBe(10) // clamped to parent
  })

  test("multiple children: overflow:hidden child + fixed child share space", () => {
    const root = Node.create()
    root.setFlexDirection(C.FLEX_DIRECTION_COLUMN)
    root.setHeight(10)
    root.setWidth(80)

    const header = Node.create()
    header.setHeight(2)

    const scrollArea = Node.create()
    scrollArea.setFlexGrow(1)
    scrollArea.setOverflow(C.OVERFLOW_HIDDEN)

    for (let i = 0; i < 30; i++) {
      const line = Node.create()
      line.setHeight(1)
      scrollArea.insertChild(line, i)
    }

    root.insertChild(header, 0)
    root.insertChild(scrollArea, 1)
    root.calculateLayout(80, 10)

    expect(root.getComputedHeight()).toBe(10)
    expect(header.getComputedHeight()).toBe(2)
    expect(scrollArea.getComputedHeight()).toBe(8) // 10 - 2 = 8
  })

  test("row direction: overflow:hidden with flexGrow is constrained", () => {
    const root = Node.create()
    root.setFlexDirection(C.FLEX_DIRECTION_ROW)
    root.setHeight(10)
    root.setWidth(80)

    const container = Node.create()
    container.setFlexGrow(1)
    container.setOverflow(C.OVERFLOW_HIDDEN)

    for (let i = 0; i < 30; i++) {
      const item = Node.create()
      item.setWidth(10)
      container.insertChild(item, i)
    }

    root.insertChild(container, 0)
    root.calculateLayout(80, 10)

    expect(root.getComputedWidth()).toBe(80)
    expect(container.getComputedWidth()).toBe(80) // constrained, not 300
  })
})

/**
 * #26238 — position offsets accept the parsed length grammar and resolve with
 * the same container-query context as dimensions and spacing.
 */
import { describe, expect, it } from "vitest"
import {
  EDGE_LEFT,
  EDGE_TOP,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_ROW,
  Node,
  POSITION_TYPE_ABSOLUTE,
  POSITION_TYPE_RELATIVE,
  LengthError,
} from "../src/index.js"
import { parseLength } from "../src/length.js"
import { CONTAINER_TYPE_INLINE_SIZE, UNIT_UNDEFINED } from "../src/constants.js"

const scale = { ch: 1, lh: 1 }

describe("#26238 position math", () => {
  it("absolute cqi offsets resolve against the nearest container query size", () => {
    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_COLUMN)
    const container = Node.create()
    container.setContainerType(CONTAINER_TYPE_INLINE_SIZE)
    container.setContainSize(true)
    container.setWidth(200)
    container.setHeight(20)
    root.insertChild(container, 0)

    const child = Node.create()
    child.setPositionType(POSITION_TYPE_ABSOLUTE)
    child.setPosition(EDGE_LEFT, parseLength("10cqi", scale))
    child.setPosition(EDGE_TOP, parseLength("1lh", scale))
    child.setWidth(4)
    child.setHeight(1)
    container.insertChild(child, 0)

    root.calculateLayout(200, 20)
    expect(child.getComputedLeft()).toBe(20)
    expect(child.getComputedTop()).toBe(1)
  })

  it("relative math offsets shift the flow position", () => {
    const root = Node.create()
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setWidth(80)
    root.setHeight(4)
    const a = Node.create()
    a.setWidth(4)
    a.setHeight(1)
    a.setPositionType(POSITION_TYPE_RELATIVE)
    a.setPosition(EDGE_LEFT, parseLength("calc(1ch + 1ch)", scale))
    root.insertChild(a, 0)
    root.calculateLayout(80, 4)
    expect(a.getComputedLeft()).toBe(2)
  })

  it("refuses a cross-axis unit on an offset, naming the prop", () => {
    const node = Node.create()
    expect(() => node.setPosition(EDGE_TOP, parseLength("2ch", scale))).toThrow(LengthError)
    expect(() => node.setPosition(EDGE_TOP, parseLength("2ch", scale))).toThrow(/position.*2ch/)
  })

  it("NaN still clears an offset", () => {
    const node = Node.create()
    node.setPosition(EDGE_LEFT, parseLength("2ch", scale))
    node.setPosition(EDGE_LEFT, NaN)
    expect(node.getPosition(EDGE_LEFT).unit).toBe(UNIT_UNDEFINED)
  })
})

/**
 * Synthetic benchmark for non-React callers that re-apply identical styles.
 *
 * Run: bun bench bench/setter-same-value-guards.bench.ts
 */

import { beforeAll, bench, describe } from "vitest"
import {
  ALIGN_CENTER,
  DIRECTION_LTR,
  EDGE_ALL,
  FLEX_DIRECTION_COLUMN,
  FLEX_DIRECTION_ROW,
  GUTTER_ALL,
  Node,
  UNIT_CQI,
} from "../src/index.js"

const WIDTH = 160
const HEIGHT = 60
const NODE_COUNT = 500
const benchOptions = {
  iterations: 1000,
  time: 1000,
}

let root: Node
let nodes: Node[]

function createStyledTree(): { root: Node; nodes: Node[] } {
  const rootNode = Node.create()
  rootNode.setWidth(WIDTH)
  rootNode.setHeight(HEIGHT)
  rootNode.setFlexDirection(FLEX_DIRECTION_ROW)
  rootNode.setGap(GUTTER_ALL, 1)

  const styledNodes: Node[] = []

  for (let columnIndex = 0; columnIndex < 5; columnIndex++) {
    const column = Node.create()
    column.setFlexGrow(1)
    column.setFlexDirection(FLEX_DIRECTION_COLUMN)
    column.setGap(GUTTER_ALL, 1)
    rootNode.insertChild(column, columnIndex)
    styledNodes.push(column)

    for (let rowIndex = 0; rowIndex < NODE_COUNT / 5; rowIndex++) {
      const card = Node.create()
      card.setHeight(2)
      card.setPadding(EDGE_ALL, 1)
      card.setBorder(EDGE_ALL, 1)
      card.setAlignItems(ALIGN_CENTER)
      column.insertChild(card, rowIndex)
      styledNodes.push(card)
    }
  }

  return { root: rootNode, nodes: styledNodes }
}

function applyIdenticalStyles(): void {
  root.setWidth(WIDTH)
  root.setHeight(HEIGHT)
  root.setFlexDirection(FLEX_DIRECTION_ROW)
  root.setGap(GUTTER_ALL, 1)

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i]!
    if (i % 5 === 0) {
      node.setFlexGrow(1)
      node.setFlexDirection(FLEX_DIRECTION_COLUMN)
      node.setGap(GUTTER_ALL, 1)
      node.setFitWidth([24, { value: 50, unit: UNIT_CQI }])
    } else {
      node.setHeight(2)
      node.setPadding(EDGE_ALL, 1)
      node.setBorder(EDGE_ALL, 1)
      node.setAlignItems(ALIGN_CENTER)
    }
  }
}

describe("Flexily setter same-value guards", () => {
  beforeAll(() => {
    ;({ root, nodes } = createStyledTree())
    applyIdenticalStyles()
    root.calculateLayout(WIDTH, HEIGHT, DIRECTION_LTR)
  })

  bench(
    "reapply identical styles to clean 500-node tree + calculateLayout",
    () => {
      applyIdenticalStyles()
      root.calculateLayout(WIDTH, HEIGHT, DIRECTION_LTR)
    },
    benchOptions,
  )

  bench(
    "calculateLayout on unchanged clean 500-node tree",
    () => {
      root.calculateLayout(WIDTH, HEIGHT, DIRECTION_LTR)
    },
    benchOptions,
  )
})

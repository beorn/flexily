/**
 * Flexily Classic vs Zero-Alloc Algorithm Comparison
 *
 * Compares layout performance between:
 * - Classic algorithm (layout.ts)
 * - Zero-allocation algorithm (layout-zero.ts)
 *
 * Run: bun bench bench/classic-vs-zero.bench.ts
 */

import { test, describe, beforeAll } from "vitest"
import * as Classic from "../src/index-classic.js"
import * as Zero from "../src/index.js"

// ============================================================================
// Tree Generators
// ============================================================================

// Helper functions use Classic.Node as the common type for simplicity.
// Both Classic.Node and Zero.Node share the same API surface; the type union
// with private members reduces to `never` under strict TS, so we cast to
// Classic.Node which has identical public methods.

function createFlatTree(engine: "classic" | "zero", nodeCount: number): Classic.Node {
  const Node = engine === "classic" ? Classic.Node : Zero.Node
  const FLEX_DIRECTION_COLUMN = engine === "classic" ? Classic.FLEX_DIRECTION_COLUMN : Zero.FLEX_DIRECTION_COLUMN

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- union of Node types reduces to never
  const root = Node.create() as any
  root.setWidth(1000)
  root.setHeight(1000)
  root.setFlexDirection(FLEX_DIRECTION_COLUMN)

  for (let i = 0; i < nodeCount; i++) {
    const child = Node.create()
    child.setHeight(10)
    child.setFlexGrow(1)
    root.insertChild(child, i)
  }

  return root
}

function createDeepTree(engine: "classic" | "zero", depth: number): Classic.Node {
  const Node = engine === "classic" ? Classic.Node : Zero.Node
  const EDGE_LEFT = engine === "classic" ? Classic.EDGE_LEFT : Zero.EDGE_LEFT

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- union of Node types reduces to never
  const root = Node.create() as any
  root.setWidth(1000)
  root.setHeight(1000)

  let current = root
  for (let i = 0; i < depth; i++) {
    const child = Node.create()
    child.setFlexGrow(1)
    child.setPadding(EDGE_LEFT, 1)
    current.insertChild(child, 0)
    current = child
  }

  return root
}

function createKanbanTree(engine: "classic" | "zero", cardsPerColumn: number): Classic.Node {
  const Node = engine === "classic" ? Classic.Node : Zero.Node
  const FLEX_DIRECTION_ROW = engine === "classic" ? Classic.FLEX_DIRECTION_ROW : Zero.FLEX_DIRECTION_ROW
  const FLEX_DIRECTION_COLUMN = engine === "classic" ? Classic.FLEX_DIRECTION_COLUMN : Zero.FLEX_DIRECTION_COLUMN
  const GUTTER_ALL = engine === "classic" ? Classic.GUTTER_ALL : Zero.GUTTER_ALL
  const EDGE_LEFT = engine === "classic" ? Classic.EDGE_LEFT : Zero.EDGE_LEFT

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- union of Node types reduces to never
  const root = Node.create() as any
  root.setWidth(120)
  root.setHeight(40)
  root.setFlexDirection(FLEX_DIRECTION_ROW)
  root.setGap(GUTTER_ALL, 1)

  for (let col = 0; col < 3; col++) {
    const column = Node.create()
    column.setFlexGrow(1)
    column.setFlexDirection(FLEX_DIRECTION_COLUMN)
    column.setGap(GUTTER_ALL, 1)

    const header = Node.create()
    header.setHeight(1)
    ;(column as any).insertChild(header, 0)

    for (let card = 0; card < cardsPerColumn; card++) {
      const cardNode = Node.create()
      cardNode.setHeight(3)
      cardNode.setPadding(EDGE_LEFT, 1)
      ;(column as any).insertChild(cardNode, card + 1)
    }

    root.insertChild(column, col)
  }

  return root
}

// ============================================================================
// Benchmarks - Flat Hierarchy
// ============================================================================

describe("Classic vs Zero - Flat Hierarchy", () => {
  for (const nodeCount of [100, 500, 1000]) {
    test(`Classic: ${nodeCount} nodes - create + layout`, async ({ bench }) => {
  await bench(`Classic: ${nodeCount} nodes - create + layout`, () => {
      const tree = createFlatTree("classic", nodeCount)
      tree.calculateLayout(1000, 1000, Classic.DIRECTION_LTR)
    }).run()
})

    test(`Zero: ${nodeCount} nodes - create + layout`, async ({ bench }) => {
  await bench(`Zero: ${nodeCount} nodes - create + layout`, () => {
      const tree = createFlatTree("zero", nodeCount)
      tree.calculateLayout(1000, 1000, Zero.DIRECTION_LTR)
    }).run()
})
  }
})

// ============================================================================
// Benchmarks - Deep Hierarchy
// ============================================================================

describe("Classic vs Zero - Deep Hierarchy", () => {
  for (const depth of [20, 50, 100]) {
    test(`Classic: ${depth} levels deep - create + layout`, async ({ bench }) => {
  await bench(`Classic: ${depth} levels deep - create + layout`, () => {
      const tree = createDeepTree("classic", depth)
      tree.calculateLayout(1000, 1000, Classic.DIRECTION_LTR)
    }).run()
})

    test(`Zero: ${depth} levels deep - create + layout`, async ({ bench }) => {
  await bench(`Zero: ${depth} levels deep - create + layout`, () => {
      const tree = createDeepTree("zero", depth)
      tree.calculateLayout(1000, 1000, Zero.DIRECTION_LTR)
    }).run()
})
  }
})

// ============================================================================
// Benchmarks - TUI Patterns
// ============================================================================

describe("Classic vs Zero - Kanban TUI", () => {
  for (const cardsPerCol of [10, 50, 100]) {
    const totalNodes = 3 + 3 * (1 + cardsPerCol)

    test(`Classic: Kanban 3×${cardsPerCol} (~${totalNodes} nodes)`, async ({ bench }) => {
  await bench(`Classic: Kanban 3×${cardsPerCol} (~${totalNodes} nodes)`, () => {
      const tree = createKanbanTree("classic", cardsPerCol)
      tree.calculateLayout(120, 40, Classic.DIRECTION_LTR)
    }).run()
})

    test(`Zero: Kanban 3×${cardsPerCol} (~${totalNodes} nodes)`, async ({ bench }) => {
  await bench(`Zero: Kanban 3×${cardsPerCol} (~${totalNodes} nodes)`, () => {
      const tree = createKanbanTree("zero", cardsPerCol)
      tree.calculateLayout(120, 40, Zero.DIRECTION_LTR)
    }).run()
})
  }
})

// ============================================================================
// Benchmarks - Layout Only (pre-created trees)
// ============================================================================

describe("Classic vs Zero - Layout Only (no allocation)", () => {
  let classicTree: Classic.Node
  let zeroTree: Zero.Node

  beforeAll(() => {
    classicTree = createKanbanTree("classic", 50)
    zeroTree = createKanbanTree("zero", 50) as unknown as Zero.Node
  })

  test("Classic: Kanban 3×50 - layout only", async ({ bench }) => {
  await bench("Classic: Kanban 3×50 - layout only", () => {
    classicTree.markDirty()
    classicTree.calculateLayout(120, 40, Classic.DIRECTION_LTR)
  }).run()
})

  test("Zero: Kanban 3×50 - layout only", async ({ bench }) => {
  await bench("Zero: Kanban 3×50 - layout only", () => {
    zeroTree.markDirty()
    zeroTree.calculateLayout(120, 40, Zero.DIRECTION_LTR)
  }).run()
})
})

// ============================================================================
// Benchmarks - Incremental Update
// ============================================================================

describe("Classic vs Zero - Incremental Update", () => {
  let classicTree: Classic.Node
  let classicLeaf: Classic.Node
  let zeroTree: Zero.Node
  let zeroLeaf: Zero.Node

  beforeAll(() => {
    classicTree = createKanbanTree("classic", 100)
    zeroTree = createKanbanTree("zero", 100) as unknown as Zero.Node

    classicLeaf = classicTree.getChild(1)!.getChild(50)!
    zeroLeaf = zeroTree.getChild(1)!.getChild(50)! as Zero.Node

    classicTree.calculateLayout(120, 40, Classic.DIRECTION_LTR)
    zeroTree.calculateLayout(120, 40, Zero.DIRECTION_LTR)
  })

  test("Classic: Single leaf dirty - relayout", async ({ bench }) => {
  await bench("Classic: Single leaf dirty - relayout", () => {
    classicLeaf.markDirty()
    classicTree.calculateLayout(120, 40, Classic.DIRECTION_LTR)
  }).run()
})

  test("Zero: Single leaf dirty - relayout", async ({ bench }) => {
  await bench("Zero: Single leaf dirty - relayout", () => {
    zeroLeaf.markDirty()
    zeroTree.calculateLayout(120, 40, Zero.DIRECTION_LTR)
  }).run()
})
})

// ============================================================================
// Benchmarks - Large Scale TUI
// ============================================================================

describe("Classic vs Zero - Large Scale TUI", () => {
  function createLargeTUI(engine: "classic" | "zero", nodeCount: number): Classic.Node {
    const Node = engine === "classic" ? Classic.Node : Zero.Node
    const FLEX_DIRECTION_ROW = engine === "classic" ? Classic.FLEX_DIRECTION_ROW : Zero.FLEX_DIRECTION_ROW
    const FLEX_DIRECTION_COLUMN = engine === "classic" ? Classic.FLEX_DIRECTION_COLUMN : Zero.FLEX_DIRECTION_COLUMN
    const GUTTER_ALL = engine === "classic" ? Classic.GUTTER_ALL : Zero.GUTTER_ALL

    const cols = 8
    const itemsPerCol = Math.floor(nodeCount / cols / 3)

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- union of Node types reduces to never
    const root = Node.create() as any
    root.setWidth(250)
    root.setHeight(120)
    root.setFlexDirection(FLEX_DIRECTION_ROW)
    root.setGap(GUTTER_ALL, 1)

    for (let c = 0; c < cols; c++) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const col = Node.create() as any
      col.setFlexGrow(1)
      col.setFlexDirection(FLEX_DIRECTION_COLUMN)

      for (let i = 0; i < itemsPerCol; i++) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const item = Node.create() as any
        item.setFlexDirection(FLEX_DIRECTION_ROW)
        item.setHeight(1)

        const icon = Node.create()
        icon.setWidth(2)
        item.insertChild(icon, 0)

        const text = Node.create()
        text.setFlexGrow(1)
        item.insertChild(text, 1)

        col.insertChild(item, i)
      }
      root.insertChild(col, c)
    }
    return root
  }

  for (const nodeCount of [500, 1000, 1500, 2000]) {
    test(`Classic: Large TUI ~${nodeCount} nodes`, async ({ bench }) => {
  await bench(`Classic: Large TUI ~${nodeCount} nodes`, () => {
      const tree = createLargeTUI("classic", nodeCount)
      tree.calculateLayout(250, 120, Classic.DIRECTION_LTR)
    }).run()
})

    test(`Zero: Large TUI ~${nodeCount} nodes`, async ({ bench }) => {
  await bench(`Zero: Large TUI ~${nodeCount} nodes`, () => {
      const tree = createLargeTUI("zero", nodeCount)
      tree.calculateLayout(250, 120, Zero.DIRECTION_LTR)
    }).run()
})
  }
})

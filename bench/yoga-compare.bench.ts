/**
 * Flexx vs Yoga Comparison Benchmarks
 *
 * Compares layout performance between:
 * - Flexx (pure JavaScript)
 * - Yoga (WebAssembly via yoga-wasm-web)
 *
 * Run: bun bench (from flexx or monorepo root)
 */

import { bench, describe, beforeAll } from "vitest"
import * as Flexx from "../src/index.js"
import initYoga, { type Yoga } from "yoga-wasm-web"
import { readFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

// ============================================================================
// Yoga Setup
// ============================================================================

let yoga: Yoga

const __dirname = dirname(fileURLToPath(import.meta.url))
const wasmPath = join(__dirname, "../node_modules/yoga-wasm-web/dist/yoga.wasm")

beforeAll(async () => {
  const wasmBuffer = readFileSync(wasmPath)
  yoga = await initYoga(wasmBuffer)
})

// ============================================================================
// Tree Generators - Flexx
// ============================================================================

function flextureFlatTree(nodeCount: number): Flexx.Node {
  const root = Flexx.Node.create()
  root.setWidth(1000)
  root.setHeight(1000)
  root.setFlexDirection(Flexx.FLEX_DIRECTION_COLUMN)

  for (let i = 0; i < nodeCount; i++) {
    const child = Flexx.Node.create()
    child.setHeight(10)
    child.setFlexGrow(1)
    root.insertChild(child, i)
  }

  return root
}

function flextureDeepTree(depth: number): Flexx.Node {
  const root = Flexx.Node.create()
  root.setWidth(1000)
  root.setHeight(1000)

  let current = root
  for (let i = 0; i < depth; i++) {
    const child = Flexx.Node.create()
    child.setFlexGrow(1)
    child.setPadding(Flexx.EDGE_LEFT, 1)
    current.insertChild(child, 0)
    current = child
  }

  return root
}

function flextureKanbanTree(cardsPerColumn: number): Flexx.Node {
  const root = Flexx.Node.create()
  root.setWidth(120)
  root.setHeight(40)
  root.setFlexDirection(Flexx.FLEX_DIRECTION_ROW)
  root.setGap(Flexx.GUTTER_ALL, 1)

  for (let col = 0; col < 3; col++) {
    const column = Flexx.Node.create()
    column.setFlexGrow(1)
    column.setFlexDirection(Flexx.FLEX_DIRECTION_COLUMN)
    column.setGap(Flexx.GUTTER_ALL, 1)

    const header = Flexx.Node.create()
    header.setHeight(1)
    column.insertChild(header, 0)

    for (let card = 0; card < cardsPerColumn; card++) {
      const cardNode = Flexx.Node.create()
      cardNode.setHeight(3)
      cardNode.setPadding(Flexx.EDGE_LEFT, 1)
      column.insertChild(cardNode, card + 1)
    }

    root.insertChild(column, col)
  }

  return root
}

// ============================================================================
// Tree Generators - Yoga
// ============================================================================

function yogaFlatTree(nodeCount: number) {
  const root = yoga.Node.create()
  root.setWidth(1000)
  root.setHeight(1000)
  root.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN)

  for (let i = 0; i < nodeCount; i++) {
    const child = yoga.Node.create()
    child.setHeight(10)
    child.setFlexGrow(1)
    root.insertChild(child, i)
  }

  return root
}

function yogaDeepTree(depth: number) {
  const root = yoga.Node.create()
  root.setWidth(1000)
  root.setHeight(1000)

  let current = root
  for (let i = 0; i < depth; i++) {
    const child = yoga.Node.create()
    child.setFlexGrow(1)
    child.setPadding(yoga.EDGE_LEFT, 1)
    current.insertChild(child, 0)
    current = child
  }

  return root
}

function yogaKanbanTree(cardsPerColumn: number) {
  const root = yoga.Node.create()
  root.setWidth(120)
  root.setHeight(40)
  root.setFlexDirection(yoga.FLEX_DIRECTION_ROW)
  root.setGap(yoga.GUTTER_ALL, 1)

  for (let col = 0; col < 3; col++) {
    const column = yoga.Node.create()
    column.setFlexGrow(1)
    column.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN)
    column.setGap(yoga.GUTTER_ALL, 1)

    const header = yoga.Node.create()
    header.setHeight(1)
    column.insertChild(header, 0)

    for (let card = 0; card < cardsPerColumn; card++) {
      const cardNode = yoga.Node.create()
      cardNode.setHeight(3)
      cardNode.setPadding(yoga.EDGE_LEFT, 1)
      column.insertChild(cardNode, card + 1)
    }

    root.insertChild(column, col)
  }

  return root
}

// ============================================================================
// Benchmarks - Create + Layout (fair comparison)
// ============================================================================

describe("Flexx vs Yoga - Flat Hierarchy", () => {
  for (const nodeCount of [100, 500, 1000]) {
    bench(`Flexx: ${nodeCount} nodes - create + layout`, () => {
      const tree = flextureFlatTree(nodeCount)
      tree.calculateLayout(1000, 1000, Flexx.DIRECTION_LTR)
    })

    bench(`Yoga: ${nodeCount} nodes - create + layout`, () => {
      const tree = yogaFlatTree(nodeCount)
      tree.calculateLayout(1000, 1000, yoga.DIRECTION_LTR)
      tree.freeRecursive()
    })
  }
})

describe("Flexx vs Yoga - Deep Hierarchy", () => {
  for (const depth of [1, 2, 5, 10, 15, 20, 50, 100]) {
    bench(`Flexx: ${depth} levels deep - create + layout`, () => {
      const tree = flextureDeepTree(depth)
      tree.calculateLayout(1000, 1000, Flexx.DIRECTION_LTR)
    })

    bench(`Yoga: ${depth} levels deep - create + layout`, () => {
      const tree = yogaDeepTree(depth)
      tree.calculateLayout(1000, 1000, yoga.DIRECTION_LTR)
      tree.freeRecursive()
    })
  }
})

describe("Flexx vs Yoga - Kanban (TUI Pattern)", () => {
  for (const cardsPerCol of [10, 50, 100]) {
    const totalNodes = 3 + 3 * (1 + cardsPerCol)

    bench(`Flexx: Kanban 3×${cardsPerCol} (~${totalNodes} nodes)`, () => {
      const tree = flextureKanbanTree(cardsPerCol)
      tree.calculateLayout(120, 40, Flexx.DIRECTION_LTR)
    })

    bench(`Yoga: Kanban 3×${cardsPerCol} (~${totalNodes} nodes)`, () => {
      const tree = yogaKanbanTree(cardsPerCol)
      tree.calculateLayout(120, 40, yoga.DIRECTION_LTR)
      tree.freeRecursive()
    })
  }
})

// ============================================================================
// Benchmarks - Layout Only (pre-created trees)
// ============================================================================

describe("Flexx vs Yoga - Layout Only (no allocation)", () => {
  let flextureTree: Flexx.Node
  let yogaTree: ReturnType<typeof yogaKanbanTree>

  beforeAll(() => {
    flextureTree = flextureKanbanTree(50)
    yogaTree = yogaKanbanTree(50)
  })

  bench("Flexx: Kanban 3×50 - layout only", () => {
    flextureTree.markDirty()
    flextureTree.calculateLayout(120, 40, Flexx.DIRECTION_LTR)
  })

  bench("Yoga: Kanban 3×50 - layout only", () => {
    yogaTree.markDirty()
    yogaTree.calculateLayout(120, 40, yoga.DIRECTION_LTR)
  })
})

// ============================================================================
// Tree Generators with Measure Functions (simulating text nodes)
// ============================================================================

/**
 * Create a tree with measure functions on leaf nodes.
 * This simulates inkx Text nodes which use measure functions for intrinsic sizing.
 */
function flextureTreeWithMeasure(nodeCount: number): Flexx.Node {
  const root = Flexx.Node.create()
  root.setWidth(250)
  root.setHeight(120)
  root.setFlexDirection(Flexx.FLEX_DIRECTION_COLUMN)

  // Create columns (like TUI columns view)
  const numCols = 5
  const itemsPerCol = Math.floor(nodeCount / numCols / 2) // /2 because each item has a text child

  for (let col = 0; col < numCols; col++) {
    const column = Flexx.Node.create()
    column.setFlexGrow(1)
    column.setFlexDirection(Flexx.FLEX_DIRECTION_COLUMN)

    for (let item = 0; item < itemsPerCol; item++) {
      // Item container
      const itemNode = Flexx.Node.create()
      itemNode.setFlexDirection(Flexx.FLEX_DIRECTION_ROW)
      itemNode.setPadding(Flexx.EDGE_LEFT, 1)

      // Text node with measure function
      const textNode = Flexx.Node.create()
      const textContent = `Item ${col}-${item} with some text content`
      textNode.setMeasureFunc((width, _widthMode, _height, _heightMode) => {
        // Simulate text measurement (simplified)
        const textWidth = textContent.length
        const maxWidth = Number.isNaN(width) ? Number.POSITIVE_INFINITY : width
        const lines = Math.ceil(textWidth / Math.max(1, maxWidth))
        return {
          width: Math.min(textWidth, maxWidth),
          height: lines,
        }
      })
      itemNode.insertChild(textNode, 0)
      column.insertChild(itemNode, item)
    }
    root.insertChild(column, col)
  }

  return root
}

function yogaTreeWithMeasure(nodeCount: number) {
  const root = yoga.Node.create()
  root.setWidth(250)
  root.setHeight(120)
  root.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN)

  const numCols = 5
  const itemsPerCol = Math.floor(nodeCount / numCols / 2)

  for (let col = 0; col < numCols; col++) {
    const column = yoga.Node.create()
    column.setFlexGrow(1)
    column.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN)

    for (let item = 0; item < itemsPerCol; item++) {
      const itemNode = yoga.Node.create()
      itemNode.setFlexDirection(yoga.FLEX_DIRECTION_ROW)
      itemNode.setPadding(yoga.EDGE_LEFT, 1)

      const textNode = yoga.Node.create()
      const textContent = `Item ${col}-${item} with some text content`
      textNode.setMeasureFunc((width, _widthMode, _height, _heightMode) => {
        const textWidth = textContent.length
        const maxWidth = Number.isNaN(width) ? Number.POSITIVE_INFINITY : width
        const lines = Math.ceil(textWidth / Math.max(1, maxWidth))
        return {
          width: Math.min(textWidth, maxWidth),
          height: lines,
        }
      })
      itemNode.insertChild(textNode, 0)
      column.insertChild(itemNode, item)
    }
    root.insertChild(column, col)
  }

  return root
}

// ============================================================================
// Benchmarks - With Measure Functions (real-world TUI pattern)
// ============================================================================

describe("Flexx vs Yoga - With Measure Functions", () => {
  for (const nodeCount of [200, 500, 1000, 1500]) {
    bench(`Flexx: ~${nodeCount} nodes with measure - create + layout`, () => {
      const tree = flextureTreeWithMeasure(nodeCount)
      tree.calculateLayout(250, 120, Flexx.DIRECTION_LTR)
    })

    bench(`Yoga: ~${nodeCount} nodes with measure - create + layout`, () => {
      const tree = yogaTreeWithMeasure(nodeCount)
      tree.calculateLayout(250, 120, yoga.DIRECTION_LTR)
      tree.freeRecursive()
    })
  }
})

// ============================================================================
// Benchmarks - Incremental Updates (single node dirty)
// ============================================================================

describe("Flexx vs Yoga - Incremental Update", () => {
  let flextureTree: Flexx.Node
  let flextureLeaf: Flexx.Node
  let yogaTree: ReturnType<typeof yogaKanbanTree>
  let yogaLeaf: ReturnType<typeof yoga.Node.create>

  beforeAll(() => {
    // Create trees
    flextureTree = flextureKanbanTree(100)
    yogaTree = yogaKanbanTree(100)

    // Get a deep leaf node to mark dirty
    flextureLeaf = flextureTree.getChild(1)!.getChild(50)!
    yogaLeaf = yogaTree.getChild(1)!.getChild(50)!

    // Initial layout
    flextureTree.calculateLayout(120, 40, Flexx.DIRECTION_LTR)
    yogaTree.calculateLayout(120, 40, yoga.DIRECTION_LTR)
  })

  bench("Flexx: Single leaf dirty - relayout", () => {
    flextureLeaf.markDirty()
    flextureTree.calculateLayout(120, 40, Flexx.DIRECTION_LTR)
  })

  bench("Yoga: Single leaf dirty - relayout", () => {
    yogaLeaf.markDirty()
    yogaTree.calculateLayout(120, 40, yoga.DIRECTION_LTR)
  })
})

// ============================================================================
// Benchmarks - Large Scale (1500+ nodes like real km app)
// ============================================================================

describe("Flexx vs Yoga - Large Scale TUI", () => {
  // Simulate a large TUI with multiple columns and many items
  function createLargeTUI(engine: "flexx" | "yoga", nodeCount: number) {
    const cols = 8
    const itemsPerCol = Math.floor(nodeCount / cols / 3) // 3 nodes per item: container + icon + text

    if (engine === "flexx") {
      const root = Flexx.Node.create()
      root.setWidth(250)
      root.setHeight(120)
      root.setFlexDirection(Flexx.FLEX_DIRECTION_ROW)
      root.setGap(Flexx.GUTTER_ALL, 1)

      for (let c = 0; c < cols; c++) {
        const col = Flexx.Node.create()
        col.setFlexGrow(1)
        col.setFlexDirection(Flexx.FLEX_DIRECTION_COLUMN)

        for (let i = 0; i < itemsPerCol; i++) {
          const item = Flexx.Node.create()
          item.setFlexDirection(Flexx.FLEX_DIRECTION_ROW)
          item.setHeight(1)

          const icon = Flexx.Node.create()
          icon.setWidth(2)
          item.insertChild(icon, 0)

          const text = Flexx.Node.create()
          text.setFlexGrow(1)
          item.insertChild(text, 1)

          col.insertChild(item, i)
        }
        root.insertChild(col, c)
      }
      return root
    } else {
      const root = yoga.Node.create()
      root.setWidth(250)
      root.setHeight(120)
      root.setFlexDirection(yoga.FLEX_DIRECTION_ROW)
      root.setGap(yoga.GUTTER_ALL, 1)

      for (let c = 0; c < cols; c++) {
        const col = yoga.Node.create()
        col.setFlexGrow(1)
        col.setFlexDirection(yoga.FLEX_DIRECTION_COLUMN)

        for (let i = 0; i < itemsPerCol; i++) {
          const item = yoga.Node.create()
          item.setFlexDirection(yoga.FLEX_DIRECTION_ROW)
          item.setHeight(1)

          const icon = yoga.Node.create()
          icon.setWidth(2)
          item.insertChild(icon, 0)

          const text = yoga.Node.create()
          text.setFlexGrow(1)
          item.insertChild(text, 1)

          col.insertChild(item, i)
        }
        root.insertChild(col, c)
      }
      return root
    }
  }

  for (const nodeCount of [500, 1000, 1500, 2000]) {
    bench(`Flexx: Large TUI ~${nodeCount} nodes`, () => {
      const tree = createLargeTUI("flexx", nodeCount) as Flexx.Node
      tree.calculateLayout(250, 120, Flexx.DIRECTION_LTR)
    })

    bench(`Yoga: Large TUI ~${nodeCount} nodes`, () => {
      const tree = createLargeTUI("yoga", nodeCount) as ReturnType<typeof yoga.Node.create>
      tree.calculateLayout(250, 120, yoga.DIRECTION_LTR)
      tree.freeRecursive()
    })
  }
})

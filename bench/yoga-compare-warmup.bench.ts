/**
 * Flexx vs Yoga Comparison Benchmarks (with warmup)
 *
 * Same as yoga-compare.bench.ts but with explicit warmup to reduce
 * JIT compilation and GC variance.
 *
 * Run: bun bench bench/yoga-compare-warmup.bench.ts
 */

import { bench, describe, beforeAll, afterAll } from "vitest"
import * as Flexx from "../src/index.js"
import { getLayoutStats, resetLayoutStats } from "../src/layout-stats.js"
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

  // Extensive warmup to stabilize JIT
  console.log("\n[Warmup] Running 1000 iterations to stabilize JIT...")
  for (let i = 0; i < 1000; i++) {
    const fTree = flexxDeepTree(50)
    fTree.calculateLayout(1000, 1000, Flexx.DIRECTION_LTR)

    const yTree = yogaDeepTree(50)
    yTree.calculateLayout(1000, 1000, yoga.DIRECTION_LTR)
    yTree.freeRecursive()
  }

  // Force GC if available
  if (typeof globalThis.gc === "function") {
    globalThis.gc()
  }
  console.log("[Warmup] Complete\n")
  resetLayoutStats()
})

afterAll(() => {
  const stats = getLayoutStats()
  const total = stats.hits + stats.misses
  if (total > 0) {
    console.log(
      `\n[Cache Stats] fingerprint hits: ${stats.hits}, misses: ${stats.misses}, ` +
        `hit rate: ${(stats.hitRate * 100).toFixed(1)}% (${total} total)`,
    )
  }
})

// ============================================================================
// Tree Generators - Flexx
// ============================================================================

function flexxFlatTree(nodeCount: number): Flexx.Node {
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

function flexxDeepTree(depth: number): Flexx.Node {
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

// ============================================================================
// Benchmark Options - More iterations, longer warmup
// ============================================================================

const benchOptions = {
  warmupIterations: 100,
  iterations: 1000,
  time: 2000, // 2 seconds per benchmark
}

// ============================================================================
// Benchmarks - Flat Hierarchy
// ============================================================================

describe("Flexx vs Yoga - Flat (warmed up)", () => {
  for (const nodeCount of [100, 500, 1000, 2000, 5000]) {
    bench(
      `Flexx: ${nodeCount} nodes`,
      () => {
        const tree = flexxFlatTree(nodeCount)
        tree.calculateLayout(1000, 1000, Flexx.DIRECTION_LTR)
      },
      benchOptions,
    )

    bench(
      `Yoga: ${nodeCount} nodes`,
      () => {
        const tree = yogaFlatTree(nodeCount)
        tree.calculateLayout(1000, 1000, yoga.DIRECTION_LTR)
        tree.freeRecursive()
      },
      benchOptions,
    )
  }
})

// ============================================================================
// Benchmarks - Deep Hierarchy
// ============================================================================

describe("Flexx vs Yoga - Deep (warmed up)", () => {
  for (const depth of [1, 2, 5, 10, 15, 20, 50, 100]) {
    bench(
      `Flexx: ${depth} levels`,
      () => {
        const tree = flexxDeepTree(depth)
        tree.calculateLayout(1000, 1000, Flexx.DIRECTION_LTR)
      },
      benchOptions,
    )

    bench(
      `Yoga: ${depth} levels`,
      () => {
        const tree = yogaDeepTree(depth)
        tree.calculateLayout(1000, 1000, yoga.DIRECTION_LTR)
        tree.freeRecursive()
      },
      benchOptions,
    )
  }
})

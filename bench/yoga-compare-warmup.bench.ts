/**
 * Flexily vs Yoga Comparison Benchmarks (with warmup)
 *
 * Same as yoga-compare.bench.ts but with explicit warmup to reduce
 * JIT compilation and GC variance.
 *
 * Run: bun bench bench/yoga-compare-warmup.bench.ts
 */

import { bench, describe, beforeAll } from "vitest"
import * as Flexily from "../src/index.js"
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
    const fTree = flexilyDeepTree(50)
    fTree.calculateLayout(1000, 1000, Flexily.DIRECTION_LTR)

    const yTree = yogaDeepTree(50)
    yTree.calculateLayout(1000, 1000, yoga.DIRECTION_LTR)
    yTree.freeRecursive()
  }

  // Force GC if available
  if (typeof globalThis.gc === "function") {
    globalThis.gc()
  }
  console.log("[Warmup] Complete\n")
})

// ============================================================================
// Tree Generators - Flexily
// ============================================================================

function flexilyFlatTree(nodeCount: number): Flexily.Node {
  const root = Flexily.Node.create()
  root.setWidth(1000)
  root.setHeight(1000)
  root.setFlexDirection(Flexily.FLEX_DIRECTION_COLUMN)

  for (let i = 0; i < nodeCount; i++) {
    const child = Flexily.Node.create()
    child.setHeight(10)
    child.setFlexGrow(1)
    root.insertChild(child, i)
  }

  return root
}

function flexilyDeepTree(depth: number): Flexily.Node {
  const root = Flexily.Node.create()
  root.setWidth(1000)
  root.setHeight(1000)

  let current = root
  for (let i = 0; i < depth; i++) {
    const child = Flexily.Node.create()
    child.setFlexGrow(1)
    child.setPadding(Flexily.EDGE_LEFT, 1)
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

describe("Flexily vs Yoga - Flat (warmed up)", () => {
  for (const nodeCount of [100, 500, 1000, 2000, 5000]) {
    bench(
      `Flexily: ${nodeCount} nodes`,
      () => {
        const tree = flexilyFlatTree(nodeCount)
        tree.calculateLayout(1000, 1000, Flexily.DIRECTION_LTR)
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

describe("Flexily vs Yoga - Deep (warmed up)", () => {
  for (const depth of [1, 2, 5, 10, 15, 20, 50, 100]) {
    bench(
      `Flexily: ${depth} levels`,
      () => {
        const tree = flexilyDeepTree(depth)
        tree.calculateLayout(1000, 1000, Flexily.DIRECTION_LTR)
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

#!/usr/bin/env bun
/**
 * Flexily vs Yoga Comparison Benchmarks
 *
 * Run: bun bench/compare.ts
 *
 * Compares layout performance between:
 * - Flexily (pure JavaScript)
 * - Yoga (WebAssembly via yoga-wasm-web)
 */

import * as Flexily from "../src/index.ts"
import initYoga, { type Yoga } from "yoga-wasm-web"
import os from "node:os"
import { readFileSync } from "node:fs"
import { fileURLToPath } from "node:url"
import { dirname, join } from "node:path"

const __dirname = dirname(fileURLToPath(import.meta.url))
const wasmPath = join(__dirname, "../node_modules/yoga-wasm-web/dist/yoga.wasm")

// ============================================================================
// Benchmark Harness
// ============================================================================

interface BenchResult {
  name: string
  iterations: number
  avgUs: number
  minUs: number
  maxUs: number
  opsPerSec: number
}

function benchmark(name: string, fn: () => void, options: { iterations?: number; warmup?: number } = {}): BenchResult {
  const { iterations = 1000, warmup = 100 } = options

  // Warmup
  for (let i = 0; i < warmup; i++) {
    fn()
  }

  // Measure
  const times: number[] = []
  const start = performance.now()

  for (let i = 0; i < iterations; i++) {
    const iterStart = performance.now()
    fn()
    times.push(performance.now() - iterStart)
  }

  const totalMs = performance.now() - start
  const avgUs = (totalMs / iterations) * 1000
  const minUs = Math.min(...times) * 1000
  const maxUs = Math.max(...times) * 1000
  const opsPerSec = Math.round(iterations / (totalMs / 1000))

  return { name, iterations, avgUs, minUs, maxUs, opsPerSec }
}

function formatComparison(
  flexily: BenchResult,
  yoga: BenchResult,
): { flexilyStr: string; yogaStr: string; winner: string; ratio: string } {
  const flexilyStr = `${flexily.avgUs.toFixed(2)} µs`
  const yogaStr = `${yoga.avgUs.toFixed(2)} µs`

  const ratio = flexily.avgUs / yoga.avgUs
  let winner: string
  let ratioStr: string

  if (ratio < 0.95) {
    winner = "Flexily"
    ratioStr = `Flexily ${(1 / ratio).toFixed(2)}x faster`
  } else if (ratio > 1.05) {
    winner = "Yoga"
    ratioStr = `Yoga ${ratio.toFixed(2)}x faster`
  } else {
    winner = "≈ same"
    ratioStr = "~equal"
  }

  return { flexilyStr, yogaStr, winner, ratio: ratioStr }
}

// ============================================================================
// Test Case Generators - Create + Layout combined
// (This is the fair comparison - both must create and layout)
// ============================================================================

function benchFlexilyFlat(nodeCount: number): () => void {
  return () => {
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

    root.calculateLayout(1000, 1000, Flexily.DIRECTION_LTR)
  }
}

function benchYogaFlat(yoga: Yoga, nodeCount: number): () => void {
  return () => {
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

    root.calculateLayout(1000, 1000, yoga.DIRECTION_LTR)
    root.freeRecursive()
  }
}

function benchFlexilyDeep(depth: number): () => void {
  return () => {
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

    root.calculateLayout(1000, 1000, Flexily.DIRECTION_LTR)
  }
}

function benchYogaDeep(yoga: Yoga, depth: number): () => void {
  return () => {
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

    root.calculateLayout(1000, 1000, yoga.DIRECTION_LTR)
    root.freeRecursive()
  }
}

function benchFlexilyKanban(cardsPerColumn: number): () => void {
  return () => {
    const root = Flexily.Node.create()
    root.setWidth(120)
    root.setHeight(40)
    root.setFlexDirection(Flexily.FLEX_DIRECTION_ROW)
    root.setGap(Flexily.GUTTER_ALL, 1)

    for (let col = 0; col < 3; col++) {
      const column = Flexily.Node.create()
      column.setFlexGrow(1)
      column.setFlexDirection(Flexily.FLEX_DIRECTION_COLUMN)
      column.setGap(Flexily.GUTTER_ALL, 1)

      const header = Flexily.Node.create()
      header.setHeight(1)
      column.insertChild(header, 0)

      for (let card = 0; card < cardsPerColumn; card++) {
        const cardNode = Flexily.Node.create()
        cardNode.setHeight(3)
        cardNode.setPadding(Flexily.EDGE_LEFT, 1)
        column.insertChild(cardNode, card + 1)
      }

      root.insertChild(column, col)
    }

    root.calculateLayout(120, 40, Flexily.DIRECTION_LTR)
  }
}

function benchYogaKanban(yoga: Yoga, cardsPerColumn: number): () => void {
  return () => {
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

    root.calculateLayout(120, 40, yoga.DIRECTION_LTR)
    root.freeRecursive()
  }
}

// ============================================================================
// Main
// ============================================================================

async function main() {
  console.log("# Flexily vs Yoga Comparison Benchmarks")
  console.log("")
  console.log("## Hardware")
  console.log(`- Platform: ${os.platform()} ${os.arch()}`)
  console.log(`- CPU: ${os.cpus()[0]?.model || "Unknown"}`)
  console.log(`- Cores: ${os.cpus().length}`)
  console.log(`- Bun: ${process.versions.bun || process.versions.node}`)
  console.log(`- Date: ${new Date().toISOString().split("T")[0]}`)
  console.log("")

  // Initialize Yoga
  console.log("Initializing Yoga WASM...")
  const wasmBuffer = readFileSync(wasmPath)
  const yoga = await initYoga(wasmBuffer)
  console.log("Yoga initialized.")
  console.log("")

  console.log("**Note:** These benchmarks measure tree creation + layout together.")
  console.log("This is the fair comparison since both engines need to allocate nodes.")
  console.log("")

  const results: Array<{
    benchmark: string
    flexily: BenchResult
    yoga: BenchResult
  }> = []

  // -------------------------------------------------------------------------
  // Flat Hierarchy
  // -------------------------------------------------------------------------
  console.log("Running flat hierarchy benchmarks...")

  for (const nodeCount of [100, 500, 1000]) {
    const flexilyResult = benchmark(`Flexily flat ${nodeCount}`, benchFlexilyFlat(nodeCount), {
      iterations: 500,
    })

    const yogaResult = benchmark(`Yoga flat ${nodeCount}`, benchYogaFlat(yoga, nodeCount), {
      iterations: 500,
    })

    results.push({
      benchmark: `Flat ${nodeCount} nodes`,
      flexily: flexilyResult,
      yoga: yogaResult,
    })
  }

  // -------------------------------------------------------------------------
  // Deep Hierarchy
  // -------------------------------------------------------------------------
  console.log("Running deep hierarchy benchmarks...")

  for (const depth of [20, 50, 100]) {
    const flexilyResult = benchmark(`Flexily deep ${depth}`, benchFlexilyDeep(depth), {
      iterations: 500,
    })

    const yogaResult = benchmark(`Yoga deep ${depth}`, benchYogaDeep(yoga, depth), {
      iterations: 500,
    })

    results.push({
      benchmark: `Deep ${depth} levels`,
      flexily: flexilyResult,
      yoga: yogaResult,
    })
  }

  // -------------------------------------------------------------------------
  // Terminal TUI Patterns
  // -------------------------------------------------------------------------
  console.log("Running TUI pattern benchmarks...")

  for (const cardsPerCol of [10, 50, 100]) {
    const totalNodes = 3 + 3 * (1 + cardsPerCol)
    const flexilyResult = benchmark(`Flexily kanban 3x${cardsPerCol}`, benchFlexilyKanban(cardsPerCol), {
      iterations: 500,
    })

    const yogaResult = benchmark(`Yoga kanban 3x${cardsPerCol}`, benchYogaKanban(yoga, cardsPerCol), {
      iterations: 500,
    })

    results.push({
      benchmark: `Kanban 3×${cardsPerCol} (~${totalNodes} nodes)`,
      flexily: flexilyResult,
      yoga: yogaResult,
    })
  }

  // -------------------------------------------------------------------------
  // Print Results Table
  // -------------------------------------------------------------------------
  console.log("")
  console.log("## Results")
  console.log("")
  console.log("| Benchmark | Flexily | Yoga | Comparison |")
  console.log("|-----------|-------|------|------------|")

  for (const { benchmark: name, flexily, yoga: yogaResult } of results) {
    const cmp = formatComparison(flexily, yogaResult)
    console.log(`| ${name.padEnd(28)} | ${cmp.flexilyStr.padStart(10)} | ${cmp.yogaStr.padStart(10)} | ${cmp.ratio} |`)
  }

  console.log("")
  console.log("## Summary")
  console.log("")

  const flexilyWins = results.filter((r) => r.flexily.avgUs < r.yoga.avgUs * 0.95).length
  const yogaWins = results.filter((r) => r.yoga.avgUs < r.flexily.avgUs * 0.95).length
  const ties = results.length - flexilyWins - yogaWins

  console.log(`- Flexily faster: ${flexilyWins} benchmarks`)
  console.log(`- Yoga faster: ${yogaWins} benchmarks`)
  console.log(`- Roughly equal: ${ties} benchmarks`)
  console.log("")

  // Calculate average ratio
  const avgRatio = results.reduce((sum, r) => sum + r.flexily.avgUs / r.yoga.avgUs, 0) / results.length

  if (avgRatio < 0.9) {
    console.log(`**Overall: Flexily is ~${(1 / avgRatio).toFixed(1)}x faster on average**`)
  } else if (avgRatio > 1.1) {
    console.log(`**Overall: Yoga is ~${avgRatio.toFixed(1)}x faster on average**`)
  } else {
    console.log("**Overall: Performance is roughly equivalent**")
  }

  console.log("")
  console.log("Both engines handle terminal UI workloads (<500 nodes) well.")
  console.log("Choose based on other factors: bundle size, WASM support, API.")
}

main().catch(console.error)

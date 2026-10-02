#!/usr/bin/env bun
/**
 * Exit nonzero and name every benchmark case that recorded no samples (#26457).
 *
 * Usage: bun bench/check-unmeasured.ts <vitest-json-report>
 *
 * A case that yields no samples is an empty result, not a measurement: it must
 * never leave the run looking green.
 */

import { findUnmeasured, type RawBenchReport } from "./unmeasured"

const path = process.argv[2]
if (!path) {
  console.error("usage: bun bench/check-unmeasured.ts <vitest-json-report>")
  process.exit(2)
}

let unmeasured: ReturnType<typeof findUnmeasured>
try {
  const report = JSON.parse(await Bun.file(path).text()) as RawBenchReport
  unmeasured = findUnmeasured(report)
} catch (error) {
  console.error(`NOT MEASURED: could not read or validate benchmark report ${path}: ${String(error)}`)
  process.exit(2)
}

if (unmeasured.length > 0) {
  console.error(`\n${unmeasured.length} benchmark case(s) recorded no samples:`)
  for (const entry of unmeasured) console.error(`  NOT MEASURED: ${entry.group} > ${entry.name}`)
  console.error("\nAn empty result is not a measurement. Fix the case, or remove it.\n")
  process.exit(1)
}

console.log(`benchmark guard: every case recorded samples (${path})`)

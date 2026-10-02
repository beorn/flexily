/**
 * Fail-loud guard for the native benchmark (#26457).
 *
 * Vitest bench records zero samples for a case that never ran, prints
 * `NaNx faster` for it in the summary, and still exits 0 — so an empty result
 * reads as a measurement. This module turns that empty result into a named
 * failure that the benchmark entry point can act on.
 */

export interface RawBenchmark {
  name?: string
  /** Present only when the case actually recorded samples. */
  sampleCount?: number
  samples?: unknown[]
}

export interface RawGroup {
  fullName?: string
  benchmarks?: RawBenchmark[]
}

export interface RawFile {
  filepath?: string
  groups?: RawGroup[]
}

export interface RawBenchReport {
  files?: RawFile[]
}

export interface UnmeasuredCase {
  group: string
  name: string
}

/** True when the case recorded at least one sample. */
export function isMeasured(benchmark: RawBenchmark): boolean {
  if (typeof benchmark.sampleCount === "number") return benchmark.sampleCount > 0
  return Array.isArray(benchmark.samples) && benchmark.samples.length > 0
}

/** Every case in the report that recorded no samples, in report order. */
export function findUnmeasured(report: RawBenchReport): UnmeasuredCase[] {
  const unmeasured: UnmeasuredCase[] = []
  for (const file of report.files ?? []) {
    for (const group of file.groups ?? []) {
      for (const benchmark of group.benchmarks ?? []) {
        if (!isMeasured(benchmark)) {
          unmeasured.push({
            group: group.fullName ?? file.filepath ?? "<unknown group>",
            name: benchmark.name ?? "<unnamed case>",
          })
        }
      }
    }
  }
  return unmeasured
}

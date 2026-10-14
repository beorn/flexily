/**
 * Fail-loud guard for the native benchmark (#26457).
 *
 * Vitest bench records zero samples for a case that never ran, prints
 * `NaNx faster` for it in the summary, and still exits 0 — so an empty result
 * reads as a measurement. This module turns that empty result into a named
 * failure that the benchmark entry point can act on.
 *
 * Vitest 5 removed bench `--outputJson`/`--compare`, so `bench:check` now reads
 * the `--reporter=json` report, whose shape nests benchmark cases one level
 * deeper (`testResults[].assertionResults[].benchmarks[].tasks[]`). Both shapes
 * are walked here.
 */

export interface RawBenchmark {
  name?: string
  /** vitest 4 `--outputJson`: present only when the case recorded samples. */
  sampleCount?: number
  samples?: unknown[]
  /** vitest 5 `--reporter=json`: the task's latency stats, carrying its own sample count. */
  latency?: { samplesCount?: number }
}

export interface RawGroup {
  fullName?: string
  benchmarks?: RawBenchmark[]
}

export interface RawFile {
  filepath?: string
  groups?: RawGroup[]
}

/** vitest 5 `--reporter=json`: a benchmark entry is a GROUP whose `tasks` are the cases. */
export interface RawReportBenchmarkGroup {
  name?: string
  tasks?: RawBenchmark[]
}

export interface RawReportAssertion {
  fullName?: string
  benchmarks?: RawReportBenchmarkGroup[]
}

export interface RawReportFile {
  name?: string
  assertionResults?: RawReportAssertion[]
}

export interface RawBenchReport {
  /** vitest 4 `--outputJson`. */
  files?: RawFile[]
  /** vitest 5 `--reporter=json`. */
  testResults?: RawReportFile[]
}

export interface UnmeasuredCase {
  group: string
  name: string
}

interface BenchCase {
  group: string
  name: string
  benchmark: RawBenchmark
}

/** True when the case recorded at least one sample. */
export function isMeasured(benchmark: RawBenchmark): boolean {
  if (typeof benchmark.sampleCount === "number") return benchmark.sampleCount > 0
  if (Array.isArray(benchmark.samples)) return benchmark.samples.length > 0
  if (benchmark.latency) return typeof benchmark.latency.samplesCount === "number" && benchmark.latency.samplesCount > 0
  return false
}

function collectCases(report: RawBenchReport): BenchCase[] {
  const cases: BenchCase[] = []
  for (const file of report.files ?? []) {
    for (const group of file.groups ?? []) {
      for (const benchmark of group.benchmarks ?? []) {
        cases.push({
          group: group.fullName ?? file.filepath ?? "<unknown group>",
          name: benchmark.name ?? "<unnamed case>",
          benchmark,
        })
      }
    }
  }
  for (const file of report.testResults ?? []) {
    for (const assertion of file.assertionResults ?? []) {
      for (const group of assertion.benchmarks ?? []) {
        for (const task of group.tasks ?? []) {
          cases.push({
            group:
              [assertion.fullName, group.name].filter((part): part is string => Boolean(part)).join(" > ") ||
              file.name ||
              "<unknown group>",
            name: task.name ?? "<unnamed case>",
            benchmark: task,
          })
        }
      }
    }
  }
  return cases
}

/** Every case in the report that recorded no samples, in report order. */
export function findUnmeasured(report: RawBenchReport): UnmeasuredCase[] {
  const cases = collectCases(report)
  const unmeasured: UnmeasuredCase[] = []
  for (const entry of cases) {
    if (!isMeasured(entry.benchmark)) unmeasured.push({ group: entry.group, name: entry.name })
  }
  if (cases.length === 0) throw new Error("benchmark report contains no benchmark cases")
  return unmeasured
}

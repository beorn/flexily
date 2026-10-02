import { describe, expect, it } from "vitest"
import { execFileSync } from "node:child_process"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"
import { findUnmeasured, isMeasured } from "../bench/unmeasured"

const here = dirname(fileURLToPath(import.meta.url))

// Shapes as Vitest's json reporter writes them: a measured case carries
// `sampleCount`, an unmeasured one stops at `samples` (always []).
const measured = { name: "Flexily: 5×10 leaf dirty", samples: [], sampleCount: 500 }
const unmeasured = { name: "Flexily: 5×10 leaf dirty", samples: [] }

function writeReport(report: unknown): string {
  const path = join(mkdtempSync(join(tmpdir(), "flexily-bench-guard-")), "report.json")
  writeFileSync(path, JSON.stringify(report))
  return path
}

describe("benchmark unmeasured guard (#26457)", () => {
  it("counts a case with samples as measured", () => {
    expect(isMeasured(measured)).toBe(true)
  })

  it("counts a case with no samples as unmeasured", () => {
    expect(isMeasured(unmeasured)).toBe(false)
  })

  it("names every unmeasured case with its group", () => {
    const report = {
      files: [
        {
          filepath: "bench/yoga-compare-rich.bench.ts",
          groups: [{ fullName: "bench/yoga-compare-rich.bench.ts > Group A", benchmarks: [measured, unmeasured] }],
        },
      ],
    }
    expect(findUnmeasured(report)).toEqual([
      { group: "bench/yoga-compare-rich.bench.ts > Group A", name: "Flexily: 5×10 leaf dirty" },
    ])
  })

  it("finds nothing in a fully measured report", () => {
    const report = { files: [{ groups: [{ fullName: "Group A", benchmarks: [measured] }] }] }
    expect(findUnmeasured(report)).toEqual([])
  })

  // @failure Empty inventories must not certify a benchmark as measured.
  // @level l0
  // @consumer bench/check-unmeasured.ts
  it.each([{}, { files: [] }, { files: [{}] }, { files: [{ groups: [{ benchmarks: [] }] }] }])(
    "rejects a report with no benchmark cases: %j",
    (report) => {
      expect(() => findUnmeasured(report)).toThrow(/no benchmark cases/)
    },
  )

  it("exits nonzero and names the case when a run yields no samples", () => {
    const reportPath = writeReport({
      files: [{ groups: [{ fullName: "bench/yoga-compare-rich.bench.ts > Group A", benchmarks: [unmeasured] }] }],
    })

    let status = 0
    let stderr = ""
    try {
      execFileSync(process.execPath, [join(here, "../bench/check-unmeasured.ts"), reportPath], {
        stdio: ["ignore", "pipe", "pipe"],
      })
    } catch (error) {
      status = (error as { status?: number }).status ?? 0
      stderr = String((error as { stderr?: unknown }).stderr ?? "")
    }

    expect(status).toBe(1)
    expect(stderr).toContain("NOT MEASURED")
    expect(stderr).toContain("Flexily: 5×10 leaf dirty")
  })

  it("exits 0 when every case recorded samples", () => {
    const reportPath = writeReport({
      files: [{ groups: [{ fullName: "bench/yoga-compare-rich.bench.ts > Group A", benchmarks: [measured] }] }],
    })

    const stdout = execFileSync(process.execPath, [join(here, "../bench/check-unmeasured.ts"), reportPath], {
      encoding: "utf8",
    })

    expect(stdout).toContain("every case recorded samples")
  })
})

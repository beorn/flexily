/**
 * @failure The package build accepts Node-only imports that cannot run in browsers.
 * @level l3
 * @consumer Browser consumers of Flexily's published entry points.
 * @testonly none
 */
import { spawnSync } from "node:child_process"
import { mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { dirname, join, resolve } from "node:path"
import { fileURLToPath } from "node:url"
import { describe, expect, test } from "vitest"

const here = dirname(fileURLToPath(import.meta.url))
const flexilyEntry = resolve(here, "../src/index.ts")
const packageRoot = resolve(here, "..")

describe("logger module shape", () => {
  test("the package build rejects a Node-only import", () => {
    const dir = mkdtempSync(join(tmpdir(), "flexily-import-guard-"))
    try {
      const entry = join(dir, "node-only.ts")
      writeFileSync(entry, 'export { readFileSync } from "node:fs"\n')
      const packed = spawnSync(process.execPath, ["run", "build", entry, "--out-dir", join(dir, "dist"), "--no-dts"], {
        cwd: packageRoot,
        encoding: "utf8",
      })
      expect(packed.error).toBeUndefined()
      expect(packed.status).not.toBe(0)
      expect(packed.stdout + packed.stderr).toContain("node:fs")
      expect(packed.stdout + packed.stderr).toContain("node-only.mjs")
      expect(packed.stdout + packed.stderr).toContain("tsdown:deps")
      expect(packed.stdout + packed.stderr).toContain("deps.onlyImport")
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  }, 30_000)

  test("Flexily source can be bundled behind a sync require", async () => {
    const dir = mkdtempSync(join(tmpdir(), "flexily-require-build-"))
    try {
      const entry = join(dir, "entry.ts")
      writeFileSync(
        entry,
        [
          `const flexily = require(${JSON.stringify(flexilyEntry)})`,
          "if (!flexily.Node) throw new Error('missing Node export')",
          "",
        ].join("\n"),
      )

      const result = await Bun.build({
        entrypoints: [entry],
        outdir: join(dir, "dist"),
        target: "node",
      })

      expect(result.logs.map((log) => log.message)).toEqual([])
      expect(result.success).toBe(true)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})

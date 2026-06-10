#!/usr/bin/env bun
/**
 * Pre-publish tarball assertion. Catches three regression classes BEFORE
 * `pnpm publish` runs in release.yml:
 *
 *   (a) Removing `publishConfig.exports` — packed package.json's exports
 *       still points at TypeScript source (./src/*).
 *   (b) Switching back to `npm publish` — npm doesn't apply
 *       publishConfig.exports overrides, so the artifact ships local-dev
 *       source paths even when publishConfig is present.
 *   (c) Forgetting `bun run build` — tarball is missing dist/* files.
 *
 * Approach: run `pnpm pack` to produce the exact tarball pnpm would
 * publish (pnpm applies publishConfig overrides during pack). Untar to a
 * temp dir. Inspect file list + packed package.json.
 *
 * Local invocation: `bun scripts/verify-publishable.ts` from flexily root.
 * Exits non-zero on any check failure with a human-readable diagnostic.
 *
 * Owned by @km/flexily/14343-publish-guard (P2).
 */

import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, relative } from "node:path"
import { spawnSync } from "node:child_process"

const FLEXILY_ROOT = new URL("..", import.meta.url).pathname.replace(/\/$/, "")

function fail(msg: string): never {
  console.error(`verify-publishable: FAIL — ${msg}`)
  process.exit(1)
}

function info(msg: string): void {
  console.log(`verify-publishable: ${msg}`)
}

function walk(dir: string, base = dir): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const abs = join(dir, entry.name)
    if (entry.isDirectory()) out.push(...walk(abs, base))
    else if (entry.isFile()) out.push(relative(base, abs))
  }
  return out
}

function isSourceTs(path: string): boolean {
  if (!path.endsWith(".ts") && !path.endsWith(".tsx")) return false
  // .d.ts / .d.mts / .d.cts are type declarations, not source — allowed.
  if (/\.d\.[mc]?ts$/.test(path)) return false
  return true
}

function exportsLeaves(value: unknown, path: string[] = []): { path: string[]; leaf: string }[] {
  if (typeof value === "string") return [{ path, leaf: value }]
  if (Array.isArray(value)) {
    return value.flatMap((v, i) => exportsLeaves(v, [...path, String(i)]))
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([k, v]) => exportsLeaves(v, [...path, k]))
  }
  return []
}

function main(): void {
  info(`packing flexily from ${FLEXILY_ROOT}`)
  const packDir = mkdtempSync(join(tmpdir(), "flexily-verify-"))
  try {
    // pnpm 10+ refuses to operate on a project whose `packageManager`
    // field names a different PM (the OTHER_PM_EXPECTED check in pnpm's
    // checkPackageManager). flexily declares `packageManager: "bun@..."`
    // for local dev but pnpm is the right tool for pack (it applies
    // publishConfig overrides; bun pack doesn't). `--pm-on-fail=ignore`
    // bypasses that refusal cleanly — but the flag only EXISTS on pnpm 10+;
    // pnpm 9 (release.yml's pinned action-setup) dies with "Unknown option"
    // and has no OTHER_PM_EXPECTED check to bypass anyway. Pass it only
    // where it exists. COREPACK_ENABLE_STRICT=0 stays as belt-and-braces.
    const runPack = (flags: string[]) =>
      spawnSync("pnpm", [...flags, "pack", "--pack-destination", packDir], {
        cwd: FLEXILY_ROOT,
        encoding: "utf8",
        env: { ...process.env, COREPACK_ENABLE_STRICT: "0" },
      })
    let pack = runPack(["--pm-on-fail=ignore"])
    if (pack.status !== 0 && /Unknown option/.test(pack.stderr ?? "")) {
      // pnpm 9 (release.yml's pinned action-setup) predates the flag AND the
      // OTHER_PM_EXPECTED refusal the flag bypasses — plain pack works there.
      info("pnpm predates --pm-on-fail; retrying plain pack")
      pack = runPack([])
    }
    if (pack.status !== 0) {
      fail(`pnpm pack exited ${pack.status}\n${pack.stderr}`)
    }
    const tgz = readdirSync(packDir).find((f) => f.endsWith(".tgz"))
    if (!tgz) fail(`no .tgz produced in ${packDir}`)
    const tgzPath = join(packDir, tgz)
    info(`tarball: ${tgz} (${statSync(tgzPath).size} bytes)`)

    const extractDir = join(packDir, "extracted")
    spawnSync("mkdir", ["-p", extractDir])
    const untar = spawnSync("tar", ["-xzf", tgzPath, "-C", extractDir], { encoding: "utf8" })
    if (untar.status !== 0) fail(`tar -xzf exited ${untar.status}\n${untar.stderr}`)

    const root = join(extractDir, "package")
    const files = walk(root)
    info(`tarball contains ${files.length} files`)

    // CHECK (a) + (c): no .ts source files, dist/ must exist
    const tsLeaks = files.filter(isSourceTs)
    if (tsLeaks.length > 0) {
      fail(
        `tarball contains TypeScript source files (publishConfig.exports likely removed, or npm publish used instead of pnpm publish):\n  ${tsLeaks.join("\n  ")}`,
      )
    }
    info("OK — no TypeScript source files in tarball")

    const distFiles = files.filter((f) => f.startsWith("dist/"))
    if (distFiles.length === 0) {
      fail("tarball contains no dist/ files (forgot bun run build?)")
    }
    info(`OK — ${distFiles.length} dist/* files present`)

    // CHECK (b): packed package.json exports leaves all point at ./dist/
    const pkgJsonPath = join(root, "package.json")
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as Record<string, unknown>
    const exp = pkg.exports
    if (!exp || typeof exp !== "object") {
      fail(`packed package.json has no "exports" field`)
    }
    const leaves = exportsLeaves(exp)
    if (leaves.length === 0) {
      fail(`packed package.json "exports" field has no string leaves`)
    }
    const badLeaves = leaves.filter((l) => !l.leaf.startsWith("./dist/"))
    if (badLeaves.length > 0) {
      const formatted = badLeaves
        .map((l) => `  exports${l.path.map((p) => `["${p}"]`).join("")} = "${l.leaf}"`)
        .join("\n")
      fail(
        `packed package.json "exports" has leaves NOT under ./dist/ (publishConfig.exports override didn't apply — switch from npm publish to pnpm publish):\n${formatted}`,
      )
    }
    info(`OK — all ${leaves.length} exports leaves point at ./dist/`)

    info("PASS — tarball is publishable")
  } finally {
    rmSync(packDir, { recursive: true, force: true })
  }
}

main()

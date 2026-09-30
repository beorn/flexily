#!/usr/bin/env bun
/**
 * Mutation testing for Flexily cache code paths.
 *
 * Deliberately injects known-wrong values into cache/invalidation logic
 * and verifies the fuzz suite catches each mutation. If a mutation passes
 * all tests, that's a coverage gap in the test suite.
 *
 * Run: cd vendor/flexily && bun scripts/mutation-test.ts
 */

import { existsSync, readFileSync, writeFileSync } from "fs"
import { resolve, relative } from "path"

interface Mutation {
  name: string
  file: string
  find: string // Exact string to find (must be unique in file)
  replace: string
  also?: { find: string; replace: string }[] // Further edits in the same file, applied together
  description: string
  equivalent?: boolean // True = mutation disables redundant defense layer, expected to pass
  testFiles?: string[] // Test files to run (defaults to relayout-consistency only)
}

const mutations: Mutation[] = [
  {
    name: "skip-resetLayoutCache",
    file: "src/layout-zero.ts",
    find: `    root.resetLayoutCache(true)`,
    replace: `    // root.resetLayoutCache(true) // MUTATION: skip the pass-start intrinsic refresh`,
    description:
      "Skip the pass-start refresh of intrinsic lengths — a stale min-content should cause wrong results",
    equivalent: true, // markDirty() and a query-size change clear min-content on every node whose inputs changed
  },
  {
    name: "skip-fingerprint-check",
    file: "src/layout-zero.ts",
    find: `  if (
    mode === LAYOUT &&
    flex.layoutValid &&`,
    replace: `  if (
    false && // MUTATION: always recompute (never skip)
    mode === LAYOUT &&
    flex.layoutValid &&`,
    description:
      "Disable fingerprint-based skip — forces full recompute every time (should still produce correct results if caching is correct)",
    equivalent: true, // Disables optimization, doesn't affect correctness
  },
  {
    name: "dirty-entry-any-gen",
    file: "src/node-zero.ts",
    find: `      (!this._isDirty || entry.gen === layoutGeneration())`,
    replace: `      true // MUTATION: a dirty node answers from an entry of any pass`,
    description:
      "Let a dirty node answer from an entry an earlier pass wrote — stale sizes after content changes (#26840 F2)",
    equivalent: true, // markDirty() also invalidates the entries; stale-entry-survives-dirty removes both layers
  },
  {
    name: "skip-markDirty-propagation",
    file: "src/node-zero.ts",
    find: `  markDirty(): void {
    let current: Node | null = this
    while (current !== null) {
      // Always clear caches - even if already dirty, a child's content change
      // may invalidate cached layout results that used the old child size
      current._m0 = current._m1 = current._m2 = current._m3 = undefined
      current.invalidateLayoutEntries()
      // Min-content cache is also content-derived; same invalidation rules
      current._minContentRow = -1
      current._minContentCol = -1
      // Skip setting dirty flag if already dirty (but still cleared caches above)
      if (current._isDirty) break
      current._isDirty = true
      // Invalidate layout fingerprint
      current._flex.layoutValid = false
      current = current._parent
    }
  }`,
    replace: `  markDirty(): void {
    let current: Node | null = this
    // MUTATION: only mark self dirty, don't propagate to ancestors
    if (current !== null) {
      current._m0 = current._m1 = current._m2 = current._m3 = undefined
      current.invalidateLayoutEntries()
      current._isDirty = true
      current._flex.layoutValid = false
    }
  }`,
    description:
      "Only mark the node itself dirty, skip ancestor propagation — parents won't know children changed",
  },
  {
    name: "markDirty-keeps-lc",
    file: "src/node-zero.ts",
    find: `      current._m0 = current._m1 = current._m2 = current._m3 = undefined
      current.invalidateLayoutEntries()
      // Min-content cache is also content-derived; same invalidation rules`,
    replace: `      current._m0 = current._m1 = current._m2 = current._m3 = undefined
      // MUTATION: layout cache entries survive markDirty
      // Min-content cache is also content-derived; same invalidation rules`,
    description:
      "Keep layout cache entries across markDirty — entries now live across passes, so a changed subtree answers with its old size (#26840)",
    equivalent: true, // the pass-stamp check also refuses them; stale-entry-survives-dirty removes both layers
  },
  {
    name: "skip-save-restore-measureNode-phase5",
    file: "src/layout-measure.ts",
    find: `      // Save/restore layout around measureNode — it overwrites node.layout
      const savedW = child.layout.width
      const savedH = child.layout.height
      const childApprox = measureNode(child, childAvailW, childAvailH, direction)
      measuredW = child.layout.width
      measuredH = child.layout.height
      child.layout.width = savedW
      child.layout.height = savedH`,
    replace: `      // MUTATION: skip save/restore — let measureNode corrupt layout dimensions
      const childApprox = measureNode(child, childAvailW, childAvailH, direction)
      measuredW = child.layout.width
      measuredH = child.layout.height`,
    description:
      "Skip save/restore around measureNode in initial measurement — layout.width/height get corrupted by intrinsic measurements",
  },
  {
    name: "wrong-cache-sentinel",
    file: "src/node-zero.ts",
    find: `    for (let i = 0; i < LAYOUT_CACHE_SLOTS; i++) lc[i]!.availW = -1`,
    replace: `    for (let i = 0; i < LAYOUT_CACHE_SLOTS; i++) lc[i]!.availW = NaN // MUTATION: NaN sentinel`,
    description:
      "Use NaN as cache sentinel instead of -1 — Object.is(NaN, NaN) is true, so unconstrained queries will falsely match invalidated entries",
  },
  {
    name: "skip-flexDist-guard",
    file: "src/layout-zero.ts",
    find: `        isRow && mainIsAutoChild && !flexGrowHasDefiniteMainBudget && !flexDistChanged && !hasMeasureLeaf
          ? NaN`,
    replace: `        isRow && mainIsAutoChild && !flexGrowHasDefiniteMainBudget /* MUTATION: removed flexDistChanged guard */ && !hasMeasureLeaf
          ? NaN`,
    description:
      "Remove flexDistChanged guard — NaN===NaN matches across passes with different flex distributions, preserving stale dimensions",
  },
  {
    name: "skip-layoutValid-set",
    file: "src/layout-zero.ts",
    find: `  flex.lastDir = direction
  flex.layoutValid = true
  _t?.layoutExit(_tn, layout.width, layout.height)
}`,
    replace: `  flex.lastDir = direction
  // MUTATION: don't mark layout as valid — forces recompute every time
  // flex.layoutValid = true
  _t?.layoutExit(_tn, layout.width, layout.height)
}`,
    description:
      "Never mark layout as valid — fingerprint check always fails, forcing full recompute (should still be correct if algorithm is sound)",
    equivalent: true, // Disables optimization, doesn't affect correctness
  },
  {
    name: "measure-writes-fingerprint",
    file: "src/layout-zero.ts",
    find: `    _t?.layoutExit(_tn, layout.width, layout.height)
    return
  }

  // Update constraint fingerprint - layout is now valid for these constraints`,
    replace: `    // MUTATION: MEASURE falls through and writes the fingerprint
  }

  // Update constraint fingerprint - layout is now valid for these constraints`,
    description:
      "A MEASURE call leaves a valid fingerprint at the sizing geometry — the positioning pass skips a node it must re-lay out (#26840 W1)",
  },
  {
    name: "measure-skips-child-restore",
    file: "src/layout-zero.ts",
    find: `      box.top = measureSaveStack[i++]!`,
    replace: `      i++ // MUTATION: a child's top is not restored after MEASURE`,
    description:
      "A MEASURE call leaves one child's top where the sizing geometry put it — a clean child keeps a moved box (#26840 W6/W7, Bug 1)",
  },
  {
    name: "measure-reads-approx",
    file: "src/layout-zero.ts",
    find: `      allocatedHeight,
      true,
    )
    if (cached) {`,
    replace: `      allocatedHeight,
      false, // MUTATION: MEASURE accepts measureNode's estimates
    )
    if (cached) {`,
    description:
      "A MEASURE call answers from measureNode's flex-basis estimate instead of a layoutNode result (#26840 exact entries)",
  },
  {
    name: "estimate-reads-exact",
    file: "src/node-zero.ts",
    find: `      entry.exact === exact &&`,
    replace: `      (entry.exact === exact || entry.exact) && // MUTATION: an exact entry answers an estimate`,
    description:
      "measureNode and the Phase 5/6c probes accept an exact MEASURE entry, where a fresh pass computes the estimate (#26840, seed 6000)",
  },
  {
    name: "stale-entry-survives-dirty",
    file: "src/node-zero.ts",
    find: `      current._m0 = current._m1 = current._m2 = current._m3 = undefined
      current.invalidateLayoutEntries()`,
    replace: `      current._m0 = current._m1 = current._m2 = current._m3 = undefined // MUTATION: entries survive markDirty`,
    also: [
      {
        find: `      (!this._isDirty || entry.gen === layoutGeneration())`,
        replace: `      true // MUTATION: and a dirty node answers from any pass`,
      },
    ],
    description:
      "Both defences against a changed subtree answering with its old size removed together (#26840 F1+F2)",
  },
  {
    name: "kinds-share-entries",
    file: "src/node-zero.ts",
    find: `      entry.exact === exact &&`,
    replace: `      (entry.exact === exact || entry.exact) && // MUTATION: an exact entry answers an estimate`,
    also: [
      {
        find: `      if (held.exact === exact && sameCacheKey(`,
        replace: `      if (sameCacheKey( // MUTATION: an exact write replaces the estimate`,
      },
    ],
    description:
      "Estimates and exact entries share one namespace again, as before the search found seeds 6000 and 4568 (#26840)",
  },
  {
    name: "restretch-reads-fingerprint-origin",
    file: "src/layout-zero.ts",
    find: `        const cAbsX = isContainer ? child.flex.passedAbsX : absX + innerLeft + savedLeft - cMarginL
        const cAbsY = isContainer ? child.flex.passedAbsY : absY + innerTop + savedTop - cMarginT`,
    replace: `        const cAbsX = isContainer ? child.flex.lastAbsX : absX + innerLeft + savedLeft - cMarginL // MUTATION
        const cAbsY = isContainer ? child.flex.lastAbsY : absY + innerTop + savedTop - cMarginT`,
    description:
      "Phase 9b re-stretches at the fingerprint's origin, which a MEASURE call never writes (#26840, seed 5987)",
  },
  {
    name: "measure-restore-skips-refresh",
    file: "src/node-zero.ts",
    find: `    this._frozenQuerySize = stored
    this.refreshQueryDependents()`,
    replace: `    this._frozenQuerySize = stored // MUTATION: keep entries derived from the MEASURE query size`,
    description:
      "A MEASURE call's descent cached sizes under its own query size and they survive the restore (#26840 C1)",
  },
  {
    name: "measure-freezes-query-size",
    file: "src/layout-zero.ts",
    find: `  if (mode === MEASURE) {
    // A leaf has no descent to show it to, and returns before the exit below.`,
    replace: `  if (false) { // MUTATION: MEASURE persists the container-query freeze like LAYOUT
    // A leaf has no descent to show it to, and returns before the exit below.`,
    description:
      "A MEASURE call persists the query size it computed — a non-stretched query container keeps its sizing width (#26840 W9)",
  },
  {
    name: "measure-writes-leaf-constraints",
    file: "src/layout-zero.ts",
    find: `  if (mode === LAYOUT && node.children.length === 0) {`,
    replace: `  if (node.children.length === 0) { // MUTATION: MEASURE writes the leaf's lastAvail*`,
    description:
      "A MEASURE call leaves a leaf's constraints at the sizing width — percent padding reads the wrong base after a skipped relayout (#26840 W2)",
  },
  {
    name: "measure-hit-skips-unknown-width-replay",
    file: "src/layout-zero.ts",
    find: `      if (cached.unknownWidths !== 0) swapUnknownBaseWidthCount(unknownBaseWidthCount() + cached.unknownWidths)`,
    replace: `      // MUTATION: a MEASURE hit does not replay the #26660 count`,
    description:
      "A MEASURE cache hit skips the unknown-width count its descent added, so #26660's repeat branch differs between a hit and a miss",
  },
  {
    name: "measure-caches-fractional-origin",
    file: "src/layout-zero.ts",
    find: `  const measureCacheable = mode === MEASURE && Number.isInteger(absX) && Number.isInteger(absY)`,
    replace: `  const measureCacheable = mode === MEASURE // MUTATION: cache at a fractional origin too`,
    description:
      "A MEASURE answer computed at one fractional origin is reused at another, where edge rounding gives a different size",
  },
  {
    name: "skip-display-none",
    file: "src/layout-zero.ts",
    find: `  // Handle display: none
  if (style.display === C.DISPLAY_NONE) {
    layout.left = 0
    layout.top = 0
    layout.width = 0
    layout.height = 0
    return
  }`,
    replace: `  // MUTATION: skip display:none handling — nodes should still render
  // if (style.display === C.DISPLAY_NONE) { ... }`,
    description:
      "Skip display:none handling — hidden nodes would participate in layout and consume space",
    testFiles: ["tests/layout.test.ts"],
  },
  {
    name: "skip-overflow-flexShrink-override",
    file: "src/layout-zero.ts",
    find: `    if (!explicitShrink && childStyle.overflow !== C.OVERFLOW_VISIBLE) shrink = Math.max(shrink, 1)`,
    replace: `    // MUTATION: removed overflow flexShrink override`,
    description:
      "Remove CSS 4.5 overflow:hidden flexShrink override — overflow containers won't shrink to fit parent",
    testFiles: ["tests/layout.test.ts"],
  },
  {
    name: "wrong-edge-rounding-leaf",
    file: "src/layout-zero.ts",
    find: `    layout.width = Math.round(nodeWidth)
    layout.height = Math.round(nodeHeight)
    layout.left = Math.round(offsetX + marginLeft)
    layout.top = Math.round(offsetY + marginTop)
    return
  }

  // MEASURE saves every child's box here`,
    replace: `    layout.width = Math.floor(nodeWidth)
    layout.height = Math.floor(nodeHeight)
    layout.left = Math.floor(offsetX + marginLeft)
    layout.top = Math.floor(offsetY + marginTop)
    return // MUTATION: use floor instead of round — creates pixel drift
  }

  // MEASURE saves every child's box here`,
    description:
      "Use Math.floor instead of Math.round for leaf node rounding — dimensions will be wrong for fractional values",
    testFiles: ["tests/layout.test.ts", "tests/relayout-consistency.test.ts"],
  },
]

async function main() {
  // Flexily package root (parent of scripts/)
  const dir = resolve(import.meta.dir, "..")

  // Detect monorepo: if we're vendored inside km, use the km root as cwd
  // so vitest picks up the workspace config with --project vendor.
  // Otherwise, run from the flexily root with its own vitest.config.ts.
  const kmRoot = resolve(dir, "../..")
  const inMonorepo = existsSync(resolve(kmRoot, "vitest.config.ts")) && existsSync(resolve(kmRoot, "vendor/flexily"))

  let caught = 0
  let equivalentConfirmed = 0
  let unexpectedPass = 0
  let unexpectedFail = 0
  const gaps: string[] = []
  const skipped: string[] = []
  const errors: string[] = []

  console.log(`Mutation testing for Flexily code paths`)
  console.log(`Running ${mutations.length} mutations against test suite\n`)

  for (const mutation of mutations) {
    const filepath = resolve(dir, mutation.file)
    const original = readFileSync(filepath, "utf8")

    // Every edit's pattern must occur exactly once in the file
    const edits = [{ find: mutation.find, replace: mutation.replace }, ...(mutation.also ?? [])]
    const badEdit = edits.find((edit) => original.split(edit.find).length !== 2)
    if (badEdit) {
      const found = original.split(badEdit.find).length - 1
      console.error(`SKIP "${mutation.name}" -- a pattern occurs ${found} times in ${mutation.file}, not once`)
      skipped.push(mutation.name)
      continue
    }

    try {
      const mutated = edits.reduce((text, edit) => text.replace(edit.find, edit.replace), original)
      writeFileSync(filepath, mutated)

      process.stdout.write(`  "${mutation.name}" ... `)

      // Test file paths are relative to flexily root; resolve for the chosen cwd
      const relTestFiles = mutation.testFiles ?? ["tests/relayout-consistency.test.ts"]
      const cwd = inMonorepo ? kmRoot : dir
      const resolvedTestFiles = relTestFiles.map((f) => (inMonorepo ? relative(kmRoot, resolve(dir, f)) : f))
      const vitestArgs = inMonorepo
        ? ["bun", "vitest", "run", "--project", "vendor", ...resolvedTestFiles, "--reporter=dot"]
        : ["bun", "vitest", "run", ...resolvedTestFiles, "--reporter=dot"]
      const proc = Bun.spawn(vitestArgs, {
        cwd,
        stdout: "pipe",
        stderr: "pipe",
      })
      const [exitCode, stdout, stderr] = await Promise.all([
        proc.exited,
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
      ])
      // A non-zero exit is a caught mutation only when tests ran and failed.
      // A refused or crashed run (a drifted gitlink, a syntax error in the
      // mutant) tested nothing and must never read as "caught".
      const output = stdout + stderr
      const testsFailed = /Tests\s+\d+ failed/.test(output)
      if (exitCode !== 0 && !testsFailed) {
        console.log(`ERROR (exit ${exitCode}, no test failed: nothing was tested)`)
        console.error(output.split("\n").slice(-8).join("\n"))
        errors.push(mutation.name)
        continue
      }

      if (exitCode === 0) {
        if (mutation.equivalent) {
          console.log(`equivalent (expected)`)
          equivalentConfirmed++
        } else {
          console.log(`COVERAGE GAP`)
          console.error(`    ${mutation.description}`)
          gaps.push(mutation.name)
          unexpectedPass++
        }
      } else {
        if (mutation.equivalent) {
          console.log(`UNEXPECTED FAIL (marked equivalent but tests caught it)`)
          unexpectedFail++
        } else {
          console.log(`caught`)
          caught++
        }
      }
    } finally {
      // ALWAYS restore
      writeFileSync(filepath, original)
    }
  }

  const total = caught + equivalentConfirmed + unexpectedPass + unexpectedFail
  console.log(`\n${"=".repeat(60)}`)
  console.log(`Mutation testing: ${caught} caught, ${equivalentConfirmed} equivalent, ${total} total`)
  if (skipped.length > 0) {
    console.log(`Skipped: ${skipped.join(", ")}`)
  }
  if (errors.length > 0) {
    console.log(`Errors (ran no tests): ${errors.join(", ")}`)
  }
  if (gaps.length > 0) {
    console.log(`Coverage gaps: ${gaps.join(", ")}`)
  }
  if (unexpectedFail > 0) {
    console.log(`Unexpected failures: ${unexpectedFail} mutations marked equivalent were caught by tests`)
  }
  // A skipped mutation is a stale pattern, not a pass: it tests nothing.
  process.exit(gaps.length > 0 || skipped.length > 0 || errors.length > 0 || unexpectedFail > 0 ? 1 : 0)
}

main()

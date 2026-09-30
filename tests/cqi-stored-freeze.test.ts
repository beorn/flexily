/**
 * cqi under a stored query freeze (#26857, pinned from #26840).
 *
 * These rows are EXPECTED TO FAIL until #26857 lands; they flip then. They live
 * apart from relayout-consistency.test.ts so that the mutation tests of
 * scripts/mutation-test.ts, which run that file, never read a pinned row
 * flipping as a caught mutation.
 */
import { describe, it } from "vitest"
import {
  applySpecEdit,
  buildSpecTree,
  expectStepsMatchFresh,
  specPaddings,
  type SpecEdit,
  type SpecNode,
  type SpecState,
} from "./relayout-steps.js"

const seed5987: Record<number, SpecNode> = {
  0: { children: [1, 4] },
  1: { row: true, children: [2, 3] },
  2: { row: true, children: [5, 6] },
  3: { row: true, shrink: 1, text: 293 },
  4: { shrink: 1, text: 249 },
  5: { row: true },
  6: { query: true, widthPct: 86, children: [7] },
  7: { widthCqi: 39 },
}

describe("cqi under a stored query freeze (#26857)", () => {
  // cqi resolves against the nearest container's STORED freeze, so an
  // incremental pass reads the previous pass's freeze where a fresh pass reads
  // none: incremental can differ from fresh. Main has the class too (about 87
  // of 6,000 cqi trees). These three are where the build differs and main did
  // not; erasing the stored freezes, and nothing else, makes each match fresh.
  // Pinned on the P2 that owns the class; they flip when it lands.
  it.fails.each<[string, number, Record<number, SpecNode>, SpecEdit[]]>([
    [
      "seed 5007",
      120,
      {
        0: { children: [1] },
        1: { row: true, shrink: 1, children: [2, 3] },
        2: { children: [4] },
        3: { query: true, shrink: 1, children: [5] },
        4: { text: 201 },
        5: { widthCqi: 29 },
      },
      [{ node: 0, rootWidth: 80 }],
    ],
    [
      "seed 5250",
      61,
      {
        0: { row: true, children: [1] },
        1: { children: [3, 4] },
        3: { children: [5] },
        4: { row: true, shrink: 1 },
        5: { row: true, width: 24.5, children: [8] },
        8: { query: true, shrink: 1, children: [9] },
        9: { widthCqi: 62, text: 179 },
      },
      [{ node: 0, rootWidth: 120 }],
    ],
    ["seed 5987", 120, seed5987, [{ node: 5, grow: 1 }]],
  ])("cqi under a stored query freeze, pinned (%s)", (_name, width, nodes, edits) => {
    const state: SpecState = { width, height: 40, nodes: structuredClone(nodes) }
    expectStepsMatchFresh(
      state,
      buildSpecTree,
      edits.map((edit) => ({ name: JSON.stringify(edit), apply: applySpecEdit(edit) })),
      specPaddings,
    )
  })
})

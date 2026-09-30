/**
 * Relayout-versus-fresh steps (#26840): lay a tree out, apply edits one at a
 * time, and compare every box of the incremental layout (and any extra facts,
 * such as computed paddings) against a tree built fresh from the same state.
 *
 * `buildSpecTree` builds the small trees the randomized differential search
 * produces (rows/columns, grow/shrink, align-self, %, cqi and fractional
 * widths, % padding, margins, wrapping text), so a reduced case reads as data.
 */
import { expect } from "vitest"
import * as C from "../src/constants.js"
import { DIRECTION_LTR, EDGE_LEFT, EDGE_TOP, FLEX_DIRECTION_COLUMN, FLEX_DIRECTION_ROW, Node } from "../src/index.js"
import { diffLayouts, getLayout } from "../src/testing.js"

export interface Step<State, Tree> {
  name: string
  apply: (state: State, live: Tree) => void
}

// Lay the live tree out twice, then for each step: edit, lay out incrementally,
// and compare every box (and any extra `facts`) against a fresh build.
export function expectStepsMatchFresh<State extends { width: number; height: number }, Tree extends { root: Node }>(
  state: State,
  build: (state: State) => Tree,
  steps: Step<State, Tree>[],
  facts: (tree: Tree) => unknown = () => null,
): void {
  const live = build(state)
  live.root.calculateLayout(state.width, state.height, DIRECTION_LTR)
  live.root.calculateLayout(state.width, state.height, DIRECTION_LTR)
  for (const step of steps) {
    step.apply(state, live)
    live.root.calculateLayout(state.width, state.height, DIRECTION_LTR)
    const fresh = build(state)
    fresh.root.calculateLayout(state.width, state.height, DIRECTION_LTR)
    const diffs = diffLayouts(getLayout(fresh.root), getLayout(live.root))
    const freshFacts = facts(fresh)
    fresh.root.freeRecursive()
    if (diffs.length > 0) {
      expect.unreachable(`step "${step.name}" differs from fresh (${diffs.length} diffs):\n  ${diffs.join("\n  ")}`)
    }
    expect(facts(live), `step "${step.name}"`).toEqual(freshFacts)
  }
  live.root.freeRecursive()
}

export interface SpecNode {
  row?: true
  query?: true
  alignStart?: true
  widthPct?: number
  widthCqi?: number
  width?: number
  paddingPct?: number
  grow?: number
  shrink?: number
  text?: number
  margin?: number
  children?: number[]
}
export interface SpecEdit {
  node: number
  grow?: number
  text?: number
  alignStart?: boolean
  rootWidth?: number
}
export interface SpecState {
  width: number
  height: number
  nodes: Record<number, SpecNode>
}
export const buildSpecTree = (state: SpecState) => {
  const nodes: Record<number, Node> = {}
  for (const [key, spec] of Object.entries(state.nodes)) {
    const node = Node.create()
    node.setFlexDirection(spec.row ? FLEX_DIRECTION_ROW : FLEX_DIRECTION_COLUMN)
    if (spec.query) {
      node.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
      // The query-container contract: sized by content only under containSize.
      node.setContainSize(spec.widthPct === undefined && spec.widthCqi === undefined && spec.width === undefined)
    }
    if (spec.alignStart) node.setAlignSelf(C.ALIGN_FLEX_START)
    if (spec.widthPct !== undefined) node.setWidthPercent(spec.widthPct)
    else if (spec.widthCqi !== undefined) node.setWidthCqi(spec.widthCqi)
    else if (spec.width !== undefined) node.setWidth(spec.width)
    if (spec.paddingPct !== undefined) node.setPaddingPercent(EDGE_LEFT, spec.paddingPct)
    if (spec.margin !== undefined) node.setMargin(EDGE_TOP, spec.margin)
    node.setFlexGrow(spec.grow ?? 0)
    node.setFlexShrink(spec.shrink ?? 0)
    if (spec.text !== undefined) {
      const cells = () => state.nodes[Number(key)]!.text!
      node.setMeasureFunc((w, mode) => {
        const length = cells()
        if (mode === C.MEASURE_MODE_UNDEFINED || !Number.isFinite(w) || w >= length) return { width: length, height: 1 }
        return { width: w, height: Math.ceil(length / Math.max(1, Math.floor(w))) }
      })
    }
    nodes[Number(key)] = node
  }
  for (const [key, spec] of Object.entries(state.nodes)) {
    ;(spec.children ?? []).forEach((child, index) => nodes[Number(key)]!.insertChild(nodes[child]!, index))
  }
  const root = nodes[0]!
  root.setWidth(state.width)
  root.setHeight(state.height)
  return { root, nodes }
}
export const applySpecEdit =
  (edit: SpecEdit) =>
  (state: SpecState, live: ReturnType<typeof buildSpecTree>): void => {
    const spec = state.nodes[edit.node]!
    const node = live.nodes[edit.node]!
    if (edit.grow !== undefined) {
      spec.grow = edit.grow
      node.setFlexGrow(edit.grow)
    }
    if (edit.text !== undefined) {
      spec.text = edit.text
      node.markDirty()
    }
    if (edit.alignStart !== undefined) {
      spec.alignStart = edit.alignStart || undefined
      node.setAlignSelf(edit.alignStart ? C.ALIGN_FLEX_START : C.ALIGN_AUTO)
    }
    if (edit.rootWidth !== undefined) {
      state.width = edit.rootWidth
      live.root.setWidth(edit.rootWidth)
    }
  }
export const specPaddings = (tree: ReturnType<typeof buildSpecTree>) =>
  Object.values(tree.nodes).map((node) => node.getComputedPadding(EDGE_LEFT))

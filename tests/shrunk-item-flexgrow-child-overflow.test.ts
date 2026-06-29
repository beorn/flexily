/**
 * Regression: a flex item shrunk BELOW its flex-basis laid out its own children
 * against the PRE-shrink (float) basis width, so a flexGrow / stretch child
 * rounded up and overflowed the parent's edge-rounded final size by one cell.
 *
 * Production symptom (silvercode hab deck, bead
 * @hab/19797-hab-master/20437-deck-chrome/20563-narrow-titlebar-buttons):
 * in a nested binary split, two 50%-basis panes + a 1-cell divider demand
 * `container + 1`. The shrink resolves each pane to a half-cell (e.g. 22.5);
 * the parent edge-rounds the wrapper to 22, but the inner pane Box
 * (`flexGrow:1`) was laid out against 22.5 and `Math.round`-ed its cross size
 * to 23 — overflowing the wrapper, and (at the screen's last pane) running one
 * column off the right edge so the close (×) / zoom (⤢) title-bar buttons
 * clipped.
 *
 * Root cause (`layout-zero.ts`): the Phase 8 child recursion passed the float
 * `childWidth`/`childHeight` (= `child.flex.mainSize`) as the child's available
 * MAIN size, while the parent assigns the edge-rounded `edgeBasedMainSize`.
 * Grandchildren must resolve against the size the child actually gets. Fix:
 * pass `edgeBasedMainSize` for container children (measure leaves keep their
 * measured constraint).
 *
 * The invariant under test is structural and preset-independent: NO child may
 * extend past its parent's content box. Verified both on the minimal shape and
 * on the production nested-split shape across a sweep of widths (the bug only
 * bites when a split's free space is odd → half-cell shrink).
 */

import { describe, expect, test } from "vitest"
import { DIRECTION_LTR, FLEX_DIRECTION_COLUMN, FLEX_DIRECTION_ROW, Node } from "../src/index.js"

/** A pane: column Box with a single flexGrow child (mirrors silvercode's leaf
 *  `<Box flexGrow={1} minWidth={0} overflow="hidden">`). */
function makePane(): { wrapper: Node; inner: Node } {
  const wrapper = Node.create({ defaults: "css" })
  wrapper.setFlexDirection(FLEX_DIRECTION_COLUMN)
  wrapper.setMinWidth(0)
  const inner = Node.create({ defaults: "css" })
  inner.setFlexGrow(1)
  inner.setMinWidth(0)
  wrapper.insertChild(inner, 0)
  return { wrapper, inner }
}

/** Assert no node in the subtree extends past its parent's content box. */
function assertNoChildOverflows(node: Node): void {
  const pw = node.getComputedWidth()
  const ph = node.getComputedHeight()
  for (let i = 0; i < node.getChildCount(); i++) {
    const c = node.getChild(i)
    // getChild returns Node | undefined; within getChildCount() it is always
    // present — narrow it (and fail loud if the invariant ever breaks).
    if (!c) throw new Error(`getChild(${i}) returned undefined within getChildCount() ${node.getChildCount()}`)
    const right = c.getComputedLeft() + c.getComputedWidth()
    const bottom = c.getComputedTop() + c.getComputedHeight()
    expect(
      right,
      `child[${i}] right edge ${right} overflows parent width ${pw} (left=${c.getComputedLeft()} w=${c.getComputedWidth()})`,
    ).toBeLessThanOrEqual(pw)
    expect(bottom, `child[${i}] bottom edge ${bottom} overflows parent height ${ph}`).toBeLessThanOrEqual(ph)
    assertNoChildOverflows(c)
  }
}

describe("shrunk flex item must not let a flexGrow child overflow it", () => {
  // Minimal shape: [A 50%] [divider 1] [B 50% > C flexGrow]. A+div+B demand
  // container+1, so both panes shrink a half cell at odd container widths.
  for (const W of [44, 45, 46, 47, 93, 121]) {
    test(`minimal split, container=${W}: inner pane child stays within its wrapper`, () => {
      const root = Node.create({ defaults: "css" })
      root.setFlexDirection(FLEX_DIRECTION_ROW)
      root.setWidth(W)
      root.setHeight(3)

      const a = makePane()
      a.wrapper.setFlexBasisPercent(50)
      a.wrapper.setFlexGrow(0)

      const div = Node.create({ defaults: "css" })
      div.setWidth(1)
      div.setFlexShrink(0)
      div.setFlexGrow(0)

      const b = makePane()
      b.wrapper.setFlexBasisPercent(50)
      b.wrapper.setFlexGrow(0)

      root.insertChild(a.wrapper, 0)
      root.insertChild(div, 1)
      root.insertChild(b.wrapper, 2)
      root.calculateLayout(W, 3, DIRECTION_LTR)

      // The flexGrow inner box must never be wider than the wrapper it lives in.
      expect(a.inner.getComputedWidth()).toBeLessThanOrEqual(a.wrapper.getComputedWidth())
      expect(b.inner.getComputedWidth()).toBeLessThanOrEqual(b.wrapper.getComputedWidth())
      // …and nothing may run off the right edge of the container.
      assertNoChildOverflows(root)
    })
  }

  // Production shape: two nested 50/50 row splits with 1-cell dividers, three
  // flexGrow panes — the exact 3-pane hab deck structure that clipped the
  // narrowest pane's title-bar buttons at 120 cols. Two invariants the fix
  // establishes (both FAIL on the pre-fix baseline, e.g. at width 90 the inner
  // split came out 45 wide inside its 44-wide wrapper):
  //   (a) a nested flexGrow SPLIT container never exceeds the shrunk wrapper it
  //       lives in, and
  //   (b) every pane's flexGrow content box never exceeds its own wrapper.
  //
  // NOTE: a SEPARATE, deeper rounding interaction (flexily edge-rounds with
  // float absolute positions while the renderer accumulates rounded relative
  // positions) can still shift a whole pane one column at fractional-position
  // widths; that is out of scope for this fix and is not asserted here. The
  // production 120-col case lands on integer positions and is fully covered by
  // tests/regressions/2026-06-29-20563-narrow-titlebar-buttons.spec.tsx.
  for (const W of [60, 80, 90, 93, 120, 121, 160]) {
    test(`nested 3-pane deck split, content width=${W}: split + pane content stay within their wrappers`, () => {
      const splitW = (weight: number, first: Node, second: Node): { split: Node; w1: Node } => {
        const split = Node.create({ defaults: "css" })
        split.setFlexDirection(FLEX_DIRECTION_ROW)
        split.setFlexGrow(1)
        split.setMinWidth(0)
        const w0 = Node.create({ defaults: "css" })
        w0.setFlexDirection(FLEX_DIRECTION_COLUMN)
        w0.setFlexGrow(0)
        w0.setFlexBasisPercent(weight * 100)
        w0.setMinWidth(0)
        w0.insertChild(first, 0)
        const div = Node.create({ defaults: "css" })
        div.setWidth(1)
        div.setFlexShrink(0)
        div.setFlexGrow(0)
        const w1 = Node.create({ defaults: "css" })
        w1.setFlexDirection(FLEX_DIRECTION_COLUMN)
        w1.setFlexGrow(0)
        w1.setFlexBasisPercent((1 - weight) * 100)
        w1.setMinWidth(0)
        w1.insertChild(second, 0)
        split.insertChild(w0, 0)
        split.insertChild(div, 1)
        split.insertChild(w1, 2)
        return { split, w1 }
      }

      const p1 = makePane()
      const p2 = makePane()
      const p3 = makePane()
      const inner = splitW(0.5, p2.wrapper, p3.wrapper)
      const outer = splitW(0.5, p1.wrapper, inner.split)

      const root = Node.create({ defaults: "css" })
      root.setFlexDirection(FLEX_DIRECTION_ROW)
      root.setWidth(W)
      root.setHeight(10)
      root.insertChild(outer.split, 0)
      root.calculateLayout(W, 10, DIRECTION_LTR)

      // (a) The inner flexGrow split must fit the wrapper that holds it — the
      // pre-fix bug let it stretch one cell past (45 inside a 44 wrapper).
      expect(inner.split.getComputedWidth()).toBeLessThanOrEqual(outer.w1.getComputedWidth())
      // (b) Every pane's flexGrow content box must fit its own wrapper.
      for (const p of [p1, p2, p3]) {
        expect(p.inner.getComputedWidth()).toBeLessThanOrEqual(p.wrapper.getComputedWidth())
      }
    })
  }
})

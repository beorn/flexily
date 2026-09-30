/**
 * Nested growing columns over wrapping rows (#26840): the shape that made one
 * leaf edit re-lay out every clean row under yrd watch.
 *
 * Fx(D, K, R): a column root, D nested columns (flexGrow 1, flexShrink 1,
 * minWidth 0), and inside the innermost column K rows of
 * `[label, column(prose, (R-1) x column(prose))]`. Each prose is 300 cells of
 * wrappable text with flexGrow 1, so every row overflows the width and every
 * level is an approximate flex basis that the sizing pass re-derives.
 *
 * Every size a measure function returns is read from the spec when it is
 * called, so a test edits the spec, dirties the matching node of the live
 * tree, and builds a fresh tree from the same spec as its oracle.
 */
import * as C from "../src/constants.js"
import type { Node } from "../src/index.js"

export interface NodeFactory {
  create(config?: { defaults: "css" }): Node
}

export interface NestedColumnsSpec {
  depth: number
  rows: number
  proseBoxes: number
  // labelWidths[k]: the label's preferred width in row k
  labelWidths: number[]
  // proseLengths[k][j]: the text length of prose j in row k
  proseLengths: number[][]
  // A column that is a container-query container, and a label width in cqi
  // that resolves against it (both optional).
  queryColumn?: number
  labelCqi?: number
  // Rows mounted after the first build: each is the first child of
  // columns[depth], one prose of the given length.
  mounts: { depth: number; proseLength: number }[]
}

export interface NestedColumns {
  root: Node
  columns: Node[]
  rows: Node[]
  labels: Node[]
  proses: Node[][]
}

export function nestedColumnsSpec(depth: number, rows: number, proseBoxes: number): NestedColumnsSpec {
  return {
    depth,
    rows,
    proseBoxes,
    labelWidths: Array.from({ length: rows }, () => 30),
    proseLengths: Array.from({ length: rows }, () => Array.from({ length: proseBoxes }, () => 300)),
    mounts: [],
  }
}

function append(parent: Node, child: Node): void {
  parent.insertChild(child, parent.getChildCount())
}

function column(factory: NodeFactory, grow: number): Node {
  const node = factory.create({ defaults: "css" })
  node.setFlexDirection(C.FLEX_DIRECTION_COLUMN)
  node.setFlexGrow(grow)
  node.setFlexShrink(1)
  node.setMinWidth(0)
  return node
}

function proseNode(factory: NodeFactory, length: () => number): Node {
  const prose = factory.create({ defaults: "css" })
  prose.setMinWidth(0)
  prose.setFlexGrow(1)
  prose.setMeasureFunc((w, mode) => {
    const cells = length()
    if (mode === C.MEASURE_MODE_MIN_CONTENT) return { width: 12, height: 1 }
    if (!Number.isFinite(w) || w >= cells || mode === C.MEASURE_MODE_UNDEFINED) return { width: cells, height: 1 }
    return { width: w, height: Math.ceil(cells / Math.max(1, Math.floor(w))) }
  })
  return prose
}

/** Mount spec.mounts[index] into a tree built from spec (the live tree's edit). */
export function mountRow(factory: NodeFactory, spec: NestedColumnsSpec, fx: NestedColumns, index: number): Node {
  const mount = spec.mounts[index]!
  const row = factory.create({ defaults: "css" })
  row.setFlexDirection(C.FLEX_DIRECTION_ROW)
  row.insertChild(
    proseNode(factory, () => spec.mounts[index]!.proseLength),
    0,
  )
  fx.columns[mount.depth]!.insertChild(row, 0)
  return row
}

export function buildNestedColumns(
  factory: NodeFactory,
  spec: NestedColumnsSpec,
  width = 220,
  height = 50,
): NestedColumns {
  const root = factory.create({ defaults: "css" })
  root.setFlexDirection(C.FLEX_DIRECTION_COLUMN)
  root.setWidth(width)
  root.setHeight(height)
  const columns: Node[] = []
  let parent = root
  for (let d = 0; d < spec.depth; d++) {
    const next = column(factory, 1)
    if (spec.queryColumn === d) next.setContainerType(C.CONTAINER_TYPE_INLINE_SIZE)
    append(parent, next)
    columns.push(next)
    parent = next
  }
  const rows: Node[] = []
  const labels: Node[] = []
  const proses: Node[][] = []
  for (let k = 0; k < spec.rows; k++) {
    const row = factory.create({ defaults: "css" })
    row.setFlexDirection(C.FLEX_DIRECTION_ROW)
    const label = factory.create({ defaults: "css" })
    if (spec.labelCqi !== undefined) label.setWidthCqi(spec.labelCqi)
    label.setMeasureFunc((w, mode) => {
      const preferred = spec.labelWidths[k]!
      return { width: mode === C.MEASURE_MODE_UNDEFINED ? preferred : Math.min(preferred, w), height: 1 }
    })
    const inner = column(factory, 0)
    const rowProses: Node[] = []
    for (let j = 0; j < spec.proseBoxes; j++) {
      const prose = proseNode(factory, () => spec.proseLengths[k]![j]!)
      if (j === 0) {
        append(inner, prose)
      } else {
        const box = column(factory, 0)
        append(box, prose)
        append(inner, box)
      }
      rowProses.push(prose)
    }
    append(row, label)
    append(row, inner)
    append(parent, row)
    rows.push(row)
    labels.push(label)
    proses.push(rowProses)
  }
  const fx = { root, columns, rows, labels, proses }
  for (let index = 0; index < spec.mounts.length; index++) mountRow(factory, spec, fx, index)
  return fx
}

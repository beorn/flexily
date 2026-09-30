/**
 * Layout Tree Traversal Utilities
 *
 * Iterative tree traversal functions that avoid recursion
 * (prevents stack overflow on deep trees).
 * Uses shared traversalStack from utils.ts for zero-allocation.
 */

import type { Node } from "./node-zero.js"
import { traversalStack } from "./utils.js"

/**
 * Mark subtree as having new layout and clear dirty flags (iterative to avoid stack overflow).
 * This is called after layout completes to reset dirty tracking for all nodes.
 */
export function markSubtreeLayoutSeen(node: Node): void {
  traversalStack.length = 0
  traversalStack.push(node)
  while (traversalStack.length > 0) {
    const current = traversalStack.pop() as Node
    // Clear dirty flag - layout is now complete
    ;(current as Node)["_isDirty"] = false
    ;(current as Node)["_hasNewLayout"] = true
    for (const child of current.children) {
      traversalStack.push(child)
    }
  }
}

/**
 * Invalidate the constraint fingerprint of a node, every descendant, and every
 * ancestor (iterative to avoid stack overflow).
 *
 * One caller: layoutNode's Phase 3a, in LAYOUT mode, when a query container's
 * frozen inline size changes. Every fingerprint in the subtree was taken under
 * the old size, and cqi descendants must lay out again. A MEASURE call never
 * gets here: it swaps the frozen size and restores it, and writes no
 * fingerprint for this to clear (#26840).
 *
 * The ANCESTORS matter as much as the subtree: a node's position is written by
 * its parent's Phase 8, so a clean-and-valid ancestor that skips its own layout
 * strands every changed position below it. The ancestors above the layoutNode
 * call that triggered this are mid-pass and will rewrite their own fingerprints
 * on the way out, so clearing them costs nothing.
 */
export function invalidateFingerprintsAround(node: Node): void {
  traversalStack.length = 0
  traversalStack.push(node)
  while (traversalStack.length > 0) {
    const current = traversalStack.pop() as Node
    current.flex.layoutValid = false
    for (const child of current.children) {
      traversalStack.push(child)
    }
  }
  for (let ancestor = node.getParent(); ancestor !== null; ancestor = ancestor.getParent()) {
    ancestor.flex.layoutValid = false
  }
}

/**
 * Count total nodes in tree (iterative to avoid stack overflow).
 */
export function countNodes(node: Node): number {
  let count = 0
  traversalStack.length = 0
  traversalStack.push(node)
  while (traversalStack.length > 0) {
    const current = traversalStack.pop() as Node
    count++
    for (const child of current.children) {
      traversalStack.push(child)
    }
  }
  return count
}

/**
 * Propagate position delta to all descendants (iterative to avoid stack overflow).
 * Used when parent position changes but layout is cached.
 *
 * Only updates the constraint fingerprint's lastOffset values, NOT layout.top/left.
 * layout.top/left store RELATIVE positions (relative to parent's border box),
 * so they don't change when an ancestor moves — only the absolute offset
 * (tracked via lastOffsetX/Y) changes.
 */
export function propagatePositionDelta(node: Node, deltaX: number, deltaY: number): void {
  traversalStack.length = 0
  // Start with all children of the node
  for (const child of node.children) {
    traversalStack.push(child)
  }
  while (traversalStack.length > 0) {
    const current = traversalStack.pop() as Node
    current.flex.lastOffsetX += deltaX
    current.flex.lastOffsetY += deltaY
    for (const child of current.children) {
      traversalStack.push(child)
    }
  }
}

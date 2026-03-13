/**
 * Layout Statistics Counters
 *
 * Mutable counters for debugging and benchmarking.
 * Separated to avoid circular dependencies between layout modules.
 */

// Layout statistics for debugging
export let layoutNodeCalls = 0
export let measureNodeCalls = 0
export let layoutSizingCalls = 0 // Calls for intrinsic sizing (offset=0,0)
export let layoutPositioningCalls = 0 // Calls for final positioning
export let layoutCacheHits = 0

export function resetLayoutStats(): void {
  layoutNodeCalls = 0
  measureNodeCalls = 0
  layoutSizingCalls = 0
  layoutPositioningCalls = 0
  layoutCacheHits = 0
}

export function incLayoutNodeCalls(): void {
  layoutNodeCalls++
}

export function incMeasureNodeCalls(): void {
  measureNodeCalls++
}

export function incLayoutSizingCalls(): void {
  layoutSizingCalls++
}

export function incLayoutPositioningCalls(): void {
  layoutPositioningCalls++
}

export function incLayoutCacheHits(): void {
  layoutCacheHits++
}

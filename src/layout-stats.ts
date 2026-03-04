/**
 * Layout Statistics Counters
 *
 * Mutable counters for debugging and benchmarking.
 * Separated to avoid circular dependencies between layout modules.
 *
 * When the FLEXX_STATS=1 environment variable is set, additional cache
 * diagnostics are tracked (fingerprint hits/misses). Use getLayoutStats()
 * and resetLayoutStats() to access and reset these counters.
 */

// Whether detailed cache stats tracking is enabled (set via FLEXX_STATS=1)
const STATS_ENABLED =
  typeof process !== "undefined" && typeof process.env !== "undefined" && process.env.FLEXX_STATS === "1"

// Layout statistics for debugging
export let layoutNodeCalls = 0
export let measureNodeCalls = 0
export let resolveEdgeCalls = 0
export let layoutSizingCalls = 0 // Calls for intrinsic sizing (offset=0,0)
export let layoutPositioningCalls = 0 // Calls for final positioning
export let layoutCacheHits = 0

// Cache diagnostics (tracked when FLEXX_STATS=1)
export let fingerprintHits = 0
export let fingerprintMisses = 0

/**
 * Get layout cache statistics.
 * Tracks fingerprint cache hits (layoutNode skipped because constraints unchanged)
 * and misses (full layout computed). Always available, but only accumulates when
 * FLEXX_STATS=1 is set.
 *
 * @returns Cache stats with hit count, miss count, and hit rate (0-1)
 */
export function getLayoutStats(): { hits: number; misses: number; hitRate: number } {
  const total = fingerprintHits + fingerprintMisses
  return {
    hits: fingerprintHits,
    misses: fingerprintMisses,
    hitRate: total > 0 ? fingerprintHits / total : 0,
  }
}

export function resetLayoutStats(): void {
  layoutNodeCalls = 0
  measureNodeCalls = 0
  resolveEdgeCalls = 0
  layoutSizingCalls = 0
  layoutPositioningCalls = 0
  layoutCacheHits = 0
  fingerprintHits = 0
  fingerprintMisses = 0
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

export function incFingerprintHit(): void {
  if (STATS_ENABLED) fingerprintHits++
}

export function incFingerprintMiss(): void {
  if (STATS_ENABLED) fingerprintMisses++
}

/**
 * Cache diagnostics tests
 *
 * Verifies the always-on cache diagnostics API:
 * - getLayoutStats() returns hits, misses, hitRate
 * - resetLayoutStats() clears all counters
 * - Fingerprint hits/misses are tracked correctly
 */

import { describe, expect, it, beforeEach } from "vitest"
import {
  Node,
  DIRECTION_LTR,
  FLEX_DIRECTION_ROW,
  FLEX_DIRECTION_COLUMN,
  getLayoutStats,
  resetLayoutStats,
} from "../src/index.js"

describe("Cache Diagnostics (getLayoutStats)", () => {
  beforeEach(() => {
    resetLayoutStats()
  })

  it("should return zero stats after reset", () => {
    const stats = getLayoutStats()
    expect(stats.hits).toBe(0)
    expect(stats.misses).toBe(0)
    expect(stats.hitRate).toBe(0)
  })

  it("should track fingerprint misses on first layout", () => {
    const root = Node.create()
    root.setWidth(100)
    root.setHeight(50)
    root.calculateLayout(100, 50, DIRECTION_LTR)

    const stats = getLayoutStats()
    // First layout always misses (no fingerprint yet)
    expect(stats.misses).toBeGreaterThan(0)
    expect(stats.hits).toBe(0)
  })

  it("should return valid hitRate between 0 and 1", () => {
    const root = Node.create()
    root.setWidth(100)
    root.setHeight(50)
    const child = Node.create()
    child.setFlexGrow(1)
    root.insertChild(child, 0)

    root.calculateLayout(100, 50, DIRECTION_LTR)
    // Second identical layout should hit cache
    root.calculateLayout(100, 50, DIRECTION_LTR)

    const stats = getLayoutStats()
    expect(stats.hitRate).toBeGreaterThanOrEqual(0)
    expect(stats.hitRate).toBeLessThanOrEqual(1)
  })

  it("should reset stats between layout passes", () => {
    const root = Node.create()
    root.setWidth(80)
    root.setHeight(24)
    root.calculateLayout(80, 24, DIRECTION_LTR)

    resetLayoutStats()
    const stats = getLayoutStats()
    expect(stats.hits).toBe(0)
    expect(stats.misses).toBe(0)
    expect(stats.hitRate).toBe(0)
  })

  it("should return stats object with correct shape", () => {
    const stats = getLayoutStats()
    expect(stats).toHaveProperty("hits")
    expect(stats).toHaveProperty("misses")
    expect(stats).toHaveProperty("hitRate")
    expect(typeof stats.hits).toBe("number")
    expect(typeof stats.misses).toBe("number")
    expect(typeof stats.hitRate).toBe("number")
  })

  it("should not throw when called multiple times", () => {
    const root = Node.create()
    root.setWidth(100)
    root.setHeight(100)

    for (let i = 0; i < 10; i++) {
      root.calculateLayout(100, 100, DIRECTION_LTR)
      const stats = getLayoutStats()
      expect(stats.hits).toBeGreaterThanOrEqual(0)
    }
  })

  it("should track stats across tree with multiple nodes", () => {
    const root = Node.create()
    root.setWidth(200)
    root.setHeight(100)
    root.setFlexDirection(FLEX_DIRECTION_ROW)

    for (let i = 0; i < 5; i++) {
      const child = Node.create()
      child.setWidth(30)
      child.setHeight(20)
      root.insertChild(child, i)
    }

    root.calculateLayout(200, 100, DIRECTION_LTR)
    const firstStats = getLayoutStats()

    // Dirty one child and re-layout
    root.getChild(2)!.markDirty()
    root.calculateLayout(200, 100, DIRECTION_LTR)
    const secondStats = getLayoutStats()

    // After re-layout with a dirty child, total calls should increase
    // (some nodes hit fingerprint cache, the dirty path doesn't)
    expect(secondStats.hits + secondStats.misses).toBeGreaterThanOrEqual(firstStats.hits + firstStats.misses)
  })
})

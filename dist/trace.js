/**
 * Layout Trace — instrumented debug mode for fingerprint/cache tracing.
 *
 * Records every fingerprint check (hit/miss), cache lookup (hit/miss),
 * measureNode save/restore, and parent size override during a layout pass.
 * Two traces from consecutive passes can be diffed to find where they diverge.
 *
 * Zero-cost when disabled: the module-level `trace` getter returns undefined,
 * and all callsites use optional chaining (`trace?.event()`).
 *
 * @example
 * ```typescript
 * import { enableTrace, disableTrace, diffTraces } from 'flexture/trace';
 *
 * const t1 = enableTrace();
 * root.calculateLayout(80, 24, DIRECTION_LTR);
 * disableTrace();
 *
 * // Mutate tree...
 * const t2 = enableTrace();
 * root.calculateLayout(80, 24, DIRECTION_LTR);
 * disableTrace();
 *
 * const diffs = diffTraces(t1, t2);
 * ```
 */
// =============================================================================
// Trace Recorder
// =============================================================================
export class LayoutTrace {
    events = [];
    _nodeCounter = 0;
    /** Reset node counter at start of a new layout pass */
    resetCounter() {
        this._nodeCounter = 0;
    }
    /** Get next node index (call once per layoutNode entry) */
    nextNode() {
        return this._nodeCounter++;
    }
    fingerprintHit(nodeIndex, availW, availH) {
        this.events.push({ type: "fingerprint_hit", nodeIndex, availW, availH });
    }
    fingerprintMiss(nodeIndex, availW, availH, detail) {
        this.events.push({ type: "fingerprint_miss", nodeIndex, availW, availH, detail });
    }
    cacheHit(nodeIndex, availW, availH, width, height) {
        this.events.push({
            type: "cache_hit",
            nodeIndex,
            availW,
            availH,
            detail: { width, height },
        });
    }
    cacheMiss(nodeIndex, availW, availH) {
        this.events.push({ type: "cache_miss", nodeIndex, availW, availH });
    }
    measureCacheHit(nodeIndex, availW, availH, width, height) {
        this.events.push({
            type: "measure_cache_hit",
            nodeIndex,
            availW,
            availH,
            detail: { width, height },
        });
    }
    measureCacheMiss(nodeIndex, availW, availH) {
        this.events.push({ type: "measure_cache_miss", nodeIndex, availW, availH });
    }
    measureSaveRestore(nodeIndex, savedW, savedH, measuredW, measuredH) {
        this.events.push({
            type: "measure_save_restore",
            nodeIndex,
            availW: 0,
            availH: 0,
            detail: { savedW, savedH, measuredW, measuredH },
        });
    }
    parentOverride(nodeIndex, axis, original, overridden) {
        this.events.push({
            type: "parent_override",
            nodeIndex,
            availW: 0,
            availH: 0,
            detail: { axis, original, overridden },
        });
    }
    layoutEnter(nodeIndex, availW, availH, isDirty, childCount) {
        this.events.push({
            type: "layout_enter",
            nodeIndex,
            availW,
            availH,
            detail: { isDirty, childCount },
        });
    }
    layoutExit(nodeIndex, width, height) {
        this.events.push({
            type: "layout_exit",
            nodeIndex,
            availW: 0,
            availH: 0,
            detail: { width, height },
        });
    }
}
// =============================================================================
// Module-level state (zero-cost when null)
// =============================================================================
let _trace = null;
/** Enable tracing. Returns the trace recorder for later inspection. */
export function enableTrace() {
    _trace = new LayoutTrace();
    return _trace;
}
/** Disable tracing. Returns the trace that was recorded. */
export function disableTrace() {
    const t = _trace;
    _trace = null;
    return t;
}
/** Get the current trace recorder (null when tracing is disabled). */
export function getTrace() {
    return _trace;
}
// =============================================================================
// Diff Utility
// =============================================================================
/**
 * Compare two traces event-by-event.
 * Returns divergence points — where the two passes made different decisions.
 */
export function diffTraces(t1, t2) {
    const diffs = [];
    const maxLen = Math.max(t1.events.length, t2.events.length);
    for (let i = 0; i < maxLen; i++) {
        const e1 = t1.events[i];
        const e2 = t2.events[i];
        if (!e1 || !e2) {
            diffs.push({
                index: i,
                event1: e1,
                event2: e2,
                reason: !e1 ? "extra event in trace 2" : "extra event in trace 1",
            });
            continue;
        }
        if (e1.type !== e2.type) {
            diffs.push({
                index: i,
                event1: e1,
                event2: e2,
                reason: `type differs: ${e1.type} vs ${e2.type}`,
            });
        }
        else if (e1.nodeIndex !== e2.nodeIndex) {
            diffs.push({
                index: i,
                event1: e1,
                event2: e2,
                reason: `nodeIndex differs: ${e1.nodeIndex} vs ${e2.nodeIndex}`,
            });
        }
        else if (!Object.is(e1.availW, e2.availW) || !Object.is(e1.availH, e2.availH)) {
            diffs.push({
                index: i,
                event1: e1,
                event2: e2,
                reason: `constraints differ: (${e1.availW},${e1.availH}) vs (${e2.availW},${e2.availH})`,
            });
        }
        else if (e1.detail && e2.detail) {
            // Compare detail fields
            const keys = new Set([...Object.keys(e1.detail), ...Object.keys(e2.detail)]);
            for (const key of keys) {
                if (!Object.is(e1.detail[key], e2.detail[key])) {
                    diffs.push({
                        index: i,
                        event1: e1,
                        event2: e2,
                        reason: `detail.${key} differs: ${e1.detail[key]} vs ${e2.detail[key]}`,
                    });
                    break;
                }
            }
        }
    }
    return diffs;
}
//# sourceMappingURL=trace.js.map
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
 * import { enableTrace, disableTrace, diffTraces } from 'flexily/trace';
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
export type TraceEventType = "fingerprint_hit" | "fingerprint_miss" | "cache_hit" | "cache_miss" | "measure_cache_hit" | "measure_cache_miss" | "measure_save_restore" | "parent_override" | "layout_enter" | "layout_exit";
export interface TraceEvent {
    type: TraceEventType;
    /** Node index in tree traversal order (stable across same tree) */
    nodeIndex: number;
    /** Available width constraint */
    availW: number;
    /** Available height constraint */
    availH: number;
    /** Extra data depending on event type */
    detail?: Record<string, number | string | boolean>;
}
export interface TraceDiff {
    index: number;
    event1: TraceEvent | undefined;
    event2: TraceEvent | undefined;
    reason: string;
}
export declare class LayoutTrace {
    readonly events: TraceEvent[];
    private _nodeCounter;
    /** Reset node counter at start of a new layout pass */
    resetCounter(): void;
    /** Get next node index (call once per layoutNode entry) */
    nextNode(): number;
    fingerprintHit(nodeIndex: number, availW: number, availH: number): void;
    fingerprintMiss(nodeIndex: number, availW: number, availH: number, detail?: Record<string, number | string | boolean>): void;
    cacheHit(nodeIndex: number, availW: number, availH: number, width: number, height: number): void;
    cacheMiss(nodeIndex: number, availW: number, availH: number): void;
    measureCacheHit(nodeIndex: number, availW: number, availH: number, width: number, height: number): void;
    measureCacheMiss(nodeIndex: number, availW: number, availH: number): void;
    measureSaveRestore(nodeIndex: number, savedW: number, savedH: number, measuredW: number, measuredH: number): void;
    parentOverride(nodeIndex: number, axis: "main" | "cross", original: number, overridden: number): void;
    layoutEnter(nodeIndex: number, availW: number, availH: number, isDirty: boolean, childCount: number): void;
    layoutExit(nodeIndex: number, width: number, height: number): void;
}
/** Enable tracing. Returns the trace recorder for later inspection. */
export declare function enableTrace(): LayoutTrace;
/** Disable tracing. Returns the trace that was recorded. */
export declare function disableTrace(): LayoutTrace | null;
/** Get the current trace recorder (null when tracing is disabled). */
export declare function getTrace(): LayoutTrace | null;
/**
 * Compare two traces event-by-event.
 * Returns divergence points — where the two passes made different decisions.
 */
export declare function diffTraces(t1: LayoutTrace, t2: LayoutTrace): TraceDiff[];
//# sourceMappingURL=trace.d.ts.map
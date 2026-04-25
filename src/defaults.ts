/**
 * Flexily defaults preset — `"css"` vs `"yoga"`.
 *
 * Flexily's default style sits between CSS and Yoga: row direction (CSS), but
 * `flexShrink: 0` and `alignContent: flex-start` (Yoga). This module exposes a
 * preset selector so consumers can opt into either pure-CSS or pure-Yoga
 * defaults explicitly via `createFlexily({ defaults })` or
 * `Node.create({ defaults })`.
 *
 * - `"css"` — flexShrink: 1, alignContent: stretch (browser-correct, multi-target)
 * - `"yoga"` — flexShrink: 0, alignContent: flex-start (drop-in replacement for
 *   yoga-layout)
 *
 * No module-level state: presets are passed explicitly. The `createFlexily`
 * engine captures its preset in a closure so every `engine.createNode()` call
 * inherits it without relying on global state.
 *
 * Static default (when no preset is passed) is currently `"yoga"` to preserve
 * existing behavior. Phase 6 of the migration (`km-silvery.flexshrink-default`)
 * flips this static default to `"css"`.
 */

export type DefaultsPreset = "css" | "yoga"

/** Static default preset. Phase 6 flips this to `"css"`. */
export const DEFAULT_PRESET: DefaultsPreset = "yoga"

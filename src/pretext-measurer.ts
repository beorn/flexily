/**
 * Pretext text measurement plugin.
 *
 * Integrates with @chenglou/pretext for proportional font measurement.
 * Pretext is a peer dependency — users must install it separately.
 *
 * See silvery-internal/design/v05-layout/pretext-integration.md
 */

import type { FlexilyPlugin } from "./create-flexily.js"
import type { TextLayoutService, PreparedText, TextLayout, IntrinsicSizes } from "./text-layout.js"

/** Pretext API shape (from @chenglou/pretext). Defined here to avoid a hard dependency. */
export interface PretextAPI {
  prepare(text: string, font: string): PretextPrepared
}

export interface PretextPrepared {
  layout(maxWidth: number, lineHeight?: number): PretextLayout
}

export interface PretextLayout {
  width: number
  height: number
  lines?: Array<{ text: string; width: number }>
}

/**
 * Create a Pretext-based text measurement service.
 *
 * @param pretext - The pretext module (import from "@chenglou/pretext")
 */
export function createPretextMeasurer(pretext: PretextAPI): TextLayoutService {
  return {
    prepare(input) {
      const { text, style } = input
      const pretextPrepared = pretext.prepare(text, style.fontShorthand)
      const lineHeight = style.lineHeight || style.fontSize

      let cachedIntrinsic: IntrinsicSizes | null = null

      const prepared: PreparedText = {
        intrinsicSizes(): IntrinsicSizes {
          if (cachedIntrinsic) return cachedIntrinsic
          const unconstrained = pretextPrepared.layout(Infinity, lineHeight)
          const minLayout = pretextPrepared.layout(0, lineHeight)
          cachedIntrinsic = {
            minContentWidth: minLayout.width,
            maxContentWidth: unconstrained.width,
          }
          return cachedIntrinsic
        },

        layout(constraints): TextLayout {
          const maxWidth = constraints.maxWidth ?? Infinity
          const result = pretextPrepared.layout(maxWidth, lineHeight)
          const lineCount = result.lines?.length ?? 1
          const width = constraints.shrinkWrap ? result.width : Math.min(maxWidth, result.width)

          return {
            width,
            height: result.height,
            lineCount,
            firstBaseline: lineHeight,
            lastBaseline: lineCount > 0 ? (lineCount - 1) * lineHeight + lineHeight : lineHeight,
            truncated: false,
          }
        },
      }

      return prepared
    },
  }
}

/**
 * Plugin: add Pretext-based proportional text measurement.
 *
 * @param pretext - The pretext module (import from "@chenglou/pretext")
 */
export function withPretext(pretext: PretextAPI): FlexilyPlugin {
  return (engine) => {
    engine.textLayout = createPretextMeasurer(pretext)
    return engine
  }
}

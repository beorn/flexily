/**
 * Monospace text measurement.
 *
 * Terminal text: graphemeCount * charWidth, always 1 line (no wrapping).
 * This is the default for terminal UIs where 1 char = 1 cell.
 */

import type { FlexilyPlugin } from "./create-flexily.js"
import type { TextLayoutService, PreparedText, TextLayout, IntrinsicSizes } from "./text-layout.js"

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })

/**
 * Create a monospace text measurement service.
 *
 * @param charWidth - Width of each character cell (default: 1 for terminal grids)
 * @param charHeight - Height of each character cell (default: 1 for terminal grids)
 */
export function createMonospaceMeasurer(charWidth = 1, charHeight = 1): TextLayoutService {
  return {
    prepare(input) {
      const { text } = input

      // Count grapheme clusters for proper emoji/CJK support
      let graphemeCount = 0
      for (const _ of segmenter.segment(text)) graphemeCount++

      const totalWidth = graphemeCount * charWidth

      const prepared: PreparedText = {
        intrinsicSizes(): IntrinsicSizes {
          return {
            minContentWidth: totalWidth, // monospace: entire text is one unbreakable segment
            maxContentWidth: totalWidth,
          }
        },

        layout(constraints): TextLayout {
          const width = constraints.maxWidth !== undefined ? Math.min(totalWidth, constraints.maxWidth) : totalWidth

          return {
            width,
            height: charHeight,
            lineCount: 1,
            firstBaseline: charHeight,
            lastBaseline: charHeight,
            truncated: width < totalWidth,
          }
        },
      }

      return prepared
    },
  }
}

/**
 * Plugin: add monospace text measurement to the engine.
 *
 * @param charWidth - Width per character cell (default: 1)
 * @param charHeight - Height per character cell (default: 1)
 */
export function withMonospace(charWidth = 1, charHeight = 1): FlexilyPlugin {
  return (engine) => {
    engine.textLayout = createMonospaceMeasurer(charWidth, charHeight)
    return engine
  }
}

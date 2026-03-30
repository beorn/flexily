/**
 * Deterministic test text measurer.
 *
 * Fixed grapheme width table: Latin 0.8, CJK 1.0, emoji 1.8 (relative to fontSize).
 * Deterministic across platforms — use in tests and CI.
 * Supports word wrapping for realistic text layout testing.
 */

import type { FlexilyPlugin } from "./create-flexily.js"
import type { TextLayoutService, PreparedText, TextLayout, TextLine, IntrinsicSizes } from "./text-layout.js"

const segmenter = new Intl.Segmenter(undefined, { granularity: "grapheme" })

/** Measure a single grapheme cluster with the deterministic width table. */
function graphemeWidth(grapheme: string, fontSize: number): number {
  const cp = grapheme.codePointAt(0) ?? 0

  // Emoji: ZWJ sequences, variation selectors, regional indicators
  if (
    (cp >= 0x1f300 && cp <= 0x1faff) ||
    (cp >= 0x2600 && cp <= 0x27bf) ||
    (cp >= 0xfe00 && cp <= 0xfe0f) ||
    cp === 0x200d ||
    (cp >= 0x1f900 && cp <= 0x1f9ff) ||
    grapheme.length > 2
  ) {
    return fontSize * 1.8
  }

  // CJK: Chinese, Japanese, Korean ideographs + fullwidth
  if (
    (cp >= 0x4e00 && cp <= 0x9fff) ||
    (cp >= 0x3000 && cp <= 0x303f) ||
    (cp >= 0x3040 && cp <= 0x309f) ||
    (cp >= 0x30a0 && cp <= 0x30ff) ||
    (cp >= 0xac00 && cp <= 0xd7af) ||
    (cp >= 0xff00 && cp <= 0xffef)
  ) {
    return fontSize * 1.0
  }

  // Latin and everything else
  return fontSize * 0.8
}

/** A word or whitespace segment for line breaking. */
interface TextSegment {
  text: string
  width: number
  isWhitespace: boolean
}

function segmentText(text: string, fontSize: number): TextSegment[] {
  const segments: TextSegment[] = []
  let current = ""
  let currentWidth = 0
  let isWhitespace = false

  for (const { segment } of segmenter.segment(text)) {
    const isSpace = segment === " " || segment === "\t"

    if (segments.length === 0 && current === "") {
      isWhitespace = isSpace
      current = segment
      currentWidth = isSpace ? fontSize * 0.8 : graphemeWidth(segment, fontSize)
      continue
    }

    if (isSpace !== isWhitespace) {
      if (current) segments.push({ text: current, width: currentWidth, isWhitespace })
      current = segment
      currentWidth = isSpace ? fontSize * 0.8 : graphemeWidth(segment, fontSize)
      isWhitespace = isSpace
    } else {
      current += segment
      currentWidth += isSpace ? fontSize * 0.8 : graphemeWidth(segment, fontSize)
    }
  }

  if (current) segments.push({ text: current, width: currentWidth, isWhitespace })
  return segments
}

function measureString(text: string, fontSize: number): number {
  let width = 0
  for (const { segment } of segmenter.segment(text)) {
    width += graphemeWidth(segment, fontSize)
  }
  return width
}

/**
 * Create a deterministic text measurement service for testing.
 *
 * Uses fixed grapheme widths: Latin 0.8, CJK 1.0, emoji 1.8 (relative to fontSize).
 */
export function createTestMeasurer(): TextLayoutService {
  return {
    prepare(input) {
      const { text, style } = input
      const fontSize = style.fontSize
      const lineHeight = style.lineHeight || fontSize

      const segments = segmentText(text, fontSize)

      let maxContentWidth = 0
      let minContentWidth = 0
      for (const seg of segments) {
        maxContentWidth += seg.width
        if (!seg.isWhitespace && seg.width > minContentWidth) {
          minContentWidth = seg.width
        }
      }

      const prepared: PreparedText = {
        intrinsicSizes(): IntrinsicSizes {
          return { minContentWidth, maxContentWidth }
        },

        layout(constraints, options?): TextLayout {
          const maxWidth = constraints.maxWidth ?? Infinity
          const maxLines = constraints.maxLines ?? Infinity
          const wrap = constraints.wrap ?? "normal"
          const includeLines = options?.includeLines ?? false

          if (wrap === "none" || maxWidth >= maxContentWidth) {
            const truncated = maxLines < 1
            const width = constraints.shrinkWrap ? maxContentWidth : Math.min(maxWidth, maxContentWidth)
            return {
              width,
              height: truncated ? 0 : lineHeight,
              lineCount: truncated ? 0 : 1,
              firstBaseline: lineHeight,
              lastBaseline: lineHeight,
              truncated: maxWidth < maxContentWidth,
              lines: includeLines
                ? [{ text, width: maxContentWidth, startIndex: 0, endIndex: text.length }]
                : undefined,
            }
          }

          // Word wrapping
          const lines: TextLine[] = []
          let lineWidth = 0
          let lineText = ""
          let lineStart = 0
          let charIndex = 0

          for (const seg of segments) {
            if (seg.isWhitespace) {
              if (lineText) {
                lineWidth += seg.width
                lineText += seg.text
              }
              charIndex += seg.text.length
              continue
            }

            if (lineWidth + seg.width > maxWidth && lineText) {
              const trimmed = lineText.trimEnd()
              lines.push({
                text: trimmed,
                width: measureString(trimmed, fontSize),
                startIndex: lineStart,
                endIndex: charIndex,
              })
              if (lines.length >= maxLines) break

              lineText = seg.text
              lineWidth = seg.width
              lineStart = charIndex
            } else {
              lineText += seg.text
              lineWidth += seg.width
            }
            charIndex += seg.text.length
          }

          if (lineText && lines.length < maxLines) {
            const trimmed = lineText.trimEnd()
            lines.push({
              text: trimmed,
              width: measureString(trimmed, fontSize),
              startIndex: lineStart,
              endIndex: charIndex,
            })
          }

          const lineCount = lines.length
          const height = lineCount * lineHeight
          const widestLine = lines.reduce((max, l) => Math.max(max, l.width), 0)
          const width = constraints.shrinkWrap ? widestLine : Math.min(maxWidth, widestLine)

          return {
            width,
            height,
            lineCount,
            firstBaseline: lineHeight,
            lastBaseline: lineCount > 0 ? (lineCount - 1) * lineHeight + lineHeight : lineHeight,
            truncated: lines.length >= maxLines && charIndex < text.length,
            lines: includeLines ? lines : undefined,
          }
        },
      }

      return prepared
    },
  }
}

/**
 * Plugin: add deterministic test text measurement to the engine.
 */
export function withTestMeasurer(): FlexilyPlugin {
  return (engine) => {
    engine.textLayout = createTestMeasurer()
    return engine
  }
}

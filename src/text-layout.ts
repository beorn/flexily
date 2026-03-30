/**
 * Text Layout Service — pluggable text measurement for Flexily.
 *
 * The TextLayoutService interface decouples text measurement from the layout engine.
 * Different backends handle different environments:
 * - MonospaceMeasurer: terminal (1 char = 1 cell)
 * - DeterministicTestMeasurer: tests/CI (fixed grapheme widths)
 * - PretextMeasurer: proportional fonts (Canvas measureText)
 *
 * See silvery-internal/design/v05-layout/pretext-integration.md for design rationale.
 */

/** Resolved text style — consumed by both measurement and painting. */
export interface ResolvedTextStyle {
  fontShorthand: string // e.g. "14px 'Inter', sans-serif"
  fontFamily: string
  fontSize: number
  fontWeight: number
  fontStyle: string
  lineHeight: number
}

/** Input for text preparation. */
export interface TextPrepareInput {
  text: string
  style: ResolvedTextStyle
  direction?: "auto" | "ltr" | "rtl"
  locale?: string
}

/** Intrinsic text sizes for flexbox min/max-content. */
export interface IntrinsicSizes {
  minContentWidth: number // longest unbreakable segment
  maxContentWidth: number // unwrapped total width
}

/** Constraints for text layout. */
export interface TextConstraints {
  maxWidth?: number
  maxHeight?: number
  maxLines?: number
  wrap?: "normal" | "anywhere" | "none"
  overflow?: "clip" | "ellipsis"
  shrinkWrap?: boolean
}

/** A single laid-out line of text. */
export interface TextLine {
  text: string
  width: number
  startIndex: number
  endIndex: number
}

/** A rectangle (for hit testing, caret, selection). */
export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

/** Result of hit-testing a point in laid-out text. */
export interface TextHit {
  index: number
  affinity: "upstream" | "downstream"
}

/** Result of laying out prepared text at a specific width. */
export interface TextLayout {
  width: number
  height: number
  lineCount: number
  firstBaseline: number
  lastBaseline: number
  truncated: boolean
  lines?: readonly TextLine[]

  // Geometry — on the layout result, not on PreparedText.
  hitTest?(x: number, y: number): TextHit
  caretRect?(index: number, affinity?: "upstream" | "downstream"): Rect
  selectionRects?(start: number, end: number): readonly Rect[]
}

/** Prepared text — measured and segmented, ready for layout at any width. */
export interface PreparedText {
  intrinsicSizes(options?: { wrap?: "normal" | "anywhere" | "none" }): IntrinsicSizes
  layout(constraints: TextConstraints, options?: { includeLines?: boolean; includeGeometry?: boolean }): TextLayout
}

/** Pluggable text measurement backend. */
export interface TextLayoutService {
  prepare(input: TextPrepareInput): PreparedText
}

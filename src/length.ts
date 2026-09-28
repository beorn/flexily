/** CSS length grammar. Scale comes from the adapter; percentages stay late-bound. */
import * as C from "./constants.js"
import type { MathExpr, Value } from "./types.js"

export interface LengthScale {
  readonly ch: number
  readonly lh: number
}

export class LengthError extends Error {
  constructor(
    readonly input: string,
    readonly reason: string,
    readonly prop?: string,
  ) {
    super(`${prop ? `${prop}: ` : ""}${JSON.stringify(input)} — ${reason}`)
    this.name = "LengthError"
  }
}

/** Parse once at style set. Changing an adapter's scale requires re-setting its styles. */
export function parseLength(input: string, scale: LengthScale): Value {
  const fail = (reason: string): never => {
    throw new LengthError(input, reason)
  }
  if (!scale || !Number.isFinite(scale.ch) || scale.ch <= 0 || !Number.isFinite(scale.lh) || scale.lh <= 0) {
    fail("adapter scale ch and lh must be finite and greater than zero")
  }
  let pos = 0
  let math = false
  const space = (at: number): boolean => /[ \t\r\n\f]/.test(input[at] ?? "")
  const skip = (): void => {
    while (space(pos)) pos++
  }
  const number = (expr: MathExpr): expr is Value => "unit" in expr && expr.unit === C.UNIT_NUMBER
  const leaf = (value: number, unit: number): Value => {
    if (!Number.isFinite(value)) fail("length or constant must be finite")
    return Object.freeze({ value, unit })
  }

  function primary(inMath: boolean): MathExpr {
    skip()
    if (inMath && input[pos] === "(") {
      pos++
      const expr = sum()
      skip()
      if (input[pos++] !== ")") fail("expected closing parenthesis")
      return expr
    }
    const name = /^[a-z]+/i.exec(input.slice(pos))?.[0].toLowerCase()
    if (name) {
      if (!inMath) math = true
      pos += name.length
      if (input[pos++] !== "(" || !["calc", "min", "max", "clamp"].includes(name)) {
        fail("expected a length or calc(), min(), max(), clamp()")
      }
      const args: MathExpr[] = [sum()]
      skip()
      while (input[pos] === ",") {
        pos++
        args.push(sum())
        skip()
      }
      if (input[pos++] !== ")") fail("expected closing parenthesis")
      if (name === "calc") {
        if (args.length !== 1) fail("calc() takes one expression")
        return args[0]!
      }
      if (args.some(number)) fail("unitless numbers are only multiplication or division operands")
      if (name === "clamp") {
        if (args.length !== 3) fail("clamp() takes exactly three lengths")
        return Object.freeze({ fn: "clamp", args: Object.freeze(args) as readonly [MathExpr, MathExpr, MathExpr] })
      }
      return Object.freeze({ fn: name as "min" | "max", args: Object.freeze(args) })
    }
    const token = /^[+-]?(?:\d*\.\d+|\d+)(?:e[+-]?\d+)?/i.exec(input.slice(pos))?.[0]
    if (!token) fail("expected a length")
    pos += token.length
    const value = Number(token)
    if (input[pos] === "%") {
      pos++
      return leaf(value, C.UNIT_PERCENT)
    }
    const unit = /^[a-z]+/i.exec(input.slice(pos))?.[0].toLowerCase()
    if (!unit) return leaf(value, C.UNIT_NUMBER)
    pos += unit.length
    if (unit === "ch") return leaf(value * scale.ch, C.UNIT_CH)
    if (unit === "lh") return leaf(value * scale.lh, C.UNIT_LH)
    if (unit === "cqi") return leaf(value, C.UNIT_CQI)
    if (unit === "px") fail("px has no adapter pixel scale; use ch for columns or lh for rows")
    if (["cqmin", "cqb", "cqmax"].includes(unit)) fail(`${unit} waits for #26239`)
    return fail(`unsupported length unit ${unit}; use ch, lh, % or cqi`)
  }

  function product(): MathExpr {
    let left = primary(true)
    skip()
    while (input[pos] === "*" || input[pos] === "/") {
      const op = input[pos++] as "*" | "/"
      const right = primary(true)
      if (op === "/" && (!number(right) || right.value === 0)) {
        fail(number(right) ? "division by zero" : "divide only by a unitless constant")
      }
      if (op === "*" && !number(left) && !number(right)) fail("multiply only by a unitless constant")
      // Reduce only scalar constants; this is not a second length evaluator.
      left =
        number(left) && number(right)
          ? leaf(op === "*" ? left.value * right.value : left.value / right.value, C.UNIT_NUMBER)
          : Object.freeze({ op, left, right })
      skip()
    }
    return left
  }

  function sum(): MathExpr {
    let left = product()
    skip()
    while (input[pos] === "+" || input[pos] === "-") {
      const op = input[pos] as "+" | "-"
      if (!space(pos - 1) || !space(pos + 1))
        fail(`write spaces on both sides of binary ${op}; for example: 100% ${op} 2ch`)
      pos++
      const right = product()
      if (number(left) || number(right)) fail("unitless numbers are only multiplication or division operands")
      left = Object.freeze({ op, left, right })
      skip()
    }
    return left
  }

  const expr = primary(false)
  skip()
  if (pos !== input.length) {
    if (/[+*/-]/.test(input[pos]!)) fail(`wrap it: calc(${input})`)
    fail("unexpected input after the length")
  }
  if (number(expr)) fail("unitless numbers are only multiplication or division operands; lengths need units")
  if ("unit" in expr) {
    if (!math && expr.value < 0) fail("negative bare dimensions are invalid; put arithmetic inside calc()")
    return Object.freeze({ ...expr, source: input })
  }
  return Object.freeze({ value: 0, unit: C.UNIT_CALC, expr, source: input })
}

/** Validate units when the dimension's axis is known; basis is checked by its parent. */
export function assertLengthAxis(value: Value, axis: "inline" | "block", prop: string): void {
  function mismatch(expr: MathExpr): boolean {
    if ("unit" in expr) {
      if (expr.unit === C.UNIT_CALC) return expr.expr ? mismatch(expr.expr) : false
      return axis === "inline" ? expr.unit === C.UNIT_LH : expr.unit === C.UNIT_CH || expr.unit === C.UNIT_CQI
    }
    if ("op" in expr) return mismatch(expr.left) || mismatch(expr.right)
    return expr.args.some(mismatch)
  }
  if (mismatch(value))
    throw new LengthError(
      value.source ?? "<Value>",
      `use ${axis === "inline" ? "ch or % on the inline axis" : "lh or % on the block axis"}; cross-axis units have no adapter aspect ratio`,
      prop,
    )
}

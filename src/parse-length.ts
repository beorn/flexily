/** Parse CSS length math once at style-set time; resolution stays in resolveValue. */
import * as C from "./constants.js"
import type { MathExpr, Value } from "./types.js"

export class LengthSyntaxError extends SyntaxError {
  constructor(input: string, reason: string) {
    super(`Invalid length ${JSON.stringify(input)}: ${reason}`)
    this.name = "LengthSyntaxError"
  }
}

interface Parsed {
  expr: MathExpr
  /** A unitless constant may multiply or divide a length. */
  scalar: number | null
}

export function parseLength(input: string): Value {
  const parser = new LengthParser(input)
  const parsed = parser.expression()
  parser.space()
  if (!parser.end()) parser.fail("unexpected trailing input")
  if ("unit" in parsed.expr) return parsed.expr
  return { value: 0, unit: C.UNIT_CALC, expr: parsed.expr }
}

class LengthParser {
  private pos = 0
  constructor(private readonly input: string) {}

  end(): boolean { return this.pos >= this.input.length }
  space(): void { while (/\s/.test(this.input[this.pos] ?? "")) this.pos++ }
  fail(reason: string): never { throw new LengthSyntaxError(this.input, `${reason} at offset ${this.pos}`) }

  expression(): Parsed {
    let left = this.term()
    while (true) {
      this.space()
      const op = this.input[this.pos]
      if (op !== "+" && op !== "-") return left
      this.pos++
      const right = this.term()
      left = {
        expr: { op, left: left.expr, right: right.expr },
        scalar: left.scalar !== null && right.scalar !== null
          ? (op === "+" ? left.scalar + right.scalar : left.scalar - right.scalar)
          : null,
      }
    }
  }

  private term(): Parsed {
    let left = this.factor()
    while (true) {
      this.space()
      const op = this.input[this.pos]
      if (op !== "*" && op !== "/") return left
      this.pos++
      const right = this.factor()
      if (op === "*" && left.scalar === null && right.scalar === null) {
        this.fail("multiplication requires a unitless constant")
      }
      if (op === "/" && right.scalar === null) this.fail("division requires a unitless constant")
      if (op === "/" && right.scalar === 0) this.fail("division by zero")
      left = {
        expr: { op, left: left.expr, right: right.expr },
        scalar: left.scalar !== null && right.scalar !== null
          ? (op === "*" ? left.scalar * right.scalar : left.scalar / right.scalar)
          : null,
      }
    }
  }

  private factor(): Parsed {
    this.space()
    const ch = this.input[this.pos]
    if (ch === "+" || ch === "-") {
      this.pos++
      const inner = this.factor()
      if (ch === "+") return inner
      return {
        expr: { op: "-", left: { value: 0, unit: C.UNIT_POINT }, right: inner.expr },
        scalar: inner.scalar === null ? null : -inner.scalar,
      }
    }
    if (ch === "(") {
      this.pos++
      const inner = this.expression()
      this.space()
      if (this.input[this.pos] !== ")") this.fail("expected )")
      this.pos++
      return inner
    }
    if (ch && /[a-z]/i.test(ch)) return this.call()
    return this.leaf()
  }

  private call(): Parsed {
    const start = this.pos
    while (/[a-z]/i.test(this.input[this.pos] ?? "")) this.pos++
    const fn = this.input.slice(start, this.pos)
    if (fn !== "min" && fn !== "max" && fn !== "clamp") this.fail(`unsupported function ${fn}`)
    this.space()
    if (this.input[this.pos] !== "(") this.fail("expected (")
    this.pos++
    this.space()
    if (this.input[this.pos] === ")") this.fail(`${fn} needs arguments`)
    const args: Parsed[] = []
    while (true) {
      args.push(this.expression())
      this.space()
      const separator = this.input[this.pos]
      if (separator === ")") { this.pos++; break }
      if (separator !== ",") this.fail("expected comma or )")
      this.pos++
    }
    if (fn === "clamp" && args.length !== 3) this.fail("clamp requires three arguments")
    const exprArgs = args.map((arg) => arg.expr)
    const expr: MathExpr = fn === "clamp"
      ? { fn, args: [exprArgs[0]!, exprArgs[1]!, exprArgs[2]!] }
      : { fn, args: exprArgs }
    const scalars = args.map((arg) => arg.scalar)
    let scalar: number | null = null
    if (scalars.every((n) => n !== null)) {
      const nums = scalars as number[]
      scalar = fn === "min" ? Math.min(...nums)
        : fn === "max" ? Math.max(...nums)
        : Math.max(nums[0]!, Math.min(nums[1]!, nums[2]!))
    }
    return { expr, scalar }
  }

  private leaf(): Parsed {
    this.space()
    const match = /^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/.exec(this.input.slice(this.pos))
    if (!match) this.fail("expected number or function")
    this.pos += match[0].length
    const value = Number(match[0])
    if (!Number.isFinite(value)) this.fail("non-finite number")
    const start = this.pos
    if (this.input[this.pos] === "%") this.pos++
    else while (/[a-z]/i.test(this.input[this.pos] ?? "")) this.pos++
    const unit = this.input.slice(start, this.pos)
    const units: Record<string, number> = {
      "": C.UNIT_POINT, px: C.UNIT_POINT, "%": C.UNIT_PERCENT,
      cqi: C.UNIT_CQI, cqmin: C.UNIT_CQMIN,
    }
    if (unit === "cqb" || unit === "cqmax") this.fail(`${unit} requires #26239`)
    if (!(unit in units)) this.fail(`unsupported unit ${unit}`)
    return { expr: { value, unit: units[unit]! }, scalar: unit === "" ? value : null }
  }
}

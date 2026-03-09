// Optional dependency - resolved via km monorepo workspace, falls back at runtime
declare module "loggily" {
  export function createLogger(namespace: string): {
    debug?: (msg: string) => void
    info?: (msg: string) => void
    warn?: (msg: string) => void
    error?: (msg: string | Error) => void
    trace?: (msg: string) => void
  }
}

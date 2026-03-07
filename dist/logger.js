/**
 * Logger with auto-detection
 *
 * Uses @beorn/logger if available (when used in km), falls back to debug library.
 * Supports the conditional `?.` pattern for zero-cost when disabled.
 */
let _logger = null;
function createFallbackLogger(namespace) {
    // Dynamic require to avoid bundling debug if not needed
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const createDebug = require("debug");
        const debug = createDebug(namespace);
        return { debug: debug.enabled ? debug : undefined };
    }
    catch {
        // debug not installed either
        return { debug: undefined };
    }
}
async function detectLogger(namespace) {
    try {
        const { createLogger } = await import("decant");
        const logger = createLogger(namespace);
        // Wrap @beorn/logger to accept printf-style args
        if (logger.debug) {
            const originalDebug = logger.debug;
            return {
                debug: (msg, ...args) => {
                    // Format printf-style placeholders
                    let i = 0;
                    const formatted = msg.replace(/%[sdOo]/g, () => {
                        const arg = args[i++];
                        if (arg === undefined)
                            return "";
                        if (arg === null)
                            return "null";
                        if (typeof arg === "object")
                            return JSON.stringify(arg);
                        return String(arg);
                    });
                    originalDebug(formatted);
                },
            };
        }
        return { debug: undefined };
    }
    catch {
        return createFallbackLogger(namespace);
    }
}
// Eagerly initialize (top-level await)
// This runs once at module load time
_logger = await detectLogger("flexture:layout");
/** Logger instance - use with optional chaining: `log.debug?.('message')` */
export const log = {
    get debug() {
        return _logger?.debug;
    },
};
//# sourceMappingURL=logger.js.map
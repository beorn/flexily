import { defineConfig } from "vite-plus"

export default defineConfig({
  fmt: {
    semi: false,
  },
  lint: {
    options: {
      typeAware: true,
      typeCheck: true,
    },
  },
  test: {
    // vitest 5 defaults clearMocks to true (v4 was false); pin v4 behaviour (29257).
    clearMocks: false,
    // Timing assertions must measure layout without concurrent test workers.
    // Keep correctness files parallel, then run the unchanged timing file alone.
    //
    // `extends: false` (vitest 5, 29257): an inline project now inherits the
    // declaring config by default, and vite-plus injects its three plugins into
    // BOTH the root config and every project entry — so v5 warns "applies the
    // same plugin multiple times". Keeping each project separate applies its own
    // injected plugins exactly once; the root `clearMocks` pin is repeated per
    // project so nothing is lost.
    projects: [
      {
        extends: false,
        test: {
          clearMocks: false,
          name: "layout",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/performance-regression.test.ts"],
          benchmark: { include: ["bench/**/*.bench.ts"] },
        },
      },
      {
        extends: false,
        test: {
          clearMocks: false,
          name: "performance",
          include: ["tests/performance-regression.test.ts"],
          benchmark: { include: [] },
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
})

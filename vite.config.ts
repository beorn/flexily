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
    projects: [
      {
        test: {
          name: "layout",
          include: ["tests/**/*.test.ts"],
          exclude: ["tests/performance-regression.test.ts"],
          benchmark: { include: ["bench/**/*.bench.ts"] },
        },
      },
      {
        test: {
          name: "performance",
          include: ["tests/performance-regression.test.ts"],
          benchmark: { include: [] },
          sequence: { groupOrder: 1 },
        },
      },
    ],
  },
})

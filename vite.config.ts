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

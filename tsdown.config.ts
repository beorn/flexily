import { defineConfig } from "tsdown"

export default defineConfig({
  clean: true,
  dts: true,
  entry: ["src/index.ts", "src/index-classic.ts", "src/testing.ts"],
  format: "esm",
  platform: "neutral",
  fixedExtension: true,
  deps: {
    neverBundle: ["debug", "loggily"],
    onlyImport: ["debug", "loggily"],
  },
})

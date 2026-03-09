import { defineConfig } from "vitepress"

export default defineConfig({
  title: "Flexily",
  description: "Pure JavaScript Flexbox Layout Engine -- Yoga-compatible API, faster, smaller, no WASM",
  base: "/flexily/",

  head: [["link", { rel: "icon", type: "image/svg+xml", href: "/flexily/logo.svg" }]],

  themeConfig: {
    logo: "/logo.svg",
    siteTitle: "Flexily",

    nav: [
      { text: "Guide", link: "/guide/getting-started" },
      { text: "API", link: "/api/reference" },
      {
        text: "Links",
        items: [
          { text: "GitHub", link: "https://github.com/beorn/flexily" },
          { text: "npm", link: "https://www.npmjs.com/package/flexily" },
        ],
      },
    ],

    sidebar: {
      "/guide/": [
        {
          text: "Introduction",
          items: [
            { text: "Getting Started", link: "/guide/getting-started" },
            { text: "Why Flexily?", link: "/guide/why-flexily" },
          ],
        },
        {
          text: "Deep Dives",
          items: [
            { text: "Algorithm", link: "/guide/algorithm" },
            { text: "Performance", link: "/guide/performance" },
            { text: "Zero-Allocation Design", link: "/guide/zero-allocation" },
            { text: "Testing", link: "/guide/testing" },
            { text: "Incremental Layout Bugs", link: "/guide/incremental-layout-bugs" },
          ],
        },
        {
          text: "Reference",
          items: [
            { text: "Yoga Comparison", link: "/guide/yoga-comparison" },
            { text: "v1 Roadmap", link: "/guide/v1-roadmap" },
          ],
        },
      ],
      "/api/": [
        {
          text: "API",
          items: [{ text: "API Reference", link: "/api/reference" }],
        },
      ],
    },

    socialLinks: [{ icon: "github", link: "https://github.com/beorn/flexily" }],

    outline: { level: [2, 3] },

    search: {
      provider: "local",
    },

    footer: {
      message: "Released under the MIT License.",
      copyright: "Copyright &copy; 2024-present",
    },
  },
})

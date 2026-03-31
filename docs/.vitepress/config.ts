import { defineConfig } from "vitepress"

export default defineConfig({
  title: "Flexily",
  description: "Pure JavaScript Flexbox Layout Engine -- Yoga-compatible API, faster, smaller, no WASM",
  base: "/flexily/",

  sitemap: { hostname: "https://beorn.github.io/flexily" },

  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/flexily/logo.svg" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: "Flexily" }],
    ["meta", { name: "twitter:card", content: "summary" }],
    ["meta", { property: "og:image", content: "https://beorn.github.io/flexily/og-image.svg" }],
    [
      "script",
      { type: "application/ld+json" },
      JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Flexily",
        url: "https://beorn.github.io/flexily",
        description: "High-performance flexbox layout engine",
      }),
    ],
    [
      "script",
      {
        defer: "",
        src: "https://static.cloudflareinsights.com/beacon.min.js",
        "data-cf-beacon": '{"token": "f7205b82de9042c39f6609a9661b479f"}',
      },
    ],
  ],

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
            { text: "Yoga Divergences", link: "/guide/yoga-divergences" },
            { text: "Migration from Yoga", link: "/guide/migration-from-yoga" },
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

  transformPageData(pageData) {
    const title = pageData.title || "Flexily"
    const description = pageData.description || "High-performance flexbox layout engine"
    const cleanPath = pageData.relativePath.replace(/\.md$/, ".html").replace(/index\.html$/, "")
    pageData.frontmatter.head ??= []
    pageData.frontmatter.head.push(
      ["meta", { property: "og:title", content: title }],
      ["meta", { property: "og:description", content: description }],
      ["meta", { property: "og:url", content: `https://beorn.github.io/flexily/${cleanPath}` }],
      ["link", { rel: "canonical", href: `https://beorn.github.io/flexily/${cleanPath}` }],
    )

    // JSON-LD BreadcrumbList
    const segments = cleanPath
      .replace(/\.html$/, "")
      .split("/")
      .filter(Boolean)
    if (segments.length > 0) {
      const breadcrumbItems = [{ "@type": "ListItem", position: 1, name: "Home", item: "https://beorn.github.io/flexily/" }]
      for (let i = 0; i < segments.length; i++) {
        const path = segments.slice(0, i + 1).join("/")
        const name = segments[i].replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
        breadcrumbItems.push({
          "@type": "ListItem",
          position: i + 2,
          name: pageData.title && i === segments.length - 1 ? pageData.title : name,
          item: `https://beorn.github.io/flexily/${path}`,
        })
      }
      pageData.frontmatter.head.push([
        "script",
        { type: "application/ld+json" },
        JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BreadcrumbList",
          itemListElement: breadcrumbItems,
        }),
      ])
    }
  },
})

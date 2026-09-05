# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Stale flex base size for a nested row with wrapped text.** A column
  distributed its free space from a base size that was short by
  `wrapped lines - 1` rows whenever an auto-height child contained a row
  with a flexible, wrappable child. Phase 5 pre-measured the child with
  `measureNode`, which sizes a row's children at an unconstrained main
  axis, so the text reported one line and the row came back one row tall.
  The container itself ended up correct in Phase 8, but the parent had
  already handed those rows to a `flexGrow` sibling, pushing every later
  sibling down and off the frame. `measureNode` now hands the one case
  its shortcut cannot answer — a row whose children's max-content sum
  overflows a definite main size — to the real algorithm instead of
  approximating it, so the base size arrives already wrapped. Regression:
  `tests/parent-flex-base-nested-row-wrap.test.ts`.
- **Phase 7a no longer reads flex-line children through a stale alias.**
  Measuring a child there can re-enter layout (a user `measureFunc` that
  lays out another tree, or the sizing pass above); the nested pass trims
  the shared `_lineChildren` line array in place and `exitLayout` restores
  the scratch arrays by rebinding them, so an alias captured before the
  call read past the trimmed end.

## [0.7.2] - 2026-05-18

### Added

- **Pre-publish guard** (`scripts/verify-publishable.ts`): packs the
  package with `pnpm pack` and asserts (a) no TypeScript source files in
  the tarball, (b) every `exports[*]` leaf points at `./dist/`, (c)
  `dist/` is non-empty. Wired into both `release.yml` (immediately before
  `pnpm publish`) and `verify.yml` (every push to `main` + every PR), so
  regressions of the 0.7.0 broken-exports class are caught BEFORE a
  release tag rides them out. Local invocation:
  `bun scripts/verify-publishable.ts`. Tracking:
  `@km/flexily/14343-publish-guard`.

### Fixed

- No source / behavior changes from 0.7.1 — pure release-pipeline
  hardening.

## [0.7.1] - 2026-05-09

### Fixed

- **Release workflow**: 0.7.0 was published with broken `exports` (pointed to `src/*.ts` source, not `dist/*.mjs`) and an empty tarball (no `dist/` files). Root cause: `.github/workflows/release.yml` ran `npm publish` without first building (`bun run build`), so `dist/` didn't exist; and `npm publish` did not apply `publishConfig.exports` overrides on this run (loggily had been getting away with the same shape, but it's not contractually guaranteed). Fixed in two parts: (1) added `bun run build` step before publish, (2) switched to `pnpm publish --access public --no-git-checks` per the canonical convention in `vendor/CLAUDE.md` "npm Publishing" — pnpm reliably applies `publishConfig.exports`. flexily 0.7.1 is the first artifact under the corrected pipeline.
- No source / behavior changes from 0.7.0 — pure release-pipeline fix.

## [0.7.0] - 2026-05-09

### Added

- `Node.getMinContent(direction)` — recursive intrinsic min-content as a property of every node. Container min-content is derived from children (sum on main axis, max on cross axis); leaf measureFunc nodes query the measurer with `MEASURE_MODE_MIN_CONTENT`. Cached per-node alongside the existing measure cache; invalidated by `markDirty()`, `insertChild`/`removeChild`, and intrinsic-affecting style setters (padding / border / gap / flexDirection).
- `MEASURE_MODE_MIN_CONTENT` measure-mode constant — exported alongside the existing `MEASURE_MODE_UNDEFINED` / `MEASURE_MODE_EXACTLY` / `MEASURE_MODE_AT_MOST`. Required by leaf measurers that participate in the recursive min-content derivation. (The 0.6.0 release predated this export by two commits — npm consumers using `MEASURE_MODE_MIN_CONTENT` against 0.6.0 fail at build time with `MISSING_EXPORT`. 0.7.0 closes that gap.)
- Aspect-ratio transferred-size + max-content content-min approximation.
- CSS §4.5 flex-item auto min-size (item-side rule).
- `flex-basis: 0` / `flex: 1 1 0` patterns handled correctly by auto-min-size.
- CSS-vs-Yoga preset config (Phase 1, no flip — defaults still match Yoga).

### Changed

- **CSS §4.5 auto-min-size for containers**: container nodes now use spec-correct recursive min-content instead of the prior `baseSize` (max-content) approximation. `Box` wrappers around `<Text wrap="wrap">` no longer pin sibling content at the longest unbreakable word — the row shrinks to its true min-content. Includes the CSS §4.5 specified-size suggestion cap so `flexBasis: 0` / `flex: 1 1 0` Fill-leader patterns continue to behave as expected (auto-min = `min(content-min, specified-size)`). Yoga preset is unaffected. `setMinWidth(0)` remains the canonical CSS escape hatch for non-wrappable Text and for containers narrower than their longest unbreakable word.

### Fixed

- Remeasure flex-grow auto-main content when distribution changes its size.
- Respect explicit `setFlexShrink(0)` for overflow children.
- Bench compare loads source entrypoint instead of stale dist.
- Skip CI publish step when version is already on npm (idempotent re-run safety).

## [0.5.1] - 2026-04-09

### Changed

- Renamed `@bearly/vitepress-enrich` to `vitepress-enrich`

### Added

- Pretext integration guide page
- Glossary tooltip CSS for ecosystem cross-links
- Navigation submenu for Guide section

### Fixed

- VitePress build: added `vitepress-plugin-llms` and `vitepress-enrich` to docs deps (CI fix)
- Sitemap URLs, adopted vitepress-enrich for SEO
- CI: use `bunx --bun` for vitepress, drop old bun versions, remove Node 20

### Docs

- Removed km references from public docs
- Restored composable API section (pipe/createBareFlexily/plugins)
- Updated problem statement in tagline, benchmarks button, pretext link
- Bjorn → Bjørn in author references

## [0.5.0] - 2026-03-30

### Added

- **Composable engine**: `createFlexily()` batteries-included factory, `createBareFlexily()` + `pipe()` for custom plugin composition
- **TextLayoutService**: pluggable text measurement interface with prepare/layout two-phase API
- **MonospaceMeasurer**: terminal text measurement (1 char = 1 cell), default for `createFlexily()`
- **DeterministicTestMeasurer**: fixed grapheme widths (Latin 0.8, CJK 1.0, emoji 1.8) for CI-stable tests
- **PretextMeasurer**: adapter for [@chenglou/pretext](https://github.com/chenglou/pretext) proportional font measurement
- **FlexilyNode**: `setTextContent(text, style?)` and `getTextContent()` — auto-creates MeasureFunc from TextLayoutService
- 31 new tests for the composable API (1561 total)
- Full documentation: API reference, getting-started, README updated

### Changed

- `FlexilyNode` is a mixin on Node (zero overhead), not a wrapper class

## [0.3.3] - 2026-03-10

### Fixed

- **measureNode layout corruption**: `measureNode` overwrote `layout.width/height` on clean nodes during partial re-layout, causing text to bleed past card borders
- **NaN cache sentinel**: `resetLayoutCache()` used `NaN` as invalidation sentinel, but `NaN` is a legitimate "unconstrained" query — `Object.is(NaN, NaN)` caused false cache hits returning stale values. Fixed by using `-1` sentinel.
- **Fingerprint mismatch with parent override**: Auto-sized children received `NaN` as `availableWidth`, so fingerprint matched across passes even when parent's flex distribution changed their actual size. Fixed by passing actual width when flex distribution changes.

### Added

- Re-layout consistency test suite (1100+ tests) using differential oracle pattern
- Fuzz testing: 500-seed random tree generation with partial dirty marking
- Cache invalidation stress tests (100 seeds at varying root widths)
- Idempotency fuzz (200 seeds)
- Resize round-trip fuzz (200 seeds)
- Multi-step constraint sweep fuzz (100 seeds)
- `diffLayouts()` diagnostic with NaN-safe comparison for debugging
- Rich benchmark suite: TUI-realistic trees, measure functions, property diversity, incremental re-layout
- Documentation: `docs/testing.md` (test methodology), `docs/incremental-layout-bugs.md` (bug taxonomy)

### Changed

- Updated performance docs with accurate multi-scenario benchmarks (initial, incremental, no-change, resize)
- Corrected performance claims: Flexily is 1.5-2.5x faster for initial layout, 5.5x for no-change, Yoga faster for incremental re-layout

## [0.1.0] - 2026-02-06

### Added

- Core flexbox layout algorithm (direction, grow, shrink, basis)
- Alignment (justify-content, align-items, align-self, align-content)
- Spacing (gap, padding, margin, border)
- Constraints (min/max width/height)
- Measure functions for content-based sizing (e.g., text)
- Baseline functions for alignment
- Absolute positioning
- Aspect ratio support
- Flex-wrap (multi-line layouts)
- Logical edges (EDGE_START/END) with full RTL support
- Zero-allocation layout algorithm (layout-zero.ts) for high-frequency recalculation
- Classic allocating algorithm (layout.ts) for debugging and comparison
- Dirty tracking for incremental relayout
- Yoga API compatibility (41/41 comparison tests passing)
- 524 tests total
- 1.5-2.5x faster initial layout than Yoga, 5x smaller bundle, zero dependencies

[Unreleased]: https://github.com/beorn/flexily/compare/v0.5.1...HEAD
[0.5.1]: https://github.com/beorn/flexily/compare/v0.5.0...v0.5.1
[0.5.0]: https://github.com/beorn/flexily/compare/v0.3.3...v0.5.0
[0.3.3]: https://github.com/beorn/flexily/compare/v0.1.0...v0.3.3
[0.1.0]: https://github.com/beorn/flexily/releases/tag/v0.1.0

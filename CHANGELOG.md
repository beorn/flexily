# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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
- Corrected performance claims: Flexx is 1.5-2.5x faster for initial layout, 5.5x for no-change, Yoga faster for incremental re-layout

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

[0.1.0]: https://github.com/beorn/flexx/releases/tag/v0.1.0

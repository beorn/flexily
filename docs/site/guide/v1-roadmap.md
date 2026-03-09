# v1.0 Roadmap

Current version: **0.2.0**

## What 1.0 Means

A 1.0 release signals: the public API is stable, the layout algorithm is correct, performance claims are verified, and the package is published on npm for external adoption. After 1.0, breaking changes require a major version bump.

## Release Criteria

### Correctness

- [x] All Yoga compatibility tests pass (41/41)
- [x] Re-layout fuzz tests pass (1200+)
- [x] Mutation testing validates fuzz suite catches known cache mutations
- [x] All feature tests pass (~110)
- [x] Total test count: 1368 passing
- [ ] No known layout correctness bugs
- [x] Intentional Yoga divergences documented

### API Stability

- [x] Yoga-compatible API surface (same constants, same method names)
- [x] Two entry points: `flexily` (zero-alloc) and `flexily/classic` (allocating)
- [ ] API surface audit
- [ ] TypeScript declaration files build cleanly
- [ ] No planned breaking changes

### Performance

- [x] Benchmark suite exists
- [x] Performance claims documented
- [ ] Benchmark numbers verified and recorded in release notes
- [x] Bundle size measured and documented

### Packaging

- [x] `package.json` has `engines` field
- [x] `package.json` has correct `exports` map
- [x] `files` field limits published content
- [ ] Published on npm as `flexily`
- [x] MIT license

### Documentation

- [x] README with usage, performance, and API overview
- [x] API reference
- [x] Performance benchmarks and methodology
- [x] Test infrastructure and methodology
- [x] Algorithm explanation
- [x] Yoga comparison
- [ ] CHANGELOG.md

## What's NOT in 1.0

- **CSS Grid** -- Flexily is a flexbox engine
- **Text layout** -- Consumers handle text measurement via measure functions
- **Multi-thread / worker support** -- Synchronous by design
- **Browser build** -- Targets Node.js/Bun (ESM works in browsers but not a gate)

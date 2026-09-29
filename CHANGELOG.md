# Changelog

Notable changes to this package are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.0 - 2026-09-29

### Added

- `webserver/index-inject` style row: `unicode-bidi: plaintext` gives every chat text block its first-strong direction, so Persian and Arabic paragraphs lay out RTL with embedded English runs intact.
- Injected refinement script: pins `dir="rtl"` (with an inline `unicode-bidi: isolate`) on Latin-led sentences whose Hebrew/Arabic characters outnumber the Latin ones, covering English-led Persian sentences a first-character heuristic would read as LTR.
- Container pinning: chat-scoped `ul`, `ol`, and `blockquote` receive an inline `direction: rtl` so ordered-list numbers, bullets, and quote bars follow their text instead of staying on the left edge.
- Stale-pin cleanup: when streamed text changes and a block no longer qualifies, the pinned attributes are removed.
- `enabled` profile-entry configuration (`false` keeps the plugin mounted without contributing rows).
- Bundle installation for the DeepSeek Harness plugin manager: `dsh.bundle` manifest with a shipped `cordis.patch.yml` layer.

# Changelog

Notable changes to this package are documented here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the package follows [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.2.0 - 2026-10-10

### Added

- Last-strong pinning: a text block or list that opens LTR yet closes with a Persian strong character (file-labeled bullets such as `README.md: دو بخش جدید …`) is pinned `dir="rtl"`, so the bullets stay on the right even when Latin tokens outnumber the Persian letters.
- Inline-run isolation: chat-scoped `code`, `kbd`, `samp`, `var`, and `a` take their own majority direction with an inline `unicode-bidi: isolate`, so symbols such as `=`, `-`, `,`, `()`, and `[]` inside mixed code spans (for example `newest=2026-10-07, age=3 روز`) stay where they were written.
- Code-block pinning: `pre` and `pre code` are pinned to `dir="ltr"` with isolation, so code structure never inherits an RTL direction from a pinned ancestor.
- Weak-digit handling: Arabic-Indic and Persian digits (`۰`–`۹`) are excluded from the RTL counts and the strong-character scan, so a `۱.`-led Persian sentence resolves like `unicode-bidi: plaintext` and pins RTL instead of rendering LTR.

## 0.1.1 - 2026-09-29

### Fixed

- README documentation, badges, and package metadata (`repository`, `homepage`, `bugs`) for the public GitHub repository.

## 0.1.0 - 2026-09-29

### Added

- `webserver/index-inject` style row: `unicode-bidi: plaintext` gives every chat text block its first-strong direction, so Persian and Arabic paragraphs lay out RTL with embedded English runs intact.
- Injected refinement script: pins `dir="rtl"` (with an inline `unicode-bidi: isolate`) on Latin-led sentences whose Hebrew/Arabic characters outnumber the Latin ones, covering English-led Persian sentences a first-character heuristic would read as LTR.
- Container pinning: chat-scoped `ul`, `ol`, and `blockquote` receive an inline `direction: rtl` so ordered-list numbers, bullets, and quote bars follow their text instead of staying on the left edge.
- Stale-pin cleanup: when streamed text changes and a block no longer qualifies, the pinned attributes are removed.
- `enabled` profile-entry configuration (`false` keeps the plugin mounted without contributing rows).
- Bundle installation for the DeepSeek Harness plugin manager: `dsh.bundle` manifest with a shipped `cordis.patch.yml` layer.

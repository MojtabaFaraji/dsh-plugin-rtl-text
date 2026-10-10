# dsh-plugin-rtl-text

[![npm version](https://img.shields.io/npm/v/dsh-plugin-rtl-text.svg)](https://www.npmjs.com/package/dsh-plugin-rtl-text)
[![license](https://img.shields.io/npm/l/dsh-plugin-rtl-text.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-MojtabaFaraji%2Fdsh--plugin--rtl--text-blue?logo=github)](https://github.com/MojtabaFaraji/dsh-plugin-rtl-text)

A DeepSeek Harness (Cordis) plugin that fixes mixed right-to-left / left-to-right text rendering in chat messages on the Web and Desktop GUI.

When a reply mixes Persian or Arabic with English words, code, or numbers, an LTR page reorders the line: sentences read backwards, punctuation attaches to the wrong side, list numbers and bullets stay on the left edge, and quote bars sit on the wrong side. This plugin gives every chat block a direction computed from its own content — without changing a single character of message text.

## Contents

- [What it fixes](#what-it-fixes)
- [What it does not change](#what-it-does-not-change)
- [Installation](#installation)
- [How it works](#how-it-works)
- [Compatibility](#compatibility)
- [Configuration](#configuration)
- [Where is cordis.yml?](#where-is-cordisyml)
- [Troubleshooting](#troubleshooting)
- [Security and privacy](#security-and-privacy)
- [Example](#example)
- [Testing](#testing)
- [Building from source](#building-from-source)
- [Publishing a release](#publishing-a-release)
- [Package contents](#package-contents)
- [Author](#author)
- [License](#license)

## What it fixes

- Persian or Arabic paragraphs with embedded English (`سلام، how are you?`) lay out RTL, with the English runs correct inside them.
- English-led Persian sentences (`build سبز + ۴ تست پاس …`) that a first-character heuristic would read as LTR.
- Sentences that open Persian but contain many Latin technical tokens (`سطح رندر: تابع واقعی renderIndexInjections …`) — they are never flipped to LTR.
- List markers and quote bars: `ol` numbers, `ul` bullets, and `blockquote` bars move to the right together with their content.
- Inline code with mixed content (`<code>newest=2026-10-07, age=3 روز</code>`): the span is isolated with its own majority direction, so `=`, `-`, `,`, parentheses, and brackets inside code stop rearranging against the paragraph.
- Code blocks keep their structure: `pre` is pinned to LTR with isolation, so an RTL context can never scramble code — Persian comments inside render as RTL runs.
- File-labeled Persian bullets (`README.md: دو بخش جدید …`): the Latin label opens and even outweighs the Persian letters, but the sentence closes Persian — the last-strong rule keeps the list RTL with its bullets on the right.
- Existing history as well as live replies: the fix is one stylesheet row and one script, so every already-loaded conversation benefits immediately — no re-streaming.

## What it does not change

- **Message text.** The durable session log, model history, and CLI output stay byte-identical; the plugin only touches presentation.
- **Other profiles.** Headless and TUI profiles have no GUI to style — the injected rows are never collected there and the plugin is a harmless no-op.
- **Code block content.** `pre` keeps its authored LTR order (it is pinned, never rewritten) — only its `direction` context is fixed.

## Installation

The plugin is installed as a **bundle layer** into a profile — this is what actually mounts it:

```bash
# from the npm registry
pnpm dsh plugin --profile <name> add dsh-plugin-rtl-text

# from a local checkout (no registry needed)
pnpm dsh plugin --profile <name> add <path-to-this-package>
```

You can also use the GUI **Add plugin** button with the package name. A plain `pnpm add` only copies files into the profile's `node_modules`; it does not append the bundle layer, so the plugin would never mount — prefer the commands above.

Peer dependency: `@deepseek-ai/cordis` (published on npm, and already present in every Harness installation).

### Why the package declares `dsh.bundle`

The Harness plugin manager refuses packages without `dsh.bundle` with `declares no dsh.bundle`, because there would be no patch file to add to the profile's composition. This package declares:

```json
"dsh": {
  "bundle": {
    "patch": "./cordis.patch.yml"
  }
}
```

The install does three things:

1. `pnpm add`s the package into `<DSH_HOME>/profiles/<name>/` and lists it in the profile `package.json` `dependencies`.
2. Appends `dsh-plugin-rtl-text` to `dsh.profile.bundles` in the profile manifest.
3. Contributes the package's `cordis.patch.yml` as a composition layer:

```yaml
- insert:
    - id: rtl-text
      name: dsh-plugin-rtl-text
      config:
        enabled: true
```

Verify the composition with `pnpm dsh --profile <name> --dump-config` — the output contains a `== dsh-plugin-rtl-text` layer with the `id: rtl-text` entry.

### After installing into a running profile

Injected rows are collected from the **live, mounted plugin** at page load, so:

1. Remount the plugin — toggle it off and on in the GUI plugin page, or restart the host.
2. Reload the page. `index.html` is rendered per request and picks up the rows.

Updating an existing install (a new build or a new registry version) needs the same two steps.

## How it works

The Web markdown renderer deliberately keeps raw HTML inert — no HTML parser enters its pipeline — so a display fix cannot travel inside message text. Instead, the plugin uses the Harness index-injection extension point (`webserver/index-inject`, the same event `ui-theme` uses): on every page load the webserver collects injection rows and renders them into `index.html`, and this plugin appends two rows.

### The `style` row

The no-JavaScript default: each block takes its direction from its first strong character (`unicode-bidi: plaintext`), scoped to chat rows through their stable `data-chat-*` attributes:

```css
:where([data-chat-group-key],[data-chat-flow-key]) :is(p,li,h1,h2,h3,h4,h5,h6,blockquote,dd,dt,td,th,figcaption){unicode-bidi:plaintext}
```

Sentences that open in their dominant language resolve correctly with no script at all.

### The `script` row: Latin-led Persian sentences

First-strong alone reads `build سبز + ۴ تست پاس` as LTR because it opens with English. When a text block opens LTR yet strong RTL characters (Hebrew/Arabic blocks, including Arabic punctuation and diacritics) outnumber strong LTR ones (Latin/Greek/Cyrillic), the script pins `dir="rtl"` with an inline `unicode-bidi: isolate` so the explicit direction wins over the stylesheet. Sentences that open Persian are never pinned — technical Latin tokens such as `renderIndexInjections` must not flip `سطح رندر: تابع واقعی …` to LTR, so first-strong keeps them RTL. A sentence that opens with a Latin label yet closes Persian (`README.md: دو بخش جدید …`) is authored Persian: blocks and lists whose last strong character is Persian are pinned RTL too.

### Container direction: list numbers, bullets, quote bars

Markers follow the container's own `direction` property, which `unicode-bidi: plaintext` on the inner text cannot change — on an LTR page they would stay on the left edge. For chat-scoped `ul`, `ol`, and `blockquote` the script applies the full rule (RTL when the text opens Persian, closes Persian, or holds an RTL majority) and pins an inline `direction: rtl`, so a list opening `1. اولین مورد …` keeps its numbers on the right with the text. English lists stay left.

### Inline code, links, and code blocks

`=`, `-`, `,`, `(`, `)` and `[` are neutral characters: inside a paragraph they take their direction from the surrounding text, which is exactly why `newest=2026-10-07, age=3 روز` scrambled in RTL context. Chat-scoped `code`, `kbd`, `samp`, `var`, and `a` therefore take their **own majority direction** (ties fall back to first-strong) with an inline `unicode-bidi: isolate` — each becomes one coherent island whose symbols stay where they were written, and nested Persian inside Latin-majority code still renders RTL. Code blocks (`pre` and `pre code`) are pinned to `dir="ltr"` so code structure never inherits an RTL direction from a pinned ancestor. Symbols in plain text outside any element follow the paragraph direction the plugin computes; if one still looks wrong, open an issue with the exact sentence.

A `MutationObserver` reapplies every decision as streaming text grows, removes a stale pin when the text no longer qualifies, and watches text and child mutations only — attribute writes never loop.

**What is never touched:** message text itself. The durable session log, model history, and CLI output stay byte-identical, and messages already in history are fixed too because the mechanism is presentation-only.

## Compatibility

- Requires a DeepSeek Harness release that exposes `webserver/index-inject` and chat rows carrying `data-chat-group-key` / `data-chat-flow-key` — current releases do.
- Both extension points are pre-stable public APIs. When upgrading the Harness across versions, rerun `pnpm run test` and check that chat rows still carry those attributes; a Harness-side rename would need a matching selector update here.
- Applies to the Web GUI and the Desktop GUI (the same document). Headless and TUI profiles are unaffected.

## Configuration

| Field | Default | Meaning |
|-------|---------|---------|
| `enabled` | `true` | Set `false` to keep the plugin mounted without contributing rows. |

Override it in the profile's `cordis.patch.yml` with an id-targeted patch:

```yaml
- id: rtl-text
  config:
    enabled: false
```

## Where is cordis.yml?

Three different files share this name:

1. **`<profile>/cordis.yml`** — the profile's root entry list. It stays empty; the file header says to edit `cordis.patch.yml` instead.
2. **`<profile>/cordis.patch.yml`** — the profile's own patch layer (id-targeted overrides and `disabled` flags), applied *above* every bundle layer.
3. **`cordis.patch.yml` inside this package** — this plugin's bundle layer, shipped with the package and referenced by `dsh.bundle.patch`. The loader reads it when the package is installed as a bundle; you do not edit it.

## Troubleshooting

| Symptom | What to do |
|---------|-----------|
| Installed and reloaded, but nothing changed | Remount first (plugin page: off → on, or restart the host), *then* reload. Rows are collected from the live mounted plugin at page load. |
| One sentence still has the wrong direction | Heuristic limit: a nearly balanced bilingual sentence falls back to its first strong character. [Open an issue](https://github.com/MojtabaFaraji/dsh-plugin-rtl-text/issues) with the exact sentence. |
| List numbers or bullets still on the left | Confirm the reload followed the remount. If your Harness version renamed the chat row attributes, the selector needs a matching update (see [Compatibility](#compatibility)). |
| You want it off | Set `enabled: false` as shown in [Configuration](#configuration). |

## Security and privacy

- The plugin contributes two static rows — one CSS block and one inline script — built from constants inside the package. No message content is embedded, no network requests are made, and nothing is stored.
- The script reads `textContent` of chat blocks and writes `dir`/inline style on them; a `MutationObserver` only watches for new content. Nothing leaves the page.
- Because message text is never rewritten, transcripts and model history stay byte-identical.

## Example

Page direction LTR:

- Reply `سلام، how are you?`: before, the paragraph follows the page direction and runs and punctuation reappear in the wrong order; after, the direction comes from `سلام` — a full RTL line with `how are you` rendered LTR inside it.
- A list item starting `build سبز + ۴ تست پاس …`: first-strong reads the opening `build` as LTR and breaks the Persian sentence; the script counts the Persian letters as the majority and pins `dir="rtl"` for the whole block.
- `سطح رندر: تابع واقعی renderIndexInjections → style در <head> …`: first-strong already reads the opening `سطح` as RTL, so the script stays out of it — the Latin technical tokens outnumber the Persian letters, but a majority override here would wrongly flip the sentence to LTR.
- A list or quote starting with a number (`1. اولین مورد …`) or a bullet: the marker follows the container's direction, not the text's — the script pins the `ul`/`ol`/`blockquote` itself with `dir="rtl"` and an inline `direction: rtl`, so the numbers and bullets move to the right with their items.

## Testing

```bash
pnpm run test   # node:test suite against a real Cordis Context
```

The suite covers both injection rows (preserving other rows, never emitting `</script`), the pinning rules against both reported failure directions (English-led Persian forced RTL; Persian-led Latin-heavy left to first-strong), container pinning for lists and quotes (numbers, bullets, quote bars); inline-code isolation against the reported `newest=2026-10-07, age=3 روز` case; LTR code-block pinning; last-strong pinning for file-labeled Persian bullets; stale-pin removal, the `enabled: false` configuration, listener unwind on `fiber.dispose()`, and two-rows-per-collection semantics.

## Building from source

```bash
pnpm run build   # tsdown → lib/index.js + lib/index.d.ts
```

Run this inside the package directory only. The DeepSeek Harness repository root has its own monorepo `tsdown.config.ts` which expects `tsc`-emitted `lib/types/{index,invariant,startup}.js` entries; building from the repository root picks up that config instead of the package-local one and fails.

The package has no runtime dependencies, so a `pnpm install` of this package alone is not required. Building and testing need `tsdown` and `@deepseek-ai/cordis`, which resolve from an adjacent DeepSeek Harness checkout — this is where development happens.

## Publishing a release

1. Green checks: `pnpm run build` and `pnpm run test` (from a checkout inside the Harness tree, as above).
2. Inspect the tarball: `npm pack --dry-run` — expect `lib/index.js`, `lib/index.d.ts`, `cordis.patch.yml`, `README.md`, `CHANGELOG.md`, and `LICENSE`.
3. Bump `version` and add an entry to [CHANGELOG.md](CHANGELOG.md).
4. `npm login` then `npm publish` — `prepublishOnly` rebuilds `lib/` automatically.
5. Push to GitHub ([MojtabaFaraji/dsh-plugin-rtl-text](https://github.com/MojtabaFaraji/dsh-plugin-rtl-text)): the repository commits `lib/` on purpose so a plain clone works without the Harness toolchain; `.gitignore` excludes only `node_modules/`, local npm caches, tarballs, and logs.

## Package contents

| File | Purpose |
|------|---------|
| `lib/index.js` | runtime entry (`apply`) |
| `lib/index.d.ts` | type declarations (`apply`, `Config`) |
| `cordis.patch.yml` | the bundle patch layer (`dsh.bundle.patch`) |
| `README.md` | this file |
| `CHANGELOG.md` | release history |
| `LICENSE` | MIT license text |

## Author

**Mojtaba Faraji**

## License

MIT — see [LICENSE](LICENSE).

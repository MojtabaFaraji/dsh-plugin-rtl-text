import type { Context } from '@deepseek-ai/cordis';

/**
 * Profile-entry configuration for the plugin (`config` in a loader entry).
 */
export interface Config {
  /**
   * Whether the bidi rows are contributed. Set `false` to keep the plugin
   * mounted without touching index.html. Defaults to `true`.
   */
  enabled?: boolean;
}

/**
 * Chat blocks scoped through the stable `data-chat-*` attributes of chat
 * rows, and the block-level elements whose paragraph direction matters.
 * The injected script repeats this selector, so both constants change
 * together.
 */
const SCOPE = ':where([data-chat-group-key],[data-chat-flow-key])';
const BLOCKS = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,dd,dt,figcaption';

/**
 * Default direction for every text block: each paragraph takes its
 * direction from its first strong character (`unicode-bidi: plaintext`).
 * Sentences that open in their dominant language resolve correctly with no
 * script at all; the injected script only overrides the known failure cases
 * and pins the containers whose markers follow their own direction.
 */
const BIDI_CSS = `${SCOPE} :is(${BLOCKS}){unicode-bidi:plaintext}`;

/**
 * Page-side overrides for the cases the stylesheet cannot resolve.
 *
 * Latin-led Persian sentences: first-strong reads `build سبز + ۴ تست پاس` as
 * LTR because it opens with English, so when a text block opens LTR yet
 * strong RTL characters (Hebrew/Arabic blocks, including Arabic
 * punctuation and diacritics) outnumber strong LTR ones
 * (Latin/Greek/Cyrillic), the script pins `dir="rtl"`. Sentences that open
 * Persian are never pinned: technical Latin tokens such as
 * `renderIndexInjections` must not flip `سطح رندر: تابع واقعی …` to LTR.
 *
 * Container direction: list markers (`ul` bullets, `ol` numbers), quote
 * bars, and table alignment follow the container's `direction` property,
 * which `unicode-bidi: plaintext` on the inner text cannot change, so
 * chat-scoped `ul`, `ol`, `blockquote`, and `table` receive the full rule
 * (RTL when the text opens Persian, closes Persian, or holds an RTL
 * majority) with an inline `direction: rtl`. Table cells deliberately
 * stay out of the stylesheet's block list: per-cell first-strong
 * directions made mixed columns disagree, and cells now inherit one
 * direction from their table.
 *
 * Last-strong sentences: `README.md: دو بخش جدید …` opens with a Latin
 * file label and its Latin tokens outnumber the Persian letters, but it
 * closes Persian — a sentence ends in the language it was authored in, so
 * text blocks and lists that open LTR yet close RTL are pinned RTL too.
 *
 * Weak digits: Arabic-Indic and Persian digits (U+0660–U+0669, U+06F0–U+06F9)
 * are numbers, not strong characters, so the RTL ranges exclude them — a
 * `۱.`-led Persian item is read exactly as `unicode-bidi: plaintext` reads
 * it (first strong character) and pins RTL through the majority rule.
 *
 * Inline runs: `=`, `-`, `,`, parentheses, and brackets are neutral
 * characters that resolve against the surrounding paragraph, so an inline
 * `code` span such as `newest=2026-10-07, age=3 روز` interleaves inside an
 * RTL paragraph. Chat-scoped `code`, `kbd`, `samp`, `var`, and `a` instead
 * take their own majority direction (ties fall back to first-strong) with
 * an inline `unicode-bidi: isolate`, becoming one coherent island whose
 * symbols stay where they were written. Code blocks (`pre` and `pre code`)
 * are pinned to `dir="ltr"` so code structure never inherits an RTL
 * direction from a pinned ancestor; Persian comments inside render as RTL
 * runs within the LTR block.
 *
 * Blocks that do not qualify keep the stylesheet default, and a stale pin
 * is removed when the text no longer qualifies. A MutationObserver
 * reapplies every decision as streaming text grows; it watches text and
 * child mutations only, so attribute writes never loop.
 */
const BIDI_SCRIPT = `(function () {
  var blocks = '${BLOCKS}';
  var scope = '${SCOPE} ';
  var scoped = scope + blocks;
  var containers = scope + ' ul,' + scope + ' ol,' + scope + ' blockquote,' + scope + ' table';
  var inlines = scope + ' code,' + scope + ' kbd,' + scope + ' samp,' + scope + ' var,' + scope + ' a';
  var pres = scope + ' pre,' + scope + ' pre code';
  var all = scoped + ',' + containers + ',' + inlines + ',' + pres;
  // Arabic-Indic and Persian digits (۰-۹) are weak, not strong: excluded like ASCII digits.
  var rtlChars = /[\u0590-\u05FF\u0600-\u065F\u066A-\u06EF\u06FA-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g;
  var ltrChars = /[\\p{Script=Latin}\\p{Script=Greek}\\p{Script=Cyrillic}]/gu;
  var strongTest = /[\u0590-\u05FF\u0600-\u065F\u066A-\u06EF\u06FA-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF\\p{Script=Latin}\\p{Script=Greek}\\p{Script=Cyrillic}]/u;
  var rtlTest = /[\u0590-\u05FF\u0600-\u065F\u066A-\u06EF\u06FA-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
  var ltrTest = /[\\p{Script=Latin}\\p{Script=Greek}\\p{Script=Cyrillic}]/u;
  function firstStrongSide(text) {
    var index = text.search(strongTest);
    return index < 0 ? '' : rtlTest.test(text.charAt(index)) ? 'rtl' : 'ltr';
  }
  function lastStrongSide(text) {
    for (var i = text.length - 1; i >= 0; i--) {
      var char = text.charAt(i);
      if (rtlTest.test(char)) return 'rtl';
      if (ltrTest.test(char)) return 'ltr';
    }
    return '';
  }
  function counts(text) {
    return {
      rtl: (text.match(rtlChars) || []).length,
      ltr: (text.match(ltrChars) || []).length
    };
  }
  function forcesRtl(text, isContainer) {
    var count = counts(text);
    if (!count.rtl) return false;
    var first = firstStrongSide(text);
    var last = lastStrongSide(text);
    if (isContainer) return first === 'rtl' || count.rtl > count.ltr || last === 'rtl';
    return first === 'ltr' && (count.rtl > count.ltr || last === 'rtl');
  }
  function majorityDir(text) {
    var count = counts(text);
    if (count.rtl === count.ltr) return firstStrongSide(text);
    return count.rtl > count.ltr ? 'rtl' : 'ltr';
  }
  function directionFor(el) {
    if (el.matches(pres)) return 'ltr';
    var text = el.textContent || '';
    if (el.matches(inlines)) return majorityDir(text);
    if (el.matches(containers)) return forcesRtl(text, true) ? 'rtl' : '';
    return forcesRtl(text, false) ? 'rtl' : '';
  }
  function apply(el) {
    var want = directionFor(el);
    var ours = el.style.unicodeBidi === 'isolate' && (el.getAttribute('dir') === 'rtl' || el.getAttribute('dir') === 'ltr');
    if (want) {
      el.setAttribute('dir', want);
      el.style.unicodeBidi = 'isolate';
      el.style.direction = want;
    } else if (ours) {
      el.removeAttribute('dir');
      el.style.unicodeBidi = '';
      el.style.direction = '';
    }
  }
  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches(scoped) || node.matches(containers) || node.matches(inlines) || node.matches(pres)) apply(node);
    var list = node.querySelectorAll(all);
    for (var i = 0; i < list.length; i++) apply(list[i]);
  }
  function scanText(textNode) {
    if (textNode && textNode.parentNode) scan(textNode.parentNode);
  }
  scan(document.body);
  new MutationObserver(function (records) {
    for (var i = 0; i < records.length; i++) {
      var record = records[i];
      if (record.type === 'characterData') {
        scanText(record.target);
        continue;
      }
      for (var j = 0; j < record.addedNodes.length; j++) scan(record.addedNodes[j]);
    }
  }).observe(document.documentElement, { subtree: true, childList: true, characterData: true });
})();`;

/**
 * Mount the RTL text fix on a DeepSeek Harness context.
 *
 * The Web markdown renderer deliberately keeps raw HTML inert (no HTML
 * parser enters its pipeline), so a display fix must reach the page as
 * index content: on `webserver/index-inject` — the same event `ui-theme`
 * uses — this plugin appends a `style` row (first-strong default) and a
 * `script` row (RTL overrides for Latin-led Persian sentences, list and
 * quote containers, inline code isolation, and LTR code blocks) that the
 * webserver renders into index.html on every page load. Message text itself
 * stays untouched, so the durable session log and model history remain
 * byte-identical.
 *
 * @param ctx - Cordis context that owns the listener effect.
 * @param config - loader-entry configuration; see {@link Config}.
 * @returns nothing; the `ctx.on` registration is tracked as the effect.
 */
export function apply(ctx: Context, config: Config = {}): void {
  if (config.enabled === false) return;
  ctx.on(
    'webserver/index-inject',
    (table: Array<Record<string, unknown> & { kind: string }>) => {
      table.push({ kind: 'style', text: BIDI_CSS });
      table.push({ kind: 'script', placement: 'body', text: BIDI_SCRIPT });
    },
    { prepend: true },
  );
}

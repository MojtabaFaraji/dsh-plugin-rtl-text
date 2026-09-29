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
const BLOCKS = 'p,li,h1,h2,h3,h4,h5,h6,blockquote,dd,dt,td,th,figcaption';

/**
 * Default direction for every text block: each paragraph takes its
 * direction from its first strong character (`unicode-bidi: plaintext`).
 * Sentences that open in their dominant language resolve correctly with no
 * script at all; the injected script only overrides the known failure case
 * and pins the containers whose markers follow their own direction.
 */
const BIDI_CSS = `${SCOPE} :is(${BLOCKS}){unicode-bidi:plaintext}`;

/**
 * Page-side overrides for the two cases the stylesheet cannot resolve.
 *
 * First, Latin-led Persian sentences: first-strong reads
 * `build سبز + ۴ تست پاس` as LTR because it opens with English, so when a
 * text block opens LTR yet strong RTL characters (Hebrew/Arabic blocks,
 * including Arabic punctuation and diacritics) outnumber strong LTR ones
 * (Latin/Greek/Cyrillic), the script pins `dir="rtl"` with an inline
 * `unicode-bidi: isolate` so the explicit direction wins over the
 * stylesheet's `plaintext`. Sentences that open Persian are never pinned:
 * technical Latin tokens such as `renderIndexInjections` must not flip
 * `سطح رندر: تابع واقعی …` to LTR.
 *
 * Second, container direction: list markers (`ul` bullets, `ol` numbers)
 * and quote bars follow the container's `direction` property, which
 * `unicode-bidi: plaintext` on the inner text cannot change — on an LTR
 * page they would stay on the left edge. For chat-scoped `ul`, `ol`, and
 * `blockquote` the script therefore applies the full rule (first-strong
 * RTL, or RTL majority regardless of the opening character) and pins an
 * inline `direction: rtl` alongside `dir`. Blocks that do not qualify keep
 * the stylesheet default, and a stale pin is removed when the text no
 * longer qualifies. A MutationObserver reapplies the decision as streaming
 * text grows; it watches text and child mutations only, so attribute
 * writes never loop.
 */
const BIDI_SCRIPT = `(function () {
  var blocks = '${BLOCKS}';
  var scope = '${SCOPE} ';
  var scoped = scope + blocks;
  var lists = scope + ' ul,' + scope + ' ol,' + scope + ' blockquote';
  var rtlChars = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/g;
  var ltrChars = /[\\p{Script=Latin}\\p{Script=Greek}\\p{Script=Cyrillic}]/gu;
  var strongTest = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF\\p{Script=Latin}\\p{Script=Greek}\\p{Script=Cyrillic}]/u;
  var rtlTest = /[\u0590-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;
  function firstStrongSide(text) {
    var index = text.search(strongTest);
    return index < 0 ? '' : rtlTest.test(text.charAt(index)) ? 'rtl' : 'ltr';
  }
  function forcesRtl(text, isContainer) {
    var rtl = (text.match(rtlChars) || []).length;
    if (!rtl) return false;
    var ltr = (text.match(ltrChars) || []).length;
    var first = firstStrongSide(text);
    return isContainer ? first === 'rtl' || rtl > ltr : rtl > ltr && first === 'ltr';
  }
  function apply(el) {
    var pinned = el.getAttribute('dir') === 'rtl' && el.style.unicodeBidi === 'isolate';
    if (forcesRtl(el.textContent || '', el.matches(lists))) {
      el.setAttribute('dir', 'rtl');
      el.style.unicodeBidi = 'isolate';
      el.style.direction = 'rtl';
    } else if (pinned) {
      el.removeAttribute('dir');
      el.style.unicodeBidi = '';
      el.style.direction = '';
    }
  }
  function scan(node) {
    if (!node || node.nodeType !== 1) return;
    if (node.matches(scoped) || node.matches(lists)) apply(node);
    var list = node.querySelectorAll(scoped + ',' + lists);
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
 * `script` row (RTL overrides for Latin-led Persian sentences and for list
 * and quote containers) that the webserver renders into index.html on every
 * page load. Message text itself stays untouched, so the durable session
 * log and model history remain byte-identical.
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

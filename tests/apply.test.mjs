import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Context } from '@deepseek-ai/cordis';
import { apply } from '../lib/index.js';

/** Matchers mirroring the script's selector tiers. */
const TIER_MATCHERS = {
  list: (selector) => selector.includes(' ul,'),
  inline: (selector) => selector.includes(' code,'),
  pre: (selector) => selector.includes(' pre'),
};

/**
 * A chat block stand-in the injected script can read and pin.
 * @param {string} text - the block's textContent.
 * @param {'list'|'inline'|'pre'} [tier] - which selector tier to match.
 */
function fakeBlock(text, tier) {
  const matcher = tier ? TIER_MATCHERS[tier] : null;
  return {
    nodeType: 1,
    textContent: text,
    style: {},
    attrs: {},
    getAttribute(key) { return key in this.attrs ? this.attrs[key] : null; },
    setAttribute(key, value) { this.attrs[key] = value; },
    removeAttribute(key) { delete this.attrs[key]; },
    matches(selector) { return matcher ? matcher(selector) : false; },
    querySelectorAll() { return []; },
  };
}

/**
 * Run the injected script against a minimal fake DOM.
 * @param {string} scriptText - the script row's text.
 * @param {(string | { text: string, tier?: 'list'|'inline'|'pre' })[]} texts - blocks: a bare string is a plain text block.
 * @returns {{ elements: object[], run: () => void }} blocks and a re-run handle.
 */
function scriptHarness(scriptText, texts) {
  const elements = texts.map((entry) =>
    typeof entry === 'string' ? fakeBlock(entry) : fakeBlock(entry.text, entry.tier ?? 'list'));
  const run = () => {
    const previousDocument = globalThis.document;
    const previousObserver = globalThis.MutationObserver;
    globalThis.document = {
      body: {
        nodeType: 1,
        matches() { return false; },
        querySelectorAll() { return elements; },
      },
      documentElement: {},
    };
    globalThis.MutationObserver = class { observe() {} };
    try {
      new Function(scriptText)();
    } finally {
      if (previousDocument === undefined) delete globalThis.document;
      else globalThis.document = previousDocument;
      if (previousObserver === undefined) delete globalThis.MutationObserver;
      else globalThis.MutationObserver = previousObserver;
    }
  };
  return { elements, run };
}

/** Collect the plugin's rows through a real Cordis context. */
async function collectedRows(config) {
  const ctx = new Context();
  await ctx.plugin(apply, config);
  const table = [{ kind: 'global', name: 'existing', value: 1 }];
  ctx.emit('webserver/index-inject', table);
  return table;
}

// English opens the sentence, but Persian letters outnumber the Latin ones.
const ENGLISH_LED_PERSIAN = 'build سبز + ۴ تست پاس روی Context واقعی: ساختِ style row بدون دست زدن به ردیف\u200cهای دیگر، enabled: false، جمع\u200cشدن listener با dispose، و «یک ردیف به ازای هر collect».';
// Persian opens the sentence; Latin technical tokens outnumber its letters.
const PERSIAN_LED_LATIN_HEAVY = 'سطح رندر: تابع واقعی renderIndexInjections → style در <head>، script بعد از <body> — خروجی: OK render: style in head, script in body.';
const PLAIN_ENGLISH = 'The quick brown fox jumps over the lazy dog.';
const PLAIN_PERSIAN = 'سلام دنیا، این یک جمله‌ی ساده فارسی است.';
// A code span mixing Latin assignments with a Persian word (reported).
const CODE_MIXED = 'newest=2026-10-07, age=3 روز';
const CODE_PERSIAN = 'کد test را در محیط فارسی اجرا کنید';
const CODE_BLOCK = 'const age = 3; // روز جاری';
// File-labeled Persian list items: Latin labels open and outnumber the
// Persian letters, but the sentences close Persian (reported).
const BULLET_README = 'README.md: دو بخش جدید در «What it fixes»، بخش جدید «Inline code, links, and code blocks» در How it works، اصلاح بخش Code blocks در «What it does not change»، و پوشش تست‌های جدید.';
const BULLET_CHANGELOG = 'CHANGELOG.md: دو بند جدید در 0.1.0.';
// Arabic-Indic digits are weak in Unicode; the RTL ranges exclude them so
// this digit-led Persian sentence pins RTL through the majority rule (reported).
const DIGIT_LED = '۱. push به GitHub: تلاش من دو بار به‌دلیلِ عدم دسترسیِ sandbox به credential helper های git شکست خورد (و approval هم پاسخ نگرفت)، پس مخزن هنوز ahead 1 است:';

describe('dsh-plugin-rtl-text on a real Cordis context', () => {
  it('appends style and script rows when the webserver collects injections', async () => {
    const table = await collectedRows();

    assert.equal(table.length, 3, 'existing row is preserved and two rows are added');
    assert.equal(table[0].kind, 'global');

    const style = table[1];
    assert.equal(style.kind, 'style');
    assert.match(style.text, /unicode-bidi:\s*plaintext/);
    assert.match(style.text, /data-chat-group-key/);
    assert.match(style.text, /data-chat-flow-key/);
    assert.match(style.text, /\bli\b/);

    const script = table.find((row) => row.kind === 'script');
    assert.equal(script.placement, 'body');
    assert.ok(script.text.includes('MutationObserver'), 'refines direction reactively');
    assert.ok(script.text.includes('setAttribute'), 'can pin an explicit dir');
    assert.ok(script.text.includes('unicodeBidi'), 'pins the inline isolation');
    assert.ok(!script.text.includes('</script'), 'never closes the rendered script element');
  });

  it('pins only Latin-led Persian sentences; first-strong cases stay with the CSS', async () => {
    const table = await collectedRows();
    const scriptText = table.find((row) => row.kind === 'script').text;
    const harness = scriptHarness(scriptText, [
      ENGLISH_LED_PERSIAN,
      PERSIAN_LED_LATIN_HEAVY,
      PLAIN_ENGLISH,
      PLAIN_PERSIAN,
    ]);
    harness.run();
    const [englishLed, persianLed, plainEnglish, plainPersian] = harness.elements;

    assert.equal(englishLed.attrs.dir, 'rtl', 'English-led Persian majority is forced RTL');
    assert.equal(englishLed.style.unicodeBidi, 'isolate', 'the pin overrides the stylesheet');
    assert.equal(persianLed.attrs.dir, undefined, 'Persian-first stays first-strong despite Latin-heavy content');
    assert.equal(plainEnglish.attrs.dir, undefined, 'plain English is untouched');
    assert.equal(plainPersian.attrs.dir, undefined, 'plain Persian is untouched');
  });

  it('removes a stale pin once the text no longer qualifies', async () => {
    const table = await collectedRows();
    const scriptText = table.find((row) => row.kind === 'script').text;
    const harness = scriptHarness(scriptText, [ENGLISH_LED_PERSIAN]);
    harness.run();
    assert.equal(harness.elements[0].attrs.dir, 'rtl');

    harness.elements[0].textContent = 'plain english text only';
    harness.run();

    assert.equal(harness.elements[0].attrs.dir, undefined, 'stale dir is removed');
    assert.equal(harness.elements[0].style.unicodeBidi, '', 'stale isolation is cleared');
  });

  it('pins list and quote containers so markers follow the text', async () => {
    const table = await collectedRows();
    const scriptText = table.find((row) => row.kind === 'script').text;
    const harness = scriptHarness(scriptText, [
      { text: '1. اولین مورد، دومین مورد و سومین مورد این لیست فارسی است' },
      { text: '«سلام» گفت و رفت و همه چیز خوب پیش رفت' },
      { text: 'Install the package, then run the build and test scripts' },
    ]);
    harness.run();
    const [numberedList, quote, englishList] = harness.elements;

    assert.equal(numberedList.attrs.dir, 'rtl', 'a list opening with a number still moves right');
    assert.equal(numberedList.style.direction, 'rtl', 'markers follow the inline direction property');
    assert.equal(numberedList.style.unicodeBidi, 'isolate');
    assert.equal(quote.attrs.dir, 'rtl', 'quote containers move their bar to the right');
    assert.equal(englishList.attrs.dir, undefined, 'English lists stay on the left');
  });

  it('treats Arabic-Indic digits as weak, so digit-led Persian pins RTL', async () => {
    const table = await collectedRows();
    const scriptText = table.find((row) => row.kind === 'script').text;
    const harness = scriptHarness(scriptText, [DIGIT_LED]);
    harness.run();

    assert.equal(harness.elements[0].attrs.dir, 'rtl', 'the leading ۱ is weak, so the first strong character is Latin and the RTL majority pins the block');
    assert.equal(harness.elements[0].style.unicodeBidi, 'isolate');
  });

  it('keeps file-labeled Persian lists RTL through the last-strong clause', async () => {
    const table = await collectedRows();
    const scriptText = table.find((row) => row.kind === 'script').text;
    const harness = scriptHarness(scriptText, [
      { text: BULLET_README + '\n' + BULLET_CHANGELOG, tier: 'list' },
      { text: BULLET_README },
      { text: BULLET_CHANGELOG },
    ]);
    harness.run();
    const [list, readmeItem, changelogItem] = harness.elements;

    assert.equal(list.attrs.dir, 'rtl', 'the list stays RTL so its bullets stay on the right');
    assert.equal(readmeItem.attrs.dir, 'rtl', 'the item opens Latin but closes Persian');
    assert.equal(changelogItem.attrs.dir, 'rtl', 'digits are not strong, so the last strong character is Persian');
  });

  it('isolates inline code with its own majority direction', async () => {
    const table = await collectedRows();
    const scriptText = table.find((row) => row.kind === 'script').text;
    const harness = scriptHarness(scriptText, [
      { text: CODE_MIXED, tier: 'inline' },
      { text: CODE_PERSIAN, tier: 'inline' },
    ]);
    harness.run();
    const [latinLed, persianLed] = harness.elements;

    assert.equal(latinLed.attrs.dir, 'ltr', 'Latin-majority code stays a coherent LTR island');
    assert.equal(latinLed.style.unicodeBidi, 'isolate', 'neutrals inside the span stop resolving against the paragraph');
    assert.equal(latinLed.style.direction, 'ltr');
    assert.equal(persianLed.attrs.dir, 'rtl', 'Persian-majority code takes RTL');
  });

  it('pins code blocks to LTR so they never inherit an RTL direction', async () => {
    const table = await collectedRows();
    const scriptText = table.find((row) => row.kind === 'script').text;
    const harness = scriptHarness(scriptText, [{ text: CODE_BLOCK, tier: 'pre' }]);
    harness.run();

    assert.equal(harness.elements[0].attrs.dir, 'ltr');
    assert.equal(harness.elements[0].style.unicodeBidi, 'isolate');
    assert.equal(harness.elements[0].style.direction, 'ltr');
  });

  it('leaves the table untouched when the profile entry disables it', async () => {
    const ctx = new Context();
    await ctx.plugin(apply, { enabled: false });

    const table = [];
    ctx.emit('webserver/index-inject', table);

    assert.equal(table.length, 0);
  });

  it('unwinds its listener when the plugin fiber is disposed', async () => {
    const ctx = new Context();
    const fiber = await ctx.plugin(apply);
    await fiber.dispose();

    const table = [];
    ctx.emit('webserver/index-inject', table);

    assert.equal(table.length, 0);
  });

  it('contributes exactly two rows per collection', async () => {
    const ctx = new Context();
    await ctx.plugin(apply);

    const table = [];
    ctx.emit('webserver/index-inject', table);
    ctx.emit('webserver/index-inject', table);

    assert.equal(table.length, 4, 'one style + one script per emit');
    assert.equal(table[0].text, table[2].text);
    assert.equal(table[1].text, table[3].text);
  });
});

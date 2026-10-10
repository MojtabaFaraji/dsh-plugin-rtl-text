import { Context } from "@deepseek-ai/cordis";

//#region src/index.d.ts
/**
 * Profile-entry configuration for the plugin (`config` in a loader entry).
 */
interface Config {
  /**
   * Whether the bidi rows are contributed. Set `false` to keep the plugin
   * mounted without touching index.html. Defaults to `true`.
   */
  enabled?: boolean;
}
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
declare function apply(ctx: Context, config?: Config): void;
//#endregion
export { Config, apply };
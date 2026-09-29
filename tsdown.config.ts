// Package-local tsdown config – builds ONLY this package.
// NOTE: do NOT import anything from 'tsdown' here; a plain object export is valid.
// This file must stay valid so tsdown never falls back to the harness root config
// (which expects tsc-emitted lib/types/{index,invariant,startup}.js entries).
export default {
  entry: ['./src/index.ts'],
  outDir: './lib',
  format: ['esm'],
  dts: true,
  platform: 'node',
  // Emit .js/.d.ts (not .mjs/.d.mts) so package.json main/exports match.
  fixedExtension: false,
  clean: true,
};

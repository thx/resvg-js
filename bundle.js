// @ts-check
const { buildSync } = require('esbuild')

/** @type {import('esbuild').BuildOptions} */
const commonOptions = {
  bundle: true,
  logLevel: 'error',
  entryPoints: ['wasm-binding.ts'],
  define: { 'import.meta.url': 'undefined' },
}

buildSync({
  ...commonOptions,
  format: 'cjs',
  outfile: 'wasm-simd/index.js',
})
buildSync({
  ...commonOptions,
  format: 'esm',
  outfile: 'wasm-simd/index.mjs',
})
buildSync({
  ...commonOptions,
  format: 'iife',
  minify: true,
  globalName: 'resvg',
  outfile: 'wasm-simd/index.min.js',
})

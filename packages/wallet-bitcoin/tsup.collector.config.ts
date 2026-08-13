import { defineConfig } from 'tsup'

export default defineConfig({
  entry: { bulletin: 'collector/main.ts' },
  format: ['iife'],
  dts: false,
  splitting: false,
  sourcemap: false,
  clean: false,
  outDir: 'collector/build',
  globalName: 'P2wshMultisigBulletin',
  target: 'es2020',
  tsconfig: './tsconfig.json',
  noExternal: [/.*/]
})

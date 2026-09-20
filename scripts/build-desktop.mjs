import { mkdir, copyFile } from 'node:fs/promises';

import { build } from 'esbuild';
await mkdir('desktop-build', { recursive: true });
await build({
  entryPoints: ['desktop/main.ts'],
  outfile: 'desktop-build/main.cjs',
  bundle: true,
  platform: 'node',
  target: 'node24',
  external: ['electron'],
  format: 'cjs',
});
await copyFile('desktop/preload.cjs', 'desktop-build/preload.cjs');

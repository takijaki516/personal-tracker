import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';

await mkdir('desktop-build', { recursive: true });
const output = resolve('desktop-build/web-dev.cjs');
await build({
  entryPoints: ['desktop/web-dev.ts'],
  outfile: output,
  bundle: true,
  platform: 'node',
  target: 'node24',
  format: 'cjs',
});
await import(pathToFileURL(output).href);

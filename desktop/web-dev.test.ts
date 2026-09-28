import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createFoodSearchServer } from './food-search-server';

let directory: string;
let bundle: string;
const servers: Server[] = [];

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'web-dev-test-'));
  bundle = join(directory, 'web-dev.cjs');
  await build({
    entryPoints: ['desktop/web-dev.ts'],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
  });
  const bin = join(directory, 'node_modules/expo/bin');
  await mkdir(bin, { recursive: true });
  // A local CLI stand-in checks the server while the parent command is running.
  await writeFile(
    join(bin, 'cli'),
    `fetch(process.env.EXPO_PUBLIC_FOOD_SEARCH_URL + '/health').then(async (response) => {
      process.stdout.write(JSON.stringify({ url: process.env.EXPO_PUBLIC_FOOD_SEARCH_URL, health: await response.json() }) + '\\nEXPO_READY\\n');
      if (process.argv.includes('--wait')) {
        const timer = setInterval(() => {}, 1000);
        process.once('SIGTERM', () => clearInterval(timer));
      } else if (process.argv.includes('--fail')) {
        process.exitCode = 2;
      }
    }).catch((error) => { console.error(error); process.exitCode = 1; });`,
  );
});

afterAll(async () => {
  await rm(directory, {
    recursive: true,
    force: true,
  });
});

afterEach(async () => {
  await Promise.all(
    servers
      .splice(0)
      .filter((server) => server.listening)
      .map(
        (server) =>
          new Promise<void>((resolve, reject) => {
            server.close((error) => (error ? reject(error) : resolve()));
            server.closeAllConnections();
          }),
      ),
  );
});

async function listen(server: Server) {
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not bind a port');
  }
  return address.port;
}

async function unusedPort() {
  const probe = createServer();
  const port = await listen(probe);
  await new Promise<void>((resolve) => probe.close(() => resolve()));
  return port;
}

function run(port: number, args: string[] = []) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    const child = execFile(
      process.execPath,
      [bundle, ...args],
      {
        cwd: directory,
        env: {
          ...process.env,
          FOOD_SEARCH_PORT: String(port),
        },
        timeout: 5000,
      },
      (error, stdout, stderr) => {
        const code = error ? error.code : 0;
        if (typeof code !== 'number') {
          reject(error);
          return;
        }
        resolve({
          code,
          stdout,
          stderr,
        });
      },
    );
    let output = '';
    child.stdout?.on('data', (chunk: string) => {
      output += chunk;
      if (args.includes('--wait') && output.includes('EXPO_READY')) {
        child.kill('SIGTERM');
      }
    });
  });
}

describe('web development command', () => {
  it.each([
    {
      name: 'normal Expo exit',
      args: [],
      code: 0,
    },
    {
      name: 'Expo failure',
      args: ['--fail'],
      code: 2,
    },
    {
      name: 'termination',
      args: ['--wait'],
      code: 0,
    },
  ])('starts the food server and closes it after $name', async ({ args, code }) => {
    const port = await unusedPort();
    const result = await run(port, args);
    expect(result.code).toBe(code);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain(`http://127.0.0.1:${port}`);
    expect(result.stdout).toContain('"source":"fatsecret-html"');
    await expect(fetch(`http://127.0.0.1:${port}/health`)).rejects.toThrow('fetch failed');
  });

  it('keeps a separately started lookup server running after Expo exits', async () => {
    const server = createFoodSearchServer();
    const port = await listen(server);
    const result = await run(port);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain('이미 실행 중입니다');
    expect(server.listening).toBe(true);
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(health.status).toBe(200);
  });
});

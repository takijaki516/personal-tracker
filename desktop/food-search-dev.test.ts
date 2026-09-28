import { execFile } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'esbuild';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';
import { createFoodSearchServer } from './food-search-server';

const servers: Server[] = [];
let directory: string;
let bundle: string;

beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), 'food-search-dev-test-'));
  bundle = join(directory, 'food-search-dev.cjs');
  await build({
    entryPoints: ['desktop/food-search-dev.ts'],
    outfile: bundle,
    bundle: true,
    platform: 'node',
    target: 'node24',
    format: 'cjs',
  });
});

afterAll(async () => {
  await rm(directory, {
    recursive: true,
    force: true,
  });
});

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
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

function run(port: number) {
  return new Promise<{ code: number; stdout: string; stderr: string }>((resolve, reject) => {
    execFile(
      process.execPath,
      [bundle],
      {
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
  });
}

describe('food lookup development command', () => {
  it('reuses a healthy food server without shutting it down', async () => {
    const port = await listen(createFoodSearchServer());
    const result = await run(port);
    expect(result.code).toBe(0);
    expect(result.stderr).toBe('');
    expect(result.stdout).toContain(`이미 실행 중입니다: http://127.0.0.1:${port}`);
    expect(result.stdout).toContain('Ctrl+C');
    const health = await fetch(`http://127.0.0.1:${port}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({
      ok: true,
      source: 'fatsecret-html',
    });
  });

  it.each([
    {
      name: 'another service',
      status: 200,
      body: '{"ok":true,"source":"other-service"}',
    },
    {
      name: 'an unhealthy food server',
      status: 200,
      body: '{"ok":false,"source":"fatsecret-html"}',
    },
    {
      name: 'a failed health check',
      status: 503,
      body: '{"ok":true,"source":"fatsecret-html"}',
    },
    {
      name: 'an HTML response',
      status: 200,
      body: '<html>Other app</html>',
    },
  ])('reports the conflict and an alternative port for $name', async ({ status, body }) => {
    const server = createServer((_request, response) => {
      response.writeHead(status).end(body);
    });
    const port = await listen(server);
    const result = await run(port);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain(`127.0.0.1:${port} 포트가 사용 중`);
    expect(result.stderr).toContain(`lsof -nP -iTCP:${port} -sTCP:LISTEN`);
    expect(result.stderr).toContain('FOOD_SEARCH_PORT=8090 npm run food-search:dev');
    expect(server.listening).toBe(true);
  });

  it('times out when the occupied port does not answer health checks', async () => {
    const server = createServer();
    const port = await listen(server);
    const result = await run(port);
    expect(result.code).toBe(1);
    expect(result.stdout).toBe('');
    expect(result.stderr).toContain('정상 음식 조회 서버를 확인하지 못했습니다');
    expect(server.listening).toBe(true);
  });
});

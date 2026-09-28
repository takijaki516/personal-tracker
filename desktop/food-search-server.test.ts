import { once } from 'node:events';
import { readFileSync } from 'node:fs';
import type { Server } from 'node:http';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FoodSearchError } from '../src/infrastructure/food-search-error';
import { createFatSecretSearch } from './food-search-client';
import { createFoodSearchServer } from './food-search-server';

const servers: Server[] = [];
const html = readFileSync(
  new URL('../src/infrastructure/fixtures/fatsecret-search.html', import.meta.url),
  'utf8',
);

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

async function start(search?: Parameters<typeof createFoodSearchServer>[0]) {
  const server = createFoodSearchServer(search);
  servers.push(server);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Test server did not bind a port');
  }
  return `http://127.0.0.1:${address.port}`;
}

describe('local food lookup HTTP server', () => {
  it('returns parsed JSON to the development browser with the correct CORS origin', async () => {
    const fetchPage = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(html, { headers: { 'Content-Type': 'text/html' } }));
    const base = await start(createFatSecretSearch(fetchPage));
    const url = new URL('/foods/search', base);
    url.searchParams.set('q', '닭가슴살');
    const response = await fetch(url, { headers: { Origin: 'http://localhost:8081' } });
    const body: unknown = await response.json();
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('http://localhost:8081');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(body).toMatchObject({
      query: '닭가슴살',
      foods: [
        {
          name: '샘플 닭가슴살',
          servingGrams: 100,
          carbohydrates: 0,
        },
        {
          brand: '샘플브랜드',
          servingGrams: 110,
        },
      ],
    });
  });

  it('supports health checks and browser preflight without requesting FatSecret', async () => {
    const search = vi.fn<NonNullable<Parameters<typeof createFoodSearchServer>[0]>>();
    const base = await start(search);
    const health = await fetch(`${base}/health`);
    expect(health.status).toBe(200);
    expect(await health.json()).toEqual({
      ok: true,
      source: 'fatsecret-html',
    });
    const preflight = await fetch(`${base}/foods/search`, {
      method: 'OPTIONS',
      headers: { Origin: 'http://127.0.0.1:8081' },
    });
    expect(preflight.status).toBe(204);
    expect(preflight.headers.get('access-control-allow-methods')).toBe('GET, OPTIONS');
    expect(preflight.headers.get('access-control-allow-origin')).toBe('http://127.0.0.1:8081');
    expect(search).not.toHaveBeenCalled();
  });

  it('cancels the upstream request when the browser disconnects during a search', async () => {
    const upstream = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Cancelled', 'AbortError')),
            { once: true },
          );
        }),
    );
    const base = await start(createFatSecretSearch(upstream));
    const controller = new AbortController();
    const result = fetch(`${base}/foods/search?q=rice`, { signal: controller.signal }).catch(
      (error: unknown) => error,
    );
    await vi.waitFor(() => expect(upstream).toHaveBeenCalledTimes(1));
    controller.abort();
    expect(await result).toMatchObject({ name: 'AbortError' });
    await vi.waitFor(() => expect(upstream.mock.calls[0][1]?.signal?.aborted).toBe(true));
  });

  it('rejects invalid queries, unrelated routes, writes and unexpected browser origins', async () => {
    const search = vi.fn<NonNullable<Parameters<typeof createFoodSearchServer>[0]>>();
    const base = await start(search);
    expect((await fetch(`${base}/foods/search?q=`)).status).toBe(400);
    expect((await fetch(`${base}/foods/search?q=${'x'.repeat(101)}`)).status).toBe(400);
    expect((await fetch(`${base}/not-supported`)).status).toBe(404);
    expect((await fetch(`${base}/foods/search?q=rice`, { method: 'POST' })).status).toBe(405);
    const rejected = await fetch(`${base}/foods/search?q=rice`, {
      headers: { Origin: 'https://other.test' },
    });
    expect(rejected.status).toBe(403);
    expect(rejected.headers.get('access-control-allow-origin')).toBeNull();
    expect(search).not.toHaveBeenCalled();
  });

  it.each([
    {
      code: 'invalid-page',
      status: 502,
    },
    {
      code: 'upstream-http',
      status: 502,
    },
    {
      code: 'upstream-network',
      status: 502,
    },
    {
      code: 'upstream-timeout',
      status: 504,
    },
  ] as const)('returns a clear error for $code', async ({ code, status }) => {
    const base = await start(async () => {
      throw new FoodSearchError(code, '조회 실패');
    });
    const response = await fetch(`${base}/foods/search?q=rice`);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({
      error: {
        code,
        message: '조회 실패',
      },
    });
  });
});

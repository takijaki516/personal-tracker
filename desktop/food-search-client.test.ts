import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { createFatSecretSearch, MAX_FOOD_SEARCH_HTML_BYTES } from './food-search-client';

const html = readFileSync(
  new URL('../src/infrastructure/fixtures/fatsecret-search.html', import.meta.url),
  'utf8',
);
const htmlResponse = (body = html) =>
  new Response(body, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });

describe('FatSecret HTML lookup client', () => {
  it('encodes a Korean query as one parameter and returns validated food data', async () => {
    const fetchPage = vi.fn<typeof fetch>().mockResolvedValue(htmlResponse());
    const response = await createFatSecretSearch(fetchPage)(' 닭가슴살 & 요거트 ');
    const url = new URL(String(fetchPage.mock.calls[0][0]));
    expect(url.origin).toBe('https://www.fatsecret.kr');
    expect(decodeURIComponent(url.pathname)).toBe('/칼로리-영양소/search');
    expect(url.searchParams.get('q')).toBe('닭가슴살 & 요거트');
    expect(url.searchParams.size).toBe(1);
    expect(fetchPage.mock.calls[0][1]?.redirect).toBe('error');
    expect(response.query).toBe('닭가슴살 & 요거트');
    expect(response.sourceUrl).toBe(url.href);
    expect(response.foods).toHaveLength(2);
    expect(response.foods[0].carbohydrates).toBe(0);
  });

  it.each([null, '', ' ', 'x'.repeat(101)])(
    'rejects invalid queries before requesting a page: %j',
    async (query) => {
      const fetchPage = vi.fn<typeof fetch>();
      await expect(createFatSecretSearch(fetchPage)(query)).rejects.toMatchObject({
        code: 'invalid-query',
      });
      expect(fetchPage).not.toHaveBeenCalled();
    },
  );

  it('decodes UTF-8 correctly across streamed chunk boundaries', async () => {
    const bytes = new TextEncoder().encode(html);
    const split = bytes.findIndex((value) => value >= 128) + 1;
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes.slice(0, split));
        controller.enqueue(bytes.slice(split, split + 1));
        controller.enqueue(bytes.slice(split + 1));
        controller.close();
      },
    });
    const fetchPage = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(stream, { headers: { 'Content-Type': 'text/html' } }));
    const response = await createFatSecretSearch(fetchPage)('닭가슴살');
    expect(response.foods[0].name).toBe('샘플 닭가슴살');
    expect(response.foods[1].brand).toBe('샘플브랜드');
  });

  it('distinguishes an empty result from a changed or blocked HTML page', async () => {
    const empty = vi
      .fn<typeof fetch>()
      .mockResolvedValue(htmlResponse('<div class="searchNoResult">결과 없음</div>'));
    expect((await createFatSecretSearch(empty)('없는음식')).foods).toEqual([]);
    const blocked = vi
      .fn<typeof fetch>()
      .mockResolvedValue(htmlResponse('<html>Checking your browser</html>'));
    await expect(createFatSecretSearch(blocked)('밥')).rejects.toMatchObject({
      code: 'invalid-page',
    });
  });

  it('rejects unsuccessful responses, non-HTML responses and oversized bodies', async () => {
    const failed = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('Blocked', { status: 403 }));
    await expect(createFatSecretSearch(failed)('밥')).rejects.toMatchObject({
      code: 'upstream-http',
    });
    const json = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response('{}', { headers: { 'Content-Type': 'application/json' } }));
    await expect(createFatSecretSearch(json)('밥')).rejects.toMatchObject({ code: 'invalid-page' });
    const oversized = vi
      .fn<typeof fetch>()
      .mockResolvedValue(htmlResponse('x'.repeat(MAX_FOOD_SEARCH_HTML_BYTES + 1)));
    await expect(createFatSecretSearch(oversized)('밥')).rejects.toMatchObject({
      code: 'response-too-large',
    });
  });

  it('reports timeouts separately from network failures', async () => {
    const timeout = vi
      .fn<typeof fetch>()
      .mockRejectedValue(new DOMException('Timed out', 'TimeoutError'));
    await expect(createFatSecretSearch(timeout)('밥')).rejects.toMatchObject({
      code: 'upstream-timeout',
    });
    const offline = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('fetch failed'));
    await expect(createFatSecretSearch(offline)('밥')).rejects.toMatchObject({
      code: 'upstream-network',
    });
  });

  it('cancels the upstream HTML request when the browser replaces its query', async () => {
    const fetchPage = vi.fn<typeof fetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Cancelled', 'AbortError')),
            { once: true },
          );
        }),
    );
    const controller = new AbortController();
    const result = createFatSecretSearch(fetchPage)('밥', controller.signal).catch(
      (error: unknown) => error,
    );
    controller.abort();
    expect(await result).toMatchObject({ name: 'AbortError' });
    expect(fetchPage.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it('does not start an HTML request for a previously cancelled consumer', async () => {
    const fetchPage = vi.fn<typeof fetch>();
    const controller = new AbortController();
    controller.abort();
    await expect(createFatSecretSearch(fetchPage)('밥', controller.signal)).rejects.toMatchObject({
      name: 'AbortError',
    });
    expect(fetchPage).not.toHaveBeenCalled();
  });
});

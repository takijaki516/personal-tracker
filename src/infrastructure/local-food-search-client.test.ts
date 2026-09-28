import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLocalFoodSearch, type LookupFetch } from './local-food-search-client';

const baseUrl = 'http://127.0.0.1:8090';
const response = {
  query: '닭가슴살',
  sourceUrl: 'https://www.fatsecret.kr/칼로리-영양소/search?q=닭가슴살',
  foods: [
    {
      name: '닭가슴살',
      servingText: '100g',
      calories: 109,
      carbohydrates: 0,
      protein: 22.98,
      fat: 1.23,
      sourceUrl: 'https://www.fatsecret.kr/칼로리-영양소/일반/닭가슴살/100g',
    },
  ],
};

afterEach(() => vi.useRealTimers());

describe('local food search client', () => {
  it('requests the lookup server and validates its JSON before returning foods', async () => {
    const fetchLookup = vi.fn<LookupFetch>().mockResolvedValue(Response.json(response));
    const search = createLocalFoodSearch(baseUrl, fetchLookup);
    expect(await search('  닭가슴살  ', new AbortController().signal)).toEqual(response);
    expect(fetchLookup).toHaveBeenCalledWith(
      new URL('/foods/search?q=%EB%8B%AD%EA%B0%80%EC%8A%B4%EC%82%B4', baseUrl).href,
      expect.objectContaining({
        cache: 'no-store',
        credentials: 'omit',
        redirect: 'error',
      }),
    );
  });

  it('does not send blank or oversized search terms', async () => {
    const fetchLookup = vi.fn<LookupFetch>();
    const search = createLocalFoodSearch(baseUrl, fetchLookup);
    await expect(search(' ', new AbortController().signal)).rejects.toThrow('1~100');
    await expect(search('가'.repeat(101), new AbortController().signal)).rejects.toThrow('1~100');
    expect(fetchLookup).not.toHaveBeenCalled();
  });

  it('distinguishes an empty result from a malformed response', async () => {
    const fetchLookup = vi
      .fn<LookupFetch>()
      .mockResolvedValueOnce(
        Response.json({
          ...response,
          foods: [],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          ...response,
          foods: [{ name: '닭가슴살' }],
        }),
      )
      .mockResolvedValueOnce(new Response('<html>Blocked</html>'));
    const search = createLocalFoodSearch(baseUrl, fetchLookup);
    expect((await search(response.query, new AbortController().signal)).foods).toEqual([]);
    await expect(search(response.query, new AbortController().signal)).rejects.toThrow('형식');
    await expect(search(response.query, new AbortController().signal)).rejects.toThrow('응답');
  });

  it.each([
    {
      status: 502,
      code: 'invalid-page',
      message: '페이지',
    },
    {
      status: 502,
      code: 'upstream-http',
      message: '조회하지 못했어요',
    },
    {
      status: 504,
      code: 'upstream-timeout',
      message: '시간이 초과',
    },
  ])(
    'reports lookup failures with status $status and code $code',
    async ({ status, code, message }) => {
      const fetchLookup = vi
        .fn<LookupFetch>()
        .mockResolvedValue(Response.json({ error: { code } }, { status }));
      const search = createLocalFoodSearch(baseUrl, fetchLookup);
      await expect(search(response.query, new AbortController().signal)).rejects.toThrow(message);
    },
  );

  it('explains how to recover when the lookup server is unavailable', async () => {
    const fetchLookup = vi.fn<LookupFetch>().mockRejectedValue(new TypeError('Failed to fetch'));
    const search = createLocalFoodSearch(baseUrl, fetchLookup);
    await expect(search(response.query, new AbortController().signal)).rejects.toThrow('개발 서버');
  });

  function pendingFetch() {
    return vi.fn<LookupFetch>(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Cancelled', 'AbortError')),
            { once: true },
          );
        }),
    );
  }

  it('cancels the network request when the search term changes or the list closes', async () => {
    const fetchLookup = pendingFetch();
    const search = createLocalFoodSearch(baseUrl, fetchLookup);
    const controller = new AbortController();
    const result = search(response.query, controller.signal).catch((error: unknown) => error);
    controller.abort();
    expect(await result).toMatchObject({ name: 'AbortError' });
    expect(fetchLookup.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it('times out a stalled lookup instead of leaving the search loading', async () => {
    vi.useFakeTimers();
    const search = createLocalFoodSearch(baseUrl, pendingFetch());
    const result = search(response.query, new AbortController().signal).catch(
      (error: unknown) => error,
    );
    await vi.advanceTimersByTimeAsync(12000);
    expect(await result).toMatchObject({ message: expect.stringContaining('시간이 초과') });
  });
});

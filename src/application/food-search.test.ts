import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoodSearchResponse } from '../domain/food-search';
import {
  createCachedFoodSearch,
  FOOD_SEARCH_CACHE_TTL_MS,
  MAX_CACHED_FOOD_SEARCHES,
  type FoodSearch,
} from './food-search';

const response = (query: string): FoodSearchResponse => ({
  query,
  sourceUrl: `https://www.fatsecret.kr/칼로리-영양소/search?q=${query}`,
  foods: [
    {
      name: query,
      calories: 100,
      carbohydrates: 0,
      servingText: '100g',
      sourceUrl: 'https://www.fatsecret.kr/칼로리-영양소/일반/밥/100g',
    },
  ],
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('food search memory cache', () => {
  it('reuses the same trimmed search term across input focus and repeat searches', async () => {
    const lookup = vi.fn<FoodSearch>(async (query) => response(query));
    const search = createCachedFoodSearch(lookup);
    const first = await search('닭가슴살', new AbortController().signal);
    expect(await search('  닭가슴살  ', new AbortController().signal)).toEqual(first);
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('refreshes expired data without extending expiry on cache hits', async () => {
    const lookup = vi.fn<FoodSearch>(async (query) => response(query));
    const search = createCachedFoodSearch(lookup);
    await search('밥', new AbortController().signal);
    await vi.advanceTimersByTimeAsync(FOOD_SEARCH_CACHE_TTL_MS - 1);
    await search('밥', new AbortController().signal);
    expect(lookup).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    await search('밥', new AbortController().signal);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('keeps recently used searches when the bounded cache fills up', async () => {
    const lookup = vi.fn<FoodSearch>(async (query) => response(query));
    const search = createCachedFoodSearch(lookup);
    for (let index = 0; index < MAX_CACHED_FOOD_SEARCHES; index += 1) {
      await search(`음식${index}`, new AbortController().signal);
    }
    await search('음식0', new AbortController().signal);
    await search('새로운음식', new AbortController().signal);
    await search('음식0', new AbortController().signal);
    expect(lookup).toHaveBeenCalledTimes(MAX_CACHED_FOOD_SEARCHES + 1);
    await search('음식1', new AbortController().signal);
    expect(lookup).toHaveBeenCalledTimes(MAX_CACHED_FOOD_SEARCHES + 2);
  });

  it('caches explicit empty results but allows a failed query to be retried', async () => {
    const empty = {
      ...response('없는음식'),
      foods: [],
    };
    const lookup = vi
      .fn<FoodSearch>()
      .mockRejectedValueOnce(new Error('연결 실패'))
      .mockResolvedValue(empty);
    const search = createCachedFoodSearch(lookup);
    await expect(search('없는음식', new AbortController().signal)).rejects.toThrow('연결 실패');
    expect((await search('없는음식', new AbortController().signal)).foods).toEqual([]);
    expect((await search('없는음식', new AbortController().signal)).foods).toEqual([]);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('does not store a late response from a cancelled request', async () => {
    let finish: (response: FoodSearchResponse) => void = () => {
      throw new Error('Request not started');
    };
    const lookup = vi
      .fn<FoodSearch>()
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finish = resolve;
          }),
      )
      .mockResolvedValue(response('밥'));
    const search = createCachedFoodSearch(lookup);
    const controller = new AbortController();
    const cancelled = search('밥', controller.signal).catch((error: unknown) => error);
    controller.abort();
    finish(response('밥'));
    expect(await cancelled).toMatchObject({ name: 'AbortError' });
    await search('밥', new AbortController().signal);
    expect(lookup).toHaveBeenCalledTimes(2);
  });

  it('rejects cancelled consumers even when the result is already cached', async () => {
    const lookup = vi.fn<FoodSearch>(async (query) => response(query));
    const search = createCachedFoodSearch(lookup);
    await search('밥', new AbortController().signal);
    const controller = new AbortController();
    controller.abort();
    await expect(search('밥', controller.signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(lookup).toHaveBeenCalledTimes(1);
  });

  it('protects cached nutrition from changes to previously returned food objects', async () => {
    const lookup = vi.fn<FoodSearch>(async (query) => response(query));
    const search = createCachedFoodSearch(lookup);
    const first = await search('밥', new AbortController().signal);
    first.foods[0].calories = 999;
    const second = await search('밥', new AbortController().signal);
    second.foods[0].carbohydrates = 20;
    const third = await search('밥', new AbortController().signal);
    expect(third.foods[0]).toMatchObject({
      calories: 100,
      carbohydrates: 0,
    });
    expect(lookup).toHaveBeenCalledTimes(1);
  });
});

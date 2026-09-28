import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { FoodSearch } from '../../application/food-search';
import type { FoodSearchResponse } from '../../domain/food-search';
import {
  createFoodAutocomplete,
  FOOD_SEARCH_DEBOUNCE_MS,
  type FoodAutocompleteState,
} from './food-autocomplete';

const response = (query: string): FoodSearchResponse => ({
  query,
  sourceUrl: 'https://www.fatsecret.kr/칼로리-영양소/search',
  foods: [
    {
      name: query,
      calories: 100,
      servingText: '100g',
      sourceUrl: 'https://www.fatsecret.kr/칼로리-영양소/일반/밥/100g',
    },
  ],
});

function deferredResponse() {
  let resolve: (response: FoodSearchResponse) => void = () => {
    throw new Error('Request not started');
  };
  let reject: (error: unknown) => void = () => {
    throw new Error('Request not started');
  };
  const promise = new Promise<FoodSearchResponse>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return {
    promise,
    resolve: (value: FoodSearchResponse) => resolve(value),
    reject: (error: unknown) => reject(error),
  };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('automatic FatSecret suggestions', () => {
  it('requests only the final query after continuous input pauses for 400ms', async () => {
    const search = vi.fn<FoodSearch>(async (query) => response(query));
    const onChange = vi.fn<(state: FoodAutocompleteState) => void>();
    const autocomplete = createFoodAutocomplete(search, onChange);
    autocomplete.update('닭');
    await vi.advanceTimersByTimeAsync(250);
    autocomplete.update('닭가슴');
    await vi.advanceTimersByTimeAsync(250);
    autocomplete.update(' 닭가슴살 ');
    await vi.advanceTimersByTimeAsync(FOOD_SEARCH_DEBOUNCE_MS - 1);
    expect(search).not.toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
      query: '닭가슴살',
      status: 'waiting',
    });
    await vi.advanceTimersByTimeAsync(1);
    expect(search).toHaveBeenCalledExactlyOnceWith('닭가슴살', expect.any(AbortSignal));
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
      query: '닭가슴살',
      status: 'success',
      foods: response('닭가슴살').foods,
    });
  });

  it('supports single-letter Korean foods without requesting an empty query', async () => {
    const search = vi.fn<FoodSearch>(async (query) => response(query));
    const autocomplete = createFoodAutocomplete(search, vi.fn());
    autocomplete.update(' ');
    await vi.advanceTimersByTimeAsync(1000);
    expect(search).not.toHaveBeenCalled();
    autocomplete.update('밥');
    await vi.advanceTimersByTimeAsync(FOOD_SEARCH_DEBOUNCE_MS);
    expect(search).toHaveBeenCalledExactlyOnceWith('밥', expect.any(AbortSignal));
  });

  it('waits for Korean composition to end even when typing pauses for a long time', async () => {
    const search = vi.fn<FoodSearch>(async (query) => response(query));
    const onChange = vi.fn<(state: FoodAutocompleteState) => void>();
    const autocomplete = createFoodAutocomplete(search, onChange);
    autocomplete.update('ㅎ', true);
    await vi.advanceTimersByTimeAsync(2000);
    autocomplete.update('하', true);
    await vi.advanceTimersByTimeAsync(2000);
    expect(search).not.toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
      query: '하',
      status: 'composing',
    });
    autocomplete.update('한', false);
    await vi.advanceTimersByTimeAsync(FOOD_SEARCH_DEBOUNCE_MS);
    expect(search).toHaveBeenCalledExactlyOnceWith('한', expect.any(AbortSignal));
  });

  it('cancels pending lookups when the input is cleared or the list closes', async () => {
    const search = vi.fn<FoodSearch>(async (query) => response(query));
    const onChange = vi.fn<(state: FoodAutocompleteState) => void>();
    const autocomplete = createFoodAutocomplete(search, onChange);
    autocomplete.update('밥');
    autocomplete.update('');
    await vi.advanceTimersByTimeAsync(1000);
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
      query: '',
      status: 'idle',
    });
    autocomplete.update('요거트');
    autocomplete.cancel();
    await vi.advanceTimersByTimeAsync(1000);
    expect(search).not.toHaveBeenCalled();
  });

  it('aborts an old request and ignores its late response after newer results arrive', async () => {
    const old = deferredResponse();
    const recent = deferredResponse();
    const search = vi
      .fn<FoodSearch>()
      .mockReturnValueOnce(old.promise)
      .mockReturnValueOnce(recent.promise);
    const onChange = vi.fn<(state: FoodAutocompleteState) => void>();
    const autocomplete = createFoodAutocomplete(search, onChange);
    autocomplete.update('닭');
    await vi.advanceTimersByTimeAsync(FOOD_SEARCH_DEBOUNCE_MS);
    autocomplete.update('요거트');
    expect(search.mock.calls[0][1].aborted).toBe(true);
    await vi.advanceTimersByTimeAsync(FOOD_SEARCH_DEBOUNCE_MS);
    recent.resolve(response('요거트'));
    await vi.advanceTimersByTimeAsync(0);
    old.resolve(response('닭'));
    await vi.advanceTimersByTimeAsync(0);
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
      query: '요거트',
      status: 'success',
      foods: response('요거트').foods,
    });
  });

  it('ignores a late failure from a replaced request', async () => {
    const old = deferredResponse();
    const search = vi
      .fn<FoodSearch>()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValue(response('밥'));
    const onChange = vi.fn<(state: FoodAutocompleteState) => void>();
    const autocomplete = createFoodAutocomplete(search, onChange);
    autocomplete.update('닭');
    await vi.advanceTimersByTimeAsync(FOOD_SEARCH_DEBOUNCE_MS);
    autocomplete.update('밥');
    await vi.advanceTimersByTimeAsync(FOOD_SEARCH_DEBOUNCE_MS);
    old.reject(new Error('이전 조회 실패'));
    await vi.advanceTimersByTimeAsync(0);
    expect(onChange.mock.calls.at(-1)?.[0]).toMatchObject({
      query: '밥',
      status: 'success',
    });
  });

  it('stops an in-flight lookup when composition starts or the list closes', async () => {
    const old = deferredResponse();
    const search = vi.fn<FoodSearch>().mockReturnValue(old.promise);
    const onChange = vi.fn<(state: FoodAutocompleteState) => void>();
    const autocomplete = createFoodAutocomplete(search, onChange);
    autocomplete.update('닭');
    await vi.advanceTimersByTimeAsync(FOOD_SEARCH_DEBOUNCE_MS);
    autocomplete.update('닭ㄱ', true);
    expect(search.mock.calls[0][1].aborted).toBe(true);
    autocomplete.cancel();
    const updates = onChange.mock.calls.length;
    old.resolve(response('닭'));
    await vi.advanceTimersByTimeAsync(0);
    expect(onChange).toHaveBeenCalledTimes(updates);
  });

  it('allows a failed query to be retried and preserves explicit empty results', async () => {
    const search = vi
      .fn<FoodSearch>()
      .mockRejectedValueOnce(new Error('서버 연결 실패'))
      .mockResolvedValue({
        ...response('밥'),
        foods: [],
      });
    const onChange = vi.fn<(state: FoodAutocompleteState) => void>();
    const autocomplete = createFoodAutocomplete(search, onChange);
    autocomplete.update('밥');
    await vi.advanceTimersByTimeAsync(FOOD_SEARCH_DEBOUNCE_MS);
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
      query: '밥',
      status: 'error',
      message: '서버 연결 실패',
    });
    autocomplete.update('밥');
    await vi.advanceTimersByTimeAsync(FOOD_SEARCH_DEBOUNCE_MS);
    expect(search).toHaveBeenCalledTimes(2);
    expect(onChange.mock.calls.at(-1)?.[0]).toEqual({
      query: '밥',
      status: 'success',
      foods: [],
    });
  });
});

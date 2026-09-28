import type { FoodSearchResponse } from '../domain/food-search';

export type FoodSearch = (query: string, signal: AbortSignal) => Promise<FoodSearchResponse>;

export const FOOD_SEARCH_CACHE_TTL_MS = 5 * 60 * 1000;
export const MAX_CACHED_FOOD_SEARCHES = 30;

type CachedSearch = { response: FoodSearchResponse; expiresAt: number };

function copyResponse(response: FoodSearchResponse): FoodSearchResponse {
  return {
    ...response,
    foods: response.foods.map((food) => ({ ...food })),
  };
}

export function createCachedFoodSearch(search: FoodSearch): FoodSearch {
  const cache = new Map<string, CachedSearch>();
  return async (value, signal) => {
    const query = value.trim();
    signal.throwIfAborted();
    const cached = cache.get(query);
    if (cached && cached.expiresAt > Date.now()) {
      cache.delete(query);
      cache.set(query, cached);
      return copyResponse(cached.response);
    }
    cache.delete(query);
    const response = await search(query, signal);
    signal.throwIfAborted();
    cache.delete(query);
    cache.set(query, {
      response: copyResponse(response),
      expiresAt: Date.now() + FOOD_SEARCH_CACHE_TTL_MS,
    });
    if (cache.size > MAX_CACHED_FOOD_SEARCHES) {
      const oldest = cache.keys().next().value;
      if (oldest !== undefined) {
        cache.delete(oldest);
      }
    }
    return response;
  };
}

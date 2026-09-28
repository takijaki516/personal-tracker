import type { FoodSearch } from '../../application/food-search';
import type { FoodSearchResult } from '../../domain/food-search';

export const FOOD_SEARCH_DEBOUNCE_MS = 400;

export type FoodAutocompleteState = { query: string } & (
  | { status: 'idle' | 'composing' | 'waiting' | 'loading' }
  | { status: 'success'; foods: FoodSearchResult[] }
  | { status: 'error'; message: string }
);

export function createFoodAutocomplete(
  search: FoodSearch,
  onChange: (state: FoodAutocompleteState) => void,
) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let request: AbortController | undefined;
  let version = 0;

  function cancel() {
    version += 1;
    clearTimeout(timer);
    timer = undefined;
    request?.abort();
    request = undefined;
  }

  function update(value: string, composing = false) {
    cancel();
    const query = value.trim();
    if (!query || composing) {
      onChange({
        query,
        status: composing ? 'composing' : 'idle',
      });
      return;
    }
    onChange({
      query,
      status: 'waiting',
    });
    const currentVersion = version;
    timer = setTimeout(async () => {
      timer = undefined;
      const controller = new AbortController();
      request = controller;
      onChange({
        query,
        status: 'loading',
      });
      try {
        const response = await search(query, controller.signal);
        if (currentVersion === version && !controller.signal.aborted) {
          onChange({
            query,
            status: 'success',
            foods: response.foods,
          });
        }
      } catch (error) {
        if (currentVersion === version && !controller.signal.aborted) {
          onChange({
            query,
            status: 'error',
            message: error instanceof Error ? error.message : '음식을 검색하지 못했어요.',
          });
        }
      }
    }, FOOD_SEARCH_DEBOUNCE_MS);
  }

  return {
    update,
    cancel,
  };
}

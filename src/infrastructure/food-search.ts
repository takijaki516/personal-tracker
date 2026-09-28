import type { FoodSearchResponse } from '../domain/food-search';

export function canSearchFoods(): boolean {
  return false;
}

export function searchFoods(_query: string, _signal: AbortSignal): Promise<FoodSearchResponse> {
  return Promise.reject(new Error('음식 검색은 현재 localhost 웹 미리보기에서 사용할 수 있어요.'));
}

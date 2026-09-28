import { createCachedFoodSearch } from '../application/food-search';
import type {} from './desktop-bridge';
import { createLocalFoodSearch } from './local-food-search-client';

export function canSearchFoods(): boolean {
  return (
    typeof window !== 'undefined' &&
    !window.exerciseDesktop &&
    window.location.protocol === 'http:' &&
    ['localhost', '127.0.0.1'].includes(window.location.hostname) &&
    window.location.port === '8081'
  );
}

export const searchFoods = createCachedFoodSearch(
  createLocalFoodSearch(process.env.EXPO_PUBLIC_FOOD_SEARCH_URL ?? 'http://127.0.0.1:8090'),
);

import type { FavoriteFood, Store } from './data';
import { normalizeFoodName } from './favorite-foods';

export const MAX_RECENT_FOOD_SUGGESTIONS = 10;

export type RecentFood = { food: FavoriteFood; date: string };

export type FoodSuggestions = { favorites: FavoriteFood[]; recent: RecentFood[] };

export function getFoodSuggestions(
  days: Store['days'],
  favoriteFoods: FavoriteFood[],
  query: string,
): FoodSuggestions {
  const search = normalizeFoodName(query).replace(/\s+/g, '');
  const matches = (name: string) => normalizeFoodName(name).replace(/\s+/g, '').includes(search);
  const favoriteNames = new Map<string, FavoriteFood>();
  for (const food of favoriteFoods) {
    const name = normalizeFoodName(food.name);
    if (!favoriteNames.has(name)) {
      favoriteNames.set(name, food);
    }
  }
  const favorites = [...favoriteNames.values()]
    .filter((food) => matches(food.name))
    .sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  const recent: RecentFood[] = [];
  const seen = new Set(favoriteNames.keys());
  const dates = Object.keys(days).sort().reverse();
  for (const date of dates) {
    const meals = days[date].meals;
    for (let index = meals.length - 1; index >= 0; index--) {
      const food = meals[index];
      const name = normalizeFoodName(food.name);
      if (seen.has(name)) {
        continue;
      }
      seen.add(name);
      if (matches(food.name)) {
        recent.push({
          food,
          date,
        });
        if (recent.length === MAX_RECENT_FOOD_SUGGESTIONS) {
          return {
            favorites,
            recent,
          };
        }
      }
    }
  }
  return {
    favorites,
    recent,
  };
}

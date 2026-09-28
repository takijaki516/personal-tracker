import {
  isMealAmount,
  MACRONUTRIENTS,
  MAX_MACRONUTRIENT_GRAMS,
  MAX_MEAL_CALORIES,
  type FavoriteFood,
} from './data';

export type FoodInput = {
  name: string;
  calories: string;
  carbohydrates: string;
  protein: string;
  fat: string;
};

export function parseFoodInput(input: FoodInput): Omit<FavoriteFood, 'id'> {
  const name = input.name.trim();
  if (!name || name.length > 100) {
    throw new Error('음식 이름을 1~100자로 입력해 주세요.');
  }
  const calories = Number(input.calories.trim());
  if (!input.calories.trim() || !isMealAmount(calories, MAX_MEAL_CALORIES)) {
    throw new Error(
      `총 칼로리를 0~${MAX_MEAL_CALORIES.toLocaleString()}kcal 범위로 입력해 주세요.`,
    );
  }
  const food: Omit<FavoriteFood, 'id'> = {
    name,
    calories,
  };
  for (const { key, label } of MACRONUTRIENTS) {
    const value = input[key].trim();
    if (!value) {
      continue;
    }
    const grams = Number(value);
    if (!isMealAmount(grams, MAX_MACRONUTRIENT_GRAMS)) {
      throw new Error(
        `${label}을 0~${MAX_MACRONUTRIENT_GRAMS.toLocaleString()}g 범위로 입력해 주세요.`,
      );
    }
    food[key] = grams;
  }
  return food;
}

export function findFavoriteFood(foods: FavoriteFood[], name: string): FavoriteFood | undefined {
  const normalized = name.trim().toLowerCase();
  return foods.find((food) => food.name.trim().toLowerCase() === normalized);
}

export function upsertFavoriteFood(foods: FavoriteFood[], food: FavoriteFood): FavoriteFood[] {
  const existing = findFavoriteFood(foods, food.name);
  if (!existing) {
    return [...foods, food];
  }
  return foods.map((item) =>
    item.id === existing.id
      ? {
          ...food,
          id: existing.id,
        }
      : item,
  );
}

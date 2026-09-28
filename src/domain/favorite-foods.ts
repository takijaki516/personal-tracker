import {
  isMealAmount,
  MACRONUTRIENTS,
  MAX_MACRONUTRIENT_GRAMS,
  MAX_MEAL_CALORIES,
  type FavoriteFood,
  type FoodNutrition,
} from './data';

export type FoodNutritionInput = {
  calories: string;
  carbohydrates: string;
  protein: string;
  fat: string;
};

export type FoodInput = FoodNutritionInput & { name: string };

export function parseFoodNutritionInput(
  input: FoodNutritionInput,
  caloriesLabel = '총 칼로리',
): FoodNutrition {
  const calories = Number(input.calories.trim());
  if (!input.calories.trim() || !isMealAmount(calories, MAX_MEAL_CALORIES)) {
    throw new Error(
      `${caloriesLabel}: 0~${MAX_MEAL_CALORIES.toLocaleString()}kcal 범위의 숫자를 입력해 주세요.`,
    );
  }
  const food: FoodNutrition = { calories };
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

export function parseFoodName(input: string): string {
  const name = input.trim();
  if (!name || name.length > 100) {
    throw new Error('음식 이름을 1~100자로 입력해 주세요.');
  }
  return name;
}

export function parseFoodInput(input: FoodInput): Omit<FavoriteFood, 'id'> {
  return {
    name: parseFoodName(input.name),
    ...parseFoodNutritionInput(input),
  };
}

export function normalizeFoodName(name: string): string {
  return name.trim().toLowerCase();
}

export function findFavoriteFood(foods: FavoriteFood[], name: string): FavoriteFood | undefined {
  const normalized = normalizeFoodName(name);
  return foods.find((food) => normalizeFoodName(food.name) === normalized);
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

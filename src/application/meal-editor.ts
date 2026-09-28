import type { Day, FavoriteFood, Meal } from '../domain/data';
import {
  createMealNutritionInput,
  parseMealNutritionInput,
  type MealNutritionInput,
} from '../domain/food-portion';

export type MealFoodInput = {
  id: string;
  name: string;
  nutritionInput: MealNutritionInput;
};

export function createMealFoodInput(id: string, food?: Omit<FavoriteFood, 'id'>): MealFoodInput {
  return {
    id,
    name: food?.name ?? '',
    nutritionInput: createMealNutritionInput(food),
  };
}

export function applyMealFoodInputs(
  day: Day,
  slot: string,
  inputs: MealFoodInput[],
  editedId: string | null,
): Day {
  if (inputs.length === 0) {
    throw new Error('음식을 한 개 이상 추가해 주세요.');
  }
  const ids = new Set<string>();
  const foods = inputs.map((input, index): Meal => {
    if (ids.has(input.id)) {
      throw new Error('음식 기록 ID가 중복되었습니다.');
    }
    ids.add(input.id);
    try {
      return {
        ...parseMealNutritionInput(input.name, input.nutritionInput),
        id: input.id,
        slot,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '입력값을 확인해 주세요.';
      throw new Error(`음식 ${index + 1}: ${message}`);
    }
  });
  const foodsById = new Map(foods.map((food) => [food.id, food]));
  const existingIds = new Set(day.meals.map((meal) => meal.id));
  const meals = day.meals.flatMap((meal) => {
    const replacement = foodsById.get(meal.id);
    if (replacement) {
      return [replacement];
    }
    return meal.id === editedId ? [] : [meal];
  });
  return {
    ...day,
    meals: [...meals, ...foods.filter((food) => !existingIds.has(food.id))],
  };
}

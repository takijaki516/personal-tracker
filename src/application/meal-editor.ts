import { MEAL_SLOTS, type Day, type FavoriteFood, type Meal } from '../domain/data';
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

export type MealSectionInput = {
  slot: string;
  foods: MealFoodInput[];
};

export class MealSectionError extends Error {
  readonly slot: string;

  constructor(slot: string, message: string) {
    super(`${slot}: ${message}`);
    this.name = 'MealSectionError';
    this.slot = slot;
  }
}

export function createMealFoodInput(id: string, food?: Omit<FavoriteFood, 'id'>): MealFoodInput {
  return {
    id,
    name: food?.name ?? '',
    nutritionInput: createMealNutritionInput(food),
  };
}

export function createMealSectionInputs(day: Day): MealSectionInput[] {
  return MEAL_SLOTS.map((slot) => ({
    slot,
    foods: day.meals
      .filter((meal) => meal.slot === slot)
      .map((meal) => createMealFoodInput(meal.id, meal)),
  }));
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

export function applyMealSectionInputs(
  day: Day,
  sections: MealSectionInput[],
  editedIds: string[] = [],
): Day {
  const inputIds = new Set(sections.flatMap(({ foods }) => foods.map(({ id }) => id)));
  if (inputIds.size === 0 && editedIds.length === 0) {
    throw new Error('음식을 한 개 이상 추가해 주세요.');
  }
  const removedIds = new Set(editedIds.filter((id) => !inputIds.has(id)));
  const ids = new Set<string>();
  let next = {
    ...day,
    meals: day.meals.filter((meal) => !removedIds.has(meal.id)),
  };
  for (const { slot, foods } of sections) {
    if (foods.length === 0) {
      continue;
    }
    try {
      for (const food of foods) {
        if (ids.has(food.id)) {
          throw new Error('음식 기록 ID가 중복되었습니다.');
        }
        ids.add(food.id);
      }
      next = applyMealFoodInputs(next, slot, foods, null);
    } catch (error) {
      const message = error instanceof Error ? error.message : '입력값을 확인해 주세요.';
      throw new MealSectionError(slot, message);
    }
  }
  return next;
}

import {
  isMealAmount,
  isFoodQuantity,
  MACRONUTRIENTS,
  MAX_MACRONUTRIENT_GRAMS,
  MAX_MEAL_CALORIES,
  type FavoriteFood,
  type FoodNutrition,
} from './data';

export type FoodSearchResult = {
  name: string;
  brand?: string;
  servingText: string;
  servingGrams?: number;
  calories: number;
  carbohydrates?: number;
  protein?: number;
  fat?: number;
  sourceUrl: string;
};

export type FoodSearchResponse = {
  query: string;
  sourceUrl: string;
  foods: FoodSearchResult[];
};

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isText(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && !!value.trim() && value.length <= maxLength;
}

function isSourceUrl(value: unknown, searchPage: boolean): value is string {
  if (typeof value !== 'string') {
    return false;
  }
  try {
    const url = new URL(value);
    const path = decodeURI(url.pathname);
    return (
      url.origin === 'https://www.fatsecret.kr' &&
      !url.username &&
      !url.password &&
      (searchPage
        ? path === '/칼로리-영양소/search'
        : path.startsWith('/칼로리-영양소/') && path !== '/칼로리-영양소/search')
    );
  } catch {
    return false;
  }
}

export function readFoodSearchResponse(value: unknown, query: string): FoodSearchResponse {
  const invalid = () => new Error('음식 검색 결과의 형식을 확인하지 못했어요. 다시 검색해 주세요.');
  if (
    !isObject(value) ||
    value.query !== query ||
    !isSourceUrl(value.sourceUrl, true) ||
    !Array.isArray(value.foods) ||
    value.foods.length > 10
  ) {
    throw invalid();
  }
  const foods = value.foods.map((food: unknown): FoodSearchResult => {
    if (
      !isObject(food) ||
      !isText(food.name, 100) ||
      !isText(food.servingText, 300) ||
      !isMealAmount(food.calories, MAX_MEAL_CALORIES) ||
      !isSourceUrl(food.sourceUrl, false) ||
      (food.brand !== undefined && !isText(food.brand, 200)) ||
      (food.servingGrams !== undefined && !isFoodQuantity(food.servingGrams))
    ) {
      throw invalid();
    }
    const result: FoodSearchResult = {
      name: food.name.trim(),
      servingText: food.servingText,
      calories: food.calories,
      sourceUrl: food.sourceUrl,
    };
    if (food.brand !== undefined) {
      result.brand = food.brand.trim();
    }
    if (food.servingGrams !== undefined) {
      result.servingGrams = food.servingGrams;
    }
    for (const { key } of MACRONUTRIENTS) {
      const amount = food[key];
      if (amount !== undefined) {
        if (!isMealAmount(amount, MAX_MACRONUTRIENT_GRAMS)) {
          throw invalid();
        }
        result[key] = amount;
      }
    }
    return result;
  });
  return {
    query,
    sourceUrl: value.sourceUrl,
    foods,
  };
}

export function foodSearchSelection(food: FoodSearchResult): Omit<FavoriteFood, 'id'> {
  const brandedName =
    food.brand && !food.name.startsWith(food.brand) ? `${food.brand} ${food.name}` : food.name;
  const selected: Omit<FavoriteFood, 'id'> = {
    name: brandedName.length <= 100 ? brandedName : food.name,
    calories: food.calories,
  };
  const referenceNutrition: FoodNutrition = { calories: food.calories };
  for (const { key } of MACRONUTRIENTS) {
    if (food[key] !== undefined) {
      selected[key] = food[key];
      referenceNutrition[key] = food[key];
    }
  }
  selected.portion = {
    quantity: food.servingGrams ?? 1,
    unit: food.servingGrams === undefined ? 'serving' : 'g',
    referenceQuantity: food.servingGrams ?? 1,
    referenceNutrition,
    referenceText: food.servingText,
  };
  return selected;
}

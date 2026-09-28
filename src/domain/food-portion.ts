import {
  isFoodQuantity,
  isMealAmount,
  MACRONUTRIENTS,
  MAX_FOOD_QUANTITY,
  NUTRITION_METRICS,
  nutritionForPortion,
  parseFoodPortion,
  type FavoriteFood,
  type FoodNutrition,
  type FoodPortion,
} from './data';
import { parseFoodName, parseFoodNutritionInput, type FoodNutritionInput } from './favorite-foods';

export type FoodPortionInput = FoodNutritionInput & {
  quantity: string;
  unit: FoodPortion['unit'];
  referenceQuantity: string;
  referenceText?: string;
};

export type MealNutritionInput = {
  portion: FoodPortionInput;
  nutrition: FoodNutritionInput;
  lastQuantity: string;
  pendingUnit: boolean;
};

function nutritionInput(nutrition?: FoodNutrition): FoodNutritionInput {
  return {
    calories: nutrition?.calories.toString() ?? '',
    carbohydrates: nutrition?.carbohydrates?.toString() ?? '',
    protein: nutrition?.protein?.toString() ?? '',
    fat: nutrition?.fat?.toString() ?? '',
  };
}

export const foodUnitLabel = (unit: FoodPortion['unit']) => (unit === 'g' ? 'g' : '회분');
export const formatFoodQuantity = (quantity: number, unit: FoodPortion['unit']) =>
  `${quantity.toLocaleString('ko-KR', { maximumFractionDigits: 4 })} ${foodUnitLabel(unit)}`;

export function createFoodPortionInput(food?: Omit<FavoriteFood, 'id'>): FoodPortionInput {
  const portion = food?.portion;
  const nutrition = portion?.referenceNutrition ?? food;
  return {
    quantity: String(portion?.quantity ?? 1),
    unit: portion?.unit ?? 'serving',
    referenceQuantity: String(portion?.referenceQuantity ?? 1),
    ...(portion?.referenceText ? { referenceText: portion.referenceText } : {}),
    ...nutritionInput(nutrition),
  };
}

function quantityInput(value: string, label: string) {
  const amount = Number(value.trim());
  if (!value.trim() || !isFoodQuantity(amount)) {
    throw new Error(
      `${label}: 0보다 크고 ${MAX_FOOD_QUANTITY.toLocaleString()} 이하인 숫자를 입력해 주세요.`,
    );
  }
  return amount;
}

export function parseFoodPortionInput(input: FoodPortionInput): FoodPortion {
  return parseFoodPortion({
    quantity: quantityInput(input.quantity, '섭취량'),
    unit: input.unit,
    referenceQuantity: quantityInput(input.referenceQuantity, '기준량'),
    referenceNutrition: parseFoodNutritionInput(input, '기준 칼로리'),
    ...(input.referenceText ? { referenceText: input.referenceText } : {}),
  });
}

export function parsePortionedFoodInput(
  nameInput: string,
  input: FoodPortionInput,
): Omit<FavoriteFood, 'id'> {
  const name = parseFoodName(nameInput);
  const portion = parseFoodPortionInput(input);
  return {
    name,
    ...nutritionForPortion(portion),
    portion,
  };
}

export function createMealNutritionInput(food?: Omit<FavoriteFood, 'id'>): MealNutritionInput {
  const portion = createFoodPortionInput(food);
  return {
    portion,
    nutrition: nutritionInput(food),
    lastQuantity: portion.quantity,
    pendingUnit: false,
  };
}

export function changeMealQuantity(
  input: MealNutritionInput,
  quantity: string,
): MealNutritionInput {
  let portion = {
    ...input.portion,
    quantity,
  };
  const amount = Number(quantity.trim());
  if (!quantity.trim() || !isFoodQuantity(amount)) {
    return {
      ...input,
      portion,
    };
  }
  if (input.pendingUnit) {
    return {
      ...input,
      portion: {
        ...portion,
        ...input.nutrition,
        referenceQuantity: quantity,
        referenceText: undefined,
      },
      lastQuantity: quantity,
      pendingUnit: false,
    };
  }
  const referenceNutrition: FoodNutrition = { calories: Number(portion.calories) };
  for (const { key } of MACRONUTRIENTS) {
    if (portion[key].trim()) {
      referenceNutrition[key] = Number(portion[key]);
    }
  }
  const scaled = nutritionForPortion({
    quantity: amount,
    unit: portion.unit,
    referenceQuantity: Number(portion.referenceQuantity),
    referenceNutrition,
  });
  const nutrition = nutritionInput(scaled);
  for (const { key } of NUTRITION_METRICS) {
    if (!portion[key].trim()) {
      nutrition[key] = '';
    } else if (!Number.isFinite(Number(portion[key]))) {
      nutrition[key] = input.nutrition[key];
    }
  }
  const referenceInvalid = NUTRITION_METRICS.some(
    ({ key, max }) => !!portion[key].trim() && !isMealAmount(Number(portion[key]), max),
  );
  const totalsValid = NUTRITION_METRICS.every(
    ({ key, max }) =>
      (key !== 'calories' && !nutrition[key].trim()) ||
      (!!nutrition[key].trim() && isMealAmount(Number(nutrition[key]), max)),
  );
  if (referenceInvalid && totalsValid) {
    // A smaller quantity can make an oversized draft valid; store that valid amount as its basis.
    portion = {
      ...portion,
      ...nutrition,
      referenceQuantity: quantity,
      referenceText: undefined,
    };
  }
  return {
    ...input,
    portion,
    nutrition,
    lastQuantity: quantity,
  };
}

export function changeMealNutrition(
  input: MealNutritionInput,
  key: keyof FoodNutritionInput,
  value: string,
): MealNutritionInput {
  const nutrition = {
    ...input.nutrition,
    [key]: value,
  };
  return {
    ...input,
    nutrition,
    portion: {
      ...input.portion,
      ...nutrition,
      referenceQuantity: input.lastQuantity,
      referenceText: undefined,
    },
  };
}

export function changeMealUnit(
  input: MealNutritionInput,
  unit: FoodPortion['unit'],
): MealNutritionInput {
  if (unit === input.portion.unit) {
    return input;
  }
  return {
    ...input,
    portion: {
      ...input.portion,
      unit,
      quantity: '',
      referenceText: undefined,
    },
    pendingUnit: true,
  };
}

export function parseMealNutritionInput(name: string, input: MealNutritionInput) {
  quantityInput(input.portion.quantity, '섭취량');
  if (input.pendingUnit) {
    throw new Error('변경한 단위의 섭취량을 입력해 주세요.');
  }
  parseFoodNutritionInput(input.nutrition);
  return parsePortionedFoodInput(name, input.portion);
}

export function getMealNutritionPreview(input: MealNutritionInput): FoodNutrition | null {
  if (input.pendingUnit) {
    return null;
  }
  try {
    parseFoodNutritionInput(input.nutrition);
    return nutritionForPortion(parseFoodPortionInput(input.portion));
  } catch {
    // Incomplete drafts stay editable without displaying stale or invalid amounts.
    return null;
  }
}

export type FoodNutrition = {
  calories: number;
  carbohydrates?: number;
  protein?: number;
  fat?: number;
};

export type FoodPortion = {
  quantity: number;
  unit: 'g' | 'serving';
  referenceQuantity: number;
  referenceNutrition: FoodNutrition;
  referenceText?: string;
};

export type Meal = FoodNutrition & {
  id: string;
  name: string;
  slot: string;
  portion?: FoodPortion;
};

export type FavoriteFood = Omit<Meal, 'slot'>;

export const MEAL_SLOTS = ['아침', '점심', '저녁', '간식'] as const;
export const MAX_MEAL_CALORIES = 20000;
export const MAX_MACRONUTRIENT_GRAMS = 5000;
export const MAX_FOOD_QUANTITY = 100000;
export const MACRONUTRIENTS = [
  {
    key: 'carbohydrates',
    label: '탄수화물',
  },
  {
    key: 'protein',
    label: '단백질',
  },
  {
    key: 'fat',
    label: '지방',
  },
] as const;

export const NUTRITION_METRICS = [
  {
    key: 'calories',
    label: '칼로리',
    goalLabel: '하루 목표 섭취 칼로리',
    unit: 'kcal',
    max: MAX_MEAL_CALORIES,
  },
  ...MACRONUTRIENTS.map(({ key, label }) => ({
    key,
    label,
    goalLabel: `목표 ${label}`,
    unit: 'g',
    max: MAX_MACRONUTRIENT_GRAMS,
  })),
] as const;

export type NutritionKey = (typeof NUTRITION_METRICS)[number]['key'];

export type NutritionGoals = Partial<Record<NutritionKey, number>>;

export function isMealAmount(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
}

export function isFoodQuantity(value: unknown): value is number {
  return isMealAmount(value, MAX_FOOD_QUANTITY) && value > 0;
}

export function nutritionForPortion(portion: FoodPortion): FoodNutrition {
  const ratio = portion.quantity / portion.referenceQuantity;
  const scale = (amount: number) => (ratio === 1 ? amount : Math.round(amount * ratio * 100) / 100);
  const nutrition: FoodNutrition = { calories: scale(portion.referenceNutrition.calories) };
  for (const { key } of MACRONUTRIENTS) {
    const amount = portion.referenceNutrition[key];
    if (amount !== undefined) {
      nutrition[key] = scale(amount);
    }
  }
  return nutrition;
}

export const BODY_PARTS = {
  chest: 'Chest',
  back: 'Back',
  biceps: 'Biceps',
  triceps: 'Triceps',
  shoulders: 'Shoulders',
  legs: 'Legs',
} as const;

export type BodyPart = keyof typeof BODY_PARTS;

export type WorkoutSet = { reps: number; weightKg: number };

export type Workout = { id: string; name: string; bodyPart: BodyPart; sets: WorkoutSet[] };

export const MAX_WORKOUT_SETS = 100;
export const MAX_REPS = 1000;
export const MAX_WEIGHT_KG = 1000;

export type Day = { meals: Meal[]; workouts: Workout[] };

export type Store = {
  version: 1;
  days: Record<string, Day>;
  favoriteFoods?: FavoriteFood[];
  nutritionGoals?: NutritionGoals;
};

export const STORAGE_KEY = 'harugyeol.v1';
export const emptyDay = (): Day => ({
  meals: [],
  workouts: [],
});
export const emptyStore = (): Store => ({
  version: 1,
  days: {},
});
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function shiftDate(date: string, amount: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + amount);
  return localDate(value);
}
export function isDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && localDate(new Date(`${value}T12:00:00`)) === value;
}
const object = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

export function parseFoodPortion(value: unknown): FoodPortion {
  if (
    !object(value) ||
    !isFoodQuantity(value.quantity) ||
    !isFoodQuantity(value.referenceQuantity) ||
    (value.unit !== 'g' && value.unit !== 'serving') ||
    (value.referenceText !== undefined &&
      (typeof value.referenceText !== 'string' ||
        !value.referenceText.trim() ||
        value.referenceText.length > 300))
  ) {
    throw new Error('음식의 섭취량과 기준량을 확인해 주세요.');
  }
  const reference = value.referenceNutrition;
  if (!object(reference) || !isMealAmount(reference.calories, MAX_MEAL_CALORIES)) {
    throw new Error('음식의 기준 영양정보를 확인해 주세요.');
  }
  const referenceNutrition: FoodNutrition = { calories: reference.calories };
  for (const { key } of MACRONUTRIENTS) {
    if (reference[key] !== undefined) {
      if (!isMealAmount(reference[key], MAX_MACRONUTRIENT_GRAMS)) {
        throw new Error('음식의 기준 영양정보를 확인해 주세요.');
      }
      referenceNutrition[key] = reference[key];
    }
  }
  const portion: FoodPortion = {
    quantity: value.quantity,
    unit: value.unit === 'g' ? 'g' : 'serving',
    referenceQuantity: value.referenceQuantity,
    referenceNutrition,
  };
  if (typeof value.referenceText === 'string') {
    portion.referenceText = value.referenceText.trim();
  }
  const totals = nutritionForPortion(portion);
  for (const { key, label, max, unit } of NUTRITION_METRICS) {
    if (totals[key] !== undefined && !isMealAmount(totals[key], max)) {
      throw new Error(`섭취량에 따른 ${label} 합계가 ${max.toLocaleString()}${unit}를 초과합니다.`);
    }
  }
  return portion;
}

function validFoodPortion(food: Record<string, unknown>): boolean {
  if (food.portion === undefined) {
    return true;
  }
  try {
    const totals = nutritionForPortion(parseFoodPortion(food.portion));
    return NUTRITION_METRICS.every(({ key }) => totals[key] === food[key]);
  } catch {
    return false;
  }
}

export function parseNutritionGoals(value: unknown): NutritionGoals {
  if (!object(value)) {
    throw new Error('하루 섭취 목표 형식을 확인해 주세요.');
  }
  const goals: NutritionGoals = {};
  for (const { key, goalLabel, max, unit } of NUTRITION_METRICS) {
    const amount = value[key];
    if (amount === undefined) {
      continue;
    }
    if (!isMealAmount(amount, max)) {
      throw new Error(
        `${goalLabel}: 0~${max.toLocaleString()}${unit} 범위의 숫자를 입력해 주세요.`,
      );
    }
    goals[key] = amount;
  }
  return goals;
}

const bounded = (v: unknown, max: number, zero = false): v is number =>
  typeof v === 'number' && Number.isFinite(v) && v >= (zero ? 0 : 0.1) && v <= max;
const short = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.trim().length > 0 && v.length <= max;
const validFood = (value: unknown): value is FavoriteFood =>
  object(value) &&
  short(value.id, 100) &&
  short(value.name, 100) &&
  isMealAmount(value.calories, MAX_MEAL_CALORIES) &&
  MACRONUTRIENTS.every(
    ({ key }) => value[key] === undefined || isMealAmount(value[key], MAX_MACRONUTRIENT_GRAMS),
  ) &&
  validFoodPortion(value);
export function parseStore(raw: string): Store {
  const data: unknown = JSON.parse(raw);
  if (!object(data) || data.version !== 1 || !object(data.days)) {
    throw new Error('지원하지 않는 백업 형식입니다.');
  }
  const nutritionGoals =
    data.nutritionGoals === undefined ? {} : parseNutritionGoals(data.nutritionGoals);
  const favoriteFoods: FavoriteFood[] = [];
  if (data.favoriteFoods !== undefined) {
    if (!Array.isArray(data.favoriteFoods)) {
      throw new Error('즐겨찾는 음식 목록을 확인해 주세요.');
    }
    const ids = new Set<string>();
    for (const food of data.favoriteFoods) {
      if (!validFood(food) || ids.has(food.id)) {
        throw new Error('즐겨찾는 음식 목록을 확인해 주세요.');
      }
      ids.add(food.id);
      const favorite: FavoriteFood = {
        id: food.id,
        name: food.name,
        calories: food.calories,
      };
      for (const { key } of MACRONUTRIENTS) {
        if (food[key] !== undefined) {
          favorite[key] = food[key];
        }
      }
      if (food.portion !== undefined) {
        favorite.portion = parseFoodPortion(food.portion);
      }
      favoriteFoods.push(favorite);
    }
  }
  for (const [date, day] of Object.entries(data.days)) {
    if (
      !isDate(date) ||
      !object(day) ||
      !Array.isArray(day.meals) ||
      !Array.isArray(day.workouts) ||
      ('weight' in day && !(day.weight === null || bounded(day.weight, 500)))
    ) {
      throw new Error('날짜 또는 기록 형식이 올바르지 않습니다.');
    }
    const ids = new Set<string>();
    for (const meal of day.meals) {
      if (
        !validFood(meal) ||
        ids.has(meal.id) ||
        !('slot' in meal) ||
        !MEAL_SLOTS.some((slot) => slot === String(meal.slot))
      ) {
        throw new Error('식단 기록을 확인해 주세요.');
      }
      ids.add(meal.id);
    }
    for (const workout of day.workouts) {
      if (
        !object(workout) ||
        !short(workout.id, 100) ||
        ids.has(workout.id) ||
        !short(workout.name, 100) ||
        typeof workout.bodyPart !== 'string' ||
        !Object.hasOwn(BODY_PARTS, workout.bodyPart) ||
        !Array.isArray(workout.sets) ||
        workout.sets.length === 0 ||
        workout.sets.length > MAX_WORKOUT_SETS ||
        workout.sets.some(
          (set) =>
            !object(set) ||
            !Number.isInteger(set.reps) ||
            !bounded(set.reps, MAX_REPS) ||
            !bounded(set.weightKg, MAX_WEIGHT_KG, true),
        )
      ) {
        throw new Error('운동 기록을 확인해 주세요.');
      }
      ids.add(workout.id);
    }
  }
  const store = data as Store;
  return {
    version: 1,
    ...(Object.keys(nutritionGoals).length > 0 ? { nutritionGoals } : {}),
    ...(favoriteFoods.length > 0 ? { favoriteFoods } : {}),
    days: Object.fromEntries(
      Object.entries(store.days).map(([date, day]) => [
        date,
        {
          meals: day.meals.map((meal) => ({
            ...meal,
            ...(meal.portion === undefined ? {} : { portion: parseFoodPortion(meal.portion) }),
          })),
          workouts: day.workouts.map(({ id, name, bodyPart, sets }) => ({
            id,
            name,
            bodyPart,
            sets: sets.map(({ reps, weightKg }) => ({
              reps,
              weightKg,
            })),
          })),
        },
      ]),
    ),
  };
}

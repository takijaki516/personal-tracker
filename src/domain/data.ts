export type Meal = {
  id: string;
  name: string;
  slot: string;
  calories: number;
  carbohydrates?: number;
  protein?: number;
  fat?: number;
};

export type FavoriteFood = Omit<Meal, 'slot'>;

export const MAX_MEAL_CALORIES = 20000;
export const MAX_MACRONUTRIENT_GRAMS = 5000;
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

export function isMealAmount(value: unknown, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= max;
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

export type Store = { version: 1; days: Record<string, Day>; favoriteFoods?: FavoriteFood[] };

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
  );
export function parseStore(raw: string): Store {
  const data: unknown = JSON.parse(raw);
  if (!object(data) || data.version !== 1 || !object(data.days)) {
    throw new Error('지원하지 않는 백업 형식입니다.');
  }
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
        !['아침', '점심', '저녁', '간식'].includes(String(meal.slot))
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
    ...(favoriteFoods.length > 0 ? { favoriteFoods } : {}),
    days: Object.fromEntries(
      Object.entries(store.days).map(([date, day]) => [
        date,
        {
          meals: day.meals,
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

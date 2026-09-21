export type Meal = { id: string; name: string; slot: string; calories: number };

export type Workout = { id: string; name: string; minutes: number; note: string };

export type Day = { meals: Meal[]; workouts: Workout[]; weight: number | null };

export type Store = { version: 1; days: Record<string, Day> };

export const STORAGE_KEY = 'harugyeol.v1';
export const emptyDay = (): Day => ({
  meals: [],
  workouts: [],
  weight: null,
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
export function parseStore(raw: string): Store {
  const data: unknown = JSON.parse(raw);
  if (!object(data) || data.version !== 1 || !object(data.days)) {
    throw new Error('지원하지 않는 백업 형식입니다.');
  }
  for (const [date, day] of Object.entries(data.days)) {
    if (
      !isDate(date) ||
      !object(day) ||
      !Array.isArray(day.meals) ||
      !Array.isArray(day.workouts) ||
      !(day.weight === null || bounded(day.weight, 500))
    ) {
      throw new Error('날짜 또는 기록 형식이 올바르지 않습니다.');
    }
    const ids = new Set<string>();
    for (const meal of day.meals) {
      if (
        !object(meal) ||
        !short(meal.id, 100) ||
        ids.has(meal.id) ||
        !short(meal.name, 100) ||
        !['아침', '점심', '저녁', '간식'].includes(String(meal.slot)) ||
        !bounded(meal.calories, 20000, true)
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
        !bounded(workout.minutes, 1440) ||
        typeof workout.note !== 'string' ||
        workout.note.length > 500
      ) {
        throw new Error('운동 기록을 확인해 주세요.');
      }
      ids.add(workout.id);
    }
  }
  return data as Store;
}

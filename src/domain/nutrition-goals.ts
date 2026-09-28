import {
  NUTRITION_METRICS,
  parseNutritionGoals,
  type FoodNutrition,
  type NutritionKey,
} from './data';

export type NutritionGoalInput = Record<NutritionKey, string>;

export function parseNutritionGoalInput(input: NutritionGoalInput) {
  const values: Partial<Record<NutritionKey, number>> = {};
  for (const { key } of NUTRITION_METRICS) {
    const value = input[key].trim();
    if (value) {
      values[key] = Number(value);
    }
  }
  return parseNutritionGoals(values);
}

const roundAmount = (value: number) => Math.round(value * 100) / 100;

export function getDailyNutrition<T extends Partial<FoodNutrition>>(meals: readonly T[]) {
  return NUTRITION_METRICS.map((metric) => {
    let consumed = 0;
    let missing = 0;
    for (const meal of meals) {
      const amount = meal[metric.key];
      if (amount === undefined) {
        missing++;
      } else {
        consumed += amount;
      }
    }
    return {
      ...metric,
      consumed: roundAmount(consumed),
      missing,
    };
  });
}

export function getNutritionProgress(consumed: number, goal: number) {
  const difference = roundAmount(goal - consumed);
  return {
    percent: goal === 0 ? 100 : Math.min(100, Math.max(0, (consumed / goal) * 100)),
    remaining: Math.max(0, difference),
    excess: Math.max(0, -difference),
  };
}

import { NUTRITION_METRICS, type FoodNutrition } from '../../domain/data';
import { getDailyNutrition } from '../../domain/nutrition-goals';

const TOTAL_LABELS = {
  calories: '총',
  carbohydrates: '탄',
  protein: '단',
  fat: '지',
};

const formatAmount = (amount: number, unit: string) =>
  `${amount.toLocaleString('ko-KR', { maximumFractionDigits: 2 })} ${unit}`;

export function formatNutritionSummary(foods: ReadonlyArray<Partial<FoodNutrition>>): string {
  return getDailyNutrition(foods)
    .map(({ key, consumed, missing, unit }) => {
      const label = TOTAL_LABELS[key];
      if (missing > 0 && missing === foods.length) {
        return `${label}: 미입력`;
      }
      const missingText = missing > 0 ? ` (미입력 ${missing}개)` : '';
      return `${label}: ${formatAmount(consumed, unit)}${missingText}`;
    })
    .join(', ');
}

export function formatFoodNutritionSummary(food: FoodNutrition | null): string {
  return NUTRITION_METRICS.map(({ key, unit }) => {
    let value = '—';
    if (food) {
      const amount = food[key];
      value = amount === undefined ? '미입력' : formatAmount(amount, unit);
    }
    return `${TOTAL_LABELS[key]}: ${value}`;
  }).join(', ');
}

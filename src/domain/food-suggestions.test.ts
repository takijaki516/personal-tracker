import { describe, expect, it } from 'vitest';
import { emptyDay, type FavoriteFood, type Meal, type Store } from './data';
import { getFoodSuggestions, MAX_RECENT_FOOD_SUGGESTIONS } from './food-suggestions';

const meal = (id: string, name: string, calories = 100): Meal => ({
  id,
  name,
  slot: '점심',
  calories,
});
const day = (...meals: Meal[]) => ({
  ...emptyDay(),
  meals,
});

describe('local food suggestions', () => {
  it('supports empty stores and favorite-only stores', () => {
    expect(getFoodSuggestions({}, [], '')).toEqual({
      favorites: [],
      recent: [],
    });
    const rice = meal('favorite-rice', '현미밥');
    const chicken = meal('favorite-chicken', '닭가슴살');
    expect(getFoodSuggestions({}, [rice, chicken], '')).toEqual({
      favorites: [chicken, rice],
      recent: [],
    });
  });

  it('uses the newest date and last added meal for each repeated name', () => {
    const latestRice = {
      ...meal('latest-rice', ' 현미밥 ', 220),
      carbohydrates: 0,
    };
    const banana = meal('banana', '바나나');
    const yogurt = meal('yogurt', 'Yogurt');
    const days = {
      '2026-09-26': day(meal('old-rice', '현미밥', 300)),
      '2026-09-28': day(meal('morning-rice', '현미밥', 250), banana, latestRice),
      '2026-09-27': day(yogurt, meal('old-banana', '바나나', 90)),
      '2026-09-25': day(meal('old-yogurt', ' yogurt ', 120)),
    };
    expect(getFoodSuggestions(days, [], '').recent).toEqual([
      {
        food: latestRice,
        date: '2026-09-28',
      },
      {
        food: banana,
        date: '2026-09-28',
      },
      {
        food: yogurt,
        date: '2026-09-27',
      },
    ]);
  });

  it('shows a name once and prefers the saved favorite over meal history', () => {
    const favorite = meal('favorite', 'Yogurt', 130);
    const duplicateFavorite = meal('duplicate-favorite', ' yogurt ', 180);
    const banana = meal('banana', '바나나');
    expect(
      getFoodSuggestions(
        { '2026-09-28': day(meal('recorded-yogurt', 'YOGURT', 200), banana) },
        [favorite, duplicateFavorite],
        '',
      ),
    ).toEqual({
      favorites: [favorite],
      recent: [
        {
          food: banana,
          date: '2026-09-28',
        },
      ],
    });
  });

  it('filters both sections by substring without whitespace or case sensitivity', () => {
    const favorite = meal('favorite', '닭 가슴살 100g');
    const recent = meal('recent', '닭가슴살 샐러드');
    const days = { '2026-09-28': day(recent, meal('rice', '현미밥')) };
    expect(getFoodSuggestions(days, [favorite], '  닭가슴살  ')).toEqual({
      favorites: [favorite],
      recent: [
        {
          food: recent,
          date: '2026-09-28',
        },
      ],
    });
    expect(
      getFoodSuggestions({}, [meal('yogurt', 'Greek Yogurt')], 'YOG URT').favorites,
    ).toHaveLength(1);
    expect(getFoodSuggestions(days, [favorite], '없는 음식')).toEqual({
      favorites: [],
      recent: [],
    });
  });

  it('limits recent matches after filtering so older matching foods remain searchable', () => {
    const older = meal('older', '연어구이');
    const newer = Array.from({ length: 20 }, (_, index) => meal(`meal-${index}`, `음식 ${index}`));
    const days = {
      '2026-09-27': day(older),
      '2026-09-28': day(...newer),
    };
    const recent = getFoodSuggestions(days, [], '').recent;
    expect(recent).toHaveLength(MAX_RECENT_FOOD_SUGGESTIONS);
    expect(recent[0].food.id).toBe('meal-19');
    expect(recent.at(-1)?.food.id).toBe('meal-10');
    expect(getFoodSuggestions(days, [], '연어').recent).toEqual([
      {
        food: older,
        date: '2026-09-27',
      },
    ]);
  });

  it('reflects edited or deleted records without keeping a separate recent-food cache', () => {
    const original = meal('rice', '현미밥', 200);
    const updated = {
      ...original,
      calories: 220,
      protein: 0,
    };
    expect(getFoodSuggestions({ '2026-09-28': day(original) }, [], '').recent[0].food).toEqual(
      original,
    );
    expect(getFoodSuggestions({ '2026-09-28': day(updated) }, [], '').recent[0].food).toEqual(
      updated,
    );
    expect(getFoodSuggestions({ '2026-09-28': day() }, [], '').recent).toEqual([]);
  });

  it('does not change the stored meals or favorites when filtering and sorting', () => {
    const favorites: FavoriteFood[] = [meal('rice', '현미밥'), meal('chicken', '닭가슴살')];
    const days: Store['days'] = { '2026-09-28': day(meal('banana', '바나나')) };
    const original = structuredClone({
      days,
      favorites,
    });
    getFoodSuggestions(days, favorites, '');
    getFoodSuggestions(days, favorites, '닭');
    expect({
      days,
      favorites,
    }).toEqual(original);
  });
});

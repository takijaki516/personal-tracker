import { describe, expect, it } from 'vitest';
import { emptyDay, emptyStore, parseStore, type FavoriteFood, type Store } from './data';
import { upsertFavoriteFood } from './favorite-foods';
import {
  changeMealNutrition,
  changeMealQuantity,
  changeMealUnit,
  createFoodPortionInput,
  createMealNutritionInput,
  getMealNutritionPreview,
  parseFoodPortionInput,
  parseMealNutritionInput,
  parsePortionedFoodInput,
  type FoodPortionInput,
} from './food-portion';
import { foodSearchSelection } from './food-search';
import { getFoodSuggestions } from './food-suggestions';
import { getDailyNutrition } from './nutrition-goals';
import { editDocument, mergeDocuments, migrateStore, parseDocument, snapshot } from './sync-model';

const input: FoodPortionInput = {
  quantity: '200',
  unit: 'g',
  referenceQuantity: '100',
  calories: '165',
  carbohydrates: '0',
  protein: '31',
  fat: '3.6',
};
const favorite: FavoriteFood = {
  id: 'favorite',
  ...parsePortionedFoodInput('닭가슴살', input),
};
const meal = {
  ...favorite,
  id: 'meal',
  slot: '점심',
};
const store: Store = {
  ...emptyStore(),
  favoriteFoods: [favorite],
  days: {
    '2026-09-28': {
      ...emptyDay(),
      meals: [meal],
    },
  },
};

describe('meal nutrition editing with an internal reference', () => {
  it('updates displayed totals when changing quantity and preserves the original reference', () => {
    const initial = createMealNutritionInput(favorite);
    expect(initial.nutrition).toEqual({
      calories: '330',
      carbohydrates: '0',
      protein: '62',
      fat: '7.2',
    });
    const smaller = changeMealQuantity(initial, '50');
    expect(smaller.nutrition).toEqual({
      calories: '82.5',
      carbohydrates: '0',
      protein: '15.5',
      fat: '1.8',
    });
    const restored = changeMealQuantity(smaller, '200');
    expect(restored.nutrition).toEqual(initial.nutrition);
    expect(restored.portion.referenceQuantity).toBe('100');
    expect(parseMealNutritionInput(favorite.name, restored)).toEqual(
      parsePortionedFoodInput(favorite.name, input),
    );
  });

  it('treats edited nutrition as the current consumed total and preserves decimal typing', () => {
    const edited = changeMealNutrition(createMealNutritionInput(favorite), 'calories', '400.');
    expect(edited.nutrition.calories).toBe('400.');
    expect(parseMealNutritionInput(favorite.name, edited).calories).toBe(400);
    const smaller = changeMealQuantity(edited, '100');
    expect(smaller.nutrition).toEqual({
      calories: '200',
      carbohydrates: '0',
      protein: '31',
      fat: '3.6',
    });
    const saved = parseMealNutritionInput(favorite.name, smaller);
    expect(createMealNutritionInput(saved).nutrition).toEqual(smaller.nutrition);
  });

  it('keeps nutrition on unit changes and establishes the internal reference from the entered quantity', () => {
    const initial = createMealNutritionInput(favorite);
    const changed = changeMealUnit(initial, 'serving');
    expect(changed.nutrition).toEqual(initial.nutrition);
    expect(() => parseMealNutritionInput(favorite.name, changed)).toThrow('섭취량');
    const twoServings = changeMealQuantity(changed, '2');
    expect(twoServings.nutrition).toEqual(initial.nutrition);
    expect(twoServings.pendingUnit).toBe(false);
    const oneServing = changeMealQuantity(twoServings, '1');
    expect(parseMealNutritionInput(favorite.name, oneServing)).toMatchObject({
      calories: 165,
      carbohydrates: 0,
      protein: 31,
      fat: 3.6,
      portion: {
        unit: 'serving',
        quantity: 1,
        referenceQuantity: 2,
      },
    });
  });

  it('uses the last valid quantity while the quantity input is incomplete', () => {
    const incomplete = changeMealQuantity(createMealNutritionInput(favorite), '');
    const edited = changeMealNutrition(incomplete, 'calories', '500');
    expect(() => parseMealNutritionInput(favorite.name, edited)).toThrow('섭취량');
    const restored = changeMealQuantity(edited, '100');
    expect(restored.nutrition.calories).toBe('250');
    expect(parseMealNutritionInput(favorite.name, restored).calories).toBe(250);
  });

  it('accepts a corrected quantity after a too-large draft without requiring a hidden field', () => {
    const tooLarge = changeMealNutrition(createMealNutritionInput(favorite), 'calories', '40000');
    expect(() => parseMealNutritionInput(favorite.name, tooLarge)).toThrow('총 칼로리');
    const smaller = changeMealQuantity(tooLarge, '50');
    expect(smaller.nutrition.calories).toBe('10000');
    expect(parseMealNutritionInput(favorite.name, smaller).calories).toBe(10000);
    expect(changeMealQuantity(smaller, '100').nutrition.calories).toBe('20000');
  });

  it('preserves invalid nutrient input without preventing other totals from scaling', () => {
    const invalid = changeMealNutrition(createMealNutritionInput(favorite), 'protein', 'abc');
    const smaller = changeMealQuantity(invalid, '50');
    expect(smaller.nutrition).toEqual({
      calories: '82.5',
      carbohydrates: '0',
      protein: 'abc',
      fat: '1.8',
    });
    expect(() => parseMealNutritionInput(favorite.name, smaller)).toThrow('단백질');
    const cleared = changeMealNutrition(smaller, 'protein', '');
    const bigger = changeMealQuantity(cleared, '100');
    expect(parseMealNutritionInput(favorite.name, bigger)).toMatchObject({
      calories: 165,
      fat: 3.6,
    });
    expect(parseMealNutritionInput(favorite.name, bigger).protein).toBeUndefined();
  });
});

describe('meal nutrition previews', () => {
  it('updates food previews and section totals after quantity and nutrition edits', () => {
    const initial = createMealNutritionInput(favorite);
    expect(getMealNutritionPreview(initial)).toEqual({
      calories: 330,
      carbohydrates: 0,
      protein: 62,
      fat: 7.2,
    });
    const smaller = changeMealQuantity(initial, '100');
    const edited = changeMealNutrition(smaller, 'protein', '40');
    expect(getMealNutritionPreview(edited)).toEqual({
      calories: 165,
      carbohydrates: 0,
      protein: 40,
      fat: 3.6,
    });
    const larger = changeMealQuantity(edited, '200');
    const rice = createMealNutritionInput({
      name: '현미밥',
      calories: 300,
      carbohydrates: 65.5,
      protein: 6,
      fat: 0,
    });
    const totals = getDailyNutrition(
      [larger, rice].map((draft) => getMealNutritionPreview(draft) ?? {}),
    );
    expect(totals.map(({ consumed }) => consumed)).toEqual([630, 65.5, 86, 7.2]);
    expect(totals.map(({ missing }) => missing)).toEqual([0, 0, 0, 0]);
  });

  it('distinguishes missing nutrients from zero in food previews and meal totals', () => {
    const preview = getMealNutritionPreview(
      createMealNutritionInput({
        name: '기존 식단',
        calories: 120,
        carbohydrates: 0,
      }),
    );
    expect(preview).toEqual({
      calories: 120,
      carbohydrates: 0,
    });
    const totals = getDailyNutrition([
      getMealNutritionPreview(createMealNutritionInput(favorite)) ?? {},
      preview ?? {},
    ]);
    expect(totals.map(({ consumed }) => consumed)).toEqual([450, 0, 62, 7.2]);
    expect(totals.map(({ missing }) => missing)).toEqual([0, 0, 1, 1]);
  });

  it.each([
    {
      label: 'empty quantity',
      draft: changeMealQuantity(createMealNutritionInput(favorite), ''),
    },
    {
      label: 'zero quantity',
      draft: changeMealQuantity(createMealNutritionInput(favorite), '0'),
    },
    {
      label: 'pending unit',
      draft: changeMealUnit(createMealNutritionInput(favorite), 'serving'),
    },
    {
      label: 'missing calories',
      draft: changeMealNutrition(createMealNutritionInput(favorite), 'calories', ''),
    },
    {
      label: 'invalid nutrient',
      draft: changeMealNutrition(createMealNutritionInput(favorite), 'protein', 'abc'),
    },
    {
      label: 'totals outside the allowed range',
      draft: changeMealQuantity(createMealNutritionInput(favorite), '20000'),
    },
  ])('does not preview stale or invalid values for $label', ({ draft }) => {
    expect(getMealNutritionPreview(draft)).toBeNull();
  });

  it('excludes incomplete food quantities from section totals until corrected', () => {
    const initial = createMealNutritionInput(favorite);
    const incomplete = changeMealQuantity(initial, '');
    const incompleteTotals = getDailyNutrition(
      [initial, incomplete].map((draft) => getMealNutritionPreview(draft) ?? {}),
    );
    expect(incompleteTotals.map(({ consumed }) => consumed)).toEqual([330, 0, 62, 7.2]);
    expect(incompleteTotals.map(({ missing }) => missing)).toEqual([1, 1, 1, 1]);
    const corrected = changeMealQuantity(incomplete, '100');
    expect(getMealNutritionPreview(corrected)).toEqual({
      calories: 165,
      carbohydrates: 0,
      protein: 31,
      fat: 3.6,
    });
  });
});

describe('food quantity calculations', () => {
  it('scales all nutrients using grams, fractions and the original reference', () => {
    expect(parsePortionedFoodInput(' 닭가슴살 ', input)).toMatchObject({
      name: '닭가슴살',
      calories: 330,
      carbohydrates: 0,
      protein: 62,
      fat: 7.2,
    });
    expect(
      parsePortionedFoodInput('닭가슴살', {
        ...input,
        quantity: '50',
      }),
    ).toMatchObject({
      calories: 82.5,
      carbohydrates: 0,
      protein: 15.5,
      fat: 1.8,
    });
    let food = favorite;
    for (const quantity of ['333', '50', '200', '100']) {
      food = {
        id: 'favorite',
        ...parsePortionedFoodInput(food.name, {
          ...createFoodPortionInput(food),
          quantity,
        }),
      };
    }
    expect(food).toMatchObject({
      calories: 165,
      carbohydrates: 0,
      protein: 31,
      fat: 3.6,
    });
    expect(food.portion?.referenceNutrition).toEqual(favorite.portion?.referenceNutrition);
  });

  it('uses the exact FatSecret serving weight and preserves its nutrition after a round trip', () => {
    const selected = foodSearchSelection({
      name: '닭가슴살',
      servingText: '1팩 (110g)',
      servingGrams: 110,
      calories: 115,
      carbohydrates: 0,
      protein: 24,
      fat: 1.6,
      sourceUrl: 'https://www.fatsecret.kr/칼로리-영양소/하림/닭가슴살/1팩',
    });
    const scaled = parsePortionedFoodInput(selected.name, {
      ...createFoodPortionInput(selected),
      quantity: '200',
    });
    expect(scaled).toMatchObject({
      calories: 209.09,
      carbohydrates: 0,
      protein: 43.64,
      fat: 2.91,
    });
    expect(
      parsePortionedFoodInput(selected.name, {
        ...createFoodPortionInput(scaled),
        quantity: '110',
      }),
    ).toEqual(selected);
  });

  it('treats legacy records as one serving and keeps unknown macros absent', () => {
    const legacy = {
      name: '기존 식단',
      calories: 200,
      carbohydrates: 0,
    };
    const initial = createFoodPortionInput(legacy);
    expect(initial).toMatchObject({
      unit: 'serving',
      quantity: '1',
      referenceQuantity: '1',
    });
    const scaled = parsePortionedFoodInput(legacy.name, {
      ...initial,
      quantity: '0.5',
    });
    expect(scaled).toMatchObject({
      calories: 100,
      carbohydrates: 0,
    });
    expect(scaled.protein).toBeUndefined();
    expect(scaled.fat).toBeUndefined();
    const highPrecision = {
      name: '직접 입력',
      calories: 0.12345,
    };
    expect(
      parsePortionedFoodInput(highPrecision.name, createFoodPortionInput(highPrecision)).calories,
    ).toBe(0.12345);
  });

  it.each(['quantity', 'referenceQuantity'] as const)('rejects invalid $key', (key) => {
    for (const value of ['', ' ', '0', '-1', '100001', 'Infinity', 'NaN', 'abc']) {
      expect(() =>
        parseFoodPortionInput({
          ...input,
          [key]: value,
        }),
      ).toThrow(key === 'quantity' ? '섭취량' : '기준량');
    }
  });

  it('blocks overflowing totals and invalid base nutrition instead of saving partial values', () => {
    expect(() =>
      parseFoodPortionInput({
        ...input,
        quantity: '100000',
      }),
    ).toThrow('칼로리 합계');
    expect(() =>
      parseFoodPortionInput({
        ...input,
        calories: '0',
        protein: '5000',
      }),
    ).toThrow('단백질 합계');
    expect(() =>
      parseFoodPortionInput({
        ...input,
        calories: '',
      }),
    ).toThrow('기준 칼로리');
    expect(() =>
      parseFoodPortionInput({
        ...input,
        fat: 'abc',
      }),
    ).toThrow('지방');
    expect(() =>
      parseFoodPortionInput({
        ...input,
        referenceQuantity: '1e-320',
      }),
    ).toThrow('칼로리 합계');
  });

  it('uses consumed totals for the daily sum and restores reference data in favorites and recents', () => {
    const updated = {
      ...favorite,
      ...parsePortionedFoodInput(favorite.name, {
        ...input,
        quantity: '50',
      }),
    };
    const favorites = upsertFavoriteFood([favorite], updated);
    expect(favorites).toHaveLength(1);
    expect(createFoodPortionInput(favorites[0])).toMatchObject({
      quantity: '50',
      calories: '165',
    });
    const recent = getFoodSuggestions(store.days, [], '').recent[0].food;
    expect(createFoodPortionInput(recent)).toEqual(input);
    expect(getDailyNutrition([meal]).map(({ consumed }) => consumed)).toEqual([330, 0, 62, 7.2]);
  });
});

describe('quantity persistence and synchronization', () => {
  it('preserves portion data through backups, migration and stale favorite or meal edits', () => {
    expect(parseStore(JSON.stringify(store))).toEqual(store);
    const initial = migrateStore(store, 'a');
    expect(snapshot(initial)).toEqual(store);
    const changedMeal = {
      ...meal,
      ...parsePortionedFoodInput(meal.name, {
        ...input,
        quantity: '50',
      }),
    };
    const changedStore = {
      ...store,
      days: {
        '2026-09-28': {
          ...emptyDay(),
          meals: [changedMeal],
        },
      },
    };
    const remoteMeal = editDocument(initial, store, changedStore);
    const changedFavorite = {
      ...favorite,
      ...parsePortionedFoodInput(favorite.name, {
        ...input,
        quantity: '300',
      }),
    };
    const localFavorite = editDocument(remoteMeal, store, {
      ...store,
      favoriteFoods: [changedFavorite],
    });
    expect(snapshot(localFavorite)).toEqual({
      ...changedStore,
      favoriteFoods: [changedFavorite],
    });
    expect(snapshot(mergeDocuments(localFavorite, initial))).toEqual(snapshot(localFavorite));
  });

  it.each([
    { quantity: 0 },
    { quantity: '200' },
    { referenceQuantity: 0 },
    { unit: 'ml' },
    { unit: ['g'] },
    { referenceText: '' },
    { referenceNutrition: null },
    {
      referenceNutrition: {
        calories: 100,
        protein: -1,
      },
    },
    {
      referenceNutrition: {
        calories: 100,
        carbohydrates: 0,
        protein: 31,
        fat: 3.6,
      },
    },
  ])('rejects invalid or inconsistent portion data in meals, favorites and sync: %j', (changes) => {
    const invalid = {
      ...favorite,
      portion: {
        ...favorite.portion,
        ...changes,
      },
    };
    expect(() =>
      parseStore(
        JSON.stringify({
          ...emptyStore(),
          favoriteFoods: [invalid],
        }),
      ),
    ).toThrow('즐겨찾는 음식 목록');
    const invalidMeal = {
      ...invalid,
      id: 'meal',
      slot: '점심',
    };
    expect(() =>
      parseStore(
        JSON.stringify({
          ...emptyStore(),
          days: {
            '2026-09-28': {
              ...emptyDay(),
              meals: [invalidMeal],
            },
          },
        }),
      ),
    ).toThrow('식단 기록');
    const doc = migrateStore(store, 'a');
    const entry = Object.values(doc.entries).find((item) => item.kind === 'meal');
    expect(entry).toBeDefined();
    const changedDoc = {
      ...doc,
      entries: Object.fromEntries(
        Object.entries(doc.entries).map(([key, value]) => [
          key,
          value.kind === 'meal'
            ? {
                ...value,
                value: invalidMeal,
              }
            : value,
        ]),
      ),
    };
    expect(() => parseDocument(JSON.stringify(changedDoc))).toThrow('식단 기록');
  });
});

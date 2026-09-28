import { describe, expect, it } from 'vitest';
import {
  emptyDay,
  emptyStore,
  NUTRITION_METRICS,
  parseNutritionGoals,
  parseStore,
  type Meal,
  type NutritionGoals,
  type Store,
} from './data';
import {
  getDailyNutrition,
  getNutritionProgress,
  parseNutritionGoalInput,
  type NutritionGoalInput,
} from './nutrition-goals';
import {
  editDocument,
  entryKey,
  mergeDocuments,
  migrateStore,
  newDocument,
  parseDocument,
  snapshot,
} from './sync-model';

const goals: NutritionGoals = {
  calories: 2000,
  carbohydrates: 250,
  protein: 150,
  fat: 60,
};
const input: NutritionGoalInput = {
  calories: ' 2000 ',
  carbohydrates: '250',
  protein: '150',
  fat: '60',
};
const withGoals = (nutritionGoals: NutritionGoals = goals): Store => ({
  ...emptyStore(),
  nutritionGoals,
});
const meal: Meal = {
  id: 'rice',
  name: '현미밥',
  slot: '점심',
  calories: 300,
  carbohydrates: 65.5,
  protein: 6,
  fat: 0,
};
const mealsStore: Store = {
  ...withGoals(),
  days: {
    '2026-09-28': {
      ...emptyDay(),
      meals: [meal],
    },
  },
};

describe('daily nutrition goal validation', () => {
  it('accepts independent goals, decimals and zero, and clears blank fields', () => {
    expect(parseNutritionGoalInput(input)).toEqual(goals);
    expect(
      parseNutritionGoalInput({
        calories: '',
        carbohydrates: ' ',
        protein: ' 120.5 ',
        fat: '0',
      }),
    ).toEqual({
      protein: 120.5,
      fat: 0,
    });
    expect(
      parseNutritionGoalInput({
        calories: '',
        carbohydrates: '',
        protein: '',
        fat: '',
      }),
    ).toEqual({});
  });

  it.each(NUTRITION_METRICS)(
    'rejects invalid $key in input, stored data and synchronization',
    ({ key, goalLabel, max }) => {
      for (const value of [-1, max + 1, Infinity, NaN, 'abc', null, {}]) {
        const invalidGoals = {
          ...goals,
          [key]: value,
        };
        expect(() => parseNutritionGoals(invalidGoals)).toThrow(goalLabel);
        expect(() =>
          parseStore(
            JSON.stringify({
              ...emptyStore(),
              nutritionGoals: invalidGoals,
            }),
          ),
        ).toThrow(goalLabel);
        const doc = migrateStore(withGoals(), 'a');
        Object.values(doc.entries)[0].value = {
          id: 'daily',
          ...invalidGoals,
        };
        expect(() => parseDocument(JSON.stringify(doc))).toThrow(goalLabel);
      }
      for (const value of ['-1', String(max + 1), 'Infinity', 'NaN', 'abc']) {
        expect(() =>
          parseNutritionGoalInput({
            ...input,
            [key]: value,
          }),
        ).toThrow(goalLabel);
      }
    },
  );

  it.each([null, [], '2000', 2000])('rejects a malformed goals object: %j', (value) => {
    expect(() =>
      parseStore(
        JSON.stringify({
          ...emptyStore(),
          nutritionGoals: value,
        }),
      ),
    ).toThrow('하루 섭취 목표 형식');
  });

  it('keeps old backups compatible and normalizes empty or extra settings', () => {
    expect(parseStore(JSON.stringify(emptyStore()))).toEqual(emptyStore());
    expect(parseStore(JSON.stringify(withGoals({})))).toEqual(emptyStore());
    expect(
      parseStore(
        JSON.stringify({
          ...withGoals(),
          nutritionGoals: {
            ...goals,
            id: 'unused',
            other: 123,
          },
        }),
      ),
    ).toEqual(withGoals());
    expect(parseStore(JSON.stringify(withGoals({ protein: 0 })))).toEqual(
      withGoals({ protein: 0 }),
    );
  });
});

describe('daily nutrition totals and progress', () => {
  it('sums the selected meals and counts missing nutrients separately from zero', () => {
    const totals = getDailyNutrition([
      {
        ...meal,
        calories: 0.1,
        carbohydrates: 0,
        protein: 0.1,
        fat: 0,
      },
      {
        ...meal,
        id: 'other',
        calories: 0.2,
        carbohydrates: 10,
        protein: 0.2,
        fat: 5,
      },
      {
        id: 'unknown',
        name: '기존 식단',
        slot: '저녁',
        calories: 200,
      },
    ]);
    expect(
      totals.map(({ key, consumed, missing }) => ({
        key,
        consumed,
        missing,
      })),
    ).toEqual([
      {
        key: 'calories',
        consumed: 200.3,
        missing: 0,
      },
      {
        key: 'carbohydrates',
        consumed: 10,
        missing: 1,
      },
      {
        key: 'protein',
        consumed: 0.3,
        missing: 1,
      },
      {
        key: 'fat',
        consumed: 5,
        missing: 1,
      },
    ]);
    expect(
      getDailyNutrition([]).map(({ consumed, missing }) => ({
        consumed,
        missing,
      })),
    ).toEqual(
      Array.from({ length: 4 }, () => ({
        consumed: 0,
        missing: 0,
      })),
    );
  });

  it('reports remaining and excess amounts without overflowing the progress bar', () => {
    expect(getNutritionProgress(300, 2000)).toEqual({
      percent: 15,
      remaining: 1700,
      excess: 0,
    });
    expect(getNutritionProgress(0.3, 0.3)).toEqual({
      percent: 100,
      remaining: 0,
      excess: 0,
    });
    expect(getNutritionProgress(2500, 2000)).toEqual({
      percent: 100,
      remaining: 0,
      excess: 500,
    });
    expect(getNutritionProgress(0, 0)).toEqual({
      percent: 100,
      remaining: 0,
      excess: 0,
    });
    expect(getNutritionProgress(10, 0)).toEqual({
      percent: 100,
      remaining: 0,
      excess: 10,
    });
  });
});

describe('nutrition goal synchronization', () => {
  it('round trips goals without inventing a calendar day', () => {
    expect(snapshot(migrateStore(withGoals(), 'a'))).toEqual(withGoals());
    expect(snapshot(editDocument(newDocument('a'), emptyStore(), withGoals()))).toEqual(
      withGoals(),
    );
    expect(snapshot(migrateStore(withGoals({ fat: 0 }), 'a'))).toEqual(withGoals({ fat: 0 }));
  });

  it('preserves remote goal changes during stale meal edits and remote meals during goal edits', () => {
    const initial = migrateStore(withGoals(), 'a');
    const changedGoals = withGoals({
      ...goals,
      calories: 2200,
    });
    const remoteGoals = editDocument(initial, withGoals(), changedGoals);
    const savedMeals = editDocument(remoteGoals, withGoals(), mealsStore);
    expect(snapshot(savedMeals)).toEqual({
      ...mealsStore,
      nutritionGoals: changedGoals.nutritionGoals,
    });

    const remoteMeals = editDocument(initial, withGoals(), mealsStore);
    const savedGoals = editDocument(remoteMeals, withGoals(), changedGoals);
    expect(snapshot(savedGoals)).toEqual(snapshot(savedMeals));
  });

  it('converges after concurrent edits and does not resurrect cleared goals on repeated merges', () => {
    const initial = migrateStore(mealsStore, 'a');
    const changed = {
      ...mealsStore,
      nutritionGoals: {
        ...goals,
        protein: 160,
      },
    };
    const a = editDocument(initial, mealsStore, changed);
    const other = {
      ...mealsStore,
      nutritionGoals: { calories: 2400 },
    };
    const b = editDocument(
      {
        ...initial,
        device: 'b',
      },
      mealsStore,
      other,
    );
    const merged = mergeDocuments(a, b);
    expect(snapshot(merged)).toEqual(other);
    expect(snapshot(mergeDocuments(b, a))).toEqual(other);

    const cleared = {
      version: 1 as const,
      days: mealsStore.days,
    };
    const removed = editDocument(merged, other, cleared);
    expect(snapshot(mergeDocuments(mergeDocuments(a, removed), initial))).toEqual(cleared);
    expect(snapshot(mergeDocuments(removed, b))).toEqual(cleared);
    expect(editDocument(removed, cleared, cleared)).toEqual(removed);
  });

  it('rejects dated goals, additional goal entries and mismatched value IDs', () => {
    const doc = migrateStore(withGoals(), 'a');
    const entry = Object.values(doc.entries)[0];
    const dated = {
      ...entry,
      date: '2026-09-28',
    };
    expect(() =>
      parseDocument(
        JSON.stringify({
          ...doc,
          entries: { [entryKey(dated)]: dated },
        }),
      ),
    ).toThrow('올바르지 않은 동기화 기록');
    const other = {
      ...entry,
      id: 'another',
      value: {
        id: 'another',
        ...goals,
      },
    };
    expect(() =>
      parseDocument(
        JSON.stringify({
          ...doc,
          entries: { [entryKey(other)]: other },
        }),
      ),
    ).toThrow('섭취 목표 기록 키');
    entry.value = {
      id: 'wrong',
      ...goals,
    };
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('기록 ID가 일치하지 않습니다.');
  });
});

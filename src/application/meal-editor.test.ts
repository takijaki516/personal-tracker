import { describe, expect, it, vi } from 'vitest';
import { emptyDay, emptyStore, parseStore, type Day, type Store } from '../domain/data';
import { changeMealNutrition, changeMealQuantity } from '../domain/food-portion';
import { foodSearchSelection } from '../domain/food-search';
import { getDailyNutrition } from '../domain/nutrition-goals';
import { editDocument, mergeDocuments, migrateStore, snapshot } from '../domain/sync-model';
import type { SyncDocument } from '../domain/sync-model';
import { createEngine, type LocalAdapter } from './local-engine';
import {
  applyMealFoodInputs,
  applyMealSectionInputs,
  createMealFoodInput,
  createMealSectionInputs,
  MealSectionError,
  type MealFoodInput,
  type MealSectionInput,
} from './meal-editor';
import { loadRecords, saveRecords, type StoragePort } from './record-repository';

const date = '2026-09-28';
const rice = createMealFoodInput('rice', {
  name: '현미밥',
  calories: 300,
  carbohydrates: 60,
});

describe('foods in separate meal sections', () => {
  const sections: MealSectionInput[] = [
    {
      slot: '아침',
      foods: [
        rice,
        createMealFoodInput('egg', {
          name: '달걀',
          calories: 150,
          protein: 12,
        }),
      ],
    },
    {
      slot: '점심',
      foods: [
        {
          ...chicken,
          nutritionInput: changeMealQuantity(chicken.nutritionInput, '200'),
        },
      ],
    },
    {
      slot: '저녁',
      foods: [
        {
          ...rice,
          id: 'dinner-rice',
          nutritionInput: changeMealQuantity(rice.nutritionInput, '0.5'),
        },
      ],
    },
    {
      slot: '간식',
      foods: [
        createMealFoodInput('apple', {
          name: '사과',
          calories: 100,
        }),
      ],
    },
  ];

  function recordedDay(): Day {
    return {
      ...applyMealSectionInputs(emptyDay(), sections),
      workouts: [
        {
          id: 'squat',
          name: '스쿼트',
          bodyPart: 'legs',
          sets: [
            {
              reps: 10,
              weightKg: 20,
            },
          ],
        },
      ],
    };
  }

  it('saves all four sections with one write and retains existing meals and workouts', async () => {
    const before: Day = {
      meals: [
        {
          id: 'existing',
          name: '우유',
          slot: '간식',
          calories: 120,
        },
      ],
      workouts: [
        {
          id: 'squat',
          name: '스쿼트',
          bodyPart: 'legs',
          sets: [
            {
              reps: 10,
              weightKg: 20,
            },
          ],
        },
      ],
    };
    const original = structuredClone(before);
    const next = storeWithDay(applyMealSectionInputs(before, sections));
    let raw: string | null = JSON.stringify(storeWithDay(before));
    const write = vi.fn<StoragePort['write']>(async (value) => {
      raw = value;
    });
    const storage: StoragePort = {
      read: async () => raw,
      write,
    };
    await saveRecords(storage, next, storeWithDay(before));
    expect(write).toHaveBeenCalledTimes(1);
    const loaded = await loadRecords(storage);
    expect(loaded).toEqual(next);
    expect(loaded.days[date].meals).toMatchObject([
      before.meals[0],
      {
        id: 'rice',
        slot: '아침',
        calories: 300,
      },
      {
        id: 'egg',
        slot: '아침',
        calories: 150,
      },
      {
        id: 'chicken',
        slot: '점심',
        calories: 330,
        portion: {
          quantity: 200,
          unit: 'g',
        },
      },
      {
        id: 'dinner-rice',
        slot: '저녁',
        calories: 150,
        portion: {
          quantity: 0.5,
          unit: 'serving',
        },
      },
      {
        id: 'apple',
        slot: '간식',
        calories: 100,
      },
    ]);
    expect(loaded.days[date].workouts).toEqual(before.workouts);
    expect(before).toEqual(original);
    expect(parseStore(JSON.stringify(loaded))).toEqual(next);
  });

  it('ignores empty sections and rejects saving without any foods', () => {
    const emptySections: MealSectionInput[] = [
      {
        slot: '아침',
        foods: [],
      },
      {
        slot: '저녁',
        foods: [],
      },
    ];
    const next = applyMealSectionInputs(emptyDay(), [
      ...emptySections,
      {
        slot: '점심',
        foods: [chicken],
      },
    ]);
    expect(next.meals).toMatchObject([
      {
        id: 'chicken',
        slot: '점심',
      },
    ]);
    expect(() => applyMealSectionInputs(next, emptySections)).toThrow('한 개 이상');
    expect(() => applyMealSectionInputs(next, [])).toThrow('한 개 이상');
  });

  it('identifies the invalid section and rejects the entire batch without changing the day', () => {
    const day = applyMealFoodInputs(emptyDay(), '간식', [rice], null);
    const original = structuredClone(day);
    const invalid: MealSectionInput[] = [
      {
        slot: '아침',
        foods: [chicken],
      },
      {
        slot: '저녁',
        foods: [
          {
            ...rice,
            name: '',
          },
        ],
      },
    ];
    expect(() => applyMealSectionInputs(day, invalid)).toThrow(MealSectionError);
    expect(() => applyMealSectionInputs(day, invalid)).toThrow('저녁: 음식 1: 음식 이름');
    expect(day).toEqual(original);
  });

  it('rejects duplicate IDs across different sections', () => {
    const day = emptyDay();
    const duplicate: MealSectionInput[] = [
      {
        slot: '아침',
        foods: [rice],
      },
      {
        slot: '점심',
        foods: [rice],
      },
    ];
    expect(() => applyMealSectionInputs(day, duplicate)).toThrow('점심: 음식 기록 ID가 중복');
    expect(day).toEqual(emptyDay());
  });

  it('keeps each food in its own section without duplicates on repeated saves', () => {
    const first = applyMealSectionInputs(emptyDay(), sections);
    expect(applyMealSectionInputs(first, sections)).toEqual(first);
    expect(first.meals).toHaveLength(5);
  });

  it('keeps the previous store on a failed section batch write and retries the complete batch', async () => {
    let document: SyncDocument | null = null;
    const commit = vi.fn<LocalAdapter['commit']>(async (next) => {
      document = structuredClone(next);
    });
    const engine = createEngine({
      load: async () => document,
      commit,
      legacy: async () => null,
      backup: async () => {},
      uuid: () => 'device',
    });
    const before = storeWithDay(
      applyMealFoodInputs(
        emptyDay(),
        '간식',
        [
          createMealFoodInput('existing', {
            name: '우유',
            calories: 120,
          }),
        ],
        null,
      ),
    );
    await engine.write(JSON.stringify(before));
    const after = storeWithDay(applyMealSectionInputs(before.days[date], sections));
    commit.mockRejectedValueOnce(new Error('disk full'));
    await expect(saveRecords(engine, after, before)).rejects.toThrow('disk full');
    expect(await loadRecords(engine)).toEqual(before);
    await saveRecords(engine, after, before);
    const loaded = await loadRecords(engine);
    expect(loaded.days[date].meals).toEqual(expect.arrayContaining(after.days[date].meals));
    expect(loaded.days[date].meals).toHaveLength(6);
    expect(loaded.days[date].workouts).toEqual([]);
  });

  it('loads the recorded foods into their sections and saves their IDs and quantities without duplicates', () => {
    const day = recordedDay();
    const inputs = createMealSectionInputs(day);
    expect(
      inputs.map(({ slot, foods }) => ({
        slot,
        ids: foods.map(({ id }) => id),
      })),
    ).toEqual([
      {
        slot: '아침',
        ids: ['rice', 'egg'],
      },
      {
        slot: '점심',
        ids: ['chicken'],
      },
      {
        slot: '저녁',
        ids: ['dinner-rice'],
      },
      {
        slot: '간식',
        ids: ['apple'],
      },
    ]);
    expect(inputs[1].foods[0].nutritionInput.portion.quantity).toBe('200');
    expect(inputs[1].foods[0].nutritionInput.nutrition.protein).toBe('62');
    expect(
      applyMealSectionInputs(
        day,
        inputs,
        day.meals.map(({ id }) => id),
      ),
    ).toEqual(day);
  });

  it('updates and removes recorded foods and adds another while preserving workouts', () => {
    const day = recordedDay();
    const original = structuredClone(day);
    const inputs = createMealSectionInputs(day).map(({ slot, foods }) => ({
      slot,
      foods: foods
        .filter(({ id }) => id !== 'chicken')
        .map((food) =>
          food.id === 'rice'
            ? {
                ...food,
                nutritionInput: changeMealQuantity(food.nutritionInput, '0.5'),
              }
            : food,
        ),
    }));
    inputs[3].foods.push(
      createMealFoodInput('yogurt', {
        name: '요거트',
        calories: 80,
        protein: 5,
      }),
    );
    const ids = day.meals.map(({ id }) => id);
    const next = applyMealSectionInputs(day, inputs, ids);
    expect(next.meals.map(({ id }) => id)).toEqual([
      'rice',
      'egg',
      'dinner-rice',
      'apple',
      'yogurt',
    ]);
    expect(next.meals[0]).toMatchObject({
      id: 'rice',
      slot: '아침',
      calories: 150,
      carbohydrates: 30,
      portion: {
        quantity: 0.5,
        unit: 'serving',
      },
    });
    expect(next.meals[4]).toMatchObject({
      id: 'yogurt',
      slot: '간식',
      calories: 80,
    });
    expect(next.workouts).toEqual(day.workouts);
    expect(applyMealSectionInputs(next, inputs, ids)).toEqual(next);
    expect(day).toEqual(original);
    expect(parseStore(JSON.stringify(storeWithDay(next))).days[date]).toEqual(next);
  });

  it('allows removing all loaded foods and retains foods added after the editor opened', () => {
    const day = recordedDay();
    const ids = day.meals.map(({ id }) => id);
    const emptyInputs = createMealSectionInputs(day).map(({ slot }) => ({
      slot,
      foods: [],
    }));
    const cleared = applyMealSectionInputs(day, emptyInputs, ids);
    expect(cleared.meals).toEqual([]);
    expect(cleared.workouts).toEqual(day.workouts);
    const additional = {
      id: 'new-milk',
      name: '우유',
      slot: '점심',
      calories: 120,
    };
    const latest = {
      ...day,
      meals: [...day.meals, additional],
    };
    expect(applyMealSectionInputs(latest, emptyInputs, ids).meals).toEqual([additional]);
  });

  it('rejects an invalid edited section before applying any removals', () => {
    const day = recordedDay();
    const original = structuredClone(day);
    const inputs = createMealSectionInputs(day).map(({ slot, foods }) => ({
      slot,
      foods: foods
        .filter(({ id }) => id !== 'chicken')
        .map((food) =>
          food.id === 'apple'
            ? {
                ...food,
                name: '',
              }
            : food,
        ),
    }));
    const ids = day.meals.map(({ id }) => id);
    expect(() => applyMealSectionInputs(day, inputs, ids)).toThrow('간식: 음식 1: 음식 이름');
    expect(day).toEqual(original);
  });

  it('retries a failed removal save and keeps deletion markers when the old document is merged', async () => {
    let document: SyncDocument | null = null;
    const commit = vi.fn<LocalAdapter['commit']>(async (next) => {
      document = structuredClone(next);
    });
    const engine = createEngine({
      load: async () => document,
      commit,
      legacy: async () => null,
      backup: async () => {},
      uuid: () => 'device',
    });
    const seed: Store = {
      ...emptyStore(),
      nutritionGoals: { calories: 2000 },
      days: {
        [date]: recordedDay(),
        '2026-09-27': applyMealFoodInputs(emptyDay(), '점심', [rice], null),
      },
    };
    await engine.write(JSON.stringify(seed));
    const before = await loadRecords(engine);
    const previousDocument = await engine.document();
    const day = before.days[date];
    const after = {
      ...before,
      days: {
        ...before.days,
        [date]: applyMealSectionInputs(
          day,
          [],
          day.meals.map(({ id }) => id),
        ),
      },
    };
    commit.mockRejectedValueOnce(new Error('disk full'));
    await expect(saveRecords(engine, after, before)).rejects.toThrow('disk full');
    expect(await loadRecords(engine)).toEqual(before);
    await saveRecords(engine, after, before);
    expect(await loadRecords(engine)).toEqual(after);
    const saved = await engine.document();
    await saveRecords(engine, after, after);
    expect(await engine.document()).toEqual(saved);
    expect(snapshot(mergeDocuments(saved, previousDocument))).toEqual(after);
  });
});
const chicken = createMealFoodInput(
  'chicken',
  foodSearchSelection({
    name: '닭가슴살',
    servingText: '100g',
    servingGrams: 100,
    calories: 165,
    carbohydrates: 0,
    protein: 31,
    fat: 3.6,
    sourceUrl: 'https://www.fatsecret.kr/칼로리-영양소/닭가슴살',
  }),
);
const storeWithDay = (day: Day): Store => ({
  ...emptyStore(),
  days: { [date]: day },
});

describe('multiple foods in a meal editor', () => {
  it('saves all foods together with individual quantities and includes them in daily totals', async () => {
    const inputs = [
      rice,
      {
        ...chicken,
        nutritionInput: changeMealQuantity(chicken.nutritionInput, '200'),
      },
    ];
    const next = storeWithDay(applyMealFoodInputs(emptyDay(), '점심', inputs, null));
    let raw: string | null = null;
    const write = vi.fn<StoragePort['write']>(async (value) => {
      raw = value;
    });
    const storage: StoragePort = {
      read: async () => raw,
      write,
    };
    await saveRecords(storage, next, emptyStore());
    expect(write).toHaveBeenCalledTimes(1);
    const loaded = await loadRecords(storage);
    expect(loaded).toEqual(next);
    expect(loaded.days[date].meals).toMatchObject([
      {
        id: 'rice',
        slot: '점심',
        calories: 300,
        portion: {
          quantity: 1,
          unit: 'serving',
        },
      },
      {
        id: 'chicken',
        slot: '점심',
        calories: 330,
        protein: 62,
        portion: {
          quantity: 200,
          unit: 'g',
        },
      },
    ]);
    expect(
      getDailyNutrition(loaded.days[date].meals).map(({ consumed, missing }) => ({
        consumed,
        missing,
      })),
    ).toEqual([
      {
        consumed: 630,
        missing: 0,
      },
      {
        consumed: 60,
        missing: 0,
      },
      {
        consumed: 62,
        missing: 1,
      },
      {
        consumed: 7.2,
        missing: 1,
      },
    ]);
    expect(parseStore(JSON.stringify(loaded))).toEqual(next);
  });

  it('keeps legacy records and other foods when editing one food and adding another', () => {
    const day: Day = {
      meals: [
        {
          id: 'breakfast',
          name: '사과',
          slot: '아침',
          calories: 100,
        },
        {
          id: 'rice',
          name: '현미밥',
          slot: '점심',
          calories: 300,
        },
        {
          id: 'soup',
          name: '국',
          slot: '점심',
          calories: 50,
        },
      ],
      workouts: [
        {
          id: 'walk',
          name: '산책',
          bodyPart: 'legs',
          sets: [
            {
              reps: 20,
              weightKg: 0,
            },
          ],
        },
      ],
    };
    const original = structuredClone(day);
    const draft = createMealFoodInput('rice', day.meals[1]);
    const next = applyMealFoodInputs(
      day,
      '저녁',
      [
        {
          ...draft,
          nutritionInput: changeMealQuantity(draft.nutritionInput, '0.5'),
        },
        chicken,
      ],
      'rice',
    );
    expect(next.meals).toMatchObject([
      day.meals[0],
      {
        id: 'rice',
        slot: '저녁',
        calories: 150,
      },
      day.meals[2],
      {
        id: 'chicken',
        slot: '저녁',
        calories: 165,
      },
    ]);
    expect(next.workouts).toEqual(day.workouts);
    expect(day).toEqual(original);
    expect(parseStore(JSON.stringify(storeWithDay(next))).days[date]).toEqual(next);
  });

  it('removes the edited food when its draft is removed and retains only the added foods', () => {
    const day = applyMealFoodInputs(emptyDay(), '점심', [rice], null);
    const next = applyMealFoodInputs(day, '점심', [chicken], 'rice');
    expect(next.meals.map(({ id }) => id)).toEqual(['chicken']);
    expect(day.meals.map(({ id }) => id)).toEqual(['rice']);
  });

  it('reuses draft IDs so repeated saves do not add duplicate foods', () => {
    const first = applyMealFoodInputs(emptyDay(), '간식', [rice, chicken], null);
    expect(applyMealFoodInputs(first, '간식', [rice, chicken], null)).toEqual(first);
  });

  it.each([
    {
      field: 'name',
      input: {
        ...chicken,
        name: '',
      },
      message: '음식 이름',
    },
    {
      field: 'quantity',
      input: {
        ...chicken,
        nutritionInput: changeMealQuantity(chicken.nutritionInput, '0'),
      },
      message: '섭취량',
    },
    {
      field: 'calories',
      input: {
        ...chicken,
        nutritionInput: changeMealNutrition(chicken.nutritionInput, 'calories', ''),
      },
      message: '총 칼로리',
    },
    {
      field: 'protein',
      input: {
        ...chicken,
        nutritionInput: changeMealNutrition(chicken.nutritionInput, 'protein', '-1'),
      },
      message: '단백질',
    },
  ])('rejects the entire edit when the second food has an invalid $field', ({ input, message }) => {
    const day = applyMealFoodInputs(emptyDay(), '아침', [rice], null);
    const original = structuredClone(day);
    expect(() => applyMealFoodInputs(day, '점심', [rice, input], 'rice')).toThrow(
      `음식 2: ${message}`,
    );
    expect(day).toEqual(original);
  });

  it('rejects empty lists and duplicate IDs while allowing separate portions of the same food', () => {
    expect(() => applyMealFoodInputs(emptyDay(), '아침', [], null)).toThrow('한 개 이상');
    expect(() => applyMealFoodInputs(emptyDay(), '아침', [rice, rice], null)).toThrow('ID가 중복');
    const another: MealFoodInput = {
      ...rice,
      id: 'another-rice',
    };
    expect(applyMealFoodInputs(emptyDay(), '아침', [rice, another], null).meals).toHaveLength(2);
  });

  it('keeps the previous store on a failed batch write and retries without duplicating foods', async () => {
    let document: SyncDocument | null = null;
    const commit = vi.fn<LocalAdapter['commit']>(async (next) => {
      document = structuredClone(next);
    });
    const engine = createEngine({
      load: async () => document,
      commit,
      legacy: async () => null,
      backup: async () => {},
      uuid: () => 'device',
    });
    const before = storeWithDay(applyMealFoodInputs(emptyDay(), '점심', [rice], null));
    await engine.write(JSON.stringify(before));
    const after = storeWithDay(
      applyMealFoodInputs(
        before.days[date],
        '점심',
        [
          {
            ...rice,
            nutritionInput: changeMealQuantity(rice.nutritionInput, '0.5'),
          },
          chicken,
        ],
        'rice',
      ),
    );
    commit.mockRejectedValueOnce(new Error('disk full'));
    await expect(saveRecords(engine, after, before)).rejects.toThrow('disk full');
    expect(await loadRecords(engine)).toEqual(before);
    await saveRecords(engine, after, before);
    const saved = await engine.document();
    await saveRecords(engine, after, after);
    expect(await engine.document()).toEqual(saved);
    const loaded = await loadRecords(engine);
    expect(loaded.days[date].meals).toEqual(expect.arrayContaining(after.days[date].meals));
    expect(loaded.days[date].meals).toHaveLength(2);
  });

  it('keeps independent remote changes when a batch is saved, updated and deleted', () => {
    const before = storeWithDay(applyMealFoodInputs(emptyDay(), '점심', [rice], null));
    const original = migrateStore(before, 'local');
    const remoteStore = storeWithDay(
      applyMealFoodInputs(
        before.days[date],
        '간식',
        [
          createMealFoodInput('fruit', {
            name: '사과',
            calories: 100,
          }),
        ],
        null,
      ),
    );
    const remote = editDocument(
      {
        ...original,
        device: 'remote',
      },
      before,
      remoteStore,
    );
    const localStore = storeWithDay(
      applyMealFoodInputs(
        before.days[date],
        '점심',
        [
          {
            ...rice,
            nutritionInput: changeMealQuantity(rice.nutritionInput, '0.5'),
          },
          chicken,
        ],
        'rice',
      ),
    );
    const local = editDocument(remote, before, localStore);
    const expected = [...localStore.days[date].meals, remoteStore.days[date].meals[1]];
    expect(snapshot(local).days[date].meals).toEqual(expect.arrayContaining(expected));
    expect(snapshot(local).days[date].meals).toHaveLength(3);
    expect(snapshot(mergeDocuments(local, original))).toEqual(snapshot(local));
    const current = snapshot(local);
    const deleted = editDocument(
      local,
      current,
      storeWithDay({
        ...current.days[date],
        meals: current.days[date].meals.filter((food) => food.id !== 'chicken'),
      }),
    );
    expect(snapshot(mergeDocuments(deleted, local)).days[date].meals.map(({ id }) => id)).toEqual([
      'fruit',
      'rice',
    ]);
  });
});

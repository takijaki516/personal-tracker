import { describe, expect, it } from 'vitest';
import {
  emptyDay,
  emptyStore,
  MACRONUTRIENTS,
  parseStore,
  type FavoriteFood,
  type Store,
} from './data';
import { parseFoodInput, upsertFavoriteFood, type FoodInput } from './favorite-foods';
import {
  editDocument,
  entryKey,
  mergeDocuments,
  migrateStore,
  newDocument,
  parseDocument,
  snapshot,
} from './sync-model';

const food: FavoriteFood = {
  id: 'rice',
  name: '현미밥',
  calories: 300,
  carbohydrates: 65.5,
  protein: 6,
  fat: 0,
};
const input: FoodInput = {
  name: ' 현미밥 ',
  calories: ' 300 ',
  carbohydrates: '65.5',
  protein: '6',
  fat: '0',
};
const withFoods = (...favoriteFoods: FavoriteFood[]): Store => ({
  ...emptyStore(),
  favoriteFoods,
});

describe('favorite food input', () => {
  it('uses the same nutrition rules for favorites and meal records', () => {
    const parsed = parseFoodInput(input);
    expect(parsed).toEqual({
      name: '현미밥',
      calories: 300,
      carbohydrates: 65.5,
      protein: 6,
      fat: 0,
    });
    expect(
      parseFoodInput({
        ...input,
        calories: '0',
        carbohydrates: '',
        protein: ' ',
        fat: '',
      }),
    ).toEqual({
      name: '현미밥',
      calories: 0,
    });
  });

  it.each(['', '   ', 'x'.repeat(101)])('rejects an invalid name: %j', (name) => {
    expect(() =>
      parseFoodInput({
        ...input,
        name,
      }),
    ).toThrow('음식 이름');
  });

  it.each(['', ' ', '-1', '20001', 'Infinity', 'NaN', 'abc'])(
    'rejects invalid calories: %j',
    (calories) => {
      expect(() =>
        parseFoodInput({
          ...input,
          calories,
        }),
      ).toThrow('총 칼로리');
    },
  );

  it.each(MACRONUTRIENTS)('rejects invalid $key without silently dropping it', ({ key, label }) => {
    for (const value of ['-1', '5001', 'Infinity', 'NaN', 'abc']) {
      expect(() =>
        parseFoodInput({
          ...input,
          [key]: value,
        }),
      ).toThrow(label);
    }
  });

  it('updates a repeated name without duplicating its ID or keeping cleared nutrients', () => {
    const original = [food];
    const updated = upsertFavoriteFood(original, {
      id: 'another-id',
      name: ' 현미밥 ',
      calories: 320,
    });
    expect(updated).toEqual([
      {
        id: food.id,
        name: ' 현미밥 ',
        calories: 320,
      },
    ]);
    expect(original).toEqual([food]);
    expect(upsertFavoriteFood(updated, updated[0])).toEqual(updated);
    expect(
      upsertFavoriteFood(updated, {
        ...food,
        id: 'oats',
        name: '오트밀',
      }),
    ).toHaveLength(2);
  });
});

describe('favorite food backups and synchronization', () => {
  it('accepts older stores and round trips favorites without creating a calendar day', () => {
    expect(parseStore(JSON.stringify(emptyStore()))).toEqual(emptyStore());
    expect(parseStore(JSON.stringify(withFoods()))).toEqual(emptyStore());
    const store = withFoods(food);
    expect(parseStore(JSON.stringify(store))).toEqual(store);
    expect(snapshot(migrateStore(store, 'a'))).toEqual(store);
    expect(snapshot(editDocument(newDocument('a'), emptyStore(), store))).toEqual(store);
  });

  it.each([
    null,
    {},
    [null],
    [
      {
        ...food,
        id: '',
      },
    ],
    [
      {
        ...food,
        name: '',
      },
    ],
    [
      {
        ...food,
        calories: -1,
      },
    ],
    [
      {
        ...food,
        calories: '300',
      },
    ],
    [
      {
        ...food,
        calories: 20001,
      },
    ],
    [food, food],
  ])('rejects invalid favorite lists: %j', (favoriteFoods) => {
    expect(() =>
      parseStore(
        JSON.stringify({
          ...emptyStore(),
          favoriteFoods,
        }),
      ),
    ).toThrow('즐겨찾는 음식 목록');
  });

  it.each(MACRONUTRIENTS)(
    'validates $key in both favorite backups and sync documents',
    ({ key }) => {
      for (const value of [-1, 5001, '20', null, {}, NaN, Infinity]) {
        const invalid = {
          ...food,
          [key]: value,
        };
        expect(() =>
          parseStore(
            JSON.stringify({
              ...emptyStore(),
              favoriteFoods: [invalid],
            }),
          ),
        ).toThrow('즐겨찾는 음식 목록');
        const doc = migrateStore(withFoods(food), 'a');
        Object.values(doc.entries)[0].value = invalid;
        expect(() => parseDocument(JSON.stringify(doc))).toThrow('즐겨찾는 음식 목록');
      }
    },
  );

  it('merges independent registrations and preserves favorites during stale meal edits', () => {
    const a = editDocument(newDocument('a'), emptyStore(), withFoods(food));
    const b = editDocument(
      newDocument('b'),
      emptyStore(),
      withFoods({
        ...food,
        id: 'oats',
        name: '오트밀',
      }),
    );
    const merged = mergeDocuments(a, b);
    expect(snapshot(merged).favoriteFoods).toHaveLength(2);
    expect(snapshot(merged)).toEqual(snapshot(mergeDocuments(b, a)));
    const localMeal: Store = {
      ...emptyStore(),
      days: {
        '2026-09-28': {
          ...emptyDay(),
          meals: [
            {
              ...food,
              id: 'meal',
              slot: '저녁',
            },
          ],
        },
      },
    };
    const edited = snapshot(editDocument(merged, emptyStore(), localMeal));
    expect(edited.favoriteFoods).toEqual(snapshot(merged).favoriteFoods);
    expect(edited.days).toEqual(localMeal.days);
  });

  it('keeps updates and removal across repeated merges without changing recorded meals', () => {
    const date = '2026-09-28';
    const store: Store = {
      ...withFoods(food),
      days: {
        [date]: {
          ...emptyDay(),
          meals: [
            {
              ...food,
              id: 'meal',
              slot: '저녁',
            },
          ],
        },
      },
    };
    const initial = migrateStore(store, 'a');
    const updatedStore = {
      ...store,
      favoriteFoods: [
        {
          ...food,
          calories: 320,
        },
      ],
    };
    const updated = editDocument(initial, store, updatedStore);
    expect(snapshot(mergeDocuments(initial, updated))).toEqual(updatedStore);
    expect(editDocument(updated, updatedStore, updatedStore)).toEqual(updated);
    const removedStore: Store = {
      version: 1,
      days: store.days,
    };
    const removed = editDocument(updated, updatedStore, removedStore);
    expect(snapshot(mergeDocuments(removed, initial))).toEqual(removedStore);
    expect(snapshot(mergeDocuments(initial, removed))).toEqual(removedStore);
    expect(snapshot(mergeDocuments(mergeDocuments(updated, removed), initial))).toEqual(
      removedStore,
    );
  });

  it('rejects dated favorites and mismatched IDs in sync entries', () => {
    const doc = migrateStore(withFoods(food), 'a');
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
    entry.value = {
      ...food,
      id: 'wrong',
    };
    expect(() => parseDocument(JSON.stringify(doc))).toThrow('기록 ID가 일치하지 않습니다.');
  });
});

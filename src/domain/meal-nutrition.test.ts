import { describe, expect, it } from 'vitest';
import {
  emptyDay,
  emptyStore,
  isMealAmount,
  MACRONUTRIENTS,
  MAX_MACRONUTRIENT_GRAMS,
  MAX_MEAL_CALORIES,
  parseStore,
  type Meal,
  type Store,
} from './data';
import {
  editDocument,
  mergeDocuments,
  migrateStore,
  newDocument,
  parseDocument,
  snapshot,
} from './sync-model';

const date = '2026-09-28';
const meal: Meal = {
  id: 'lunch',
  name: '점심 도시락',
  slot: '점심',
  calories: 650,
};

function storeWithMeal(value: Meal): Store {
  return {
    version: 1,
    days: {
      [date]: {
        ...emptyDay(),
        meals: [value],
      },
    },
  };
}

describe('meal nutrition', () => {
  it('keeps calorie-only legacy records without inventing macro values', () => {
    const store = storeWithMeal(meal);
    expect(parseStore(JSON.stringify(store))).toEqual(store);
    expect(snapshot(migrateStore(store, 'a'))).toEqual(store);
  });

  it.each(MACRONUTRIENTS)(
    'round trips optional $key including zero and decimal grams',
    ({ key }) => {
      for (const grams of [0, 12.5, MAX_MACRONUTRIENT_GRAMS]) {
        const store = storeWithMeal({
          ...meal,
          [key]: grams,
        });
        expect(parseStore(JSON.stringify(store))).toEqual(store);
      }
    },
  );

  it.each(MACRONUTRIENTS)('rejects invalid $key in backups and sync documents', ({ key }) => {
    for (const value of [-1, MAX_MACRONUTRIENT_GRAMS + 1, '20', null, {}, Infinity, NaN]) {
      const store = storeWithMeal(meal);
      const invalid = {
        ...meal,
        [key]: value,
      };
      const raw = JSON.stringify({
        ...store,
        days: {
          [date]: {
            ...emptyDay(),
            meals: [invalid],
          },
        },
      });
      expect(() => parseStore(raw)).toThrow('식단 기록을 확인해 주세요.');
      const doc = migrateStore(store, 'a');
      Object.values(doc.entries)[0].value = invalid;
      expect(() => parseDocument(JSON.stringify(doc))).toThrow('식단 기록을 확인해 주세요.');
    }
  });

  it('validates finite nonnegative calorie and gram amounts with their respective limits', () => {
    expect(isMealAmount(0, MAX_MEAL_CALORIES)).toBe(true);
    expect(isMealAmount(MAX_MEAL_CALORIES, MAX_MEAL_CALORIES)).toBe(true);
    expect(isMealAmount(MAX_MEAL_CALORIES + 1, MAX_MEAL_CALORIES)).toBe(false);
    expect(isMealAmount(12.5, MAX_MACRONUTRIENT_GRAMS)).toBe(true);
    for (const value of [-1, Infinity, NaN, null, '12']) {
      expect(isMealAmount(value, MAX_MACRONUTRIENT_GRAMS)).toBe(false);
    }
  });

  it('synchronizes macro additions, edits and clearing values across repeated merges', () => {
    const legacy = storeWithMeal(meal);
    const initial = migrateStore(legacy, 'a');
    const complete = storeWithMeal({
      ...meal,
      carbohydrates: 80.5,
      protein: 35,
      fat: 20,
    });
    const added = editDocument(initial, legacy, complete);
    expect(snapshot(parseDocument(JSON.stringify(added)))).toEqual(complete);
    expect(editDocument(added, snapshot(added), complete)).toEqual(added);
    const remote = mergeDocuments(newDocument('b'), added);
    const edited = storeWithMeal({
      ...meal,
      carbohydrates: 75,
      protein: 40,
      fat: 0,
    });
    const updated = editDocument(remote, complete, edited);
    const merged = mergeDocuments(added, updated);
    expect(snapshot(merged)).toEqual(edited);
    expect(snapshot(mergeDocuments(merged, added))).toEqual(edited);
    const cleared = editDocument(merged, edited, legacy);
    expect(snapshot(mergeDocuments(updated, cleared))).toEqual(legacy);
    const deleted = editDocument(cleared, legacy, emptyStore());
    expect(snapshot(mergeDocuments(added, deleted))).toEqual(emptyStore());
  });
});

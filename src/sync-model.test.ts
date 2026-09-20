import { describe, expect, it } from 'vitest';

import { emptyDay, emptyStore, type Store } from './data';
import {
  editDocument,
  mergeDocuments,
  migrateStore,
  newDocument,
  parseDocument,
  snapshot,
} from './sync-model';
const date = '2026-09-15';
function meal(id: string): Store {
  return {
    version: 1,
    days: { [date]: { ...emptyDay(), meals: [{ id, name: id, calories: 100, slot: '점심' }] } },
  };
}
describe('record synchronization', () => {
  it('merges independent edits on the same day', () => {
    const a = editDocument(newDocument('a'), emptyStore(), meal('a'));
    const b = editDocument(newDocument('b'), emptyStore(), meal('b'));
    expect(
      snapshot(mergeDocuments(a, b))
        .days[date].meals.map((m) => m.id)
        .sort(),
    ).toEqual(['a', 'b']);
    expect(snapshot(mergeDocuments(a, b))).toEqual(snapshot(mergeDocuments(b, a)));
  });
  it('preserves a deletion when an offline peer reconnects repeatedly', () => {
    const a = editDocument(newDocument('a'), emptyStore(), meal('a'));
    const deleted = editDocument(a, snapshot(a), emptyStore());
    expect(snapshot(mergeDocuments(deleted, a))).toEqual(emptyStore());
    expect(snapshot(mergeDocuments(a, deleted))).toEqual(emptyStore());
  });
  it('converges for concurrent changes to the same record and favors a later observed edit', () => {
    const a = migrateStore(meal('x'), 'a');
    const b = { ...a, device: 'b' };
    const s1 = meal('x');
    s1.days[date].meals[0].calories = 200;
    const s2 = meal('x');
    s2.days[date].meals[0].calories = 300;
    const aa = editDocument(a, snapshot(a), s1),
      bb = editDocument(b, snapshot(b), s2);
    const merged = mergeDocuments(aa, bb);
    expect(snapshot(merged)).toEqual(snapshot(mergeDocuments(bb, aa)));
    const s3 = meal('x');
    s3.days[date].meals[0].calories = 400;
    expect(snapshot(mergeDocuments(editDocument(merged, snapshot(merged), s3), bb))).toEqual(s3);
  });
  it('does not erase a remote addition while a local editor has an older snapshot', () => {
    const a = migrateStore(meal('a'), 'a');
    const oldView = snapshot(a);
    const b = editDocument(newDocument('b'), emptyStore(), meal('b'));
    const merged = mergeDocuments(a, b);
    const edit = meal('a');
    edit.days[date].meals[0].calories = 250;
    const result = snapshot(editDocument(merged, oldView, edit));
    expect(result.days[date].meals).toHaveLength(2);
    expect(result.days[date].meals.find((m) => m.id === 'a')?.calories).toBe(250);
  });
  it('imports legacy records only once and validates hostile payloads', () => {
    const a = migrateStore(meal('a'), 'a'),
      b = migrateStore(meal('a'), 'b');
    expect(snapshot(mergeDocuments(a, b))).toEqual(meal('a'));
    const invalid = structuredClone(a);
    Object.values(invalid.entries)[0].counter = -1;
    expect(() => parseDocument(JSON.stringify(invalid))).toThrow(
      '올바르지 않은 동기화 기록입니다.',
    );
    Object.values(invalid.entries)[0].counter = 0;
    Object.values(invalid.entries)[0].value = { id: 'a', calories: -1 };
    expect(() => parseDocument(JSON.stringify(invalid))).toThrow('식단 기록을 확인해 주세요.');
  });
});

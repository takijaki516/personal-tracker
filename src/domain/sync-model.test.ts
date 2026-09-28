import { describe, expect, it } from 'vitest';
import { emptyDay, emptyStore, type Store, type Workout } from './data';
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
    days: {
      [date]: {
        ...emptyDay(),
        meals: [
          {
            id,
            name: id,
            calories: 100,
            slot: '점심',
          },
        ],
      },
    },
  };
}
function workouts(...ids: string[]): Store {
  return {
    version: 1,
    days: {
      [date]: {
        ...emptyDay(),
        workouts: ids.map((id) => ({
          id,
          name: id,
          bodyPart: 'chest',
          sets: [
            {
              reps: 8,
              weightKg: 60,
            },
          ],
        })),
      },
    },
  };
}
describe('record synchronization', () => {
  it('preserves workout insertion order through edits, deletion and repeated synchronization', () => {
    const first = workouts('z-bench');
    const initial = editDocument(newDocument('a'), emptyStore(), first);
    const added = workouts('z-bench', 'a-incline', 'm-fly');
    const doc = editDocument(initial, snapshot(initial), added);
    expect(snapshot(parseDocument(JSON.stringify(doc)))).toEqual(added);
    expect(editDocument(doc, snapshot(doc), snapshot(doc))).toEqual(doc);
    const edited = structuredClone(added);
    edited.days[date].workouts[0].sets[0].weightKg = 70;
    const updated = editDocument(doc, snapshot(doc), edited);
    expect(snapshot(updated)).toEqual(edited);
    const removed = structuredClone(edited);
    removed.days[date].workouts.splice(1, 1);
    const deleted = editDocument(updated, snapshot(updated), removed);
    const merged = mergeDocuments(deleted, doc);
    expect(snapshot(merged)).toEqual(removed);
    expect(snapshot(mergeDocuments(doc, deleted))).toEqual(removed);
    expect(snapshot(mergeDocuments(merged, doc))).toEqual(removed);
  });
  it('preserves workout order from legacy backups and records explicit reordering', () => {
    const store = workouts('z-bench', 'a-incline');
    const doc = migrateStore(store, 'a');
    expect(snapshot(doc)).toEqual(store);
    const reversed = structuredClone(store);
    reversed.days[date].workouts.reverse();
    const reordered = editDocument(doc, snapshot(doc), reversed);
    expect(snapshot(mergeDocuments(doc, reordered))).toEqual(reversed);
  });
  it('keeps a deterministic order for simultaneous additions from two devices', () => {
    const first = workouts('z-bench');
    const a = editDocument(newDocument('a'), emptyStore(), first);
    const b = {
      ...a,
      device: 'b',
    };
    const aa = editDocument(a, first, workouts('z-bench', 'x-incline'));
    const bb = editDocument(b, first, workouts('z-bench', 'a-fly'));
    expect(snapshot(mergeDocuments(aa, bb))).toEqual(workouts('z-bench', 'a-fly', 'x-incline'));
    expect(snapshot(mergeDocuments(aa, bb))).toEqual(snapshot(mergeDocuments(bb, aa)));
  });
  it('accepts old documents without order and rejects invalid positions', () => {
    const doc = migrateStore(workouts('z-bench', 'a-incline'), 'a');
    for (const entry of Object.values(doc.entries)) {
      delete entry.position;
    }
    const old = parseDocument(JSON.stringify(doc));
    const current = snapshot(old);
    const added = structuredClone(current);
    added.days[date].workouts.push(workouts('new').days[date].workouts[0]);
    const updated = editDocument(old, current, added);
    expect(snapshot(updated)).toEqual(added);
    for (const position of [0, -1, 1.5, '1', null, Number.MAX_SAFE_INTEGER + 1]) {
      const invalid = {
        ...doc,
        entries: structuredClone(doc.entries),
      };
      const key = Object.keys(invalid.entries)[0];
      expect(() =>
        parseDocument(
          JSON.stringify({
            ...invalid,
            entries: {
              ...invalid.entries,
              [key]: {
                ...invalid.entries[key],
                position,
              },
            },
          }),
        ),
      ).toThrow('올바르지 않은 동기화 기록입니다.');
    }
  });
  it('does not overwrite remote edits when assigning positions to old records', () => {
    const doc = migrateStore(workouts('bench'), 'a');
    const entry = Object.values(doc.entries)[0];
    delete entry.position;
    const oldView = snapshot(doc);
    entry.value = {
      ...(entry.value as Workout),
      name: 'Remote bench',
    };
    const updated = editDocument(doc, oldView, oldView);
    expect(snapshot(updated).days[date].workouts[0].name).toBe('Remote bench');
    entry.value = null;
    expect(snapshot(editDocument(doc, oldView, oldView))).toEqual(emptyStore());
  });
  it('preserves remote workout edits when a stale local deletion changes their position', () => {
    const original = workouts('z-bench', 'a-incline');
    const doc = migrateStore(original, 'a');
    const remote = structuredClone(original);
    remote.days[date].workouts[1].sets[0].weightKg = 80;
    const merged = editDocument(
      {
        ...doc,
        device: 'b',
      },
      original,
      remote,
    );
    const deleted = structuredClone(original);
    deleted.days[date].workouts.shift();
    const updated = snapshot(editDocument(merged, original, deleted));
    expect(updated.days[date].workouts.map((w) => w.id)).toEqual(['a-incline']);
    expect(updated.days[date].workouts[0].sets[0].weightKg).toBe(80);
  });
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
    const b = {
      ...a,
      device: 'b',
    };
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
    Object.values(invalid.entries)[0].value = {
      id: 'a',
      calories: -1,
    };
    expect(() => parseDocument(JSON.stringify(invalid))).toThrow('식단 기록을 확인해 주세요.');
  });
  it('discards old weight entries during parsing and repeated merges', () => {
    const legacy = {
      ...newDocument('older-device'),
      entries: {
        '["2026-09-15","weight","weight"]': {
          date,
          kind: 'weight',
          id: 'weight',
          value: 70,
          counter: 0,
          device: 'older-device',
        },
      },
    };
    const parsed = parseDocument(JSON.stringify(legacy));
    expect(parsed.entries).toEqual({});
    expect(snapshot(mergeDocuments(newDocument('new-device'), parsed))).toEqual(emptyStore());
  });
  it('preserves distinct sets and bodyweight through synchronization', () => {
    const store: Store = {
      version: 1,
      days: {
        [date]: {
          ...emptyDay(),
          workouts: [
            {
              id: 'bench',
              name: '벤치프레스',
              bodyPart: 'chest',
              sets: [
                {
                  reps: 10,
                  weightKg: 40,
                },
                {
                  reps: 8,
                  weightKg: 45,
                },
                {
                  reps: 6,
                  weightKg: 0,
                },
              ],
            },
          ],
        },
      },
    };
    const doc = editDocument(newDocument('a'), emptyStore(), store);
    expect(snapshot(parseDocument(JSON.stringify(doc)))).toEqual(store);
    expect(snapshot(mergeDocuments(newDocument('b'), doc))).toEqual(store);
    const invalid = structuredClone(doc);
    Object.values(invalid.entries)[0].value = {
      id: 'bench',
      name: '벤치프레스',
      bodyPart: 'chest',
      sets: [
        {
          reps: -1,
          weightKg: 40,
        },
      ],
    };
    expect(() => parseDocument(JSON.stringify(invalid))).toThrow('운동 기록을 확인해 주세요.');
  });
});

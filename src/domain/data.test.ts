import { describe, expect, it } from 'vitest';

import { emptyStore, isDate, localDate, parseStore, shiftDate } from './data';
describe('backup validation', () => {
  it('round trips complete records', () => {
    const store = {
      version: 1,
      days: {
        '2026-09-14': {
          weight: 72.3,
          meals: [{ id: 'a', name: '밥', slot: '점심', calories: 500 }],
          workouts: [{ id: 'b', name: '산책', minutes: 30, note: '' }],
        },
      },
    };
    expect(parseStore(JSON.stringify(store))).toEqual(store);
    expect(parseStore(JSON.stringify(emptyStore()))).toEqual(emptyStore());
  });
  it.each([
    null,
    {},
    { version: 2, days: {} },
    { version: 1, days: { '2026-02-30': { weight: null, meals: [], workouts: [] } } },
    { version: 1, days: { '2026-09-14': { weight: -1, meals: [], workouts: [] } } },
    {
      version: 1,
      days: {
        '2026-09-14': {
          weight: null,
          meals: [{ id: 'a', name: '밥', slot: '점심', calories: '500' }],
          workouts: [],
        },
      },
    },
  ])('rejects invalid records: %j', (value) => {
    expect(() => parseStore(JSON.stringify(value))).toThrow(
      /백업 형식|날짜 또는 기록 형식|식단 기록/,
    );
  });
});
describe('calendar dates', () => {
  it('handles month and year boundaries', () => {
    expect(shiftDate('2026-01-01', -1)).toBe('2025-12-31');
    expect(shiftDate('2024-02-28', 1)).toBe('2024-02-29');
  });
  it('uses local calendar date', () => {
    expect(localDate(new Date(2026, 8, 14, 0, 5))).toBe('2026-09-14');
    expect(isDate('2026-02-29')).toBe(false);
  });
});

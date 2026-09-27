import { describe, expect, it } from 'vitest';
import { calendarDates, formatDateWithWeekday, shiftMonth } from './calendar';

describe('month calendar', () => {
  it('places days under the correct weekdays, including leap day', () => {
    const dates = calendarDates('2024-02');
    expect(dates).toHaveLength(35);
    expect(dates.slice(0, 5)).toEqual([null, null, null, null, '2024-02-01']);
    expect(dates).toContain('2024-02-29');
    expect(dates.at(-1)).toBeNull();
  });

  it('moves between months across year boundaries', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2026-12', 1)).toBe('2027-01');
  });

  it('labels the selected date with its weekday', () => {
    expect(formatDateWithWeekday('2026-09-28')).toBe('2026-09-28(월)');
    expect(formatDateWithWeekday('2024-02-29')).toBe('2024-02-29(목)');
  });
});

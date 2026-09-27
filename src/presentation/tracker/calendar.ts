import { localDate } from '../../domain/data';

const weekdays = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일'];

export function formatDateWithWeekday(date: string): string {
  const weekday = weekdays[new Date(`${date}T12:00:00`).getDay()];
  return `${date}(${weekday})`;
}

export function calendarDates(month: string): (string | null)[] {
  const [year, monthNumber] = month.split('-').map(Number);
  const firstWeekday = new Date(`${month}-01T12:00:00`).getDay();
  const daysInMonth = new Date(year, monthNumber, 0).getDate();
  const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
  return Array.from({ length: cellCount }, (_, index) => {
    const day = index - firstWeekday + 1;
    return day >= 1 && day <= daysInMonth ? `${month}-${String(day).padStart(2, '0')}` : null;
  });
}

export function shiftMonth(month: string, amount: number): string {
  const value = new Date(`${month}-01T12:00:00`);
  value.setMonth(value.getMonth() + amount);
  return localDate(value).slice(0, 7);
}

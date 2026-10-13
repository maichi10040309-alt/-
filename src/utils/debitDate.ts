import holidays from '@/data/japaneseHolidays.json';
import { addMonths, parseYearMonth } from '@/utils/date';
import type { Invoice, YearMonth } from '@/types';

const official = holidays as Record<string, string[]>;
const iso = (date: Date) => date.toISOString().slice(0, 10);
const cache = new Map<number, Set<string>>();

/** 内閣府の公表済み休日を使用。未公表年は現行の祝日規則で計算する。 */
export function holidaysForYear(year: number): Set<string> {
  if (cache.has(year)) return cache.get(year)!;
  const dates = new Set(official[String(year)] ?? []);
  if (!official[String(year)]) {
    const add = (month: number, day: number) => dates.add(iso(new Date(Date.UTC(year, month - 1, day))));
    const monday = (month: number, nth: number) => {
      const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
      add(month, 1 + (8 - first) % 7 + (nth - 1) * 7);
    };
    for (const [month, day] of [[1,1],[2,11],[2,23],[4,29],[5,3],[5,4],[5,5],[8,11],[11,3],[11,23]]) add(month, day);
    monday(1, 2); monday(7, 3); monday(9, 3); monday(10, 2);
    add(3, Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)));
    add(9, Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4)));
    const national = new Set(dates);
    for (const holiday of national) {
      const date = new Date(holiday + 'T00:00:00Z');
      const before = new Date(date); before.setUTCDate(before.getUTCDate() - 1);
      const after = new Date(date); after.setUTCDate(after.getUTCDate() + 1);
      const following = new Date(after); following.setUTCDate(following.getUTCDate() + 1);
      if (national.has(iso(following))) dates.add(iso(after));
      if (date.getUTCDay() === 0) {
        while (national.has(iso(after))) after.setUTCDate(after.getUTCDate() + 1);
        dates.add(iso(after));
      }
    }
  }
  cache.set(year, dates);
  return dates;
}

export function nextBusinessDay(value: string): string {
  const date = new Date(value + 'T00:00:00Z');
  while (date.getUTCDay() === 0 || date.getUTCDay() === 6 || holidaysForYear(date.getUTCFullYear()).has(iso(date))) {
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return iso(date);
}

export function debitDateForMonth(month: YearMonth): string {
  const { year, month: number } = parseYearMonth(month);
  return nextBusinessDay(`${year}-${String(number).padStart(2, '0')}-26`);
}

export function invoiceDebitDates(invoice: Pick<Invoice, 'cycleEndMonth'>) {
  const month = addMonths(invoice.cycleEndMonth, 1);
  return { current: debitDateForMonth(month), next: debitDateForMonth(addMonths(month, 4)) };
}

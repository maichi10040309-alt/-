import type { YearMonth } from '@/types';

export function currentYearMonth(): YearMonth {
  return toYearMonth(new Date());
}

export function toYearMonth(d: Date): YearMonth {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function todayIso(): string {
  return toYearMonth(new Date()) + '-' + String(new Date().getDate()).padStart(2, '0');
}

/** "2026-08" -> {year:2026, month:8} */
export function parseYearMonth(ym: YearMonth): { year: number; month: number } {
  const [y, m] = ym.split('-').map(Number);
  return { year: y, month: m };
}

export function addMonths(ym: YearMonth, delta: number): YearMonth {
  const { year, month } = parseYearMonth(ym);
  const total = year * 12 + (month - 1) + delta;
  const y = Math.floor(total / 12);
  const m = (total % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

/** ym1 <= ym2 なら true */
export function ymLte(ym1: YearMonth, ym2: YearMonth): boolean {
  return ym1 <= ym2;
}

export function ymCompare(a: YearMonth, b: YearMonth): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function formatYmJapanese(ym: YearMonth): string {
  const { year, month } = parseYearMonth(ym);
  return `${year}年${month}月`;
}

export function formatDateJapanese(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return `${y}年${m}月${d}日`;
}

export function isValidYearMonth(ym: string): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(ym);
}

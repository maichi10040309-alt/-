export function formatMoney(value: number): string {
  return `¥${Math.round(value).toLocaleString('ja-JP')}`;
}

export function formatNumber(value: number): string {
  return value.toLocaleString('ja-JP');
}

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDateJa(iso: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return toISODate(d);
}

export function addMonths(iso: string, months: number): string {
  const d = new Date(iso);
  d.setMonth(d.getMonth() + months);
  return toISODate(d);
}

// 締め日/支払日の考え方: day=31 は月末扱い
export function resolveDayInMonth(year: number, monthIndex0: number, day: number): Date {
  const lastDay = new Date(year, monthIndex0 + 1, 0).getDate();
  const d = Math.min(day, lastDay);
  return new Date(year, monthIndex0, d);
}

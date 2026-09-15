export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString('ja-JP')}`;
}

export function currentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function formatYearMonthLabel(yearMonth: string): string {
  const [y, m] = yearMonth.split('-');
  return `${y}年${Number(m)}月`;
}

/** 直近N ヶ月分(当月含む)の"YYYY-MM"リストを新しい順で返す。 */
export function recentYearMonths(n: number, from: Date = new Date()): string[] {
  const result: string[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    result.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

import type { BillingType, Client, Invoice, LateAdjustment, RentalItem, UsageEntry, YearMonth } from '@/types';
import { addMonths, parseYearMonth, ymCompare } from '@/utils/date';

export const CYCLE_LENGTH = 4; // 請求は4か月ごと

// 請求サイクルは全利用者共通の固定カレンダー(3月/7月/11月始まり)。
// 例: 7〜10月分→11月請求、11〜2月分→3月請求、3〜6月分→7月請求。
// 2000年3月を基準点として、そこから4か月おきに区切る(3,7,11月はいずれも
// 基準点から4の倍数か月離れているため、常にサイクル開始月になる)。
const CYCLE_ANCHOR: YearMonth = '2000-03';

export function cycleStartForMonth(ym: YearMonth): YearMonth {
  const anchor = parseYearMonth(CYCLE_ANCHOR);
  const target = parseYearMonth(ym);
  const anchorTotal = anchor.year * 12 + (anchor.month - 1);
  const targetTotal = target.year * 12 + (target.month - 1);
  const cycleIndex = Math.floor((targetTotal - anchorTotal) / CYCLE_LENGTH);
  const cycleStartTotal = anchorTotal + cycleIndex * CYCLE_LENGTH;
  const y = Math.floor(cycleStartTotal / 12);
  const m = (cycleStartTotal % 12) + 1;
  return `${y}-${String(m).padStart(2, '0')}`;
}

export interface BillingCycle {
  clientId: string;
  cycleStartMonth: YearMonth;
  cycleEndMonth: YearMonth;
  months: YearMonth[]; // cycle内の4か月
  /** サイクルの最終月が基準月を過ぎていて請求可能かどうか(=請求月に到達したか) */
  isDue: boolean;
  /** 保険分の請求書(既に発行/下書き済みのものがあれば) */
  insuranceInvoice: Invoice | null;
  /** 自費分の請求書(既に発行/下書き済みのものがあれば) */
  privateInvoice: Invoice | null;
  /** この機能追加より前に作成された、保険・自費合算の旧形式請求書があれば(あれば両区分とも請求済み扱い) */
  combinedInvoice: Invoice | null;
}

/**
 * 利用実績のある最初の月から、固定カレンダー(3/7/11月始まり)で4か月ずつの
 * サイクルを列挙する。referenceMonth まで(サイクル開始月が referenceMonth 以下)
 * のサイクルを対象とする。
 */
export function getClientCycles(
  client: Client,
  usageEntries: UsageEntry[],
  invoices: Invoice[],
  referenceMonth: YearMonth
): BillingCycle[] {
  const clientUsage = usageEntries.filter((u) => u.clientId === client.id);
  if (clientUsage.length === 0) return [];

  const clientInvoices = invoices.filter((inv) => inv.clientId === client.id);

  let earliestUsageMonth = clientUsage[0].yearMonth;
  let lastUsageMonth = clientUsage[0].yearMonth;
  for (const u of clientUsage) {
    if (ymCompare(u.yearMonth, earliestUsageMonth) < 0) earliestUsageMonth = u.yearMonth;
    if (ymCompare(u.yearMonth, lastUsageMonth) > 0) lastUsageMonth = u.yearMonth;
  }

  // 表示対象の最終月: 基準月 と 実績のある最終月 の遅い方まで
  let horizon = referenceMonth;
  if (ymCompare(lastUsageMonth, horizon) > 0) {
    horizon = lastUsageMonth;
  }

  const cycles: BillingCycle[] = [];
  let cycleStart = cycleStartForMonth(earliestUsageMonth);
  let guard = 0;
  while (ymCompare(cycleStart, horizon) <= 0 && guard < 500) {
    guard++;
    const months: YearMonth[] = [];
    for (let i = 0; i < CYCLE_LENGTH; i++) months.push(addMonths(cycleStart, i));
    const cycleEndMonth = months[months.length - 1];

    const insuranceInvoice =
      clientInvoices.find((inv) => inv.cycleStartMonth === cycleStart && inv.billingCategory === 'insurance') ?? null;
    const privateInvoice =
      clientInvoices.find((inv) => inv.cycleStartMonth === cycleStart && inv.billingCategory === 'private') ?? null;
    const combinedInvoice =
      clientInvoices.find((inv) => inv.cycleStartMonth === cycleStart && inv.billingCategory === 'combined') ?? null;

    cycles.push({
      clientId: client.id,
      cycleStartMonth: cycleStart,
      cycleEndMonth,
      months,
      // 請求は締め月の翌月に行う(例: 7〜10月分は11月に請求)
      isDue: ymCompare(cycleEndMonth, referenceMonth) < 0,
      insuranceInvoice,
      privateInvoice,
      combinedInvoice,
    });

    cycleStart = addMonths(cycleStart, CYCLE_LENGTH);
  }

  return cycles;
}

/**
 * 保険分/自費分のどちらか一方の区分のみを対象に、請求書に印字する月別内訳を組み立てる。
 * 品目マスタが削除されていて区分が判別できない実績行は、保険分として扱う。
 */
export function buildInvoiceMonths(
  cycle: BillingCycle,
  usageEntries: UsageEntry[],
  lateAdjustments: LateAdjustment[],
  items: RentalItem[],
  category: BillingType
): Pick<Invoice, 'months' | 'adjustments' | 'totalAmount' | 'nonTaxableTotal' | 'taxableTotal'> {
  const itemBillingTypeById = new Map(items.map((i) => [i.id, i.billingType]));
  const entryCategory = (itemId: string): BillingType => itemBillingTypeById.get(itemId) ?? 'insurance';

  const months: Invoice['months'] = cycle.months.map((ym) => {
    const entries = usageEntries.filter(
      (u) => u.clientId === cycle.clientId && u.yearMonth === ym && entryCategory(u.itemId) === category
    );
    const lines = entries.map((e) => ({
      itemName: e.itemName,
      quantity: e.quantity,
      unitPrice: e.unitPrice,
      amount: e.amount,
      taxCategory: e.taxCategory,
    }));
    const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
    const nonTaxableSubtotal = lines
      .filter((l) => l.taxCategory === 'nontaxable')
      .reduce((sum, l) => sum + l.amount, 0);
    const taxableSubtotal = lines
      .filter((l) => l.taxCategory === 'taxable')
      .reduce((sum, l) => sum + l.amount, 0);
    return { yearMonth: ym, lines, subtotal, nonTaxableSubtotal, taxableSubtotal, note: '' };
  });

  const adjustments: Invoice['adjustments'] = lateAdjustments
    .filter(
      (a) =>
        a.clientId === cycle.clientId &&
        cycleStartForMonth(a.billedYearMonth) === cycle.cycleStartMonth &&
        a.billingType === category
    )
    .map((a) => ({
      originalYearMonth: a.originalYearMonth,
      reason: a.reason,
      itemName: a.itemName,
      quantity: a.quantity,
      unitPrice: a.unitPrice,
      amount: a.amount,
      taxCategory: a.taxCategory,
    }));

  const monthsTotal = months.reduce((sum, m) => sum + m.subtotal, 0);
  const monthsNonTaxable = months.reduce((sum, m) => sum + m.nonTaxableSubtotal, 0);
  const monthsTaxable = months.reduce((sum, m) => sum + m.taxableSubtotal, 0);
  const adjustmentsTotal = adjustments.reduce((sum, a) => sum + a.amount, 0);
  const adjustmentsNonTaxable = adjustments
    .filter((a) => a.taxCategory === 'nontaxable')
    .reduce((sum, a) => sum + a.amount, 0);
  const adjustmentsTaxable = adjustments
    .filter((a) => a.taxCategory === 'taxable')
    .reduce((sum, a) => sum + a.amount, 0);

  return {
    months,
    adjustments,
    totalAmount: monthsTotal + adjustmentsTotal,
    nonTaxableTotal: monthsNonTaxable + adjustmentsNonTaxable,
    taxableTotal: monthsTaxable + adjustmentsTaxable,
  };
}

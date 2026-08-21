import type { Client, Invoice, UsageEntry, YearMonth } from '@/types';
import { addMonths, ymCompare } from '@/utils/date';

export const CYCLE_LENGTH = 4; // 請求は4か月ごと

export interface BillingCycle {
  clientId: string;
  cycleStartMonth: YearMonth;
  cycleEndMonth: YearMonth;
  months: YearMonth[]; // cycle内の4か月
  /** サイクルの最終月が基準月を過ぎていて請求可能かどうか */
  isDue: boolean;
  invoice: Invoice | null; // 既に発行/下書き済みの請求書があれば
}

/**
 * 利用者の契約開始月(billingStartMonth)を起点に4か月ごとのサイクルを列挙する。
 * referenceMonth まで(サイクル開始月が referenceMonth 以下)のサイクルを対象とする。
 */
export function getClientCycles(
  client: Client,
  usageEntries: UsageEntry[],
  invoices: Invoice[],
  referenceMonth: YearMonth
): BillingCycle[] {
  if (!client.billingStartMonth) return [];

  const clientUsage = usageEntries.filter((u) => u.clientId === client.id);
  const clientInvoices = invoices.filter((inv) => inv.clientId === client.id);

  const lastUsageMonth = clientUsage.reduce<YearMonth | null>((max, u) => {
    if (!max || ymCompare(u.yearMonth, max) > 0) return u.yearMonth;
    return max;
  }, null);

  // 表示対象の最終月: 基準月 と 実績のある最終月 の遅い方まで
  let horizon = referenceMonth;
  if (lastUsageMonth && ymCompare(lastUsageMonth, horizon) > 0) {
    horizon = lastUsageMonth;
  }

  const cycles: BillingCycle[] = [];
  let cycleStart = client.billingStartMonth;
  let guard = 0;
  while (ymCompare(cycleStart, horizon) <= 0 && guard < 500) {
    guard++;
    const months: YearMonth[] = [];
    for (let i = 0; i < CYCLE_LENGTH; i++) months.push(addMonths(cycleStart, i));
    const cycleEndMonth = months[months.length - 1];

    const invoice =
      clientInvoices.find((inv) => inv.cycleStartMonth === cycleStart) ?? null;

    cycles.push({
      clientId: client.id,
      cycleStartMonth: cycleStart,
      cycleEndMonth,
      months,
      isDue: ymCompare(cycleEndMonth, referenceMonth) <= 0,
      invoice,
    });

    cycleStart = addMonths(cycleStart, CYCLE_LENGTH);
  }

  return cycles;
}

export function buildInvoiceMonths(
  cycle: BillingCycle,
  usageEntries: UsageEntry[]
): { months: Invoice['months']; totalAmount: number } {
  const months: Invoice['months'] = cycle.months.map((ym) => {
    const entries = usageEntries.filter(
      (u) => u.clientId === cycle.clientId && u.yearMonth === ym
    );
    const lines = entries.map((e) => ({
      itemName: e.itemName,
      quantity: e.quantity,
      unitPrice: e.unitPrice,
      amount: e.amount,
    }));
    const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
    return { yearMonth: ym, lines, subtotal };
  });
  const totalAmount = months.reduce((sum, m) => sum + m.subtotal, 0);
  return { months, totalAmount };
}

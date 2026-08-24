import type { CompanyInfo, DocumentItem, TaxRate, TaxSummaryEntry } from '../types';

export function roundTax(amount: number, mode: CompanyInfo['taxRounding']): number {
  switch (mode) {
    case 'ceil':
      return Math.ceil(amount);
    case 'round':
      return Math.round(amount);
    case 'floor':
    default:
      return Math.floor(amount);
  }
}

export function itemAmount(item: Pick<DocumentItem, 'quantity' | 'unitPrice'>): number {
  return item.quantity * item.unitPrice;
}

export interface DocumentTotals {
  subtotal: number;
  taxSummary: TaxSummaryEntry[];
  taxTotal: number;
  grandTotal: number;
}

// 外税方式: 明細金額(税抜)を税率ごとに集計し、税額を加算する
export function calcDocumentTotals(
  items: DocumentItem[],
  roundingMode: CompanyInfo['taxRounding'],
): DocumentTotals {
  const rateGroups = new Map<TaxRate, number>();
  for (const item of items) {
    const amount = itemAmount(item);
    rateGroups.set(item.taxRate, (rateGroups.get(item.taxRate) ?? 0) + amount);
  }

  const taxSummary: TaxSummaryEntry[] = [];
  let subtotal = 0;
  let taxTotal = 0;

  for (const [rate, taxableAmount] of Array.from(rateGroups.entries()).sort((a, b) => b[0] - a[0])) {
    const taxAmount = roundTax((taxableAmount * rate) / 100, roundingMode);
    taxSummary.push({ rate, taxableAmount, taxAmount });
    subtotal += taxableAmount;
    taxTotal += taxAmount;
  }

  return {
    subtotal,
    taxSummary,
    taxTotal,
    grandTotal: subtotal + taxTotal,
  };
}

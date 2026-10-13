import type { Invoice, InvoiceMonth } from '@/types';
import { addMonths, todayIso } from '@/utils/date';

export function isEarlyInvoice(invoice: Invoice): boolean {
  if (invoice.billingTiming) return invoice.billingTiming === 'early';
  const stored = invoice.months.find((month) => month.billingTiming)?.billingTiming;
  if (stored) return stored === 'early';
  // 旧データには種別がないため、通常の請求月より前に作成されたものを早期と判定。
  const createdMonth = invoice.createdAt?.slice(0, 7);
  return !!createdMonth && createdMonth < addMonths(invoice.cycleEndMonth, 1);
}

export function invoiceIssueDate(invoice: Invoice): string {
  return isEarlyInvoice(invoice)
    ? invoice.issuedDate || todayIso()
    : `${addMonths(invoice.cycleEndMonth, 1)}-10`;
}

/** 過去の請求書で月が省かれていても、対象期間の全月を0円で補完して表示。 */
export function invoiceDisplayMonths(invoice: Invoice): InvoiceMonth[] {
  const months: InvoiceMonth[] = [];
  let month = invoice.cycleStartMonth;
  for (let count = 0; month <= invoice.cycleEndMonth && count < 120; count++, month = addMonths(month, 1)) {
    months.push(invoice.months.find((entry) => entry.yearMonth === month) ?? {
      yearMonth: month, lines: [], subtotal: 0, nonTaxableSubtotal: 0, taxableSubtotal: 0, note: '',
    });
  }
  return months;
}

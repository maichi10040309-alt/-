import type { SalesDocument } from '../types';
import { calcDocumentTotals } from './tax';
import type { CompanyInfo } from '../types';

export interface CustomerBalance {
  customerId: string;
  billedTotal: number; // 請求書・合計請求書の合計
  receiptTotal: number; // 領収証の合計(入金)
  balance: number; // 売掛残高
}

// 請求書/合計請求書の合計額から領収証の合計額を差し引いて売掛残高を算出する。
// (見積書・納品書は残高に影響しない。合計請求書は対象の納品書を束ねて請求する伝票)
export function calcReceivables(
  documents: SalesDocument[],
  roundingMode: CompanyInfo['taxRounding'],
): Map<string, CustomerBalance> {
  const map = new Map<string, CustomerBalance>();

  const ensure = (customerId: string) => {
    if (!map.has(customerId)) {
      map.set(customerId, { customerId, billedTotal: 0, receiptTotal: 0, balance: 0 });
    }
    return map.get(customerId)!;
  };

  for (const doc of documents) {
    if (doc.status === 'draft') continue;
    const totals = calcDocumentTotals(doc.items, roundingMode);
    const entry = ensure(doc.customerId);
    if (doc.type === 'invoice' || doc.type === 'consolidated_invoice') {
      entry.billedTotal += totals.grandTotal;
    } else if (doc.type === 'receipt') {
      entry.receiptTotal += totals.grandTotal;
    }
  }

  for (const entry of map.values()) {
    entry.balance = entry.billedTotal - entry.receiptTotal;
  }

  return map;
}

// "YYYY-MM" 形式の年月文字列
export type YearMonth = string;

// 介護保険の利用者負担割合。'seiho' = 生活保護等により自己負担なし
export type CopayRatio = '1' | '2' | '3' | 'seiho';

export const COPAY_RATIO_LABELS: Record<CopayRatio, string> = {
  '1': '1割',
  '2': '2割',
  '3': '3割',
  seiho: '生保(自己負担なし)',
};

/** 負担割合から、保険給付品目の単位あたり自己負担額(円)を返す */
export function copayYenPerUnit(ratio: CopayRatio): number {
  if (ratio === 'seiho') return 0;
  return Number(ratio);
}

export interface Client {
  id: string;
  name: string; // 利用者名
  kana: string; // フリガナ
  careLevel: string; // 要介護度(自由入力: 要支援1〜要介護5 など)
  copayRatio: CopayRatio; // 利用者負担割合(介護保険品目の自己負担計算に使用)
  address: string;
  phone: string;
  careOfficeName: string; // 居宅介護支援事業所
  careManagerName: string; // 担当ケアマネジャー
  salesRepName: string; // 営業担当者
  active: boolean; // 現在レンタル中かどうか
  note: string;
}

// 'insurance' = 介護保険レンタル品目(単位数×負担割合で自己負担額を自動計算)
// 'private'   = 自費レンタル品目(金額を直接入力)
export type BillingType = 'insurance' | 'private';

export interface RentalItem {
  id: string;
  name: string; // 品目名(例: 特殊寝台、車椅子)
  category: string; // 分類
  billingType: BillingType;
  unitPrice: number; // 自費品目の目安月額(円)。保険品目では使用しない(0でよい)
  note: string;
}

// 消費税の課税区分。介護保険の給付限度額を超えた分などは課税になることがあるため
// 品目マスタではなく実績行ごとに手動で区分する(旧運用のExcelと同じ考え方)。
export type TaxCategory = 'nontaxable' | 'taxable';

export const TAX_CATEGORY_LABELS: Record<TaxCategory, string> = {
  nontaxable: '非課税',
  taxable: '課税',
};

export interface UsageEntry {
  id: string;
  clientId: string;
  yearMonth: YearMonth; // 利用月
  itemId: string;
  itemName: string; // 入力時点の品目名スナップショット
  quantity: number; // 保険品目は単位数、自費品目は通常1
  unitPrice: number; // 保険品目は自己負担額(円/単位)、自費品目は金額(円)そのもの
  amount: number; // 金額(quantity × unitPrice を既定に手動調整可)
  taxCategory: TaxCategory;
  note: string;
  enteredAt: string; // ISO日時
}

export type InvoiceStatus = 'draft' | 'issued';

export interface InvoiceMonthLine {
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  taxCategory: TaxCategory;
}

export interface InvoiceMonth {
  yearMonth: YearMonth;
  lines: InvoiceMonthLine[];
  subtotal: number;
  nonTaxableSubtotal: number;
  taxableSubtotal: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string; // 請求書番号
  clientId: string;
  cycleStartMonth: YearMonth;
  cycleEndMonth: YearMonth;
  months: InvoiceMonth[];
  totalAmount: number;
  nonTaxableTotal: number;
  taxableTotal: number;
  status: InvoiceStatus;
  issuedDate: string | null; // "YYYY-MM-DD"
  createdAt: string; // ISO日時
}

export interface CompanySettings {
  companyName: string;
  address: string;
  phone: string;
  fax: string;
  bankInfo: string; // 振込先情報
}

export interface AppState {
  version: 1;
  clients: Client[];
  items: RentalItem[];
  usageEntries: UsageEntry[];
  invoices: Invoice[];
  invoiceSeq: number;
  company: CompanySettings;
}

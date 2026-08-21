// "YYYY-MM" 形式の年月文字列
export type YearMonth = string;

export interface Client {
  id: string;
  name: string; // 利用者名
  kana: string; // フリガナ
  careLevel: string; // 要介護度(自由入力: 要支援1〜要介護5 など)
  address: string;
  phone: string;
  careOfficeName: string; // 居宅介護支援事業所
  careManagerName: string; // 担当ケアマネジャー
  salesRepName: string; // 営業担当者
  billingStartMonth: YearMonth; // 請求サイクルの起算月(この月から4か月ごとに区切る)
  active: boolean; // 現在レンタル中かどうか
  note: string;
}

export interface RentalItem {
  id: string;
  name: string; // 品目名(例: 特殊寝台、車椅子)
  category: string; // 分類
  unitPrice: number; // 月額単価(円)
  note: string;
}

export interface UsageEntry {
  id: string;
  clientId: string;
  yearMonth: YearMonth; // 利用月
  itemId: string;
  itemName: string; // 入力時点の品目名スナップショット
  quantity: number; // 数量(通常1、複数貸与時などに使用)
  unitPrice: number; // 入力時点の単価スナップショット(日割り等で調整可)
  amount: number; // 金額(quantity × unitPrice を既定に手動調整可)
  note: string;
  enteredAt: string; // ISO日時
}

export type InvoiceStatus = 'draft' | 'issued';

export interface InvoiceMonthLine {
  itemName: string;
  quantity: number;
  unitPrice: number;
  amount: number;
}

export interface InvoiceMonth {
  yearMonth: YearMonth;
  lines: InvoiceMonthLine[];
  subtotal: number;
}

export interface Invoice {
  id: string;
  invoiceNo: string; // 請求書番号
  clientId: string;
  cycleStartMonth: YearMonth;
  cycleEndMonth: YearMonth;
  months: InvoiceMonth[];
  totalAmount: number;
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

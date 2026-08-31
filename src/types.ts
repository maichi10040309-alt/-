// ドメイン型定義

export type TaxRate = 0 | 8 | 10;

export type DocumentType =
  | 'quotation' // 見積書
  | 'delivery' // 納品書
  | 'invoice' // 請求書(単発)
  | 'consolidated_invoice' // 合計請求書(締め処理で生成)
  | 'receipt'; // 領収証

export const DOCUMENT_TYPE_LABEL: Record<DocumentType, string> = {
  quotation: '見積書',
  delivery: '納品書',
  invoice: '請求書',
  consolidated_invoice: '合計請求書',
  receipt: '領収証',
};

export const DOCUMENT_TYPE_PREFIX: Record<DocumentType, string> = {
  quotation: 'Q',
  delivery: 'D',
  invoice: 'I',
  consolidated_invoice: 'CI',
  receipt: 'R',
};

export type DocumentStatus = 'draft' | 'issued' | 'converted' | 'closed';

export const DOCUMENT_STATUS_LABEL: Record<DocumentStatus, string> = {
  draft: '下書き',
  issued: '発行済み',
  converted: '変換済み',
  closed: '請求済み',
};

export interface CompanyInfo {
  id: number; // 常に 1 固定(単一レコード)
  name: string;
  zip: string;
  address1: string;
  address2: string;
  tel: string;
  fax: string;
  email: string;
  invoiceRegistrationNumber: string; // 適格請求書発行事業者登録番号
  representativeName: string;
  bankInfo: string; // 振込先情報
  sealImageDataUrl: string; // 印影画像(任意)
  logoDataUrl: string; // ロゴ画像(任意)
  defaultTaxRate: TaxRate;
  taxRounding: 'floor' | 'round' | 'ceil';
  nextDocNumber: Partial<Record<DocumentType, number>>;
  deliveryTagOptions: string[]; // 納品書の配送区分(直送・店頭・営業担当者名など)の選択肢
}

export type PriceTier = 1 | 2 | 3;

export interface ProductPrices {
  price1: number; // 単価1(標準)
  price2: number; // 単価2(卸値等)
  price3: number; // 単価3(特別価格等)
  cost: number; // 仕入原価(粗利分析用)
}

export interface Product {
  id: string;
  code: string;
  name: string;
  category: string;
  unit: string; // 単位(個,箱,時間 等)
  taxRate: TaxRate;
  prices: ProductPrices;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface Customer {
  id: string;
  code: string;
  name: string;
  kana: string;
  zip: string;
  address1: string;
  address2: string;
  tel: string;
  fax: string;
  email: string;
  contactPerson: string;
  priceTier: PriceTier; // 適用する単価ランク
  discountRate: number; // 得意先別掛率(%) 100=掛け率なし
  closingDay: number; // 締め日 (1-31, 31=末日扱い)
  paymentMonthOffset: number; // 支払月(当月=0,翌月=1,翌々月=2)
  paymentDay: number; // 支払日 (1-31, 31=末日扱い)
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface DocumentItem {
  id: string;
  productId: string | null;
  name: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxRate: TaxRate;
}

export interface TaxSummaryEntry {
  rate: TaxRate;
  taxableAmount: number;
  taxAmount: number;
}

export interface SalesDocument {
  id: string;
  type: DocumentType;
  number: string; // 例: Q-2026-0001
  customerId: string;
  issueDate: string; // ISO date
  validUntilDate: string; // 見積書の有効期限
  dueDate: string; // 請求書の支払期限
  title: string; // 件名
  items: DocumentItem[];
  notes: string;
  status: DocumentStatus;
  sourceDocumentIds: string[]; // 変換元の伝票ID(複数可・合計請求書は複数の納品書から生成)
  convertedToDocumentId: string | null; // 変換先の伝票ID
  periodFrom: string; // 合計請求書の対象期間(開始)
  periodTo: string; // 合計請求書の対象期間(終了)
  previousBalance: number; // 合計請求書:前回繰越残高
  paymentsAmount: number; // 合計請求書:入金額(相殺した領収額)
  deliveryTag: string; // 納品書の配送区分(直送・店頭・営業担当者名など、company.deliveryTagOptionsから選択)
  paid: boolean; // 入金済みフラグ
  paidDate: string; // 入金日
  bankFee: number; // 振込手数料(合計請求書の繰越計算用)
  sourceSummaries: DocumentSourceSummary[]; // 締め処理時点の納品書ごとの内訳(合計請求書の明細表示用)
  createdAt: string;
  updatedAt: string;
}

export interface DocumentSourceSummary {
  date: string; // 元の納品書の発行日
  number: string; // 元の納品書の番号
  title: string; // 施設名など(得意先名や件名)
  subtotal: number; // 税抜金額
}

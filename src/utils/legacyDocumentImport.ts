import { parseCSV } from './csv';
import { newId } from './id';
import type { Customer, DocumentItem, DocumentType, Product, SalesDocument, TaxRate } from '../types';

// 「販売らくだ」等、旧販売管理ソフトから書き出したCSV(見積書・納品書・請求書・領収証)を
// このアプリのデータへ変換するための取り込みロジック。
//
// 旧ソフトのCSVは「伝票番号ごとに複数行(明細1行=1行)」の形式で、同じ伝票番号の行は
// 得意先情報・発行日などを毎回繰り返して持っている。領収証だけは明細行の代わりに
// 支払方法(現金・振込等)の内訳行を持つ、まったく別の構造になっている。

export interface LegacyImportRow {
  number: string;
  issueDate: string; // ISO
  customerCode: string;
  customerName: string;
  zip: string;
  address1: string;
  address2: string;
  tel: string;
  fax: string;
  contactPerson: string;
  title: string;
  notes: string;
  items: DocumentItem[];
  // items と同じ順序で、CSV上の商品コード・商品名を保持しておく(商品台帳とのひも付け解決用)。
  // 領収証の明細(お預かり金)は商品ではないため空配列のまま。
  itemProductRefs: { code: string; name: string }[];
}

export interface LegacyParseResult {
  rows: LegacyImportRow[];
  skippedRowCount: number;
  totalCsvRows: number;
}

function col(header: string[], name: string): number {
  return header.indexOf(name);
}

function val(row: string[], idx: number): string {
  if (idx < 0) return '';
  return (row[idx] ?? '').trim();
}

// 半角/全角どちらの数字表記にも対応する
function toHalfWidthDigits(s: string): string {
  return s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
}

export function parseLegacyDate(raw: string): string {
  const s = raw.trim();
  const m = s.match(/(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (!m) return '';
  const [, y, mo, d] = m;
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

// 「外税(１０％)」「内税(５％)」「非課税」「対象外」「免税」「外(８％軽)」等を解釈する。
// 内税の場合は税込の単価が入っているため、税抜に換算する必要があることを inclusive で示す。
export function parseLegacyTaxCategory(raw: string): { rate: TaxRate; inclusive: boolean } {
  const v = raw.trim();
  if (!v || v.includes('非課税') || v.includes('対象外') || v.includes('免税')) {
    return { rate: 0, inclusive: false };
  }
  const digitsMatch = toHalfWidthDigits(v).match(/(\d+)/);
  if (!digitsMatch) return { rate: 0, inclusive: false };
  const n = Number(digitsMatch[1]);
  const rate: TaxRate = n === 5 || n === 8 || n === 10 ? (n as TaxRate) : n >= 9 ? 10 : n >= 6 ? 8 : n >= 1 ? 5 : 0;
  const inclusive = v.includes('内税') || v.includes('内消費税');
  return { rate, inclusive };
}

function parseNumberJP(raw: string): number {
  if (!raw) return 0;
  const cleaned = toHalfWidthDigits(raw).replace(/[,，¥]/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// 「【 外消費税(5%) 】」のような、消費税額だけをまとめて表示する疑似明細行は取り込まない
// (このアプリでは税額を明細から自動計算するため、二重計上になってしまう)
function isTaxSummaryPseudoRow(productName: string): boolean {
  return /^【.*消費税.*】$/.test(productName.replace(/\s/g, ''));
}

const ITEM_LINE_HEADERS = {
  slip: '伝票番号',
  date: '発行日',
  code: '得意先コード',
  company: '会社名',
  person: '個人名',
  zip: '郵便番号',
  addr1: '住所A',
  addr2: '住所B',
  tel: 'TEL',
  fax: 'FAX',
  contact: '担当者名',
  title: '件名',
  notes: '伝票備考',
  productCode: '商品コード',
  productName: '商品名',
  quantity: '数量',
  unit: '単位',
  unitPrice: '単価',
  amount: '金額',
  taxCategory: '課税区分',
  itemNote: '明細備考',
};

// 見積書・納品書・請求書: 明細1行=1行の形式
function parseItemLineCsv(csvText: string): LegacyParseResult {
  const table = parseCSV(csvText);
  if (table.length === 0) return { rows: [], skippedRowCount: 0, totalCsvRows: 0 };
  const [header, ...body] = table;
  const idx = Object.fromEntries(
    Object.entries(ITEM_LINE_HEADERS).map(([key, name]) => [key, col(header, name)]),
  ) as Record<keyof typeof ITEM_LINE_HEADERS, number>;

  const groups = new Map<string, string[][]>();
  let skipped = 0;
  for (const r of body) {
    const slip = val(r, idx.slip);
    if (!slip) {
      skipped++;
      continue;
    }
    if (!groups.has(slip)) groups.set(slip, []);
    groups.get(slip)!.push(r);
  }

  const rows: LegacyImportRow[] = [];
  for (const [slip, groupRows] of groups) {
    const first = groupRows[0];
    const items: DocumentItem[] = [];
    const itemProductRefs: { code: string; name: string }[] = [];
    for (const r of groupRows) {
      const productName = val(r, idx.productName);
      if (!productName) continue;
      if (isTaxSummaryPseudoRow(productName)) continue;

      const quantity = idx.quantity >= 0 && val(r, idx.quantity) ? parseNumberJP(val(r, idx.quantity)) : 1;
      const amount = parseNumberJP(val(r, idx.amount));
      let unitPrice = idx.unitPrice >= 0 && val(r, idx.unitPrice) ? parseNumberJP(val(r, idx.unitPrice)) : null;
      if (unitPrice === null) unitPrice = quantity !== 0 ? amount / quantity : amount;

      const { rate, inclusive } = parseLegacyTaxCategory(val(r, idx.taxCategory));
      if (inclusive && rate > 0) {
        unitPrice = unitPrice / (1 + rate / 100);
      }

      items.push({
        id: newId(),
        productId: null,
        name: productName,
        unit: val(r, idx.unit),
        quantity: quantity || 1,
        unitPrice: Math.round(unitPrice),
        taxRate: rate,
        note: val(r, idx.itemNote),
      });
      itemProductRefs.push({ code: val(r, idx.productCode), name: productName });
    }
    if (items.length === 0) continue;

    const company = val(first, idx.company);
    const person = val(first, idx.person);
    const customerName = [company, person].filter(Boolean).join('　') || '(得意先不明)';

    rows.push({
      number: slip,
      issueDate: parseLegacyDate(val(first, idx.date)),
      customerCode: val(first, idx.code),
      customerName,
      zip: val(first, idx.zip),
      address1: val(first, idx.addr1),
      address2: val(first, idx.addr2),
      tel: val(first, idx.tel),
      fax: val(first, idx.fax),
      contactPerson: val(first, idx.contact),
      title: idx.title >= 0 ? val(first, idx.title) : '',
      notes: val(first, idx.notes),
      items,
      itemProductRefs,
    });
  }

  return { rows, skippedRowCount: skipped, totalCsvRows: body.length };
}

const RECEIPT_HEADERS = {
  slip: '伝票番号',
  date: '発行日',
  code: '得意先コード',
  company: '会社名',
  person: '個人名',
  zip: '郵便番号',
  addr1: '住所A',
  addr2: '住所B',
  tel: 'TEL',
  fax: 'FAX',
  contact: '担当者名',
  notes: '伝票備考',
  total: '合計金額',
  breakdown: '内訳',
  breakdownAmount: '金額',
};

// 領収証: 明細行の代わりに、支払方法(現金/振込等)ごとの内訳行を持つ
function parseReceiptCsv(csvText: string): LegacyParseResult {
  const table = parseCSV(csvText);
  if (table.length === 0) return { rows: [], skippedRowCount: 0, totalCsvRows: 0 };
  const [header, ...body] = table;
  const idx = Object.fromEntries(
    Object.entries(RECEIPT_HEADERS).map(([key, name]) => [key, col(header, name)]),
  ) as Record<keyof typeof RECEIPT_HEADERS, number>;

  const groups = new Map<string, string[][]>();
  let skipped = 0;
  for (const r of body) {
    const slip = val(r, idx.slip);
    if (!slip) {
      skipped++;
      continue;
    }
    if (!groups.has(slip)) groups.set(slip, []);
    groups.get(slip)!.push(r);
  }

  const rows: LegacyImportRow[] = [];
  for (const [slip, groupRows] of groups) {
    const first = groupRows[0];
    const total = parseNumberJP(val(first, idx.total));
    if (total === 0) continue;

    const paidMethod = groupRows.find((r) => parseNumberJP(val(r, idx.breakdownAmount)) > 0);
    const methodLabel = paidMethod ? val(paidMethod, idx.breakdown) : '';

    const company = val(first, idx.company);
    const person = val(first, idx.person);
    const customerName = [company, person].filter(Boolean).join('　') || '(得意先不明)';

    rows.push({
      number: slip,
      issueDate: parseLegacyDate(val(first, idx.date)),
      customerCode: val(first, idx.code),
      customerName,
      zip: val(first, idx.zip),
      address1: val(first, idx.addr1),
      address2: val(first, idx.addr2),
      tel: val(first, idx.tel),
      fax: val(first, idx.fax),
      contactPerson: val(first, idx.contact),
      title: methodLabel ? `お支払方法：${methodLabel}` : '',
      notes: val(first, idx.notes),
      items: [
        {
          id: newId(),
          productId: null,
          name: 'お預かり金',
          unit: '式',
          quantity: 1,
          unitPrice: total,
          note: '',
          taxRate: 0,
        },
      ],
      // 領収証の「お預かり金」は支払方法の内訳であって商品ではないため、ひも付け対象にしない
      itemProductRefs: [],
    });
  }

  return { rows, skippedRowCount: skipped, totalCsvRows: body.length };
}

export function parseLegacyCsv(csvText: string, docType: DocumentType): LegacyParseResult {
  return docType === 'receipt' ? parseReceiptCsv(csvText) : parseItemLineCsv(csvText);
}

// BOMがあればUTF-8、無ければ旧ソフト特有のShift_JIS(CP932)として読み込む
export async function readLegacyCsvFile(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const hasUtf8Bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const encoding = hasUtf8Bom ? 'utf-8' : 'shift_jis';
  return new TextDecoder(encoding).decode(buffer);
}

export interface NewCustomerDraft {
  key: string;
  code: string; // 空ならインポート時に新規採番する
  name: string;
  zip: string;
  address1: string;
  address2: string;
  tel: string;
  fax: string;
  contactPerson: string;
}

export interface CustomerResolution {
  // 伝票ごとの解決キー(得意先コード優先、無ければ名前)→ 既存の得意先ID
  matchedByKey: Map<string, string>;
  // 新規に作成が必要な得意先(取り込み対象の全伝票から重複排除済み)
  newCustomers: NewCustomerDraft[];
}

function customerKeyOf(row: LegacyImportRow): string {
  return row.customerCode ? `code:${row.customerCode}` : `name:${row.customerName}`;
}

export { customerKeyOf };

export function resolveCustomers(rows: LegacyImportRow[], existingCustomers: Customer[]): CustomerResolution {
  const byCode = new Map<string, Customer>();
  const byName = new Map<string, Customer>();
  for (const c of existingCustomers) {
    if (c.code) byCode.set(c.code.trim(), c);
    if (c.name) byName.set(c.name.trim(), c);
  }

  const matchedByKey = new Map<string, string>();
  const newCustomers: NewCustomerDraft[] = [];
  const seenKeys = new Set<string>();

  for (const row of rows) {
    const key = customerKeyOf(row);
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    const existing =
      (row.customerCode && byCode.get(row.customerCode)) || byName.get(row.customerName) || null;
    if (existing) {
      matchedByKey.set(key, existing.id);
    } else {
      newCustomers.push({
        key,
        code: row.customerCode,
        name: row.customerName,
        zip: row.zip,
        address1: row.address1,
        address2: row.address2,
        tel: row.tel,
        fax: row.fax,
        contactPerson: row.contactPerson,
      });
    }
  }

  return { matchedByKey, newCustomers };
}

export interface NewProductDraft {
  key: string;
  code: string; // 空ならインポート時に新規採番する
  name: string;
  unit: string;
  taxRate: TaxRate;
  unitPrice: number; // 商品台帳への初期登録価格(標準単価)。取り込んだ明細の単価を仮の値として使う
}

export interface ProductResolution {
  // 解決キー(商品コード優先、無ければ商品名)→ 既存の商品ID
  matchedByKey: Map<string, string>;
  // 新規に作成が必要な商品(取り込み対象の全明細から重複排除済み)
  newProducts: NewProductDraft[];
}

function productKeyOf(ref: { code: string; name: string }): string {
  return ref.code ? `code:${ref.code}` : `name:${ref.name}`;
}

export { productKeyOf };

// 明細行を商品台帳とひも付ける(得意先と同様、商品コードが一致すればそれを優先し、
// 無ければ商品名の一致で判断する)。一致する商品が無い場合は新規作成の対象とする。
// これを行わないと、取り込んだ明細は「(自由入力)」のまま商品未選択の状態になってしまう。
export function resolveProducts(rows: LegacyImportRow[], existingProducts: Product[]): ProductResolution {
  const byCode = new Map<string, Product>();
  const byName = new Map<string, Product>();
  for (const p of existingProducts) {
    if (p.code) byCode.set(p.code.trim(), p);
    if (p.name) byName.set(p.name.trim(), p);
  }

  const matchedByKey = new Map<string, string>();
  const newProducts: NewProductDraft[] = [];
  const seenKeys = new Set<string>();

  for (const row of rows) {
    row.items.forEach((item, i) => {
      const ref = row.itemProductRefs[i];
      if (!ref || !ref.name) return;
      const key = productKeyOf(ref);
      if (seenKeys.has(key)) return;
      seenKeys.add(key);

      const existing = (ref.code && byCode.get(ref.code)) || byName.get(ref.name.trim()) || null;
      if (existing) {
        matchedByKey.set(key, existing.id);
      } else {
        newProducts.push({
          key,
          code: ref.code,
          name: ref.name,
          unit: item.unit,
          taxRate: item.taxRate,
          unitPrice: item.unitPrice,
        });
      }
    });
  }

  return { matchedByKey, newProducts };
}

// resolveProductsの結果をもとに、各明細のproductIdを実際に埋める(その場でitemを書き換える)
export function applyResolvedProductIds(
  rows: LegacyImportRow[],
  keyToProductId: Map<string, string>,
): void {
  for (const row of rows) {
    row.items.forEach((item, i) => {
      const ref = row.itemProductRefs[i];
      if (!ref || !ref.name) return;
      const productId = keyToProductId.get(productKeyOf(ref));
      if (productId) item.productId = productId;
    });
  }
}

// --- 既に取り込み済みの伝票を、あとから商品台帳とひも付け直すための機能 ---
// (この機能を追加する前に取り込んだ伝票は、明細に商品コードの控えが残っていないため、
//  商品名の一致のみで判断する)

export interface ProductLinkGap {
  key: string;
  name: string;
  unit: string;
  taxRate: TaxRate;
  unitPrice: number;
}

export interface ProductLinkAnalysis {
  affectedDocumentCount: number;
  affectedItemCount: number;
  matchedByKey: Map<string, string>; // 商品名キー → 既存の商品ID
  newProducts: ProductLinkGap[];
}

function productNameKey(name: string): string {
  return `name:${name.trim()}`;
}

export function analyzeMissingProductLinks(
  documents: SalesDocument[],
  existingProducts: Product[],
): ProductLinkAnalysis {
  const byName = new Map<string, Product>();
  for (const p of existingProducts) {
    if (p.name) byName.set(p.name.trim(), p);
  }

  const matchedByKey = new Map<string, string>();
  const newProductsMap = new Map<string, ProductLinkGap>();
  let affectedDocumentCount = 0;
  let affectedItemCount = 0;

  for (const doc of documents) {
    // 領収証の明細(お預かり金)は支払方法の内訳であって商品ではないため対象外
    if (doc.type === 'receipt') continue;
    let docAffected = false;
    for (const item of doc.items) {
      if (item.productId || !item.name.trim()) continue;
      docAffected = true;
      affectedItemCount++;
      const key = productNameKey(item.name);
      if (matchedByKey.has(key) || newProductsMap.has(key)) continue;
      const existing = byName.get(item.name.trim());
      if (existing) {
        matchedByKey.set(key, existing.id);
      } else {
        newProductsMap.set(key, { key, name: item.name, unit: item.unit, taxRate: item.taxRate, unitPrice: item.unitPrice });
      }
    }
    if (docAffected) affectedDocumentCount++;
  }

  return {
    affectedDocumentCount,
    affectedItemCount,
    matchedByKey,
    newProducts: Array.from(newProductsMap.values()),
  };
}

// 商品名の一致結果をもとに、対象の伝票のうち実際に更新が必要なものだけを
// (明細のproductIdを埋めた新しいオブジェクトとして)返す
export function applyProductLinksToDocuments(
  documents: SalesDocument[],
  keyToProductId: Map<string, string>,
  now: string,
): SalesDocument[] {
  const changed: SalesDocument[] = [];
  for (const doc of documents) {
    if (doc.type === 'receipt') continue;
    let docChanged = false;
    const newItems = doc.items.map((item) => {
      if (item.productId || !item.name.trim()) return item;
      const productId = keyToProductId.get(productNameKey(item.name));
      if (!productId) return item;
      docChanged = true;
      return { ...item, productId };
    });
    if (docChanged) changed.push({ ...doc, items: newItems, updatedAt: now });
  }
  return changed;
}

export function buildSalesDocument(
  row: LegacyImportRow,
  docType: DocumentType,
  customerId: string,
  now: string,
): SalesDocument {
  const issueDate = row.issueDate || now.slice(0, 10);
  // 合計請求書は本来「元となる納品書ごとの内訳」を明細表に表示するが、
  // 旧ソフトのCSVには元の納品書との対応関係が無いため、明細行をそのまま
  // 内訳の代わりとして表示できるようにしておく(印刷時に空欄にならないため)
  const sourceSummaries =
    docType === 'consolidated_invoice'
      ? row.items.map((item) => ({
          date: issueDate,
          number: row.number,
          title: item.name,
          subtotal: item.quantity * item.unitPrice,
        }))
      : [];

  return {
    id: newId(),
    type: docType,
    number: row.number,
    customerId,
    issueDate,
    validUntilDate: '',
    dueDate: '',
    title: row.title,
    items: row.items,
    notes: row.notes,
    status: 'issued',
    sourceDocumentIds: [],
    convertedToDocumentId: null,
    periodFrom: '',
    periodTo: '',
    previousBalance: 0,
    paymentsAmount: 0,
    deliveryTag: '',
    paid: false,
    paidDate: '',
    bankFee: 0,
    sourceSummaries,
    createdAt: now,
    updatedAt: now,
  };
}

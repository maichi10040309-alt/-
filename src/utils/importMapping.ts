export type ImportFieldKind = 'text' | 'number' | 'taxRate';

export interface ImportFieldDef {
  key: string;
  label: string;
  kind: ImportFieldKind;
  required?: boolean;
}

// 取り込み先フィールドごとに、CSVヘッダーとしてよくある表記の候補
const HEADER_SYNONYMS: Record<string, string[]> = {
  code: ['商品コード', '得意先コード', 'コード', 'code', 'no', 'no.'],
  name: ['商品名', '得意先名', '品名', '氏名', '会社名', 'name'],
  kana: ['フリガナ', 'ふりがな', 'カナ', 'かな'],
  category: ['分類', 'カテゴリ', 'カテゴリー', '区分'],
  unit: ['単位'],
  taxRate: ['税率', '課税区分', '消費税'],
  price1: ['単価1', '単価', '税抜単価', '価格', '本体価格'],
  price2: ['単価2', '卸単価'],
  price3: ['単価3', '特別単価'],
  cost: ['仕入原価', '原価', '仕入価格'],
  notes: ['備考', 'メモ', '元データ', '摘要'],
  zip: ['郵便番号', '〒'],
  address1: ['住所1', '住所', '所在地'],
  address2: ['住所2', '建物名', 'ビル名'],
  tel: ['電話番号', 'tel', '電話'],
  fax: ['fax', 'ファックス', 'ＦＡＸ'],
  email: ['メール', 'メールアドレス', 'email'],
  contactPerson: ['担当者', '担当者名'],
  priceTier: ['単価ランク'],
  discountRate: ['掛率', '掛率(%)', '掛け率'],
  closingDay: ['締め日'],
  paymentMonthOffset: ['支払月'],
  paymentDay: ['支払日'],
};

function normalize(s: string): string {
  return s.trim().toLowerCase();
}

// CSVのヘッダー行から、各取り込み先フィールドに最も近そうな列を推測する
export function guessMapping(headerRow: string[], fields: ImportFieldDef[]): Record<string, number | null> {
  const mapping: Record<string, number | null> = {};
  const normalizedHeaders = headerRow.map(normalize);

  for (const field of fields) {
    const candidates = HEADER_SYNONYMS[field.key] ?? [field.label];
    let found: number | null = null;
    for (const candidate of candidates) {
      const idx = normalizedHeaders.indexOf(normalize(candidate));
      if (idx !== -1) {
        found = idx;
        break;
      }
    }
    mapping[field.key] = found;
  }
  return mapping;
}

export function parseNumberJP(raw: string | undefined): number {
  if (!raw) return 0;
  const cleaned = raw.replace(/[,，¥]/g, '').trim();
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}

// 税率列の値を 0/8/10 に変換する。数値ならそのまま、
// 「課税」「非課税」のような文字列は taxAssumption(既定は10%)を使って変換する。
export function parseTaxRate(raw: string | undefined, taxAssumption: 8 | 10): 0 | 8 | 10 {
  const v = (raw ?? '').trim();
  if (v === '') return 10;
  const numeric = Number(v.replace('%', ''));
  if (numeric === 0 || numeric === 8 || numeric === 10) return numeric as 0 | 8 | 10;
  if (v.includes('非課税') || v.includes('対象外') || v.includes('不課税')) return 0;
  if (v.includes('課税')) return taxAssumption;
  return 10;
}

// 列の値がおおむね数値かどうか(税率列が「課税/非課税」のような文字列表記かの判定に使う)
export function looksNumeric(values: string[]): boolean {
  const nonEmpty = values.filter((v) => v.trim() !== '');
  if (nonEmpty.length === 0) return true;
  return nonEmpty.every((v) => !Number.isNaN(Number(v.trim().replace(/[,，%]/g, ''))));
}

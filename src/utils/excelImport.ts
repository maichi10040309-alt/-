import * as XLSX from 'xlsx';
import type { CopayRatio, TaxCategory } from '@/types';
import { copayYenPerUnit } from '@/types';

export interface ImportedUsageLine {
  itemName: string;
  billingType: 'insurance' | 'private';
  quantity: number; // 保険品目=単位数、自費品目=1
  unitPrice: number; // 保険品目=負担割合から自動算出前の円/単位(取り込み時点では負担割合ratioで再計算)、自費品目=金額そのもの
  taxCategory: TaxCategory;
  // 限度額超過の追加負担など、通常の負担割合では計算できない行の単価。
  unitPriceOverride?: number;
  note?: string;
}

export interface ImportedClient {
  name: string;
  kana: string;
  careLevel: string;
  copayRatio: CopayRatio;
  careOfficeName: string;
  careManagerName: string;
  lines: ImportedUsageLine[];
}

export interface ImportResult {
  clients: ImportedClient[];
  warnings: string[];
}

const INSURANCE_SHEET_CANDIDATES = ['保険(在宅)', '保険（在宅）'];
const PRIVATE_SHEET_CANDIDATES = ['自費(在宅)', '自費（在宅）'];

function findSheet(wb: XLSX.WorkBook, candidates: string[]): string | null {
  for (const name of candidates) {
    if (wb.SheetNames.includes(name)) return name;
  }
  const prefix = candidates[0].slice(0, 2);
  return wb.SheetNames.find((n) => n.startsWith(prefix)) ?? null;
}

function normalizeCopayRatio(raw: unknown, warnings: string[], clientName: string): CopayRatio {
  if (raw === 1 || raw === '1') return '1';
  if (raw === 2 || raw === '2') return '2';
  if (raw === 3 || raw === '3') return '3';
  if (typeof raw === 'string' && raw.includes('生保')) return 'seiho';
  warnings.push(`${clientName}: 負担割合「${String(raw)}」を認識できなかったため「1割」として取り込みました。`);
  return '1';
}

function cellStr(v: unknown): string {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function cellNum(v: unknown): number {
  if (typeof v === 'number') return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** 名前+フリガナから同一利用者をマッチングするための正規化キー */
export function clientMatchKey(name: string, kana: string): string {
  const strip = (s: string) => s.replace(/[\s　]+/g, '');
  return `${strip(name)}|${strip(kana)}`;
}

/**
 * weights の中から合計が target に最も近くなる部分集合を探す(厳密一致があれば厳密一致)。
 * 品目ごとの課税/非課税は、Excel側で品目単位ではなくクライアント単位の非課税額・課税額
 * (手入力の集計値)として管理されているため、その集計値に一致する組み合わせを
 * 逆算することで、どの品目が課税扱いだったかを復元する。
 */
function findSubsetMatchingSum(weights: number[], target: number): { indices: Set<number>; achieved: number } {
  const dp = new Map<number, number[]>();
  dp.set(0, []);
  for (let i = 0; i < weights.length; i++) {
    const w = weights[i];
    if (w <= 0) continue;
    for (const [sum, idxs] of Array.from(dp.entries())) {
      const newSum = sum + w;
      if (!dp.has(newSum)) dp.set(newSum, [...idxs, i]);
    }
  }
  if (dp.has(target)) {
    return { indices: new Set(dp.get(target)), achieved: target };
  }
  let bestSum = 0;
  let bestDiff = Math.abs(target);
  for (const sum of dp.keys()) {
    const diff = Math.abs(target - sum);
    if (diff < bestDiff) {
      bestDiff = diff;
      bestSum = sum;
    }
  }
  return { indices: new Set(dp.get(bestSum) ?? []), achieved: bestSum };
}

function applyTaxCategories(
  lines: ImportedUsageLine[],
  weightOf: (line: ImportedUsageLine) => number,
  taxableTarget: number,
  clientName: string,
  itemLabel: string,
  warnings: string[]
) {
  if (taxableTarget <= 0) {
    lines.forEach((l) => (l.taxCategory = 'nontaxable'));
    return;
  }
  const weights = lines.map(weightOf);
  const { indices, achieved } = findSubsetMatchingSum(weights, taxableTarget);
  lines.forEach((l, idx) => {
    l.taxCategory = indices.has(idx) ? 'taxable' : 'nontaxable';
  });
  if (achieved !== taxableTarget) {
    warnings.push(
      `${clientName}: ${itemLabel}の課税/非課税の内訳を元のExcelと完全には一致させられませんでした(概算で割り当てています)。「月次利用入力」で確認してください。`
    );
  }
}

export function parseCareExcelWorkbook(buffer: ArrayBuffer): ImportResult {
  const wb = XLSX.read(buffer, { type: 'array' });
  const warnings: string[] = [];
  const clientsByKey = new Map<string, ImportedClient>();

  const insuranceSheetName = findSheet(wb, INSURANCE_SHEET_CANDIDATES);
  if (insuranceSheetName) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[insuranceSheetName], {
      header: 1,
      raw: true,
    });
    for (let r = 2; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const name = cellStr(row[3]);
      if (!name) continue;
      const kana = cellStr(row[4]);
      const careLevel = cellStr(row[7]);
      const copayRatio = normalizeCopayRatio(row[6], warnings, name);
      const careOfficeName = cellStr(row[9]);
      const careManagerName = cellStr(row[10]);
      const taxableUnits = cellNum(row[13]); // 課(課税単位数)

      const lines: ImportedUsageLine[] = [];
      for (let c = 14; c + 1 < row.length && c <= 45; c += 2) {
        const units = row[c];
        const code = cellStr(row[c + 1]);
        if (!code || units === null || units === undefined || units === '') continue;
        const qty = cellNum(units);
        if (qty === 0) continue;
        lines.push({ itemName: code, billingType: 'insurance', quantity: qty, unitPrice: 0, taxCategory: 'nontaxable' });
      }
      applyTaxCategories(lines, (l) => l.quantity, taxableUnits, name, '介護保険品目', warnings);

      const key = clientMatchKey(name, kana);
      clientsByKey.set(key, {
        name,
        kana,
        careLevel,
        copayRatio,
        careOfficeName,
        careManagerName,
        lines,
      });
    }
  } else {
    warnings.push('「保険(在宅)」シートが見つかりませんでした。保険品目は取り込まれません。');
  }

  const privateSheetName = findSheet(wb, PRIVATE_SHEET_CANDIDATES);
  if (privateSheetName) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[privateSheetName], {
      header: 1,
      raw: true,
    });
    for (let r = 3; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const name = cellStr(row[2]);
      if (!name) continue;
      const kana = cellStr(row[3]);
      const careLevel = cellStr(row[5]);
      const careOfficeName = cellStr(row[6]);
      const careManagerName = cellStr(row[7]);
      const taxableYen = cellNum(row[10]); // 課(課税金額)

      const lines: ImportedUsageLine[] = [];
      for (let c = 11; c + 1 < row.length && c <= 30; c += 2) {
        const amount = row[c];
        const code = cellStr(row[c + 1]);
        if (!code || amount === null || amount === undefined || amount === '') continue;
        const yen = cellNum(amount);
        if (yen === 0) continue;
        lines.push({ itemName: code, billingType: 'private', quantity: 1, unitPrice: yen, taxCategory: 'nontaxable' });
      }
      applyTaxCategories(lines, (l) => l.unitPrice, taxableYen, name, '自費品目', warnings);

      const key = clientMatchKey(name, kana);
      const existing = clientsByKey.get(key);
      if (existing) {
        existing.lines.push(...lines);
      } else {
        clientsByKey.set(key, {
          name,
          kana,
          careLevel,
          copayRatio: '1',
          careOfficeName,
          careManagerName,
          lines,
        });
      }
    }
  } else {
    warnings.push('「自費(在宅)」シートが見つかりませんでした。自費品目は取り込まれません。');
  }

  // 保険シートは実績単位数のみ。給付限度額超過分は「請求額」シートのJ/K列で
  // 管理されている。通常の自己負担額は既に品目行に含むため、10円との差額だけ加算する。
  // 超過対象の品目までは元Excelで特定されていないので、品目を推測して変更せず別行で保持する。
  const claimSheetName = findSheet(wb, ['請求額(在宅)', '請求額（在宅）']);
  if (claimSheetName && insuranceSheetName) {
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[claimSheetName], { header: 1, raw: true });
    const handled = new Set<string>();
    for (let r = 3; r < rows.length; r++) {
      const row = rows[r];
      if (!row) continue;
      const name = cellStr(row[2]);
      if (!name) continue;
      const key = clientMatchKey(name, cellStr(row[3]));
      const matches = [...clientsByKey.values()].filter((client) => clientMatchKey(client.name, '') === clientMatchKey(name, ''));
      const client = clientsByKey.get(key) ?? (matches.length === 1 ? matches[0] : undefined);
      if (!client) continue;
      const clientKey = clientMatchKey(client.name, client.kana);
      const excess = [
        { units: cellNum(row[9]), taxCategory: 'nontaxable' as const, label: '非課税' },
        { units: cellNum(row[10]), taxCategory: 'taxable' as const, label: '課税' },
      ];
      if (!excess.some((entry) => entry.units > 0)) continue;
      if (handled.has(clientKey)) {
        throw new Error(`${name}: 請求額シートに超過単位数の行が重複しています。元Excelをご確認ください。`);
      }
      handled.add(clientKey);
      if (client.copayRatio === 'seiho') continue; // 元Excelの利用者負担額の式と同じ扱い
      for (const entry of excess) {
        if (entry.units <= 0) continue;
        const additionalAmount = entry.units * (10 - copayYenPerUnit(client.copayRatio));
        client.lines.push({
          itemName: `給付限度額超過分（${entry.label}・追加負担）`,
          billingType: 'insurance', quantity: 1, unitPrice: additionalAmount,
          unitPriceOverride: additionalAmount, taxCategory: entry.taxCategory,
          note: `元Excel「${claimSheetName}」の${entry.label}超過${entry.units}単位。通常負担で計算済みのため差額のみ加算。`,
        });
        warnings.push(`${name}: 給付限度額超過分（${entry.label}）${additionalAmount.toLocaleString('ja-JP')}円を追加負担として反映しました。`);
      }
    }
  } else if (insuranceSheetName) {
    warnings.push('「請求額(在宅)」シートが見つからないため、給付限度額超過分の追加負担は取り込まれていません。超過がある場合は確認してください。');
  }

  const clients = [...clientsByKey.values()];
  if (clients.length === 0) {
    warnings.push('取り込めるデータが見つかりませんでした。シート構成が想定と異なる可能性があります。');
  }

  return { clients, warnings };
}

export function readFileAsArrayBuffer(file: File): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

import * as XLSX from 'xlsx';
import type { CopayRatio } from '@/types';

export interface ImportedUsageLine {
  itemName: string;
  billingType: 'insurance' | 'private';
  quantity: number; // 保険品目=単位数、自費品目=1
  unitPrice: number; // 保険品目=負担割合から自動算出前の円/単位(取り込み時点では負担割合ratioで再計算)、自費品目=金額そのもの
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

      const lines: ImportedUsageLine[] = [];
      for (let c = 14; c + 1 < row.length && c <= 45; c += 2) {
        const units = row[c];
        const code = cellStr(row[c + 1]);
        if (!code || units === null || units === undefined || units === '') continue;
        const qty = cellNum(units);
        if (qty === 0) continue;
        lines.push({ itemName: code, billingType: 'insurance', quantity: qty, unitPrice: 0 });
      }

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

      const lines: ImportedUsageLine[] = [];
      for (let c = 11; c + 1 < row.length && c <= 30; c += 2) {
        const amount = row[c];
        const code = cellStr(row[c + 1]);
        if (!code || amount === null || amount === undefined || amount === '') continue;
        const yen = cellNum(amount);
        if (yen === 0) continue;
        lines.push({ itemName: code, billingType: 'private', quantity: 1, unitPrice: yen });
      }
      if (lines.length === 0) continue;

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

  const clients = [...clientsByKey.values()].filter((c) => c.lines.length > 0);
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

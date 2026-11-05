import * as XLSX from 'xlsx';
import type { Client } from '@/types';

export function normalizeCustomerName(name: string): string {
  return name.normalize('NFKC').replace(/\s/g, '');
}

export function readCustomerNumbers(bytes: ArrayBuffer) {
  const workbook = XLSX.read(bytes, { type: 'array' });
  const byName = new Map<string, Set<string>>();
  const byNumber = new Map<string, Set<string>>();
  let sheetCount = 0;
  for (const sheet of Object.values(workbook.Sheets)) {
    const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, raw: false, defval: '' });
    const header = rows.findIndex((row) => row.includes('顧客番号') && row.includes('名前'));
    if (header < 0) continue;
    sheetCount++;
    const numberColumn = rows[header].indexOf('顧客番号');
    const nameColumn = rows[header].indexOf('名前');
    for (const row of rows.slice(header + 1)) {
      const number = String(row[numberColumn] ?? '').normalize('NFKC').trim();
      const name = normalizeCustomerName(String(row[nameColumn] ?? ''));
      if (!/^[0-9]+$/.test(number) || !name) continue;
      if (!byName.has(name)) byName.set(name, new Set());
      if (!byNumber.has(number)) byNumber.set(number, new Set());
      byName.get(name)!.add(number);
      byNumber.get(number)!.add(name);
    }
  }
  if (!sheetCount || !byName.size) throw new Error('「顧客番号」「名前」があるシートを読み込めませんでした。');
  return { byName, byNumber };
}

export function matchCustomerNumbers(clients: Client[], source: ReturnType<typeof readCustomerNumbers>) {
  const matches: { client: Client; number: string }[] = [];
  const conflicts: Client[] = [];
  let unchanged = 0;
  let missing = 0;
  const nameCounts = new Map<string, number>();
  const assigned = new Map<string, Set<string>>();
  for (const client of clients) {
    const name = normalizeCustomerName(client.name);
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
    if (client.customerNumber) {
      const ids = assigned.get(client.customerNumber) ?? new Set<string>();
      ids.add(client.id);
      assigned.set(client.customerNumber, ids);
    }
  }
  for (const client of clients) {
    const name = normalizeCustomerName(client.name);
    const numbers = source.byName.get(name);
    if (!numbers) { missing++; continue; }
    const number = [...numbers][0];
    if (numbers.size !== 1 || source.byNumber.get(number)?.size !== 1 ||
        nameCounts.get(name) !== 1 ||
        [...(assigned.get(number) ?? [])].some((id) => id !== client.id) ||
        (client.customerNumber && client.customerNumber !== number)) {
      conflicts.push(client);
    } else if (client.customerNumber === number) unchanged++;
    else matches.push({ client, number });
  }
  return { matches, conflicts, unchanged, missing };
}

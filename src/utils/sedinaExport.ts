import * as XLSX from 'xlsx';
import type { Client, UsageEntry } from '@/types';
import { addMonths } from '@/utils/date';

export function readSedinaWorkbook(bytes: ArrayBuffer) {
  return XLSX.read(bytes, { type: 'array' });
}

export function planSedinaTransfer(workbook: XLSX.WorkBook, sheetName: string, start: string, clients: Client[], entries: UsageEntry[]) {
  if (!workbook.SheetNames.includes(sheetName)) throw new Error('転記先のタブを選んでください。');
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1, range: 0, raw: false, defval: '' });
  const headerRow = rows.findIndex((row, i) => i > 0 && row.some((cell) => /^(顧客番号|セディナ番号)$/.test(cell.trim())) &&
    rows[i - 1].some((cell) => cell.trim() === 'レンタル'));
  if (headerRow < 0) throw new Error('選んだタブに顧客番号とレンタル欄がありません。');
  const rentalStart = rows[headerRow - 1].findIndex((cell) => cell.trim() === 'レンタル');
  const rentalCols = rows[headerRow].slice(rentalStart, rentalStart + 2).map((cell) => cell.trim());
  const nonTaxCol = rentalStart + rentalCols.indexOf('非課税');
  const taxCol = rentalStart + rentalCols.indexOf('課税');
  if (!rentalCols.includes('非課税') || !rentalCols.includes('課税')) throw new Error('レンタル欄の非課税・課税列を特定できません。');
  const numberCol = rows[headerRow].findIndex((cell) => /^(顧客番号|セディナ番号)$/.test(cell.trim()));
  const clientNumbers = new Map(clients.map((client) => [client.id, client.customerNumber?.trim() || '']));
  const groups = new Map<string, { nonTax: number; tax: number }>();
  const withoutNumber = new Set<string>();
  const end = addMonths(start, 3);
  for (const entry of entries) {
    if (entry.yearMonth < start || entry.yearMonth > end) continue;
    const number = clientNumbers.get(entry.clientId);
    if (!number) { withoutNumber.add(entry.clientId); continue; }
    const group = groups.get(number) ?? { nonTax: 0, tax: 0 };
    if (!Number.isFinite(entry.amount)) throw new Error('集計対象に無効な金額があります。');
    if (entry.taxCategory === 'taxable') group.tax += entry.amount;
    else group.nonTax += entry.amount;
    groups.set(number, group);
  }
  const updates: { row: number; col: number; value: number }[] = [];
  const matched = new Set<string>();
  let nonTaxTotal = 0;
  let taxTotal = 0;
  for (let row = headerRow + 1; row < rows.length; row++) {
    const number = (rows[row][numberCol] ?? '').normalize('NFKC').trim();
    const group = groups.get(number);
    if (!group) continue;
    if (matched.has(number)) throw new Error(`転記先タブに番号 ${number} が複数行あります。二重計上を防ぐため1行に整理してください。`);
    matched.add(number);
    for (const [col, value] of [[nonTaxCol, group.nonTax], [taxCol, group.tax]]) {
      const address = XLSX.utils.encode_cell({ r: row, c: col });
      if (sheet[address]?.f) throw new Error(`レンタル欄の ${address} に数式があるため転記できません。`);
      updates.push({ row, col, value });
    }
    nonTaxTotal += group.nonTax;
    taxTotal += group.tax;
  }
  return { updates, matched: matched.size, nonTaxTotal, taxTotal, withoutNumber: withoutNumber.size,
    unmatchedNumbers: [...groups.keys()].filter((number) => !matched.has(number)) };
}

export function writeSedinaTransfer(bytes: ArrayBuffer, sheetName: string, updates: ReturnType<typeof planSedinaTransfer>['updates']): Uint8Array {
  // Excelで再構築せず、元ファイルのZIP内のシートXMLだけ編集する。
  const cfb = XLSX.CFB;
  const zip = cfb.read(new Uint8Array(bytes), { type: 'array' });
  const parser = new DOMParser();
  const serializer = new XMLSerializer();
  const find = (path: string) => {
    const entry = cfb.find(zip, '/' + path);
    if (!entry?.content) throw new Error('Excelファイルの構造を読み込めませんでした。');
    return entry;
  };
  const xml = (entry: { content: Uint8Array }) => {
    const doc = parser.parseFromString(new TextDecoder().decode(new Uint8Array(entry.content)), 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Excelファイルの構造を読み込めませんでした。');
    return doc;
  };
  const save = (entry: { content: Uint8Array; size: number }, doc: XMLDocument) => {
    entry.content = new TextEncoder().encode(serializer.serializeToString(doc));
    entry.size = entry.content.length;
  };
  const workbookEntry = find('xl/workbook.xml');
  const workbook = xml(workbookEntry);
  const sheet = Array.from(workbook.getElementsByTagNameNS('*', 'sheet')).find((el) => el.getAttribute('name') === sheetName);
  const relationId = sheet?.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id');
  const relation = Array.from(xml(find('xl/_rels/workbook.xml.rels')).getElementsByTagNameNS('*', 'Relationship'))
    .find((el) => el.getAttribute('Id') === relationId);
  const target = relation?.getAttribute('Target');
  if (!target || relation?.getAttribute('TargetMode') === 'External') throw new Error('転記先のシートを開けませんでした。');
  const path = new URL(target, 'https://workbook.invalid/xl/workbook.xml').pathname.slice(1);
  const entry = find(path);
  const doc = xml(entry);
  const ns = doc.documentElement.namespaceURI;
  const rows = new Map(Array.from(doc.getElementsByTagNameNS(ns, 'row')).map((row) => [Number(row.getAttribute('r')) - 1, row]));
  for (const { row, col, value } of updates) {
    const rowNode = rows.get(row);
    if (!rowNode) throw new Error('転記先の行が見つかりません。');
    const address = XLSX.utils.encode_cell({ r: row, c: col });
    const cells = Array.from(rowNode.children).filter((child) => child.localName === 'c');
    let cell = cells.find((child) => child.getAttribute('r') === address);
    if (!cell) {
      cell = doc.createElementNS(ns, 'c');
      cell.setAttribute('r', address);
      const next = cells.find((child) => XLSX.utils.decode_cell(child.getAttribute('r') || 'A1').c > col);
      rowNode.insertBefore(cell, next ?? null);
    }
    cell.removeAttribute('t');
    for (const node of Array.from(cell.children)) if (['v', 'is'].includes(node.localName)) node.remove();
    const amount = doc.createElementNS(ns, 'v');
    amount.textContent = String(value);
    cell.insertBefore(amount, cell.firstChild);
  }
  save(entry, doc);
  const calc = workbook.getElementsByTagNameNS('*', 'calcPr')[0];
  if (calc) { calc.setAttribute('fullCalcOnLoad', '1'); save(workbookEntry, workbook); }
  return new Uint8Array(cfb.write(zip, { type: 'array', fileType: 'zip', compression: true }));
}

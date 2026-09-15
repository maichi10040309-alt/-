import type { AccountType, CompanySettings } from '../types';
import { encodeShiftJIS } from './shiftjis';
import { isZenginSafeText, sanitizeToZenginText } from './kana';

export interface TransferItem {
  vendorName: string; // 表示・エラーメッセージ用(ファイルには出力しない)
  bankCode: string;
  bankNameKana: string;
  branchCode: string;
  branchNameKana: string;
  accountType: AccountType;
  accountNumber: string;
  payeeKana: string;
  amount: number;
}

export interface ZenginBuildResult {
  ok: boolean;
  errors: string[];
  bytes?: Uint8Array;
  recordCount?: number;
  totalAmount?: number;
}

const RECORD_LENGTH = 120;

function accountTypeCode(type: AccountType): string {
  return type === 'ordinary' ? '1' : '2';
}

function digitsOnly(value: string): string {
  return value.replace(/[^0-9]/g, '');
}

function padNumeric(value: string, width: number, fieldName: string, errors: string[]): string {
  const digits = digitsOnly(value);
  if (digits.length > width) {
    errors.push(`${fieldName}は${width}桁以内で入力してください(入力値: ${value})`);
    return digits.slice(-width);
  }
  return digits.padStart(width, '0');
}

function padKana(value: string, width: number, fieldName: string, errors: string[]): string {
  const sanitized = sanitizeToZenginText(value);
  if (!isZenginSafeText(value)) {
    errors.push(`${fieldName}に半角カタカナ・半角英数字以外の文字が含まれています(自動変換しました: "${value}" → "${sanitized}")`);
  }
  if (sanitized.length > width) {
    errors.push(`${fieldName}は${width}文字以内で入力してください(入力値: "${sanitized}")`);
    return sanitized.slice(0, width);
  }
  return sanitized.padEnd(width, ' ');
}

function formatMMDD(date: Date): string {
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${mm}${dd}`;
}

function assertLength(record: string, label: string): void {
  if (record.length !== RECORD_LENGTH) {
    throw new Error(`内部エラー: ${label}レコードの長さが${RECORD_LENGTH}バイトになっていません(実際: ${record.length})`);
  }
}

/**
 * 全銀協規定フォーマット(総合振込)のテキストを生成する。
 * 銀行によって受入要件が異なる場合があるため、実際に取り込む前に必ず取引銀行の
 * ネットバンキングで動作確認してください。
 */
export function buildZenginTransferFile(
  company: CompanySettings,
  transferDate: Date,
  items: TransferItem[]
): ZenginBuildResult {
  const errors: string[] = [];

  if (!company.clientCode.trim()) errors.push('自社設定の委託者コードが未入力です');
  if (!company.clientNameKana.trim()) errors.push('自社設定の委託者名(カナ)が未入力です');
  if (!company.bankCode.trim()) errors.push('自社設定の仕向銀行番号が未入力です');
  if (!company.branchCode.trim()) errors.push('自社設定の仕向支店番号が未入力です');
  if (!company.accountNumber.trim()) errors.push('自社設定の口座番号が未入力です');

  if (items.length === 0) {
    errors.push('振込対象の明細がありません');
  }

  items.forEach((item) => {
    if (!item.bankCode.trim()) errors.push(`${item.vendorName}: 銀行コードが未入力です`);
    if (!item.branchCode.trim()) errors.push(`${item.vendorName}: 支店コードが未入力です`);
    if (!item.accountNumber.trim()) errors.push(`${item.vendorName}: 口座番号が未入力です`);
    if (!item.payeeKana.trim()) errors.push(`${item.vendorName}: 受取人名(カナ)が未入力です`);
    if (!(item.amount > 0)) errors.push(`${item.vendorName}: 振込金額が0円以下です`);
  });

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  const fieldErrors: string[] = [];

  const header =
    '1' +
    '21' +
    '0' +
    padNumeric(company.clientCode, 10, '委託者コード', fieldErrors) +
    padKana(company.clientNameKana, 40, '委託者名(カナ)', fieldErrors) +
    formatMMDD(transferDate) +
    padNumeric(company.bankCode, 4, '仕向銀行番号', fieldErrors) +
    padKana(company.bankNameKana, 15, '仕向銀行名(カナ)', fieldErrors) +
    padNumeric(company.branchCode, 3, '仕向支店番号', fieldErrors) +
    padKana(company.branchNameKana, 15, '仕向支店名(カナ)', fieldErrors) +
    accountTypeCode(company.accountType) +
    padNumeric(company.accountNumber, 7, '自社口座番号', fieldErrors) +
    ' '.repeat(17);
  assertLength(header, 'ヘッダー');

  const dataRecords = items.map((item) => {
    const rec =
      '2' +
      padNumeric(item.bankCode, 4, `${item.vendorName}の銀行コード`, fieldErrors) +
      padKana(item.bankNameKana, 15, `${item.vendorName}の銀行名(カナ)`, fieldErrors) +
      padNumeric(item.branchCode, 3, `${item.vendorName}の支店コード`, fieldErrors) +
      padKana(item.branchNameKana, 15, `${item.vendorName}の支店名(カナ)`, fieldErrors) +
      '0000' + // 手形交換所番号(未使用)
      accountTypeCode(item.accountType) +
      padNumeric(item.accountNumber, 7, `${item.vendorName}の口座番号`, fieldErrors) +
      padKana(item.payeeKana, 30, `${item.vendorName}の受取人名(カナ)`, fieldErrors) +
      padNumeric(String(Math.round(item.amount)), 10, `${item.vendorName}の振込金額`, fieldErrors) +
      '1' + // 新規コード(1:新規)
      ' '.repeat(10) + // 顧客コード1
      ' '.repeat(10) + // 顧客コード2
      '0' + // 振込指定区分(0:未指定)
      ' ' + // 識別表示
      ' '.repeat(7); // ダミー
    assertLength(rec, 'データ');
    return rec;
  });

  const totalAmount = items.reduce((sum, item) => sum + Math.round(item.amount), 0);

  const trailer =
    '8' +
    String(items.length).padStart(6, '0') +
    String(totalAmount).padStart(12, '0') +
    ' '.repeat(101);
  assertLength(trailer, 'トレーラー');

  const endRecord = '9' + ' '.repeat(119);
  assertLength(endRecord, 'エンド');

  if (fieldErrors.length > 0) {
    return { ok: false, errors: fieldErrors };
  }

  const allRecords = [header, ...dataRecords, trailer, endRecord];
  const text = allRecords.join('\r\n');

  try {
    const bytes = encodeShiftJIS(text);
    return { ok: true, errors: [], bytes, recordCount: items.length, totalAmount };
  } catch (e) {
    return { ok: false, errors: [e instanceof Error ? e.message : String(e)] };
  }
}

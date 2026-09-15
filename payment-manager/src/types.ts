export type AccountType = 'ordinary' | 'checking'; // 普通 / 当座

export interface Department {
  id: string;
  name: string;
  sortOrder: number;
}

export interface AccountCategory {
  id: string;
  name: string; // 例: 仕入, 消耗品費, 賃借料, 広告宣伝費
  taxRate: 10 | 8 | 0;
  sortOrder: number;
}

export interface Vendor {
  id: string;
  name: string;
  defaultDepartmentId: string | null;
  bankName: string; // 銀行名(表示用、漢字可)
  bankNameKana: string; // 銀行名(半角カナ、全銀データ作成に必須)
  bankCode: string; // 銀行コード(4桁、全銀データ作成に必須)
  branchName: string; // 支店名(表示用、漢字可)
  branchNameKana: string; // 支店名(半角カナ、全銀データ作成に必須)
  branchCode: string; // 支店コード(3桁、全銀データ作成に必須)
  accountType: AccountType;
  accountNumber: string; // 口座番号(7桁以内)
  payeeKana: string; // 受取人名(半角カナ、全銀データ作成に必須)
  note: string;
}

export interface Invoice {
  id: string;
  yearMonth: string; // "YYYY-MM"
  departmentId: string;
  vendorId: string;
  accountCategoryId: string;
  billedAmount: number; // 請求額
  paidAmount: number; // 支払額
  carriedOverAmount: number; // 繰越額
  note: string;
  isPaid: boolean;
  paidDate: string | null;
}

export interface CompanySettings {
  clientCode: string; // 委託者コード(10桁)
  clientNameKana: string; // 委託者名(半角カナ)
  bankCode: string; // 仕向銀行番号(4桁)
  bankNameKana: string; // 仕向銀行名(半角カナ)
  branchCode: string; // 仕向支店番号(3桁)
  branchNameKana: string; // 仕向支店名(半角カナ)
  accountType: AccountType;
  accountNumber: string; // 引落口座番号(7桁)
}

export interface AppData {
  version: 1;
  departments: Department[];
  accountCategories: AccountCategory[];
  vendors: Vendor[];
  invoices: Invoice[];
  companySettings: CompanySettings;
}

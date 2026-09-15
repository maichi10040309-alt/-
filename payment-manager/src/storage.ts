import type { AppData } from './types';

const STORAGE_KEY = 'payment-manager-data-v1';

function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function defaultData(): AppData {
  const now = uuid();
  return {
    version: 1,
    departments: [{ id: now, name: '本部', sortOrder: 0 }],
    sections: [],
    accountCategories: [
      { id: uuid(), name: '仕入', taxRate: 10, sortOrder: 0 },
      { id: uuid(), name: '仕入(軽減税率)', taxRate: 8, sortOrder: 1 },
      { id: uuid(), name: '仕入(非課税)', taxRate: 0, sortOrder: 2 },
      { id: uuid(), name: '消耗品費', taxRate: 10, sortOrder: 3 },
      { id: uuid(), name: '賃借料', taxRate: 10, sortOrder: 4 },
      { id: uuid(), name: '広告宣伝費', taxRate: 10, sortOrder: 5 },
      { id: uuid(), name: '支払手数料', taxRate: 10, sortOrder: 6 },
      { id: uuid(), name: '福利厚生費', taxRate: 10, sortOrder: 7 },
      { id: uuid(), name: '修繕費', taxRate: 10, sortOrder: 8 },
    ],
    vendors: [],
    invoices: [],
    companySettings: {
      clientCode: '',
      clientNameKana: '',
      bankCode: '',
      bankNameKana: '',
      branchCode: '',
      branchNameKana: '',
      accountType: 'ordinary',
      accountNumber: '',
    },
  };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultData();
    const parsed = JSON.parse(raw) as AppData;
    if (parsed.version !== 1) return defaultData();
    // 旧バージョン(課の概念がなかったデータ)からの読み込みに備えて不足フィールドを補う
    return {
      ...parsed,
      sections: parsed.sections ?? [],
      invoices: parsed.invoices.map((inv) => ({ ...inv, sectionId: inv.sectionId ?? null })),
    };
  } catch {
    return defaultData();
  }
}

export function saveData(data: AppData): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export { uuid };

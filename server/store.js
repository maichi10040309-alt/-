import { readFileSync, writeFileSync, existsSync, mkdirSync, renameSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, 'data');
const DATA_FILE = join(DATA_DIR, 'db.json');

function defaultCompany() {
  return {
    id: 1,
    name: '株式会社サンプル商事',
    zip: '100-0001',
    address1: '東京都千代田区千代田1-1-1',
    address2: 'サンプルビル3F',
    tel: '03-1234-5678',
    fax: '03-1234-5679',
    email: 'info@example.co.jp',
    invoiceRegistrationNumber: 'T1234567890123',
    representativeName: '代表取締役 山田 太郎',
    bankInfo: 'サンプル銀行 本店営業部 普通 1234567 カ)サンプルショウジ',
    sealImageDataUrl: '',
    logoDataUrl: '',
    defaultTaxRate: 10,
    taxRounding: 'floor',
    nextDocNumber: {},
  };
}

function defaultData() {
  return {
    customers: [],
    products: [],
    documents: [],
    company: defaultCompany(),
    counters: { customer: 1, product: 1 },
  };
}

function load() {
  if (!existsSync(DATA_FILE)) {
    return defaultData();
  }
  try {
    const raw = readFileSync(DATA_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      customers: Array.isArray(parsed.customers) ? parsed.customers : [],
      products: Array.isArray(parsed.products) ? parsed.products : [],
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      company: parsed.company ?? defaultCompany(),
      counters: parsed.counters ?? { customer: 1, product: 1 },
    };
  } catch (err) {
    console.error('データファイルの読み込みに失敗しました。既定値で起動します。', err);
    return defaultData();
  }
}

const state = load();

function persist() {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  const tmpFile = DATA_FILE + '.tmp';
  writeFileSync(tmpFile, JSON.stringify(state, null, 2), 'utf-8');
  renameSync(tmpFile, DATA_FILE);
}

// 初回起動時にファイルを作成しておく
if (!existsSync(DATA_FILE)) persist();

function makeCollection(name, sortByCode) {
  return {
    list() {
      if (!sortByCode) return state[name];
      return [...state[name]].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? ''));
    },
    get(id) {
      return state[name].find((r) => r.id === id) ?? null;
    },
    put(record) {
      const idx = state[name].findIndex((r) => r.id === record.id);
      if (idx >= 0) state[name][idx] = record;
      else state[name].push(record);
      persist();
      return record;
    },
    bulkPut(records) {
      for (const record of records) {
        const idx = state[name].findIndex((r) => r.id === record.id);
        if (idx >= 0) state[name][idx] = record;
        else state[name].push(record);
      }
      persist();
      return records.length;
    },
    patch(id, patch) {
      const idx = state[name].findIndex((r) => r.id === id);
      if (idx < 0) return null;
      state[name][idx] = { ...state[name][idx], ...patch };
      persist();
      return state[name][idx];
    },
    remove(id) {
      const idx = state[name].findIndex((r) => r.id === id);
      if (idx < 0) return false;
      state[name].splice(idx, 1);
      persist();
      return true;
    },
    count() {
      return state[name].length;
    },
  };
}

export const customers = makeCollection('customers', true);
export const products = makeCollection('products', true);
export const documents = makeCollection('documents', false);

export const company = {
  get() {
    return state.company;
  },
  put(record) {
    state.company = { ...record, id: 1 };
    persist();
    return state.company;
  },
  patch(patch) {
    state.company = { ...state.company, ...patch };
    persist();
    return state.company;
  },
};

// 伝票番号を採番する(単一プロセス・単一イベントループのため同期処理でレースコンディションを回避)
const DOC_PREFIX = {
  quotation: 'Q',
  delivery: 'D',
  invoice: 'I',
  consolidated_invoice: 'CI',
  receipt: 'R',
};

export function issueDocumentNumber(type, issueDate) {
  const year = String(issueDate).slice(0, 4);
  const next = state.company.nextDocNumber ?? {};
  const current = next[type] ?? 1;
  next[type] = current + 1;
  state.company.nextDocNumber = next;
  persist();
  const prefix = DOC_PREFIX[type] ?? 'X';
  return `${prefix}-${year}-${String(current).padStart(4, '0')}`;
}

export function issueCustomerCode() {
  const current = state.counters.customer ?? 1;
  state.counters.customer = current + 1;
  persist();
  return `C${String(current).padStart(4, '0')}`;
}

export function issueProductCode() {
  const current = state.counters.product ?? 1;
  state.counters.product = current + 1;
  persist();
  return `P${String(current).padStart(4, '0')}`;
}

export function exportAll() {
  return state;
}

export function importAll(data) {
  state.customers = Array.isArray(data.customers) ? data.customers : [];
  state.products = Array.isArray(data.products) ? data.products : [];
  state.documents = Array.isArray(data.documents) ? data.documents : [];
  // 旧IndexedDB版のバックアップは company が配列形式(単一レコード)だったため両対応する
  const company = Array.isArray(data.company) ? data.company[0] : data.company;
  state.company = company ?? defaultCompany();
  state.counters = data.counters ?? state.counters ?? { customer: 1, product: 1 };
  persist();
}

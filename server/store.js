import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { writeFile, rename, mkdir } from 'node:fs/promises';
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
    bankBranch: 'サンプル銀行 本店営業部',
    bankAccount: '普通 1234567',
    bankAccountHolder: 'カ)サンプルショウジ',
    sealImageDataUrl: '',
    logoDataUrl: '',
    defaultTaxRate: 10,
    taxRounding: 'floor',
    nextDocNumber: {},
    deliveryTagOptions: ['直送', '店頭'],
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

// 旧バージョンの1行の振込先自由記述(例:「○○銀行 ○○支店 普通 1234567 カ)○○ショウジ」)を、
// 「普通/当座/貯蓄 + 口座番号」のパターンを手がかりに 銀行名支店名/口座種別・番号/口座名義 の3つに分割する。
// パターンが見つからない場合は内容を失わないよう全て1段目に入れる。
function splitLegacyBankInfo(text) {
  const match = text.match(/(普通|当座|貯蓄)[\s　]*([0-9０-９]+)/);
  if (!match) {
    return { bankBranch: text, bankAccount: '', bankAccountHolder: '' };
  }
  const start = match.index;
  const end = start + match[0].length;
  return {
    bankBranch: text.slice(0, start).trim(),
    bankAccount: text.slice(start, end).trim(),
    bankAccountHolder: text.slice(end).trim(),
  };
}

// 新しい3段表示(銀行名支店名/口座種別・番号/口座名義)フィールドが未設定で、
// 旧データに bankInfo が残っている場合は、内容を失わないよう自動分割して引き継ぐ。
function migrateCompany(merged, rawCompany) {
  const hasNewBankFields =
    rawCompany && ('bankBranch' in rawCompany || 'bankAccount' in rawCompany || 'bankAccountHolder' in rawCompany);
  if (!hasNewBankFields && rawCompany?.bankInfo) {
    const split = splitLegacyBankInfo(rawCompany.bankInfo);
    merged.bankBranch = split.bankBranch;
    merged.bankAccount = split.bankAccount;
    merged.bankAccountHolder = split.bankAccountHolder;
  }
  return merged;
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
      // 古いデータファイルに後から追加した項目が無い場合があるため、既定値にマージする
      company: migrateCompany({ ...defaultCompany(), ...(parsed.company ?? {}) }, parsed.company),
      counters: parsed.counters ?? { customer: 1, product: 1 },
    };
  } catch (err) {
    console.error('データファイルの読み込みに失敗しました。既定値で起動します。', err);
    return defaultData();
  }
}

const state = load();

// データ件数が多くなると保存対象のJSONが数十MBになり、同期書き込み(writeFileSync)では
// 書き込み中Node.jsのイベントループ全体が止まってしまい、1件保存するだけの操作でも
// 画面の応答が数秒止まって「重い」と感じる原因になっていた。
// そのため実際のディスク書き込みは非同期で行い、短時間に連続した変更は1回にまとめる
// (デバウンス)ことで、API呼び出し自体は即座に応答を返せるようにする。
const PERSIST_DEBOUNCE_MS = 200;
let persistTimer = null;
let persistDirty = false;
let persistInFlight = null;

async function flushToDisk() {
  if (!persistDirty) return;
  persistDirty = false;
  if (!existsSync(DATA_DIR)) await mkdir(DATA_DIR, { recursive: true });
  const tmpFile = DATA_FILE + '.tmp';
  const json = JSON.stringify(state);
  await writeFile(tmpFile, json, 'utf-8');
  await rename(tmpFile, DATA_FILE);
}

function schedulePersist() {
  if (persistTimer) return;
  persistTimer = setTimeout(() => {
    persistTimer = null;
    persistInFlight = flushToDisk()
      .catch((err) => console.error('データの保存に失敗しました:', err))
      .finally(() => {
        persistInFlight = null;
        // 書き込み中にさらに変更があった場合は続けて保存する
        if (persistDirty) schedulePersist();
      });
  }, PERSIST_DEBOUNCE_MS);
}

function persist() {
  persistDirty = true;
  schedulePersist();
}

// サーバー終了時に保留中の変更を確実に書き込む
async function flushAndExit() {
  if (persistTimer) {
    clearTimeout(persistTimer);
    persistTimer = null;
  }
  try {
    await persistInFlight;
    await flushToDisk();
  } catch (err) {
    console.error('終了時のデータ保存に失敗しました:', err);
  }
  process.exit(0);
}
process.on('SIGINT', flushAndExit);
process.on('SIGTERM', flushAndExit);

// 初回起動時にファイルを作成しておく(こちらは即座に存在させたいので同期書き込みのまま)
if (!existsSync(DATA_FILE)) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(state), 'utf-8');
}

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
      // 過去データ一括取り込みなど件数が多い場合、件数ごとにfindIndexで線形探索すると
      // 全体でO(件数×既存件数)になり大量データで極端に遅くなるため、事前にMapで索引化する
      const indexById = new Map(state[name].map((r, i) => [r.id, i]));
      for (const record of records) {
        const idx = indexById.get(record.id);
        if (idx !== undefined) {
          state[name][idx] = record;
        } else {
          indexById.set(record.id, state[name].length);
          state[name].push(record);
        }
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
    removeMany(ids) {
      const idSet = new Set(ids);
      const before = state[name].length;
      state[name] = state[name].filter((r) => !idSet.has(r.id));
      persist();
      return before - state[name].length;
    },
    removeAll() {
      const count = state[name].length;
      state[name] = [];
      persist();
      return count;
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
  return issueCustomerCodes(1)[0];
}

export function issueProductCode() {
  return issueProductCodes(1)[0];
}

// まとめて採番する(CSV一括取り込み時、1件ずつサーバーへ問い合わせるのを避けるため)
export function issueCustomerCodes(count) {
  const start = state.counters.customer ?? 1;
  const codes = Array.from({ length: count }, (_, i) => `C${String(start + i).padStart(4, '0')}`);
  state.counters.customer = start + count;
  persist();
  return codes;
}

export function issueProductCodes(count) {
  const start = state.counters.product ?? 1;
  const codes = Array.from({ length: count }, (_, i) => `P${String(start + i).padStart(4, '0')}`);
  state.counters.product = start + count;
  persist();
  return codes;
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

import Dexie, { type Table } from 'dexie';
import type { Customer, Product, SalesDocument, CompanyInfo } from '../types';

export class SalesDB extends Dexie {
  customers!: Table<Customer, string>;
  products!: Table<Product, string>;
  documents!: Table<SalesDocument, string>;
  company!: Table<CompanyInfo, number>;

  constructor() {
    super('sales-management-db');
    this.version(1).stores({
      customers: 'id, code, name, kana',
      products: 'id, code, name, category',
      documents: 'id, type, number, customerId, issueDate, status',
      company: 'id',
    });
  }
}

export const db = new SalesDB();

export async function ensureCompanySeed() {
  const existing = await db.company.get(1);
  if (!existing) {
    const seed: CompanyInfo = {
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
    await db.company.put(seed);
  }
}

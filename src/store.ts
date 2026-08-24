import type { AppState, Client, ClientEvent, Invoice, LateAdjustment, RentalItem, UsageEntry } from '@/types';
import { DEFAULT_ITEMS } from '@/data/defaultItems';

const STORAGE_KEY = 'care-rental-billing-v1';

/**
 * taxCategory(非課税/課税)導入より前に保存されたデータには、
 * UsageEntry / InvoiceMonthLine に taxCategory が存在しない。
 * 読み込み時に「非課税」として補完し、影響を受ける集計値を再計算する。
 */
function migrateState(state: AppState): AppState {
  for (const client of state.clients) {
    if (client.paymentMethod !== 'cash' && client.paymentMethod !== 'cycle') {
      client.paymentMethod = 'cycle';
    }
  }
  for (const entry of state.usageEntries) {
    if (entry.taxCategory !== 'taxable' && entry.taxCategory !== 'nontaxable') {
      entry.taxCategory = 'nontaxable';
    }
  }
  for (const invoice of state.invoices) {
    let nonTaxableTotal = 0;
    let taxableTotal = 0;
    for (const month of invoice.months) {
      let nonTaxableSubtotal = 0;
      let taxableSubtotal = 0;
      for (const line of month.lines) {
        if (line.taxCategory !== 'taxable' && line.taxCategory !== 'nontaxable') {
          line.taxCategory = 'nontaxable';
        }
        if (line.taxCategory === 'taxable') taxableSubtotal += line.amount;
        else nonTaxableSubtotal += line.amount;
      }
      month.nonTaxableSubtotal = nonTaxableSubtotal;
      month.taxableSubtotal = taxableSubtotal;
      if (typeof month.note !== 'string') month.note = '';
      nonTaxableTotal += nonTaxableSubtotal;
      taxableTotal += taxableSubtotal;
    }
    invoice.nonTaxableTotal = nonTaxableTotal;
    invoice.taxableTotal = taxableTotal;
    if (!invoice.adjustments) invoice.adjustments = [];
    if (invoice.paidDate === undefined) invoice.paidDate = null;
    // 区分未設定の請求書(保険/自費の分割請求より前に作成されたもの)は、
    // 保険・自費が1枚に混在した旧形式として扱う。
    if (
      invoice.billingCategory !== 'insurance' &&
      invoice.billingCategory !== 'private' &&
      invoice.billingCategory !== 'combined'
    ) {
      invoice.billingCategory = 'combined';
    }
  }
  if (!state.clientEvents) state.clientEvents = [];
  if (!state.lateAdjustments) state.lateAdjustments = [];
  const itemBillingTypeByName = new Map(state.items.map((i) => [i.name, i.billingType]));
  for (const adjustment of state.lateAdjustments) {
    if (adjustment.billingType !== 'insurance' && adjustment.billingType !== 'private') {
      adjustment.billingType = itemBillingTypeByName.get(adjustment.itemName) ?? 'insurance';
    }
  }
  if (!state.company.companyName && !state.company.address) {
    state.company.companyName = '株式会社グッドライフ';
    state.company.address = '和歌山市内原876-1';
  }
  return state;
}

function loadState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.version === 1) return migrateState(parsed);
    } catch {
      // 破損データは無視して初期化する
    }
  }
  return {
    version: 1,
    clients: [],
    items: DEFAULT_ITEMS.map((item) => ({ ...item, id: newId() })),
    usageEntries: [],
    invoices: [],
    invoiceSeq: 1,
    company: {
      companyName: '株式会社グッドライフ',
      address: '和歌山市内原876-1',
      phone: '',
      fax: '',
      bankInfo: '',
    },
    clientEvents: [],
    lateAdjustments: [],
  };
}

export function newId(): string {
  return crypto.randomUUID();
}

class Store {
  private state: AppState = loadState();
  private listeners: Array<() => void> = [];

  getState(): AppState {
    return this.state;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private commit() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    for (const l of this.listeners) l();
  }

  // ---- Client ----
  upsertClient(client: Client) {
    const idx = this.state.clients.findIndex((c) => c.id === client.id);
    if (idx >= 0) this.state.clients[idx] = client;
    else this.state.clients.push(client);
    this.commit();
  }

  deleteClient(id: string) {
    this.state.clients = this.state.clients.filter((c) => c.id !== id);
    this.state.usageEntries = this.state.usageEntries.filter((u) => u.clientId !== id);
    this.state.invoices = this.state.invoices.filter((i) => i.clientId !== id);
    this.state.clientEvents = this.state.clientEvents.filter((e) => e.clientId !== id);
    this.state.lateAdjustments = this.state.lateAdjustments.filter((a) => a.clientId !== id);
    this.commit();
  }

  // ---- RentalItem ----
  upsertItem(item: RentalItem) {
    const idx = this.state.items.findIndex((i) => i.id === item.id);
    if (idx >= 0) this.state.items[idx] = item;
    else this.state.items.push(item);
    this.commit();
  }

  deleteItem(id: string) {
    this.state.items = this.state.items.filter((i) => i.id !== id);
    this.commit();
  }

  // ---- UsageEntry ----
  setUsageEntriesForMonth(clientId: string, yearMonth: string, entries: UsageEntry[]) {
    this.state.usageEntries = this.state.usageEntries.filter(
      (u) => !(u.clientId === clientId && u.yearMonth === yearMonth)
    );
    this.state.usageEntries.push(...entries);
    this.commit();
  }

  // ---- Invoice ----
  saveInvoice(invoice: Invoice) {
    const idx = this.state.invoices.findIndex((i) => i.id === invoice.id);
    if (idx >= 0) this.state.invoices[idx] = invoice;
    else this.state.invoices.push(invoice);
    this.commit();
  }

  // ---- ClientEvent(新規・終了・休止などの履歴) ----
  upsertClientEvent(event: ClientEvent) {
    const idx = this.state.clientEvents.findIndex((e) => e.id === event.id);
    if (idx >= 0) this.state.clientEvents[idx] = event;
    else this.state.clientEvents.push(event);
    this.commit();
  }

  deleteClientEvent(id: string) {
    this.state.clientEvents = this.state.clientEvents.filter((e) => e.id !== id);
    this.commit();
  }

  // ---- LateAdjustment(月遅れ等の調整) ----
  upsertLateAdjustment(adjustment: LateAdjustment) {
    const idx = this.state.lateAdjustments.findIndex((a) => a.id === adjustment.id);
    if (idx >= 0) this.state.lateAdjustments[idx] = adjustment;
    else this.state.lateAdjustments.push(adjustment);
    this.commit();
  }

  deleteLateAdjustment(id: string) {
    this.state.lateAdjustments = this.state.lateAdjustments.filter((a) => a.id !== id);
    this.commit();
  }

  // ---- Company settings ----
  updateCompany(company: AppState['company']) {
    this.state.company = company;
    this.commit();
  }

  nextInvoiceNo(): string {
    const seq = this.state.invoiceSeq;
    this.state.invoiceSeq += 1;
    const now = new Date();
    const prefix = `${now.getFullYear()}`;
    return `INV-${prefix}-${String(seq).padStart(4, '0')}`;
  }
}

export const store = new Store();

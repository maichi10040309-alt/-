import type { AppState, Client, Invoice, RentalItem, UsageEntry } from '@/types';
import { DEFAULT_ITEMS } from '@/data/defaultItems';

const STORAGE_KEY = 'care-rental-billing-v1';

function loadState(): AppState {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as AppState;
      if (parsed && parsed.version === 1) return parsed;
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
      companyName: '',
      address: '',
      phone: '',
      fax: '',
      bankInfo: '',
    },
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

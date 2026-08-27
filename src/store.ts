import type {
  AppState,
  BillingType,
  Client,
  ClientEvent,
  ClientEventType,
  ClientStatus,
  CompanySettings,
  CopayRatio,
  Invoice,
  InvoiceBillingCategory,
  InvoiceStatus,
  LateAdjustment,
  PaymentMethod,
  RentalItem,
  TaxCategory,
  UsageEntry,
} from '@/types';
import { DEFAULT_ITEMS } from '@/data/defaultItems';
import { supabase } from '@/supabaseClient';

export function newId(): string {
  return crypto.randomUUID();
}

function defaultCompany(): CompanySettings {
  return {
    companyName: '株式会社グッドライフ',
    address: '和歌山市内原876-1',
    phone: '',
    fax: '',
    bankInfo: '',
  };
}

function emptyState(): AppState {
  return {
    version: 1,
    clients: [],
    items: [],
    usageEntries: [],
    invoices: [],
    invoiceSeq: 1,
    company: defaultCompany(),
    clientEvents: [],
    lateAdjustments: [],
  };
}

// ==================== DB(snake_case) <-> ドメイン型(camelCase)の変換 ====================
// テーブル定義は supabase/schema.sql を参照。

function clientFromDb(r: Record<string, unknown>): Client {
  return {
    id: r.id as string,
    name: r.name as string,
    kana: r.kana as string,
    careLevel: r.care_level as string,
    copayRatio: r.copay_ratio as CopayRatio,
    paymentMethod: r.payment_method as PaymentMethod,
    address: r.address as string,
    phone: r.phone as string,
    careOfficeName: r.care_office_name as string,
    careManagerName: r.care_manager_name as string,
    salesRepName: r.sales_rep_name as string,
    status: r.status as ClientStatus,
    note: r.note as string,
  };
}
function clientToDb(c: Client) {
  return {
    id: c.id,
    name: c.name,
    kana: c.kana,
    care_level: c.careLevel,
    copay_ratio: c.copayRatio,
    payment_method: c.paymentMethod,
    address: c.address,
    phone: c.phone,
    care_office_name: c.careOfficeName,
    care_manager_name: c.careManagerName,
    sales_rep_name: c.salesRepName,
    status: c.status,
    note: c.note,
  };
}

function itemFromDb(r: Record<string, unknown>): RentalItem {
  return {
    id: r.id as string,
    name: r.name as string,
    category: r.category as string,
    billingType: r.billing_type as BillingType,
    unitPrice: Number(r.unit_price),
    note: r.note as string,
  };
}
function itemToDb(i: RentalItem) {
  return {
    id: i.id,
    name: i.name,
    category: i.category,
    billing_type: i.billingType,
    unit_price: i.unitPrice,
    note: i.note,
  };
}

function usageEntryFromDb(r: Record<string, unknown>): UsageEntry {
  return {
    id: r.id as string,
    clientId: r.client_id as string,
    yearMonth: r.year_month as string,
    itemId: r.item_id as string,
    itemName: r.item_name as string,
    quantity: Number(r.quantity),
    unitPrice: Number(r.unit_price),
    amount: Number(r.amount),
    taxCategory: r.tax_category as TaxCategory,
    note: r.note as string,
    enteredAt: r.entered_at as string,
  };
}
function usageEntryToDb(u: UsageEntry) {
  return {
    id: u.id,
    client_id: u.clientId,
    year_month: u.yearMonth,
    item_id: u.itemId,
    item_name: u.itemName,
    quantity: u.quantity,
    unit_price: u.unitPrice,
    amount: u.amount,
    tax_category: u.taxCategory,
    note: u.note,
    entered_at: u.enteredAt,
  };
}

function invoiceFromDb(r: Record<string, unknown>): Invoice {
  return {
    id: r.id as string,
    invoiceNo: r.invoice_no as string,
    clientId: r.client_id as string,
    cycleStartMonth: r.cycle_start_month as string,
    cycleEndMonth: r.cycle_end_month as string,
    months: (r.months as Invoice['months']) ?? [],
    adjustments: (r.adjustments as Invoice['adjustments']) ?? [],
    totalAmount: Number(r.total_amount),
    nonTaxableTotal: Number(r.non_taxable_total),
    taxableTotal: Number(r.taxable_total),
    billingCategory: r.billing_category as InvoiceBillingCategory,
    status: r.status as InvoiceStatus,
    issuedDate: (r.issued_date as string | null) ?? null,
    paidDate: (r.paid_date as string | null) ?? null,
    createdAt: r.created_at as string,
  };
}
function invoiceToDb(i: Invoice) {
  return {
    id: i.id,
    invoice_no: i.invoiceNo,
    client_id: i.clientId,
    cycle_start_month: i.cycleStartMonth,
    cycle_end_month: i.cycleEndMonth,
    months: i.months,
    adjustments: i.adjustments,
    total_amount: i.totalAmount,
    non_taxable_total: i.nonTaxableTotal,
    taxable_total: i.taxableTotal,
    billing_category: i.billingCategory,
    status: i.status,
    issued_date: i.issuedDate,
    paid_date: i.paidDate,
    created_at: i.createdAt,
  };
}

function clientEventFromDb(r: Record<string, unknown>): ClientEvent {
  return {
    id: r.id as string,
    clientId: r.client_id as string,
    type: r.type as ClientEventType,
    date: r.date as string,
    content: r.content as string,
    note: r.note as string,
    createdAt: r.created_at as string,
  };
}
function clientEventToDb(e: ClientEvent) {
  return {
    id: e.id,
    client_id: e.clientId,
    type: e.type,
    date: e.date,
    content: e.content,
    note: e.note,
    created_at: e.createdAt,
  };
}

function lateAdjustmentFromDb(r: Record<string, unknown>): LateAdjustment {
  return {
    id: r.id as string,
    clientId: r.client_id as string,
    originalYearMonth: r.original_year_month as string,
    billedYearMonth: r.billed_year_month as string,
    reason: r.reason as string,
    billingType: r.billing_type as BillingType,
    itemName: r.item_name as string,
    quantity: Number(r.quantity),
    unitPrice: Number(r.unit_price),
    amount: Number(r.amount),
    taxCategory: r.tax_category as TaxCategory,
    note: r.note as string,
    createdAt: r.created_at as string,
  };
}
function lateAdjustmentToDb(a: LateAdjustment) {
  return {
    id: a.id,
    client_id: a.clientId,
    original_year_month: a.originalYearMonth,
    billed_year_month: a.billedYearMonth,
    reason: a.reason,
    billing_type: a.billingType,
    item_name: a.itemName,
    quantity: a.quantity,
    unit_price: a.unitPrice,
    amount: a.amount,
    tax_category: a.taxCategory,
    note: a.note,
    created_at: a.createdAt,
  };
}

// ==================== Supabaseからの一括取得 ====================

async function fetchAllFromSupabase(): Promise<AppState> {
  const [clientsRes, itemsRes, usageRes, invoicesRes, eventsRes, adjustmentsRes, companyRes] = await Promise.all([
    supabase.from('clients').select('*'),
    supabase.from('items').select('*'),
    supabase.from('usage_entries').select('*'),
    supabase.from('invoices').select('*'),
    supabase.from('client_events').select('*'),
    supabase.from('late_adjustments').select('*'),
    supabase.from('company_settings').select('*').eq('id', 1).maybeSingle(),
  ]);

  for (const res of [clientsRes, itemsRes, usageRes, invoicesRes, eventsRes, adjustmentsRes, companyRes]) {
    if (res.error) throw res.error;
  }

  let items = (itemsRes.data ?? []).map(itemFromDb);
  if (items.length === 0) {
    // 品目マスタが空(初回セットアップ時)は、初期品目をSupabase側にも投入しておく。
    const seeded = DEFAULT_ITEMS.map((item) => ({ ...item, id: newId() }));
    const { error } = await supabase.from('items').insert(seeded.map(itemToDb));
    if (!error) items = seeded;
  }

  const companyRow = companyRes.data as Record<string, unknown> | null;
  const company: CompanySettings = companyRow
    ? {
        companyName: companyRow.company_name as string,
        address: companyRow.address as string,
        phone: companyRow.phone as string,
        fax: companyRow.fax as string,
        bankInfo: companyRow.bank_info as string,
      }
    : defaultCompany();
  const invoiceSeq = companyRow ? Number(companyRow.invoice_seq) : 1;

  return {
    version: 1,
    clients: (clientsRes.data ?? []).map(clientFromDb),
    items,
    usageEntries: (usageRes.data ?? []).map(usageEntryFromDb),
    invoices: (invoicesRes.data ?? []).map(invoiceFromDb),
    invoiceSeq,
    company,
    clientEvents: (eventsRes.data ?? []).map(clientEventFromDb),
    lateAdjustments: (adjustmentsRes.data ?? []).map(lateAdjustmentFromDb),
  };
}

// ==================== Store ====================
// 複数拠点(複数パソコン)で同じデータを共有するため、Supabase(共有データベース)に
// 読み書きする。書き込み操作は「ローカルの状態をすぐ更新して画面に反映」→
// 「裏でSupabaseへ反映」という楽観的更新にして、これまで通り呼び出し側は
// 同期的に使える(await不要)ようにしている。他のパソコンでの変更は、
// 画面遷移のたび・タブに戻ってきたタイミングで自動的に取り込まれる
// (常時ポーリングはしていない。編集中の入力欄が予期せず巻き戻るのを防ぐため)。
class Store {
  private state: AppState = emptyState();
  private listeners: Array<() => void> = [];
  private ready = false;
  private loadError: string | null = null;

  constructor() {
    void this.refresh(true);
  }

  getState(): AppState {
    return this.state;
  }

  isReady(): boolean {
    return this.ready;
  }

  getLoadError(): string | null {
    return this.loadError;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== fn);
    };
  }

  private notify() {
    for (const l of this.listeners) l();
  }

  private async refresh(isInitial: boolean) {
    try {
      const fresh = await fetchAllFromSupabase();
      this.state = fresh;
      this.loadError = null;
      this.ready = true;
      this.notify();
    } catch (err) {
      console.error('Supabaseからのデータ取得に失敗しました', err);
      if (isInitial) {
        this.loadError =
          'データベースに接続できませんでした。インターネット接続を確認し、画面を再読み込みしてください。';
        this.ready = true;
        this.notify();
      }
      // 画面遷移時などの再取得が一時的に失敗しても、表示中のデータはそのまま残す。
    }
  }

  /** 他のパソコンでの変更を取り込むため、画面遷移時などに呼び出す */
  refreshNow() {
    void this.refresh(false);
  }

  // ---- Client ----
  upsertClient(client: Client) {
    const idx = this.state.clients.findIndex((c) => c.id === client.id);
    if (idx >= 0) this.state.clients[idx] = client;
    else this.state.clients.push(client);
    this.notify();
    void supabase
      .from('clients')
      .upsert(clientToDb(client))
      .then(({ error }) => error && console.error('client upsert failed', error));
  }

  deleteClient(id: string) {
    this.state.clients = this.state.clients.filter((c) => c.id !== id);
    this.state.usageEntries = this.state.usageEntries.filter((u) => u.clientId !== id);
    this.state.invoices = this.state.invoices.filter((i) => i.clientId !== id);
    this.state.clientEvents = this.state.clientEvents.filter((e) => e.clientId !== id);
    this.state.lateAdjustments = this.state.lateAdjustments.filter((a) => a.clientId !== id);
    this.notify();
    void (async () => {
      await Promise.all([
        supabase.from('usage_entries').delete().eq('client_id', id),
        supabase.from('invoices').delete().eq('client_id', id),
        supabase.from('client_events').delete().eq('client_id', id),
        supabase.from('late_adjustments').delete().eq('client_id', id),
      ]);
      const { error } = await supabase.from('clients').delete().eq('id', id);
      if (error) console.error('client delete failed', error);
    })();
  }

  // ---- RentalItem ----
  upsertItem(item: RentalItem) {
    const idx = this.state.items.findIndex((i) => i.id === item.id);
    if (idx >= 0) this.state.items[idx] = item;
    else this.state.items.push(item);
    this.notify();
    void supabase
      .from('items')
      .upsert(itemToDb(item))
      .then(({ error }) => error && console.error('item upsert failed', error));
  }

  deleteItem(id: string) {
    this.state.items = this.state.items.filter((i) => i.id !== id);
    this.notify();
    void supabase
      .from('items')
      .delete()
      .eq('id', id)
      .then(({ error }) => error && console.error('item delete failed', error));
  }

  // ---- UsageEntry ----
  setUsageEntriesForMonth(clientId: string, yearMonth: string, entries: UsageEntry[]) {
    this.state.usageEntries = this.state.usageEntries.filter(
      (u) => !(u.clientId === clientId && u.yearMonth === yearMonth)
    );
    this.state.usageEntries.push(...entries);
    this.notify();
    void (async () => {
      const { error: delErr } = await supabase
        .from('usage_entries')
        .delete()
        .eq('client_id', clientId)
        .eq('year_month', yearMonth);
      if (delErr) {
        console.error('usage_entries delete failed', delErr);
        return;
      }
      if (entries.length > 0) {
        const { error: insErr } = await supabase.from('usage_entries').insert(entries.map(usageEntryToDb));
        if (insErr) console.error('usage_entries insert failed', insErr);
      }
    })();
  }

  // ---- Invoice ----
  saveInvoice(invoice: Invoice) {
    const idx = this.state.invoices.findIndex((i) => i.id === invoice.id);
    if (idx >= 0) this.state.invoices[idx] = invoice;
    else this.state.invoices.push(invoice);
    this.notify();
    void supabase
      .from('invoices')
      .upsert(invoiceToDb(invoice))
      .then(({ error }) => error && console.error('invoice upsert failed', error));
  }

  // ---- ClientEvent(新規・終了・休止などの履歴) ----
  upsertClientEvent(event: ClientEvent) {
    const idx = this.state.clientEvents.findIndex((e) => e.id === event.id);
    if (idx >= 0) this.state.clientEvents[idx] = event;
    else this.state.clientEvents.push(event);
    this.notify();
    void supabase
      .from('client_events')
      .upsert(clientEventToDb(event))
      .then(({ error }) => error && console.error('client_event upsert failed', error));
  }

  deleteClientEvent(id: string) {
    this.state.clientEvents = this.state.clientEvents.filter((e) => e.id !== id);
    this.notify();
    void supabase
      .from('client_events')
      .delete()
      .eq('id', id)
      .then(({ error }) => error && console.error('client_event delete failed', error));
  }

  // ---- LateAdjustment(月遅れ等の調整) ----
  upsertLateAdjustment(adjustment: LateAdjustment) {
    const idx = this.state.lateAdjustments.findIndex((a) => a.id === adjustment.id);
    if (idx >= 0) this.state.lateAdjustments[idx] = adjustment;
    else this.state.lateAdjustments.push(adjustment);
    this.notify();
    void supabase
      .from('late_adjustments')
      .upsert(lateAdjustmentToDb(adjustment))
      .then(({ error }) => error && console.error('late_adjustment upsert failed', error));
  }

  deleteLateAdjustment(id: string) {
    this.state.lateAdjustments = this.state.lateAdjustments.filter((a) => a.id !== id);
    this.notify();
    void supabase
      .from('late_adjustments')
      .delete()
      .eq('id', id)
      .then(({ error }) => error && console.error('late_adjustment delete failed', error));
  }

  // ---- Company settings ----
  updateCompany(company: AppState['company']) {
    this.state.company = company;
    this.notify();
    void supabase
      .from('company_settings')
      .update({
        company_name: company.companyName,
        address: company.address,
        phone: company.phone,
        fax: company.fax,
        bank_info: company.bankInfo,
      })
      .eq('id', 1)
      .then(({ error }) => error && console.error('company update failed', error));
  }

  nextInvoiceNo(): string {
    const seq = this.state.invoiceSeq;
    this.state.invoiceSeq += 1;
    const now = new Date();
    const prefix = `${now.getFullYear()}`;
    void supabase
      .from('company_settings')
      .update({ invoice_seq: this.state.invoiceSeq })
      .eq('id', 1)
      .then(({ error }) => error && console.error('invoice_seq update failed', error));
    return `INV-${prefix}-${String(seq).padStart(4, '0')}`;
  }
}

export const store = new Store();

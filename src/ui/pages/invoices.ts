import { store, newId } from '@/store';
import type { Invoice } from '@/types';
import { escapeHtml, formatYen } from '@/utils/format';
import { currentYearMonth, formatDateJapanese, formatYmJapanese, todayIso } from '@/utils/date';
import { buildInvoiceMonths, getClientCycles } from '@/utils/billing';
import { navigate } from '@/ui/router';
import { showConfirm } from '@/ui/components/dialog';

let referenceMonth = currentYearMonth();

export function renderInvoicesPage(root: HTMLElement) {
  const { clients, usageEntries, invoices } = store.getState();

  const dueRows: {
    clientId: string;
    clientName: string;
    cycleStartMonth: string;
    cycleEndMonth: string;
  }[] = [];

  for (const client of clients) {
    const cycles = getClientCycles(client, usageEntries, invoices, referenceMonth);
    for (const cycle of cycles) {
      if (cycle.isDue && !cycle.invoice) {
        dueRows.push({
          clientId: client.id,
          clientName: client.name,
          cycleStartMonth: cycle.cycleStartMonth,
          cycleEndMonth: cycle.cycleEndMonth,
        });
      }
    }
  }
  dueRows.sort((a, b) => a.cycleEndMonth.localeCompare(b.cycleEndMonth));

  const sortedInvoices = [...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  root.innerHTML = `
    <div class="toolbar">
      <div class="page-subtitle">4か月ごとの請求サイクルを自動集計します。基準月時点で締められたサイクルが「請求対象」に表示されます。</div>
      <div class="toolbar-controls">
        <label>基準月</label>
        <input type="month" id="f-reference" value="${referenceMonth}" />
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">請求対象(未請求) ${dueRows.length > 0 ? `<span class="badge badge-warning">${dueRows.length}件</span>` : ''}</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>利用者</th>
            <th>請求対象期間</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="due-rows">
          ${
            dueRows.length === 0
              ? `<tr class="empty-row"><td colspan="3">基準月時点で新たに請求すべきサイクルはありません。</td></tr>`
              : dueRows
                  .map(
                    (r) => `
              <tr>
                <td>${escapeHtml(r.clientName)}</td>
                <td>${formatYmJapanese(r.cycleStartMonth)} 〜 ${formatYmJapanese(r.cycleEndMonth)}</td>
                <td class="actions-cell">
                  <button class="btn btn-sm btn-primary js-create" data-client="${r.clientId}" data-cycle="${r.cycleStartMonth}">請求書を作成</button>
                </td>
              </tr>
            `
                  )
                  .join('')
          }
        </tbody>
      </table>
    </div>

    <div class="card">
      <h3 class="card-title">請求書一覧</h3>
      <table class="data-table">
        <thead>
          <tr>
            <th>請求書番号</th>
            <th>利用者</th>
            <th>対象期間</th>
            <th class="num">請求金額</th>
            <th>状態</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="invoice-rows">
          ${
            sortedInvoices.length === 0
              ? `<tr class="empty-row"><td colspan="6">請求書はまだ作成されていません。</td></tr>`
              : sortedInvoices.map(invoiceRowHtml).join('')
          }
        </tbody>
      </table>
    </div>
  `;

  root.querySelector('#f-reference')?.addEventListener('change', (e) => {
    const v = (e.target as HTMLInputElement).value;
    if (v) {
      referenceMonth = v;
      renderInvoicesPage(root);
    }
  });

  root.querySelector('#due-rows')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.js-create') as HTMLElement | null;
    if (!btn) return;
    const clientId = btn.dataset.client!;
    const cycleStartMonth = btn.dataset.cycle!;
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    const cycles = getClientCycles(client, usageEntries, invoices, referenceMonth);
    const cycle = cycles.find((c) => c.cycleStartMonth === cycleStartMonth);
    if (!cycle) return;
    const { months, totalAmount } = buildInvoiceMonths(cycle, usageEntries);
    const invoice: Invoice = {
      id: newId(),
      invoiceNo: '',
      clientId,
      cycleStartMonth: cycle.cycleStartMonth,
      cycleEndMonth: cycle.cycleEndMonth,
      months,
      totalAmount,
      status: 'draft',
      issuedDate: null,
      createdAt: new Date().toISOString(),
    };
    store.saveInvoice(invoice);
    navigate(`invoices/${invoice.id}`);
  });

  root.querySelector('#invoice-rows')?.addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest('.js-view') as HTMLElement | null;
    if (!btn) return;
    navigate(`invoices/${btn.dataset.id}`);
  });
}

function invoiceRowHtml(inv: Invoice): string {
  const client = store.getState().clients.find((c) => c.id === inv.clientId);
  const statusBadge =
    inv.status === 'issued'
      ? `<span class="badge badge-success">発行済み(${inv.issuedDate ? formatDateJapanese(inv.issuedDate) : ''})</span>`
      : `<span class="badge badge-warning">下書き</span>`;
  return `
    <tr>
      <td>${inv.invoiceNo ? escapeHtml(inv.invoiceNo) : '-'}</td>
      <td>${escapeHtml(client?.name ?? '(削除済み)')}</td>
      <td>${formatYmJapanese(inv.cycleStartMonth)} 〜 ${formatYmJapanese(inv.cycleEndMonth)}</td>
      <td class="num">${formatYen(inv.totalAmount)}</td>
      <td>${statusBadge}</td>
      <td class="actions-cell">
        <button class="btn-link js-view" data-id="${inv.id}">表示</button>
      </td>
    </tr>
  `;
}

export function renderInvoiceDetailPage(root: HTMLElement, invoiceId: string) {
  const invoice = store.getState().invoices.find((i) => i.id === invoiceId);
  if (!invoice) {
    root.innerHTML = `<div class="card">請求書が見つかりません。<button class="btn" id="btn-back">請求書一覧に戻る</button></div>`;
    root.querySelector('#btn-back')?.addEventListener('click', () => navigate('invoices'));
    return;
  }
  const client = store.getState().clients.find((c) => c.id === invoice.clientId);
  const company = store.getState().company;

  root.innerHTML = `
    <div class="invoice-actions no-print">
      <button class="btn" id="btn-back">← 一覧に戻る</button>
      <div style="flex:1"></div>
      ${
        invoice.status === 'draft'
          ? `<button class="btn btn-primary" id="btn-issue">発行済みにする</button>`
          : ''
      }
      <button class="btn" id="btn-print">🖨 印刷</button>
    </div>
    <p class="no-print" style="color:var(--color-text-muted);font-size:12px;margin:-10px 0 16px;text-align:right">
      印刷ボタンで画面が変わらない場合は、キーボードの Ctrl+P(Macは⌘+P)をお試しください。
    </p>
    <div class="invoice-sheet" id="invoice-sheet">
      <div class="invoice-header">
        <div>
          <h2>請求書</h2>
          <div>${escapeHtml(client?.name ?? '')} 様</div>
          <div style="color:#64748b;font-size:12px;margin-top:4px">${escapeHtml(client?.address ?? '')}</div>
        </div>
        <div class="invoice-meta">
          <div>請求書番号: ${invoice.invoiceNo ? escapeHtml(invoice.invoiceNo) : '(未発行)'}</div>
          <div>発行日: ${invoice.issuedDate ? formatDateJapanese(invoice.issuedDate) : '(未発行)'}</div>
          <div>対象期間: ${formatYmJapanese(invoice.cycleStartMonth)} 〜 ${formatYmJapanese(invoice.cycleEndMonth)}</div>
          <div style="margin-top:10px;font-weight:600">${escapeHtml(company.companyName)}</div>
          <div>${escapeHtml(company.address)}</div>
          <div>${company.phone ? 'TEL: ' + escapeHtml(company.phone) : ''} ${company.fax ? 'FAX: ' + escapeHtml(company.fax) : ''}</div>
        </div>
      </div>

      <div class="invoice-total-box">
        <span class="label">ご請求金額(4か月分合計)</span>
        <span class="amount">${formatYen(invoice.totalAmount)}</span>
      </div>

      ${invoice.months.map(monthBlockHtml).join('')}

      ${
        company.bankInfo
          ? `<div class="card" style="margin-top:20px"><h3 class="card-title">お振込先</h3><div style="white-space:pre-line">${escapeHtml(company.bankInfo)}</div></div>`
          : ''
      }
    </div>
  `;

  root.querySelector('#btn-back')?.addEventListener('click', () => navigate('invoices'));
  root.querySelector('#btn-print')?.addEventListener('click', () => window.print());
  root.querySelector('#btn-issue')?.addEventListener('click', async () => {
    if (!(await showConfirm('この請求書を発行済みにします。よろしいですか?'))) return;
    const invoiceNo = invoice.invoiceNo || store.nextInvoiceNo();
    store.saveInvoice({
      ...invoice,
      invoiceNo,
      status: 'issued',
      issuedDate: todayIso(),
    });
  });
}

function monthBlockHtml(month: Invoice['months'][number]): string {
  return `
    <div class="invoice-month-block">
      <h4>${formatYmJapanese(month.yearMonth)}分</h4>
      <table class="data-table">
        <thead>
          <tr>
            <th>品目</th>
            <th class="num">数量</th>
            <th class="num">月額単価</th>
            <th class="num">金額</th>
          </tr>
        </thead>
        <tbody>
          ${
            month.lines.length === 0
              ? `<tr class="empty-row"><td colspan="4">利用実績の入力がありません</td></tr>`
              : month.lines
                  .map(
                    (l) => `
              <tr>
                <td>${escapeHtml(l.itemName)}</td>
                <td class="num">${l.quantity}</td>
                <td class="num">${formatYen(l.unitPrice)}</td>
                <td class="num">${formatYen(l.amount)}</td>
              </tr>
            `
                  )
                  .join('')
          }
          <tr>
            <td colspan="3" style="text-align:right;font-weight:600">小計</td>
            <td class="num" style="font-weight:600">${formatYen(month.subtotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

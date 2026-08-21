import { store, newId } from '@/store';
import type { Client, Invoice, LateAdjustment, TaxCategory } from '@/types';
import { TAX_CATEGORY_LABELS } from '@/types';
import { escapeHtml, formatYen } from '@/utils/format';
import { currentYearMonth, formatDateJapanese, formatYmJapanese, isValidYearMonth, todayIso } from '@/utils/date';
import { buildInvoiceMonths, cycleStartForMonth, getClientCycles } from '@/utils/billing';
import { navigate } from '@/ui/router';
import { showAlert, showConfirm } from '@/ui/components/dialog';
import { openModal } from '@/ui/components/modal';

let referenceMonth = currentYearMonth();

export function renderInvoicesPage(root: HTMLElement) {
  const { clients, usageEntries, invoices, lateAdjustments } = store.getState();

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
      <div class="page-subtitle">
        全利用者共通で3月・7月・11月始まりの4か月サイクルを自動集計します(例: 7〜10月分は11月請求)。
        基準月が請求月に達したサイクルが「請求対象」に表示されます。
      </div>
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
      <div class="toolbar">
        <h3 class="card-title" style="margin:0">月遅れ等の調整 ${lateAdjustments.length > 0 ? `<span class="badge badge-muted">${lateAdjustments.length}件</span>` : ''}</h3>
        <button class="btn btn-sm" id="btn-add-adjustment" ${clients.length === 0 ? 'disabled' : ''}>＋ 調整を追加</button>
      </div>
      <p class="page-subtitle" style="margin:0 0 12px">
        過去の提供月の実績を後日追加する場合の入力です。指定した「計上する請求月」を含む請求サイクルの請求書作成時にまとめて反映されます。
      </p>
      <table class="data-table">
        <thead>
          <tr>
            <th>利用者</th>
            <th>本来の提供月</th>
            <th>計上する請求月</th>
            <th>理由</th>
            <th>品目</th>
            <th class="num">金額</th>
            <th>状態</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="adjustment-rows">
          ${
            lateAdjustments.length === 0
              ? `<tr class="empty-row"><td colspan="8">調整はまだありません。</td></tr>`
              : [...lateAdjustments]
                  .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
                  .map((a) => adjustmentRowHtml(a, clients, invoices))
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
    const { months, adjustments, totalAmount, nonTaxableTotal, taxableTotal } = buildInvoiceMonths(
      cycle,
      usageEntries,
      lateAdjustments
    );
    const invoice: Invoice = {
      id: newId(),
      invoiceNo: '',
      clientId,
      cycleStartMonth: cycle.cycleStartMonth,
      cycleEndMonth: cycle.cycleEndMonth,
      months,
      adjustments,
      totalAmount,
      nonTaxableTotal,
      taxableTotal,
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

  root.querySelector('#btn-add-adjustment')?.addEventListener('click', () => {
    if (clients.length === 0) return;
    openAdjustmentModal(clients);
  });

  root.querySelector('#adjustment-rows')?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const id = target.getAttribute('data-id');
    if (!id) return;
    if (target.classList.contains('js-edit-adjustment')) {
      const adj = store.getState().lateAdjustments.find((a) => a.id === id);
      if (adj) openAdjustmentModal(clients, adj);
    } else if (target.classList.contains('js-delete-adjustment')) {
      if (await showConfirm('この調整を削除します。よろしいですか?')) {
        store.deleteLateAdjustment(id);
      }
    }
  });
}

function adjustmentRowHtml(a: LateAdjustment, clients: Client[], invoices: Invoice[]): string {
  const client = clients.find((c) => c.id === a.clientId);
  const cycleStart = cycleStartForMonth(a.billedYearMonth);
  const alreadyInvoiced = invoices.some((inv) => inv.clientId === a.clientId && inv.cycleStartMonth === cycleStart);
  return `
    <tr>
      <td>${escapeHtml(client?.name ?? '(削除済み)')}</td>
      <td>${formatYmJapanese(a.originalYearMonth)}</td>
      <td>${formatYmJapanese(a.billedYearMonth)}</td>
      <td>${escapeHtml(a.reason)}</td>
      <td>${escapeHtml(a.itemName)}</td>
      <td class="num">${formatYen(a.amount)}</td>
      <td>${alreadyInvoiced ? '<span class="badge badge-success">請求済み</span>' : '<span class="badge badge-warning">未請求</span>'}</td>
      <td class="actions-cell">
        <button class="btn-link js-edit-adjustment" data-id="${a.id}">編集</button>
        <button class="btn-link js-delete-adjustment" data-id="${a.id}" style="color:#dc2626">削除</button>
      </td>
    </tr>
  `;
}

function openAdjustmentModal(clients: Client[], existing?: LateAdjustment) {
  const isEdit = !!existing;
  const { box, close } = openModal(isEdit ? '月遅れ等調整の編集' : '月遅れ等調整の追加');

  const a: LateAdjustment = existing ?? {
    id: newId(),
    clientId: clients[0].id,
    originalYearMonth: currentYearMonth(),
    billedYearMonth: currentYearMonth(),
    reason: '暫定利用による月遅れ請求',
    itemName: '',
    quantity: 1,
    unitPrice: 0,
    amount: 0,
    taxCategory: 'nontaxable',
    note: '',
    createdAt: new Date().toISOString(),
  };

  box.insertAdjacentHTML(
    'beforeend',
    `
    <div class="form-grid">
      <div class="form-field full">
        <label>利用者 *</label>
        <select id="f-client">
          ${clients.map((c) => `<option value="${c.id}" ${c.id === a.clientId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>本来の提供月 *</label>
        <input type="month" id="f-original-month" value="${a.originalYearMonth}" />
      </div>
      <div class="form-field">
        <label>計上する請求月 *</label>
        <input type="month" id="f-billed-month" value="${a.billedYearMonth}" />
      </div>
      <div class="form-field full">
        <label>理由</label>
        <input type="text" id="f-reason" placeholder="例: 暫定利用による月遅れ請求、返戻等による再請求、過誤による返金" value="${escapeHtml(a.reason)}" />
      </div>
      <div class="form-field full">
        <label>品目名 *</label>
        <input type="text" id="f-item-name" value="${escapeHtml(a.itemName)}" />
      </div>
      <div class="form-field">
        <label>数量</label>
        <input type="number" id="f-quantity" step="0.5" value="${a.quantity}" />
      </div>
      <div class="form-field">
        <label>単価(円)</label>
        <input type="number" id="f-unit-price" step="1" value="${a.unitPrice}" />
      </div>
      <div class="form-field">
        <label>税区分</label>
        <select id="f-tax">
          <option value="nontaxable" ${a.taxCategory === 'nontaxable' ? 'selected' : ''}>非課税</option>
          <option value="taxable" ${a.taxCategory === 'taxable' ? 'selected' : ''}>課税</option>
        </select>
      </div>
      <div class="form-field">
        <label>金額(円、返金はマイナス)</label>
        <input type="number" id="f-amount" step="1" value="${a.quantity * a.unitPrice}" />
      </div>
      <div class="form-field full">
        <label>備考</label>
        <textarea id="f-note">${escapeHtml(a.note)}</textarea>
      </div>
    </div>
    <p style="color:var(--color-text-muted);font-size:12px;margin-top:8px">
      ※ 金額欄は数量×単価で自動計算されますが、直接書き換えることもできます。
    </p>
    <div class="form-actions">
      <button class="btn" id="btn-cancel">キャンセル</button>
      <button class="btn btn-primary" id="btn-save">保存</button>
    </div>
  `
  );

  const qtyInput = box.querySelector('#f-quantity') as HTMLInputElement;
  const priceInput = box.querySelector('#f-unit-price') as HTMLInputElement;
  const amountInput = box.querySelector('#f-amount') as HTMLInputElement;
  const syncAmount = () => {
    amountInput.value = String(Number(qtyInput.value || 0) * Number(priceInput.value || 0));
  };
  qtyInput.addEventListener('input', syncAmount);
  priceInput.addEventListener('input', syncAmount);

  box.querySelector('#btn-cancel')?.addEventListener('click', close);
  box.querySelector('#btn-save')?.addEventListener('click', async () => {
    const originalYearMonth = (box.querySelector('#f-original-month') as HTMLInputElement).value;
    const billedYearMonth = (box.querySelector('#f-billed-month') as HTMLInputElement).value;
    const itemName = (box.querySelector('#f-item-name') as HTMLInputElement).value.trim();
    if (!isValidYearMonth(originalYearMonth) || !isValidYearMonth(billedYearMonth)) {
      await showAlert('提供月と計上する請求月を選択してください。');
      return;
    }
    if (!itemName) {
      await showAlert('品目名を入力してください。');
      return;
    }
    const updated: LateAdjustment = {
      ...a,
      clientId: (box.querySelector('#f-client') as HTMLSelectElement).value,
      originalYearMonth,
      billedYearMonth,
      reason: (box.querySelector('#f-reason') as HTMLInputElement).value.trim(),
      itemName,
      quantity: Number(qtyInput.value) || 0,
      unitPrice: Number(priceInput.value) || 0,
      amount: Number(amountInput.value) || 0,
      taxCategory: (box.querySelector('#f-tax') as HTMLSelectElement).value as TaxCategory,
      note: (box.querySelector('#f-note') as HTMLTextAreaElement).value.trim(),
    };
    store.upsertLateAdjustment(updated);
    close();
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
      <p style="text-align:right;color:var(--color-text-muted);font-size:13px;margin:-20px 0 20px">
        内訳: 非課税 ${formatYen(invoice.nonTaxableTotal)} ／ 課税 ${formatYen(invoice.taxableTotal)}
      </p>

      ${invoice.months.map(monthBlockHtml).join('')}

      ${invoice.adjustments.length > 0 ? adjustmentsBlockHtml(invoice.adjustments) : ''}

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

function adjustmentsBlockHtml(adjustments: Invoice['adjustments']): string {
  const total = adjustments.reduce((sum, a) => sum + a.amount, 0);
  return `
    <div class="invoice-month-block">
      <h4>月遅れ等の調整</h4>
      <table class="data-table">
        <thead>
          <tr>
            <th>本来の提供月</th>
            <th>理由</th>
            <th>品目</th>
            <th class="num">数量</th>
            <th class="num">単価</th>
            <th>税区分</th>
            <th class="num">金額</th>
          </tr>
        </thead>
        <tbody>
          ${adjustments
            .map(
              (a) => `
            <tr>
              <td>${formatYmJapanese(a.originalYearMonth)}</td>
              <td>${escapeHtml(a.reason)}</td>
              <td>${escapeHtml(a.itemName)}</td>
              <td class="num">${a.quantity}</td>
              <td class="num">${formatYen(a.unitPrice)}</td>
              <td>${TAX_CATEGORY_LABELS[a.taxCategory]}</td>
              <td class="num">${formatYen(a.amount)}</td>
            </tr>
          `
            )
            .join('')}
          <tr>
            <td colspan="6" style="text-align:right;font-weight:600">調整小計</td>
            <td class="num" style="font-weight:600">${formatYen(total)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
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
            <th>税区分</th>
            <th class="num">金額</th>
          </tr>
        </thead>
        <tbody>
          ${
            month.lines.length === 0
              ? `<tr class="empty-row"><td colspan="5">利用実績の入力がありません</td></tr>`
              : month.lines
                  .map(
                    (l) => `
              <tr>
                <td>${escapeHtml(l.itemName)}</td>
                <td class="num">${l.quantity}</td>
                <td class="num">${formatYen(l.unitPrice)}</td>
                <td>${TAX_CATEGORY_LABELS[l.taxCategory]}</td>
                <td class="num">${formatYen(l.amount)}</td>
              </tr>
            `
                  )
                  .join('')
          }
          <tr>
            <td colspan="4" style="text-align:right;color:var(--color-text-muted)">非課税小計 / 課税小計</td>
            <td class="num" style="color:var(--color-text-muted)">${formatYen(month.nonTaxableSubtotal)} / ${formatYen(month.taxableSubtotal)}</td>
          </tr>
          <tr>
            <td colspan="4" style="text-align:right;font-weight:600">小計</td>
            <td class="num" style="font-weight:600">${formatYen(month.subtotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

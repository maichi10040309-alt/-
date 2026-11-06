import { openSedinaExport } from '@/ui/pages/sedinaExport';
import { buildInvoiceMonths } from '@/utils/billing';
import { store, newId } from '@/store';
import type { Invoice, TaxCategory, UsageEntry } from '@/types';
import { CLIENT_STATUS_LABELS, INVOICE_BILLING_CATEGORY_LABELS, TAX_CATEGORY_LABELS, copayYenPerUnit } from '@/types';
import { escapeHtml, formatYen } from '@/utils/format';
import { addMonths, currentYearMonth, formatYmJapanese, isValidYearMonth, todayIso } from '@/utils/date';
import { openImportModal } from '@/ui/pages/importExcel';
import { showAlert, showConfirm } from '@/ui/components/dialog';
import { clientStatusBadge, focusClientOnNextRender } from '@/ui/pages/clients';
import { navigate } from '@/ui/router';

interface DraftRow {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  taxCategory: TaxCategory;
  note?: string;
}

type Mode = 'input' | 'list';

let mode: Mode = 'input';
let selectedClientId = '';
let issuingCashInvoice = false;
let savingMonthlyUsage = false;
let selectedMonth = currentYearMonth();
let listMonthCount: 1 | 4 = 1;
let draftRows: DraftRow[] = [];
let currentRoot: HTMLElement | null = null;

export function renderUsagePage(root: HTMLElement) {
  currentRoot = root;
  const { clients } = store.getState();
  const sortedClients = [...clients].sort((a, b) => a.kana.localeCompare(b.kana, 'ja'));

  if (!selectedClientId && sortedClients.length > 0) {
    selectedClientId = sortedClients[0].id;
  }

  root.innerHTML = `
    <div class="toolbar">
      <div class="page-subtitle" style="margin-bottom:0">
        介護保険品目は単位数を入れると利用者負担割合から自己負担額を自動計算します。
        保存すると請求に反映されます。都度現金払いの利用者は、ここから対象月分の請求書を発行できます。
      </div>
      <button class="btn btn-sm" id="btn-open-import">📥 Excelから一括取り込み</button>
    </div>
    <div style="margin-bottom:16px">
      <button class="btn btn-sm ${mode === 'input' ? 'btn-primary' : ''}" id="tab-input">📝 入力</button>
      <button class="btn btn-sm ${mode === 'list' ? 'btn-primary' : ''}" id="tab-list">📋 一覧</button>
    </div>
    <div id="usage-section"></div>
  `;

  root.querySelector('#btn-open-import')?.addEventListener('click', () => openImportModal());
  root.querySelector('#tab-input')?.addEventListener('click', () => {
    mode = 'input';
    renderUsagePage(root);
  });
  root.querySelector('#tab-list')?.addEventListener('click', () => {
    mode = 'list';
    renderUsagePage(root);
  });

  const section = root.querySelector('#usage-section') as HTMLElement;
  if (mode === 'list') {
    renderListSection(section, sortedClients);
  } else {
    renderInputSection(section, sortedClients);
  }
}

function editClient(clientId: string, month = selectedMonth) {
  selectedClientId = clientId;
  selectedMonth = month;
  mode = 'input';
  if (currentRoot) renderUsagePage(currentRoot);
}

function goToClientMaster(clientId: string) {
  focusClientOnNextRender(clientId);
  navigate('clients');
}

// ==================== 一覧タブ ====================

function renderListSection(section: HTMLElement, clients: ReturnType<typeof store.getState>['clients']) {
  const usageEntries = store.getState().usageEntries;

  section.innerHTML = `
    <div class="card">
      <div class="form-grid" style="margin-bottom:16px;grid-template-columns:repeat(auto-fit,minmax(200px,1fr))">
        <div class="form-field">
          <label for="f-list-month">${listMonthCount === 4 ? '開始月（この月から4か月）' : '対象月'}</label>
          <input type="month" id="f-list-month" value="${selectedMonth}" />
        </div>
        <div class="form-field">
          <label for="f-list-period">表示期間</label>
          <select id="f-list-period">
            <option value="1" ${listMonthCount === 1 ? 'selected' : ''}>1か月</option>
            <option value="4" ${listMonthCount === 4 ? 'selected' : ''}>4か月まとめて</option>
          </select>
        </div>
      </div>
      <div style="margin-bottom:12px">
        <button class="btn btn-sm" id="btn-export-sedina">セディナ管理表へ4か月分を転記</button>
        <button class="btn btn-sm" id="btn-export-usage">表示中の${listMonthCount === 4 ? '4か月' : '1か月'}分をExcel出力</button>
      </div>
      <p id="list-summary" style="font-size:13px;margin:0 0 10px"></p>
      <div class="table-scroll">
        <table class="data-table">
          <thead>
            <tr>
              <th rowspan="2" style="vertical-align:bottom">利用者名</th>
              <th rowspan="2" style="vertical-align:bottom">状態</th>
              <th rowspan="2" style="vertical-align:bottom">入力状況</th>
              <th colspan="2" style="text-align:center">介護保険品目</th>
              <th colspan="2" style="text-align:center">自費品目</th>
              <th colspan="2" style="text-align:center">税区分</th>
              ${listMonthCount === 4 ? Array.from({ length: 4 }, (_, i) => `<th rowspan="2" class="num" style="vertical-align:bottom">${formatYmJapanese(addMonths(selectedMonth, i))}</th>`).join('') : ''}
              <th rowspan="2" class="num" style="vertical-align:bottom">${listMonthCount === 4 ? '4か月合計' : '合計金額'}</th>
              <th rowspan="2"></th>
            </tr>
            <tr>
              <th class="num">品目数</th>
              <th class="num">自己負担額</th>
              <th class="num">品目数</th>
              <th class="num">金額</th>
              <th class="num">非課税</th>
              <th class="num">課税</th>
            </tr>
          </thead>
          <tbody id="list-rows"></tbody>
          <tfoot id="list-totals"></tfoot>
        </table>
      </div>
    </div>
  `;

  section.querySelector('#f-list-month')?.addEventListener('change', (e) => {
    const v = (e.target as HTMLInputElement).value;
    if (v) selectedMonth = v;
    renderListSection(section, clients);
  });
  section.querySelector('#f-list-period')?.addEventListener('change', (e) => {
    listMonthCount = (e.target as HTMLSelectElement).value === '4' ? 4 : 1;
    renderListSection(section, clients);
  });

  section.querySelector('#btn-export-sedina')?.addEventListener('click', () => openSedinaExport(selectedMonth));
  section.querySelector('#btn-export-usage')?.addEventListener('click', async () => {
    const button = section.querySelector('#btn-export-usage') as HTMLButtonElement;
    button.disabled = true;
    try {
      const state = store.getState();
      const sortedClients = [...state.clients].sort((a, b) => a.kana.localeCompare(b.kana, 'ja'));
      const months = Array.from({ length: listMonthCount }, (_, i) => addMonths(selectedMonth, i));
      const tables = buildUsageExportTables(sortedClients, state.usageEntries, state.items, months);
      const XLSX = await import('xlsx');
      const workbook = XLSX.utils.book_new();
      for (const { name, rows, moneyColumns } of tables) {
        const sheet = XLSX.utils.aoa_to_sheet(rows);
        sheet['!cols'] = rows[0].map((_, index) => ({ wch: index === 0 ? 22 : 18 }));
        sheet['!autofilter'] = { ref: XLSX.utils.encode_range({ r: 0, c: 0 }, { r: rows.length - 2, c: rows[0].length - 1 }) };
        for (let row = 1; row < rows.length; row++) {
          for (const column of moneyColumns) {
            const cell = sheet[XLSX.utils.encode_cell({ r: row, c: column })];
            if (cell?.t === 'n') cell.z = '#,##0"円";[Red]-#,##0"円";0"円"';
          }
        }
        XLSX.utils.book_append_sheet(workbook, sheet, name);
      }
      const period = months.length === 1 ? months[0] : `${months[0]}_${months[months.length - 1]}`;
      XLSX.writeFile(workbook, `レンタル利用明細_${period}.xlsx`);
    } catch (error) {
      console.error('利用明細のExcel出力に失敗しました', error);
      await showAlert('Excel出力に失敗しました。もう一度お試しください。');
    } finally {
      button.disabled = false;
    }
  });

  renderListRows(clients, usageEntries);
}

function renderListRows(
  clients: ReturnType<typeof store.getState>['clients'],
  usageEntries: ReturnType<typeof store.getState>['usageEntries']
) {
  const tbody = document.querySelector('#list-rows');
  if (!tbody) return;

  const months = Array.from({ length: listMonthCount }, (_, i) => addMonths(selectedMonth, i));
  const periodLabel = listMonthCount === 4
    ? `${formatYmJapanese(months[0])}〜${formatYmJapanese(months[3])}`
    : formatYmJapanese(selectedMonth);
  if (clients.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="${listMonthCount === 4 ? 15 : 11}">利用者が登録されていません。</td></tr>`;
    const totals = document.querySelector('#list-totals');
    if (totals) totals.innerHTML = '';
    const summary = document.querySelector('#list-summary');
    if (summary) summary.textContent = `${periodLabel}: 利用者が登録されていません。`;
    return;
  }

  const items = store.getState().items;
  const billingTypeOf = (itemId: string) => items.find((i) => i.id === itemId)?.billingType ?? 'insurance';

  let grandTotal = 0;
  let insuranceGrandTotal = 0;
  let privateGrandTotal = 0;
  let nonTaxableGrandTotal = 0;
  let taxableGrandTotal = 0;
  let enteredCount = 0;
  let insuranceItemCount = 0;
  let privateItemCount = 0;
  const monthlyTotals = months.map(() => ({ insurance: 0, private: 0 }));

  const rows = clients.map((c) => {
    const entries = usageEntries.filter((u) => u.clientId === c.id && months.includes(u.yearMonth));
    const insuranceEntries = entries.filter((e) => billingTypeOf(e.itemId) === 'insurance');
    const privateEntries = entries.filter((e) => billingTypeOf(e.itemId) === 'private');
    const insuranceTotal = insuranceEntries.reduce((sum, e) => sum + e.amount, 0);
    const privateTotal = privateEntries.reduce((sum, e) => sum + e.amount, 0);
    const nonTaxableTotal = entries
      .filter((e) => e.taxCategory === 'nontaxable')
      .reduce((sum, e) => sum + e.amount, 0);
    const taxableTotal = entries.filter((e) => e.taxCategory === 'taxable').reduce((sum, e) => sum + e.amount, 0);
    const total = insuranceTotal + privateTotal;
    insuranceItemCount += insuranceEntries.length;
    privateItemCount += privateEntries.length;
    months.forEach((month, index) => {
      for (const entry of entries.filter((entry) => entry.yearMonth === month)) {
        monthlyTotals[index][billingTypeOf(entry.itemId)] += entry.amount;
      }
    });
    grandTotal += total;
    insuranceGrandTotal += insuranceTotal;
    privateGrandTotal += privateTotal;
    nonTaxableGrandTotal += nonTaxableTotal;
    taxableGrandTotal += taxableTotal;
    const enteredMonths = months.filter((month) => entries.some((entry) => entry.yearMonth === month)).length;
    if (enteredMonths === listMonthCount) enteredCount++;
    const statusLabel = listMonthCount === 4 && enteredMonths > 0 && enteredMonths < 4
      ? `<span class="badge badge-warning">${enteredMonths}/4か月入力</span>`
      : entries.length > 0 ? '<span class="badge badge-success">入力済み</span>' : '<span class="badge badge-warning">未入力</span>';
    return `
      <tr>
        <td>${escapeHtml(c.name)}<div style="color:#94a3b8;font-size:12px">${escapeHtml(c.kana)}</div></td>
        <td>${clientStatusBadge(c.status)}</td>
        <td>${statusLabel}</td>
        <td class="num">${insuranceEntries.length}</td>
        <td class="num">${formatYen(insuranceTotal)}</td>
        <td class="num">${privateEntries.length}</td>
        <td class="num">${formatYen(privateTotal)}</td>
        <td class="num">${formatYen(nonTaxableTotal)}</td>
        <td class="num">${formatYen(taxableTotal)}</td>
        ${listMonthCount === 4 ? months.map((month) => {
          const monthEntries = entries.filter((entry) => entry.yearMonth === month);
          const insurance = monthEntries.filter((entry) => billingTypeOf(entry.itemId) === 'insurance').reduce((sum, entry) => sum + entry.amount, 0);
          const privateAmount = monthEntries.filter((entry) => billingTypeOf(entry.itemId) === 'private').reduce((sum, entry) => sum + entry.amount, 0);
          return `<td class="num">${renderSplitTotal(insurance, privateAmount)}<div style="font-size:12px">${monthEntries.length ? '入力済み' : '未入力'}</div><button class="btn-link js-edit-client" data-id="${c.id}" data-month="${month}">入力へ</button></td>`;
        }).join('') : ''}
        <td class="num">${renderSplitTotal(insuranceTotal, privateTotal)}</td>
        <td class="actions-cell">
          ${listMonthCount === 1 ? `<button class="btn-link js-edit-client" data-id="${c.id}">入力へ</button>` : ''}
          <button class="btn-link js-view-client" data-id="${c.id}">利用者マスタへ</button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = rows.join('');
  const totals = document.querySelector('#list-totals');
  if (totals) {
    totals.innerHTML = `<tr style="font-weight:700;background:#eef2ff;border-top:2px solid #94a3b8">
      <th colspan="3" scope="row">全員の合計（${clients.length}名）</th>
      <td class="num">${insuranceItemCount}</td>
      <td class="num">${formatYen(insuranceGrandTotal)}</td>
      <td class="num">${privateItemCount}</td>
      <td class="num">${formatYen(privateGrandTotal)}</td>
      <td class="num">${formatYen(nonTaxableGrandTotal)}</td>
      <td class="num">${formatYen(taxableGrandTotal)}</td>
      ${listMonthCount === 4 ? monthlyTotals.map((amount) => `<td class="num">${renderSplitTotal(amount.insurance, amount.private)}</td>`).join('') : ''}
      <td class="num">${renderSplitTotal(insuranceGrandTotal, privateGrandTotal)}</td>
      <td></td>
    </tr>`;
  }

  const summary = document.querySelector('#list-summary');
  if (summary) {
    summary.innerHTML = `${periodLabel}: <strong>${enteredCount} / ${clients.length}名</strong> ${listMonthCount === 4 ? '4か月すべて入力済み' : '入力済み'}、
      合計 <strong>${formatYen(grandTotal)}</strong>
      (介護保険品目 ${formatYen(insuranceGrandTotal)} ／ 自費品目 ${formatYen(privateGrandTotal)} ／
      非課税 ${formatYen(nonTaxableGrandTotal)} ／ 課税 ${formatYen(taxableGrandTotal)})`;
  }

  tbody.querySelectorAll('.js-edit-client').forEach((el) =>
    el.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).dataset.id;
      if (id) editClient(id, (e.currentTarget as HTMLElement).dataset.month ?? selectedMonth);
    })
  );

  tbody.querySelectorAll('.js-view-client').forEach((el) =>
    el.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).dataset.id;
      if (id) goToClientMaster(id);
    })
  );
}


function renderSplitTotal(insurance: number, privateAmount: number): string {
  return `<div style="white-space:nowrap;font-size:12px">保険分 ${formatYen(insurance)}</div>
    <div style="white-space:nowrap;font-size:12px">自費分 ${formatYen(privateAmount)}</div>
    <div style="white-space:nowrap;font-weight:700">合計 ${formatYen(insurance + privateAmount)}</div>`;
}

/** 一覧と品目明細のExcel用データ。金額は一覧と同じ保存済みの自己負担額を使用する。 */
export function buildUsageExportTables(
  clients: ReturnType<typeof store.getState>['clients'],
  usageEntries: ReturnType<typeof store.getState>['usageEntries'],
  items: ReturnType<typeof store.getState>['items'],
  months: string[]
) {
  type Cell = string | number;
  const billingTypeOf = (id: string) => items.find((item) => item.id === id)?.billingType ?? 'insurance';
  const summaryHeader = ['利用者名', 'フリガナ', '状態', ...months.flatMap((month) => [
    `${month} 保険分（自己負担額）`, `${month} 自費分`, `${month} 合計`, `${month} 入力状況`,
  ]), '期間合計 保険分（自己負担額）', '期間合計 自費分', '期間合計 合算', '非課税合計', '課税合計'];
  const summaryRows: Cell[][] = [summaryHeader];
  const detailRows: Cell[][] = [['利用者名', 'フリガナ', '状態', '対象月', '入力状況', '区分', '品目', '数量／単位数', '単価（円）', '金額（円）', '税区分', '備考']];
  const summaryMoneyColumns = [
    ...months.flatMap((_, index) => [3 + index * 4, 4 + index * 4, 5 + index * 4]),
    ...Array.from({ length: 5 }, (_, index) => 3 + months.length * 4 + index),
  ];
  const summaryTotals = summaryHeader.map(() => 0);
  let detailTotal = 0;
  for (const client of clients) {
    const entries = usageEntries.filter((entry) => entry.clientId === client.id && months.includes(entry.yearMonth));
    const sum = (rows: UsageEntry[]) => rows.reduce((total, entry) => total + entry.amount, 0);
    const insurance = sum(entries.filter((entry) => billingTypeOf(entry.itemId) === 'insurance'));
    const privateAmount = sum(entries.filter((entry) => billingTypeOf(entry.itemId) === 'private'));
    const row: Cell[] = [client.name, client.kana, CLIENT_STATUS_LABELS[client.status]];
    for (const month of months) {
      const monthly = entries.filter((entry) => entry.yearMonth === month);
      row.push(sum(monthly.filter((entry) => billingTypeOf(entry.itemId) === 'insurance')),
        sum(monthly.filter((entry) => billingTypeOf(entry.itemId) === 'private')),
        sum(monthly), monthly.length ? '入力済み' : '未入力');
      if (!monthly.length) {
        detailRows.push([client.name, client.kana, CLIENT_STATUS_LABELS[client.status], month, '未入力', '', '', '', '', 0, '', '']);
      }
      for (const entry of monthly) {
        detailRows.push([client.name, client.kana, CLIENT_STATUS_LABELS[client.status], month, '入力済み',
          billingTypeOf(entry.itemId) === 'insurance' ? '保険分（自己負担額）' : '自費分', entry.itemName,
          entry.quantity, entry.unitPrice, entry.amount, TAX_CATEGORY_LABELS[entry.taxCategory], entry.note]);
        detailTotal += entry.amount;
      }
    }
    row.push(insurance, privateAmount, insurance + privateAmount,
      sum(entries.filter((entry) => entry.taxCategory === 'nontaxable')),
      sum(entries.filter((entry) => entry.taxCategory === 'taxable')));
    summaryMoneyColumns.forEach((column) => { summaryTotals[column] += Number(row[column]); });
    summaryRows.push(row);
  }
  const totalRow: Cell[] = summaryHeader.map(() => '');
  totalRow[0] = `全員の合計（${clients.length}名）`;
  summaryMoneyColumns.forEach((column) => { totalRow[column] = summaryTotals[column]; });
  summaryRows.push(totalRow);
  detailRows.push(['全員の合計', '', '', '', '', '', '', '', '', detailTotal, '', '']);
  return [
    { name: '利用者別一覧', rows: summaryRows, moneyColumns: summaryMoneyColumns },
    { name: '品目明細', rows: detailRows, moneyColumns: [8, 9] },
  ];
}

// ==================== 入力タブ ====================

function renderInputSection(section: HTMLElement, sortedClients: ReturnType<typeof store.getState>['clients']) {
  const items = store.getState().items;

  section.innerHTML = `
    <div class="card">
      ${
        sortedClients.length === 0
          ? `<p>先に「利用者マスタ」から利用者を登録するか、「Excelから一括取り込み」をお使いください。</p>`
          : `
        <div class="form-grid" style="margin-bottom:16px">
          <div class="form-field">
            <label>利用者</label>
            <div style="display:flex;align-items:center;gap:8px">
              <select id="f-client" style="flex:1">
                ${sortedClients
                  .map(
                    (c) =>
                      `<option value="${c.id}" ${c.id === selectedClientId ? 'selected' : ''}>${escapeHtml(c.name)}${c.status === 'active' ? '' : `(${CLIENT_STATUS_LABELS[c.status]})`}</option>`
                  )
                  .join('')}
              </select>
              <button class="btn-link" id="btn-view-client" type="button">利用者マスタへ</button>
            </div>
          </div>
          <div class="form-field">
            <label>対象月</label>
            <input type="month" id="f-month" value="${selectedMonth}" />
          </div>
        </div>
        <div class="toolbar">
          <div></div>
          <div class="toolbar-controls">
            <button class="btn btn-sm" id="btn-copy-prev">前月の内容をコピー</button>
            <button class="btn btn-sm" id="btn-add-row">＋ 品目を追加</button>
          </div>
        </div>
        <table class="data-table usage-table">
          <thead>
            <tr>
              <th style="width:26%">品目</th>
              <th style="width:10%">区分</th>
              <th class="num" style="width:12%">数量/単位数</th>
              <th class="num" style="width:13%">単価(円)</th>
              <th style="width:12%">税区分</th>
              <th class="num" style="width:13%">金額</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="usage-rows"></tbody>
          <tfoot>
            <tr class="usage-total-row">
              <td colspan="5">合計(非課税 <span id="usage-total-nontax">${formatYen(0)}</span> ／ 課税 <span id="usage-total-tax">${formatYen(0)}</span>)</td>
              <td class="num" id="usage-total">${formatYen(0)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>
        <div class="form-actions">
          <button class="btn" id="btn-cash-invoice" style="display:none">この月の現金払い請求書を発行</button>
          <button class="btn btn-primary" id="btn-save">この月の内容を保存</button>
        </div>
      `
      }
    </div>
  `;

  if (sortedClients.length === 0) return;

  loadDraftFromStore();
  renderRows(items);

  const cashInvoiceButton = section.querySelector<HTMLButtonElement>('#btn-cash-invoice')!;
  function updateCashInvoiceButton() {
    cashInvoiceButton.style.display = sortedClients.find((client) => client.id === selectedClientId)?.paymentMethod === 'cash' ? '' : 'none';
    cashInvoiceButton.disabled = issuingCashInvoice || savingMonthlyUsage;
  }
  updateCashInvoiceButton();

  cashInvoiceButton.addEventListener('click', async () => {
    if (issuingCashInvoice || savingMonthlyUsage) return;
    const clientId = selectedClientId;
    const yearMonth = section.querySelector<HTMLInputElement>('#f-month')!.value;
    if (!isValidYearMonth(yearMonth)) {
      await showAlert('対象月を選択してください。');
      return;
    }
    const existingForMonth = () => store.fetchBillableInvoicesForMonth(clientId, yearMonth);
    async function showExistingInvoices(existing: Invoice[]) {
      const lines = existing.map((invoice) => {
        const start = formatYmJapanese(invoice.cycleStartMonth);
        const end = formatYmJapanese(invoice.cycleEndMonth);
        const period = start === end ? start : `${start}〜${end}`;
        const category = start === end && invoice.billingCategory === 'combined'
          ? '都度現金' : INVOICE_BILLING_CATEGORY_LABELS[invoice.billingCategory];
        return `${invoice.invoiceNo || '番号未設定'} ／ ${period}分 ／ ${category} ／ ${formatYen(invoice.totalAmount)}${invoice.paidDate ? '（入金済み）' : ''}`;
      });
      const message = `この月を含む請求書が残っています。二重請求を防ぐため、新しい請求書は発行しません。\n\n${lines.join('\n')}`;
      if (existing.length === 1) {
        if (await showConfirm(`${message}\n\n該当の請求書を開きますか？`, '発行済みの請求書')) navigate(`invoices/${existing[0].id}`);
      } else if (await showConfirm(`${message}\n\n請求書一覧を開きますか？`, '発行済みの請求書')) navigate('invoices');
    }
    const monthlyDetails = () => {
      const { usageEntries, lateAdjustments, items } = store.getState();
      return buildInvoiceMonths({
        clientId, cycleStartMonth: yearMonth, cycleEndMonth: yearMonth, months: [yearMonth],
        isDue: true, insuranceInvoice: null, privateInvoice: null, combinedInvoice: null,
      }, usageEntries, lateAdjustments, items, 'combined');
    };
    const client = store.getState().clients.find((entry) => entry.id === clientId);
    if (client?.paymentMethod !== 'cash') return;
    issuingCashInvoice = true;
    updateCashInvoiceButton();
    try {
      const existing = await existingForMonth();
      if (existing.length) {
        await showExistingInvoices(existing);
        return;
      }
      const details = monthlyDetails();
      if (details.totalAmount === 0) {
        await showAlert('この月の保存済み請求額は0円です。利用内容を入力し、保存してから発行してください。');
        return;
      }
      if (!await showConfirm(`${client.name}さんの${formatYmJapanese(yearMonth)}分を、保存済みの金額 ${formatYen(details.totalAmount)} で発行しますか？`)) return;
      const remaining = await existingForMonth();
      if (remaining.length) {
        await showExistingInvoices(remaining);
        return;
      }
      if (savingMonthlyUsage ||
          store.getState().clients.find((entry) => entry.id === clientId)?.paymentMethod !== 'cash' ||
          JSON.stringify(monthlyDetails()) !== JSON.stringify(details)) {
        await showAlert('請求内容が変わりました。対象月の内容を確認して、もう一度操作してください。');
        return;
      }
      const invoice: Invoice = {
        ...details, id: newId(), invoiceNo: store.nextInvoiceNo(), clientId,
        cycleStartMonth: yearMonth, cycleEndMonth: yearMonth,
        billingCategory: 'combined', billingTiming: 'early', status: 'issued',
        issuedDate: todayIso(), paidDate: null, createdAt: new Date().toISOString(),
      };
      if (await store.saveInvoice(invoice)) navigate(`invoices/${invoice.id}`);
      else {
        store.refreshNow();
        await showAlert('請求書を保存できませんでした。再読み込みして請求書一覧を確認してください。');
      }
    } catch (error) {
      console.error('現金払い請求書の確認・発行に失敗しました', error);
      await showAlert('請求書を確認できませんでした。通信状態を確認し、もう一度お試しください。');
    } finally {
      issuingCashInvoice = false;
      const currentButton = currentRoot?.querySelector<HTMLButtonElement>('#btn-cash-invoice');
      if (currentButton) currentButton.disabled = savingMonthlyUsage;
    }
  });

  section.querySelector('#f-client')?.addEventListener('change', (e) => {
    selectedClientId = (e.target as HTMLSelectElement).value;
    updateCashInvoiceButton();
    loadDraftFromStore();
    renderRows(items);
  });

  section.querySelector('#btn-view-client')?.addEventListener('click', () => {
    if (selectedClientId) goToClientMaster(selectedClientId);
  });

  section.querySelector('#f-month')?.addEventListener('change', (e) => {
    const v = (e.target as HTMLInputElement).value;
    if (v) selectedMonth = v;
    loadDraftFromStore();
    renderRows(items);
  });

  section.querySelector('#btn-add-row')?.addEventListener('click', () => {
    const firstItem = items[0];
    draftRows.push({
      itemId: firstItem?.id ?? '',
      itemName: firstItem?.name ?? '',
      quantity: 1,
      unitPrice: firstItem ? defaultUnitPriceFor(firstItem) : 0,
      taxCategory: 'nontaxable',
    });
    renderRows(items);
  });

  section.querySelector('#btn-copy-prev')?.addEventListener('click', async () => {
    const prevMonth = addMonths(selectedMonth, -1);
    const prevEntries = store
      .getState()
      .usageEntries.filter((u) => u.clientId === selectedClientId && u.yearMonth === prevMonth);
    if (prevEntries.length === 0) {
      await showAlert(`${formatYmJapanese(prevMonth)}の入力データが見つかりません。`);
      return;
    }
    if (draftRows.length > 0 && !(await showConfirm('現在入力中の内容を前月の内容で置き換えます。よろしいですか?'))) {
      return;
    }
    draftRows = prevEntries.map((e) => ({
      itemId: e.itemId,
      itemName: e.itemName,
      quantity: e.quantity,
      unitPrice: e.unitPrice,
      taxCategory: e.taxCategory,
      note: e.note,
    }));
    renderRows(items);
  });

  section.querySelector('#btn-save')?.addEventListener('click', async () => {
    if (!selectedClientId || !selectedMonth || savingMonthlyUsage || issuingCashInvoice) return;
    const entries: UsageEntry[] = draftRows
      .filter((r) => r.itemId)
      .map((r) => ({
        id: newId(),
        clientId: selectedClientId,
        yearMonth: selectedMonth,
        itemId: r.itemId,
        itemName: r.itemName,
        quantity: r.quantity,
        unitPrice: r.unitPrice,
        amount: r.quantity * r.unitPrice,
        taxCategory: r.taxCategory,
        note: r.note ?? '',
        enteredAt: new Date().toISOString(),
      }));
    savingMonthlyUsage = true;
    updateCashInvoiceButton();
    try {
      if (!await store.setUsageEntriesForMonth(selectedClientId, selectedMonth, entries)) {
        store.refreshNow();
        await showAlert('利用内容を保存できませんでした。再読み込みして確認してください。');
      }
    } finally {
      savingMonthlyUsage = false;
      const currentButton = currentRoot?.querySelector<HTMLButtonElement>('#btn-cash-invoice');
      if (currentButton) currentButton.disabled = issuingCashInvoice;
    }
  });
}

function defaultUnitPriceFor(item: ReturnType<typeof store.getState>['items'][number]): number {
  if (item.billingType === 'private') return item.unitPrice;
  const client = store.getState().clients.find((c) => c.id === selectedClientId);
  return client ? copayYenPerUnit(client.copayRatio) : 0;
}

function loadDraftFromStore() {
  const existing = store
    .getState()
    .usageEntries.filter((u) => u.clientId === selectedClientId && u.yearMonth === selectedMonth);
  draftRows = existing.map((e) => ({
    itemId: e.itemId,
    itemName: e.itemName,
    quantity: e.quantity,
    unitPrice: e.unitPrice,
    taxCategory: e.taxCategory,
    note: e.note,
  }));
}

function renderRows(items: ReturnType<typeof store.getState>['items']) {
  const tbody = document.querySelector('#usage-rows');
  if (!tbody) return;

  if (draftRows.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="7">品目が入力されていません。「品目を追加」から入力してください。</td></tr>`;
  } else {
    tbody.innerHTML = draftRows
      .map((row, idx) => {
        const item = items.find((i) => i.id === row.itemId);
        const badge =
          item?.billingType === 'private'
            ? '<span class="badge badge-success">自費</span>'
            : '<span class="badge badge-muted">保険</span>';
        return `
      <tr data-index="${idx}">
        <td>
          <select class="js-item" data-index="${idx}">
            ${items
              .map(
                (i) =>
                  `<option value="${i.id}" ${i.id === row.itemId ? 'selected' : ''}>${escapeHtml(i.name)}</option>`
              )
              .join('')}
          </select>
        </td>
        <td>${badge}</td>
        <td class="num">
          <input type="number" class="js-qty" data-index="${idx}" min="0" step="0.5" value="${row.quantity}" />
        </td>
        <td class="num">
          <input type="number" class="js-price" data-index="${idx}" min="0" step="1" value="${row.unitPrice}" />
        </td>
        <td>
          <select class="js-tax" data-index="${idx}">
            <option value="nontaxable" ${row.taxCategory === 'nontaxable' ? 'selected' : ''}>${TAX_CATEGORY_LABELS.nontaxable}</option>
            <option value="taxable" ${row.taxCategory === 'taxable' ? 'selected' : ''}>${TAX_CATEGORY_LABELS.taxable}</option>
          </select>
        </td>
        <td class="num js-amount" data-index="${idx}">${formatYen(row.quantity * row.unitPrice)}</td>
        <td class="actions-cell">
          <button class="btn-link js-remove" data-index="${idx}" style="color:#dc2626">削除</button>
        </td>
      </tr>
    `;
      })
      .join('');
  }

  updateTotal();

  tbody.querySelectorAll('.js-item').forEach((el) =>
    el.addEventListener('change', (e) => {
      const idx = Number((e.target as HTMLSelectElement).dataset.index);
      const itemId = (e.target as HTMLSelectElement).value;
      const item = items.find((i) => i.id === itemId);
      if (!item) return;
      draftRows[idx] = {
        ...draftRows[idx],
        itemId: item.id,
        itemName: item.name,
        unitPrice: defaultUnitPriceFor(item),
      };
      renderRows(items);
    })
  );

  tbody.querySelectorAll('.js-qty').forEach((el) =>
    el.addEventListener('input', (e) => {
      const idx = Number((e.target as HTMLInputElement).dataset.index);
      const value = Number((e.target as HTMLInputElement).value) || 0;
      draftRows[idx].quantity = value;
      updateRowAmount(idx);
    })
  );

  tbody.querySelectorAll('.js-price').forEach((el) =>
    el.addEventListener('input', (e) => {
      const idx = Number((e.target as HTMLInputElement).dataset.index);
      const value = Number((e.target as HTMLInputElement).value) || 0;
      draftRows[idx].unitPrice = value;
      updateRowAmount(idx);
    })
  );

  tbody.querySelectorAll('.js-tax').forEach((el) =>
    el.addEventListener('change', (e) => {
      const idx = Number((e.target as HTMLSelectElement).dataset.index);
      draftRows[idx].taxCategory = (e.target as HTMLSelectElement).value as TaxCategory;
      updateTotal();
    })
  );

  tbody.querySelectorAll('.js-remove').forEach((el) =>
    el.addEventListener('click', (e) => {
      const idx = Number((e.target as HTMLElement).dataset.index);
      draftRows.splice(idx, 1);
      renderRows(items);
    })
  );
}

function updateRowAmount(idx: number) {
  const row = draftRows[idx];
  const cell = document.querySelector(`.js-amount[data-index="${idx}"]`);
  if (cell) cell.textContent = formatYen(row.quantity * row.unitPrice);
  updateTotal();
}

function updateTotal() {
  const totalEl = document.querySelector('#usage-total');
  const nonTaxEl = document.querySelector('#usage-total-nontax');
  const taxEl = document.querySelector('#usage-total-tax');
  if (!totalEl) return;
  const total = draftRows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
  const nonTaxable = draftRows
    .filter((r) => r.taxCategory === 'nontaxable')
    .reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
  const taxable = draftRows
    .filter((r) => r.taxCategory === 'taxable')
    .reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
  totalEl.textContent = formatYen(total);
  if (nonTaxEl) nonTaxEl.textContent = formatYen(nonTaxable);
  if (taxEl) taxEl.textContent = formatYen(taxable);
}

import { store, newId } from '@/store';
import type { TaxCategory, UsageEntry } from '@/types';
import { CLIENT_STATUS_LABELS, TAX_CATEGORY_LABELS, copayYenPerUnit } from '@/types';
import { escapeHtml, formatYen } from '@/utils/format';
import { addMonths, currentYearMonth, formatYmJapanese } from '@/utils/date';
import { openImportModal } from '@/ui/pages/importExcel';
import { showAlert, showConfirm } from '@/ui/components/dialog';
import { clientStatusBadge } from '@/ui/pages/clients';

interface DraftRow {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
  taxCategory: TaxCategory;
}

type Mode = 'input' | 'list';

let mode: Mode = 'input';
let selectedClientId = '';
let selectedMonth = currentYearMonth();
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
        保存すると4か月ごとの請求に自動反映されます。
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

function editClient(clientId: string) {
  selectedClientId = clientId;
  mode = 'input';
  if (currentRoot) renderUsagePage(currentRoot);
}

// ==================== 一覧タブ ====================

function renderListSection(section: HTMLElement, clients: ReturnType<typeof store.getState>['clients']) {
  const usageEntries = store.getState().usageEntries;

  section.innerHTML = `
    <div class="card">
      <div class="form-grid" style="margin-bottom:16px;grid-template-columns:200px">
        <div class="form-field">
          <label>対象月</label>
          <input type="month" id="f-list-month" value="${selectedMonth}" />
        </div>
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
              <th rowspan="2" class="num" style="vertical-align:bottom">合計金額</th>
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
        </table>
      </div>
    </div>
  `;

  section.querySelector('#f-list-month')?.addEventListener('change', (e) => {
    const v = (e.target as HTMLInputElement).value;
    if (v) selectedMonth = v;
    renderListRows(clients, usageEntries);
  });

  renderListRows(clients, usageEntries);
}

function renderListRows(
  clients: ReturnType<typeof store.getState>['clients'],
  usageEntries: ReturnType<typeof store.getState>['usageEntries']
) {
  const tbody = document.querySelector('#list-rows');
  if (!tbody) return;

  if (clients.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="11">利用者が登録されていません。</td></tr>`;
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

  const rows = clients.map((c) => {
    const entries = usageEntries.filter((u) => u.clientId === c.id && u.yearMonth === selectedMonth);
    const insuranceEntries = entries.filter((e) => billingTypeOf(e.itemId) === 'insurance');
    const privateEntries = entries.filter((e) => billingTypeOf(e.itemId) === 'private');
    const insuranceTotal = insuranceEntries.reduce((sum, e) => sum + e.amount, 0);
    const privateTotal = privateEntries.reduce((sum, e) => sum + e.amount, 0);
    const nonTaxableTotal = entries
      .filter((e) => e.taxCategory === 'nontaxable')
      .reduce((sum, e) => sum + e.amount, 0);
    const taxableTotal = entries.filter((e) => e.taxCategory === 'taxable').reduce((sum, e) => sum + e.amount, 0);
    const total = insuranceTotal + privateTotal;
    grandTotal += total;
    insuranceGrandTotal += insuranceTotal;
    privateGrandTotal += privateTotal;
    nonTaxableGrandTotal += nonTaxableTotal;
    taxableGrandTotal += taxableTotal;
    if (entries.length > 0) enteredCount++;
    return `
      <tr>
        <td>${escapeHtml(c.name)}<div style="color:#94a3b8;font-size:12px">${escapeHtml(c.kana)}</div></td>
        <td>${clientStatusBadge(c.status)}</td>
        <td>${entries.length > 0 ? '<span class="badge badge-success">入力済み</span>' : '<span class="badge badge-warning">未入力</span>'}</td>
        <td class="num">${insuranceEntries.length}</td>
        <td class="num">${formatYen(insuranceTotal)}</td>
        <td class="num">${privateEntries.length}</td>
        <td class="num">${formatYen(privateTotal)}</td>
        <td class="num">${formatYen(nonTaxableTotal)}</td>
        <td class="num">${formatYen(taxableTotal)}</td>
        <td class="num">${formatYen(total)}</td>
        <td class="actions-cell"><button class="btn-link js-edit-client" data-id="${c.id}">入力へ</button></td>
      </tr>
    `;
  });

  tbody.innerHTML = rows.join('');

  const summary = document.querySelector('#list-summary');
  if (summary) {
    summary.innerHTML = `${formatYmJapanese(selectedMonth)}: <strong>${enteredCount} / ${clients.length}名</strong> 入力済み、
      合計 <strong>${formatYen(grandTotal)}</strong>
      (介護保険品目 ${formatYen(insuranceGrandTotal)} ／ 自費品目 ${formatYen(privateGrandTotal)} ／
      非課税 ${formatYen(nonTaxableGrandTotal)} ／ 課税 ${formatYen(taxableGrandTotal)})`;
  }

  tbody.querySelectorAll('.js-edit-client').forEach((el) =>
    el.addEventListener('click', (e) => {
      const id = (e.target as HTMLElement).dataset.id;
      if (id) editClient(id);
    })
  );
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
            <select id="f-client">
              ${sortedClients
                .map(
                  (c) =>
                    `<option value="${c.id}" ${c.id === selectedClientId ? 'selected' : ''}>${escapeHtml(c.name)}${c.status === 'active' ? '' : `(${CLIENT_STATUS_LABELS[c.status]})`}</option>`
                )
                .join('')}
            </select>
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
          <button class="btn btn-primary" id="btn-save">この月の内容を保存</button>
        </div>
      `
      }
    </div>
  `;

  if (sortedClients.length === 0) return;

  loadDraftFromStore();
  renderRows(items);

  section.querySelector('#f-client')?.addEventListener('change', (e) => {
    selectedClientId = (e.target as HTMLSelectElement).value;
    loadDraftFromStore();
    renderRows(items);
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
    }));
    renderRows(items);
  });

  section.querySelector('#btn-save')?.addEventListener('click', () => {
    if (!selectedClientId || !selectedMonth) return;
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
        note: '',
        enteredAt: new Date().toISOString(),
      }));
    store.setUsageEntriesForMonth(selectedClientId, selectedMonth, entries);
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

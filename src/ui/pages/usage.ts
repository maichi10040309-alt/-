import { store, newId } from '@/store';
import type { UsageEntry } from '@/types';
import { copayYenPerUnit } from '@/types';
import { escapeHtml, formatYen } from '@/utils/format';
import { addMonths, currentYearMonth, formatYmJapanese } from '@/utils/date';
import { openImportModal } from '@/ui/pages/importExcel';

interface DraftRow {
  itemId: string;
  itemName: string;
  quantity: number;
  unitPrice: number;
}

let selectedClientId = '';
let selectedMonth = currentYearMonth();
let draftRows: DraftRow[] = [];

export function renderUsagePage(root: HTMLElement) {
  const { clients, items } = store.getState();
  const sortedClients = [...clients].sort((a, b) => a.kana.localeCompare(b.kana, 'ja'));

  if (!selectedClientId && sortedClients.length > 0) {
    selectedClientId = sortedClients[0].id;
  }

  root.innerHTML = `
    <div class="toolbar">
      <div class="page-subtitle" style="margin-bottom:0">
        利用者・対象月を選び、レンタル中の品目を入力してください。介護保険品目は単位数を入れると
        利用者負担割合から自己負担額を自動計算します。保存すると4か月ごとの請求に自動反映されます。
      </div>
      <button class="btn btn-sm" id="btn-open-import">📥 Excelから一括取り込み</button>
    </div>
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
                    `<option value="${c.id}" ${c.id === selectedClientId ? 'selected' : ''}>${escapeHtml(c.name)}${c.active ? '' : '(終了)'}</option>`
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
              <th style="width:34%">品目</th>
              <th style="width:12%">区分</th>
              <th class="num" style="width:14%">数量/単位数</th>
              <th class="num" style="width:16%">単価(円)</th>
              <th class="num" style="width:16%">金額</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="usage-rows"></tbody>
          <tfoot>
            <tr class="usage-total-row">
              <td colspan="4">合計</td>
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

  root.querySelector('#btn-open-import')?.addEventListener('click', () => openImportModal());

  if (sortedClients.length === 0) return;

  loadDraftFromStore();
  renderRows(items);

  root.querySelector('#f-client')?.addEventListener('change', (e) => {
    selectedClientId = (e.target as HTMLSelectElement).value;
    loadDraftFromStore();
    renderRows(items);
  });

  root.querySelector('#f-month')?.addEventListener('change', (e) => {
    const v = (e.target as HTMLInputElement).value;
    if (v) selectedMonth = v;
    loadDraftFromStore();
    renderRows(items);
  });

  root.querySelector('#btn-add-row')?.addEventListener('click', () => {
    const firstItem = items[0];
    draftRows.push({
      itemId: firstItem?.id ?? '',
      itemName: firstItem?.name ?? '',
      quantity: 1,
      unitPrice: firstItem ? defaultUnitPriceFor(firstItem) : 0,
    });
    renderRows(items);
  });

  root.querySelector('#btn-copy-prev')?.addEventListener('click', () => {
    const prevMonth = addMonths(selectedMonth, -1);
    const prevEntries = store
      .getState()
      .usageEntries.filter((u) => u.clientId === selectedClientId && u.yearMonth === prevMonth);
    if (prevEntries.length === 0) {
      alert(`${formatYmJapanese(prevMonth)}の入力データが見つかりません。`);
      return;
    }
    if (draftRows.length > 0 && !confirm('現在入力中の内容を前月の内容で置き換えます。よろしいですか?')) {
      return;
    }
    draftRows = prevEntries.map((e) => ({
      itemId: e.itemId,
      itemName: e.itemName,
      quantity: e.quantity,
      unitPrice: e.unitPrice,
    }));
    renderRows(items);
  });

  root.querySelector('#btn-save')?.addEventListener('click', () => {
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
  }));
}

function renderRows(items: ReturnType<typeof store.getState>['items']) {
  const tbody = document.querySelector('#usage-rows');
  if (!tbody) return;

  if (draftRows.length === 0) {
    tbody.innerHTML = `<tr class="empty-row"><td colspan="6">品目が入力されていません。「品目を追加」から入力してください。</td></tr>`;
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
  if (!totalEl) return;
  const total = draftRows.reduce((sum, r) => sum + r.quantity * r.unitPrice, 0);
  totalEl.textContent = formatYen(total);
}

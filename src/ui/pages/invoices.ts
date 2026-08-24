import { store, newId } from '@/store';
import type { BillingType, Client, CopayRatio, Invoice, LateAdjustment, TaxCategory } from '@/types';
import { INVOICE_BILLING_CATEGORY_LABELS, TAX_CATEGORY_LABELS } from '@/types';
import { escapeHtml, formatYen } from '@/utils/format';
import {
  addMonths,
  currentYearMonth,
  formatDateJapanese,
  formatYmJapanese,
  isValidYearMonth,
  parseYearMonth,
  todayIso,
} from '@/utils/date';
import { buildInvoiceMonths, cycleStartForMonth, getClientCycles, type BillingCycle } from '@/utils/billing';
import { navigate } from '@/ui/router';
import { showAlert, showConfirm } from '@/ui/components/dialog';
import { openModal } from '@/ui/components/modal';

const COMPACT_COPAY_LABELS: Record<CopayRatio, string> = {
  '1': '1割',
  '2': '2割',
  '3': '3割',
  seiho: '生保',
};

const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  insurance: '保険',
  private: '自費',
};

let referenceMonth = currentYearMonth();

/** そのサイクルの指定区分(保険/自費)に、請求すべき実績(利用実績 or 月遅れ調整)があるかどうか */
function cycleCategoryHasData(cycle: BillingCycle, category: BillingType): boolean {
  const { usageEntries, lateAdjustments, items } = store.getState();
  const preview = buildInvoiceMonths(cycle, usageEntries, lateAdjustments, items, category);
  return preview.months.some((m) => m.lines.length > 0) || preview.adjustments.length > 0;
}

function categoryInvoiceOf(cycle: BillingCycle, category: BillingType): Invoice | null {
  return category === 'insurance' ? cycle.insuranceInvoice : cycle.privateInvoice;
}

/** 「請求対象(未請求)」に表示されていない利用者について、その理由を説明する文言を返す */
function clientDueStatusLabel(
  client: Client,
  usageEntries: ReturnType<typeof store.getState>['usageEntries'],
  invoices: Invoice[],
  referenceMonth: string
): string {
  if (client.paymentMethod === 'cash') {
    return '都度現金払いのため自動請求対象外です。「早期請求」から請求書を作成してください。';
  }
  const cycles = getClientCycles(client, usageEntries, invoices, referenceMonth);
  if (cycles.length === 0) {
    return '利用実績がまだ入力されていません。';
  }
  const latest = cycles[cycles.length - 1];
  const periodLabel = `${formatYmJapanese(latest.cycleStartMonth)} 〜 ${formatYmJapanese(latest.cycleEndMonth)}分`;
  if (!latest.isDue) {
    return `${periodLabel}は進行中のサイクルです。${formatYmJapanese(addMonths(latest.cycleEndMonth, 1))}になると自動的に請求対象になります(急ぐ場合は「早期請求」から作成できます)。`;
  }
  if (latest.combinedInvoice) {
    return `${periodLabel}は請求済みです(旧形式の請求書)。`;
  }
  const stillPending = (['insurance', 'private'] as const).some(
    (category) => !categoryInvoiceOf(latest, category) && cycleCategoryHasData(latest, category)
  );
  if (stillPending) {
    return '上の「請求対象(未請求)」一覧に表示されています。';
  }
  return `${periodLabel}は請求済みです。`;
}

type DueRow = {
  clientId: string;
  clientName: string;
  cycleStartMonth: string;
  cycleEndMonth: string;
  category: BillingType;
};

export function renderInvoicesPage(root: HTMLElement) {
  const { clients, usageEntries, invoices, lateAdjustments, items } = store.getState();

  const allDueRows: DueRow[] = [];
  // 利用者ごとの「一番新しいサイクル」の締め月(まだ請求対象になっていなくても)。
  // これと一致する未請求行だけを「今回分」とし、それより前のサイクルは締め済みでも
  // 「過去の未請求分」に回す(旧Excel運用からの移行期など、導入前から続く利用者で
  // 古い未請求サイクルが積み残っている場合に、直近の請求対象と混在させないため)。
  const latestCycleEndByClient = new Map<string, string>();

  for (const client of clients) {
    if (client.paymentMethod === 'cash') continue; // 都度現金の方は自動請求対象に含めない
    const cycles = getClientCycles(client, usageEntries, invoices, referenceMonth);
    if (cycles.length > 0) {
      latestCycleEndByClient.set(client.id, cycles[cycles.length - 1].cycleEndMonth);
    }
    for (const cycle of cycles) {
      if (!cycle.isDue || cycle.combinedInvoice) continue;
      for (const category of ['insurance', 'private'] as const) {
        if (categoryInvoiceOf(cycle, category)) continue;
        if (!cycleCategoryHasData(cycle, category)) continue;
        allDueRows.push({
          clientId: client.id,
          clientName: client.name,
          cycleStartMonth: cycle.cycleStartMonth,
          cycleEndMonth: cycle.cycleEndMonth,
          category,
        });
      }
    }
  }

  const isCurrent = (r: DueRow) => latestCycleEndByClient.get(r.clientId) === r.cycleEndMonth;
  const dueRows = allDueRows.filter(isCurrent).sort((a, b) => a.cycleEndMonth.localeCompare(b.cycleEndMonth));
  const pastDueRows = allDueRows.filter((r) => !isCurrent(r)).sort((a, b) => a.cycleEndMonth.localeCompare(b.cycleEndMonth));

  const sortedInvoices = [...invoices].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  root.innerHTML = `
    <div class="toolbar">
      <div class="page-subtitle">
        全利用者共通で3月・7月・11月始まりの4か月サイクルを自動集計します(例: 7〜10月分は11月請求)。
        基準月が請求月に達したサイクルが「請求対象」に表示されます。保険分・自費分は別々の請求書として作成されます。
      </div>
      <div class="toolbar-controls">
        <label>基準月</label>
        <input type="month" id="f-reference" value="${referenceMonth}" />
      </div>
    </div>

    <div class="card">
      <div class="toolbar">
        <h3 class="card-title" style="margin:0">請求対象(未請求) ${dueRows.length > 0 ? `<span class="badge badge-warning">${dueRows.length}件</span>` : ''}</h3>
        <button class="btn btn-sm btn-primary" id="btn-bulk-create" ${dueRows.length === 0 ? 'disabled' : ''}>選択した請求書をまとめて作成</button>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:24px"><input type="checkbox" id="f-select-all" ${dueRows.length === 0 ? 'disabled' : ''} /></th>
            <th>利用者</th>
            <th>区分</th>
            <th>請求対象期間</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="due-rows">
          ${
            dueRows.length === 0
              ? `<tr class="empty-row"><td colspan="5">基準月時点で新たに請求すべきサイクルはありません。</td></tr>`
              : dueRows
                  .map(
                    (r, idx) => `
              <tr>
                <td><input type="checkbox" class="js-due-check" data-index="${idx}" /></td>
                <td>${escapeHtml(r.clientName)}</td>
                <td>${BILLING_TYPE_LABELS[r.category]}</td>
                <td>${formatYmJapanese(r.cycleStartMonth)} 〜 ${formatYmJapanese(r.cycleEndMonth)}</td>
                <td class="actions-cell">
                  <button class="btn btn-sm btn-primary js-create" data-client="${r.clientId}" data-cycle="${r.cycleStartMonth}" data-category="${r.category}">請求書を作成</button>
                </td>
              </tr>
            `
                  )
                  .join('')
          }
        </tbody>
      </table>
      <details class="inv-detail-toggle" style="margin-top:16px">
        <summary>この一覧に表示されない利用者を確認</summary>
        <table class="data-table" style="margin-top:12px">
          <thead>
            <tr>
              <th>利用者</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            ${
              clients.length === 0
                ? `<tr class="empty-row"><td colspan="2">利用者が登録されていません。</td></tr>`
                : [...clients]
                    .filter((c) => !dueRows.some((r) => r.clientId === c.id) && !pastDueRows.some((r) => r.clientId === c.id))
                    .sort((a, b) => a.kana.localeCompare(b.kana, 'ja'))
                    .map(
                      (c) => `
                <tr>
                  <td>${escapeHtml(c.name)}${c.active ? '' : ' <span class="badge badge-muted">終了/休止</span>'}</td>
                  <td>${escapeHtml(clientDueStatusLabel(c, usageEntries, invoices, referenceMonth))}</td>
                </tr>
              `
                    )
                    .join('')
            }
          </tbody>
        </table>
      </details>
    </div>

    <div class="card">
      <details ${pastDueRows.length > 0 ? 'open' : ''}>
        <summary style="cursor:pointer">
          <span class="card-title" style="display:inline">過去の未請求分 ${pastDueRows.length > 0 ? `<span class="badge badge-warning">${pastDueRows.length}件</span>` : ''}</span>
        </summary>
        <p class="page-subtitle" style="margin:12px 0">
          直近の対象期間より前に、締め済みなのにまだ請求書を作成していないサイクルです。導入前から利用中の方の場合、
          旧Excel等で既に請求済みのことも多いため、内容を確認してから作成してください。
        </p>
        <div class="toolbar">
          <div></div>
          <button class="btn btn-sm btn-primary" id="btn-bulk-create-past" ${pastDueRows.length === 0 ? 'disabled' : ''}>選択した請求書をまとめて作成</button>
        </div>
        <table class="data-table">
          <thead>
            <tr>
              <th style="width:24px"><input type="checkbox" id="f-select-all-past" ${pastDueRows.length === 0 ? 'disabled' : ''} /></th>
              <th>利用者</th>
              <th>区分</th>
              <th>請求対象期間</th>
              <th></th>
            </tr>
          </thead>
          <tbody id="past-due-rows">
            ${
              pastDueRows.length === 0
                ? `<tr class="empty-row"><td colspan="5">過去の未請求分はありません。</td></tr>`
                : pastDueRows
                    .map(
                      (r, idx) => `
              <tr>
                <td><input type="checkbox" class="js-due-check-past" data-index="${idx}" /></td>
                <td>${escapeHtml(r.clientName)}</td>
                <td>${BILLING_TYPE_LABELS[r.category]}</td>
                <td>${formatYmJapanese(r.cycleStartMonth)} 〜 ${formatYmJapanese(r.cycleEndMonth)}</td>
                <td class="actions-cell">
                  <button class="btn btn-sm btn-primary js-create" data-client="${r.clientId}" data-cycle="${r.cycleStartMonth}" data-category="${r.category}">請求書を作成</button>
                </td>
              </tr>
            `
                    )
                    .join('')
            }
          </tbody>
        </table>
      </details>
    </div>

    <div class="card">
      <h3 class="card-title">早期請求(途中解約・都度現金など)</h3>
      <p class="page-subtitle" style="margin:0 0 12px">
        4か月そろう前に請求したい場合(途中解約など)や、都度現金の方の請求書を作りたい場合はここから作成できます。
      </p>
      <div class="form-grid" style="grid-template-columns:280px;margin-bottom:12px">
        <div class="form-field">
          <label>利用者</label>
          <select id="f-early-client">
            <option value="">選択してください</option>
            ${[...clients]
              .sort((a, b) => a.kana.localeCompare(b.kana, 'ja'))
              .map((c) => `<option value="${c.id}">${escapeHtml(c.name)}${c.paymentMethod === 'cash' ? '(都度現金)' : ''}</option>`)
              .join('')}
          </select>
        </div>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>対象期間</th>
            <th>区分</th>
            <th class="num">現在の金額</th>
            <th>状態</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="early-cycle-rows">
          <tr class="empty-row"><td colspan="5">利用者を選択してください。</td></tr>
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
            <th>区分</th>
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
              ? `<tr class="empty-row"><td colspan="9">調整はまだありません。</td></tr>`
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
            <th>区分</th>
            <th>対象期間</th>
            <th class="num">請求金額</th>
            <th>状態</th>
            <th>入金</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="invoice-rows">
          ${
            sortedInvoices.length === 0
              ? `<tr class="empty-row"><td colspan="8">請求書はまだ作成されていません。</td></tr>`
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

  function createInvoiceForCycle(
    clientId: string,
    cycleStartMonth: string,
    farReference: string,
    category: BillingType,
    navigateAfter = true
  ): Invoice | null {
    const client = clients.find((c) => c.id === clientId);
    if (!client) return null;
    const cycles = getClientCycles(client, usageEntries, invoices, farReference);
    const cycle = cycles.find((c) => c.cycleStartMonth === cycleStartMonth);
    if (!cycle) return null;
    const { months, adjustments, totalAmount, nonTaxableTotal, taxableTotal } = buildInvoiceMonths(
      cycle,
      usageEntries,
      lateAdjustments,
      items,
      category
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
      billingCategory: category,
      status: 'draft',
      issuedDate: null,
      paidDate: null,
      createdAt: new Date().toISOString(),
    };
    store.saveInvoice(invoice);
    if (navigateAfter) navigate(`invoices/${invoice.id}`);
    return invoice;
  }

  function wireDueSection(
    rowsElId: string,
    checkClass: string,
    selectAllId: string,
    bulkBtnId: string,
    rows: DueRow[]
  ) {
    root.querySelector(`#${rowsElId}`)?.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest('.js-create') as HTMLElement | null;
      if (!btn) return;
      createInvoiceForCycle(
        btn.dataset.client!,
        btn.dataset.cycle!,
        referenceMonth,
        btn.dataset.category as BillingType
      );
    });

    const selectAllCheckbox = root.querySelector(`#${selectAllId}`) as HTMLInputElement | null;
    selectAllCheckbox?.addEventListener('change', () => {
      root.querySelectorAll(`.${checkClass}`).forEach((el) => {
        (el as HTMLInputElement).checked = selectAllCheckbox.checked;
      });
    });

    root.querySelector(`#${bulkBtnId}`)?.addEventListener('click', async () => {
      const checked = Array.from(root.querySelectorAll(`.${checkClass}:checked`)) as HTMLInputElement[];
      if (checked.length === 0) {
        await showAlert('請求書を作成する行にチェックを入れてください。');
        return;
      }
      if (!(await showConfirm(`選択した${checked.length}件の請求書をまとめて作成します。よろしいですか?`))) return;
      let created = 0;
      for (const cb of checked) {
        const row = rows[Number(cb.dataset.index)];
        if (!row) continue;
        const invoice = createInvoiceForCycle(row.clientId, row.cycleStartMonth, referenceMonth, row.category, false);
        if (invoice) created++;
      }
      await showAlert(`${created}件の請求書を作成しました(下書き)。内容は「請求書一覧」から確認できます。`);
      renderInvoicesPage(root);
    });
  }

  wireDueSection('due-rows', 'js-due-check', 'f-select-all', 'btn-bulk-create', dueRows);
  wireDueSection('past-due-rows', 'js-due-check-past', 'f-select-all-past', 'btn-bulk-create-past', pastDueRows);

  const earlyClientSelect = root.querySelector('#f-early-client') as HTMLSelectElement;
  const earlyCycleRows = root.querySelector('#early-cycle-rows') as HTMLElement;
  const todayMonth = currentYearMonth();

  function renderEarlyCycleRows() {
    const clientId = earlyClientSelect.value;
    if (!clientId) {
      earlyCycleRows.innerHTML = `<tr class="empty-row"><td colspan="5">利用者を選択してください。</td></tr>`;
      return;
    }
    const client = clients.find((c) => c.id === clientId);
    if (!client) return;
    // 今日時点までの実績があるサイクルのみ対象(未来の空サイクルは表示しない)
    const cycles = getClientCycles(client, usageEntries, invoices, todayMonth).filter((c) => !c.combinedInvoice);
    type Row = { cycle: BillingCycle; category: BillingType };
    const rows: Row[] = [];
    for (const cycle of cycles) {
      for (const category of ['insurance', 'private'] as const) {
        if (categoryInvoiceOf(cycle, category)) continue;
        if (!cycleCategoryHasData(cycle, category)) continue;
        rows.push({ cycle, category });
      }
    }
    if (rows.length === 0) {
      earlyCycleRows.innerHTML = `<tr class="empty-row"><td colspan="5">未請求のサイクルはありません。先に「月次利用入力」で利用状況を入力してください。</td></tr>`;
      return;
    }
    earlyCycleRows.innerHTML = rows
      .map(({ cycle, category }) => {
        const preview = buildInvoiceMonths(cycle, usageEntries, lateAdjustments, items, category);
        const statusBadge = cycle.isDue
          ? '<span class="badge badge-warning">締め済み(通常の請求対象)</span>'
          : '<span class="badge badge-muted">進行中(早期請求)</span>';
        return `
          <tr>
            <td>${formatYmJapanese(cycle.cycleStartMonth)} 〜 ${formatYmJapanese(cycle.cycleEndMonth)}</td>
            <td>${BILLING_TYPE_LABELS[category]}</td>
            <td class="num">${formatYen(preview.totalAmount)}</td>
            <td>${statusBadge}</td>
            <td class="actions-cell">
              <button class="btn btn-sm btn-primary js-create-early" data-cycle="${cycle.cycleStartMonth}" data-category="${category}">この期間で請求書を作成</button>
            </td>
          </tr>
        `;
      })
      .join('');
  }

  earlyClientSelect?.addEventListener('change', renderEarlyCycleRows);
  earlyCycleRows?.addEventListener('click', async (e) => {
    const btn = (e.target as HTMLElement).closest('.js-create-early') as HTMLElement | null;
    if (!btn) return;
    const cycleStartMonth = btn.dataset.cycle!;
    const category = btn.dataset.category as BillingType;
    if (!(await showConfirm(`${BILLING_TYPE_LABELS[category]}分の請求書をこの期間で作成します。よろしいですか?`))) return;
    createInvoiceForCycle(earlyClientSelect.value, cycleStartMonth, todayMonth, category);
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
  const alreadyInvoiced = invoices.some(
    (inv) =>
      inv.clientId === a.clientId &&
      inv.cycleStartMonth === cycleStart &&
      (inv.billingCategory === a.billingType || inv.billingCategory === 'combined')
  );
  return `
    <tr>
      <td>${escapeHtml(client?.name ?? '(削除済み)')}</td>
      <td>${BILLING_TYPE_LABELS[a.billingType]}</td>
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
    billingType: 'insurance',
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
        <label>区分 *</label>
        <select id="f-billing-type">
          <option value="insurance" ${a.billingType === 'insurance' ? 'selected' : ''}>保険分</option>
          <option value="private" ${a.billingType === 'private' ? 'selected' : ''}>自費分</option>
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
      ※ 金額欄は数量×単価で自動計算されますが、直接書き換えることもできます。区分は、この調整をどちらの請求書(保険分/自費分)に計上するかを選択してください。
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
      billingType: (box.querySelector('#f-billing-type') as HTMLSelectElement).value as BillingType,
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
  const paidBadge = inv.paidDate
    ? `<span class="badge badge-success">入金済み(${formatDateJapanese(inv.paidDate)})</span>`
    : `<span class="badge badge-muted">未入金</span>`;
  return `
    <tr>
      <td>${inv.invoiceNo ? escapeHtml(inv.invoiceNo) : '-'}</td>
      <td>${escapeHtml(client?.name ?? '(削除済み)')}</td>
      <td>${INVOICE_BILLING_CATEGORY_LABELS[inv.billingCategory]}</td>
      <td>${formatYmJapanese(inv.cycleStartMonth)} 〜 ${formatYmJapanese(inv.cycleEndMonth)}</td>
      <td class="num">${formatYen(inv.totalAmount)}</td>
      <td>${statusBadge}</td>
      <td>${paidBadge}</td>
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

  const issueDateLabel = invoice.issuedDate ? formatDateJapanese(invoice.issuedDate) : formatDateJapanese(todayIso());
  // 負担割合は介護保険分の請求書のみ意味を持つ(自費分は自己負担割合の概念がないため表示しない)
  const ratioLabel = client && invoice.billingCategory !== 'private' ? COMPACT_COPAY_LABELS[client.copayRatio] : '';

  const monthRows = invoice.months.map((m, idx) => monthRowHtml(m, idx, ratioLabel)).join('');
  const adjustmentRows = invoice.adjustments.map(adjustmentRowHtmlForTable).join('');

  root.innerHTML = `
    <div class="invoice-actions no-print">
      <button class="btn" id="btn-back">← 一覧に戻る</button>
      <div style="flex:1"></div>
      ${
        invoice.paidDate
          ? `<span class="badge badge-success" style="align-self:center">入金済み(${formatDateJapanese(invoice.paidDate)})</span>
             <button class="btn" id="btn-unpaid">未入金に戻す</button>`
          : `<button class="btn btn-primary" id="btn-paid">入金済みにする</button>`
      }
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
      <h2 class="inv-title">請求書${invoice.billingCategory !== 'combined' ? `<span class="inv-category-badge no-print">(${INVOICE_BILLING_CATEGORY_LABELS[invoice.billingCategory]})</span>` : ''}</h2>
      <div class="inv-header-row">
        <div class="inv-client-line">${escapeHtml(client?.name ?? '')}<span class="inv-sama">様</span></div>
        <div class="inv-meta">
          <div>発行日: ${issueDateLabel}</div>
          <div style="margin-top:8px">${escapeHtml(company.address)}</div>
          <div class="inv-company-name">${escapeHtml(company.companyName)}</div>
        </div>
      </div>

      <p class="inv-lead">下記のとおり御請求申し上げます。</p>

      <div class="invoice-total-box">
        <span class="label">請求合計金額</span>
        <span class="amount">${formatYen(invoice.totalAmount)}</span>
        <span class="suffix">（税込）</span>
      </div>

      <table class="data-table inv-table">
        <thead>
          <tr>
            <th></th>
            <th>負担割合</th>
            <th class="num">非課税分</th>
            <th class="num">課税分</th>
            <th class="num">月別合計金額</th>
            <th>備考</th>
          </tr>
        </thead>
        <tbody>
          ${monthRows}
          ${adjustmentRows}
          <tr class="inv-total-row">
            <td>合計</td>
            <td></td>
            <td class="num">${formatYen(invoice.nonTaxableTotal)}</td>
            <td class="num">${formatYen(invoice.taxableTotal)}</td>
            <td class="num">${formatYen(invoice.totalAmount)}</td>
            <td></td>
          </tr>
        </tbody>
      </table>

      <p class="inv-footer">ご不明な点等ございましたら、ご連絡頂きますようお願い致します。</p>

      ${
        company.bankInfo
          ? `<div class="card no-print" style="margin-top:20px"><h3 class="card-title">お振込先(社内メモ・印刷されません)</h3><div style="white-space:pre-line">${escapeHtml(company.bankInfo)}</div></div>`
          : ''
      }

      <details class="inv-detail-toggle no-print">
        <summary>品目明細を表示(社内確認用・印刷されません)</summary>
        ${invoice.months.map(monthDetailBlockHtml).join('')}
        ${invoice.adjustments.length > 0 ? adjustmentsDetailBlockHtml(invoice.adjustments) : ''}
      </details>
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
  root.querySelector('#btn-paid')?.addEventListener('click', async () => {
    if (!(await showConfirm('この請求書を入金済みにします。よろしいですか?'))) return;
    store.saveInvoice({ ...invoice, paidDate: todayIso() });
  });
  root.querySelector('#btn-unpaid')?.addEventListener('click', async () => {
    if (!(await showConfirm('入金済みを取り消して未入金に戻します。よろしいですか?'))) return;
    store.saveInvoice({ ...invoice, paidDate: null });
  });

  root.querySelectorAll('.js-month-note').forEach((el) =>
    el.addEventListener('change', (e) => {
      const idx = Number((e.target as HTMLInputElement).dataset.index);
      const value = (e.target as HTMLInputElement).value;
      const current = store.getState().invoices.find((i) => i.id === invoiceId);
      if (!current) return;
      const months = current.months.map((m, i) => (i === idx ? { ...m, note: value } : m));
      store.saveInvoice({ ...current, months });
    })
  );
}

function monthRowHtml(month: Invoice['months'][number], idx: number, ratioLabel: string): string {
  if (month.lines.length === 0) return ''; // 利用実績のない月は行を出さない(途中解約等で4か月そろわない場合に対応)
  const { month: monthNumber } = parseYearMonth(month.yearMonth);
  return `
    <tr>
      <td>${monthNumber}月分レンタル料</td>
      <td>${ratioLabel}</td>
      <td class="num">${formatYen(month.nonTaxableSubtotal)}</td>
      <td class="num">${formatYen(month.taxableSubtotal)}</td>
      <td class="num">${formatYen(month.subtotal)}</td>
      <td>
        <input type="text" class="js-month-note inv-note-input" data-index="${idx}" value="${escapeHtml(month.note)}" />
      </td>
    </tr>
  `;
}

function adjustmentRowHtmlForTable(a: Invoice['adjustments'][number]): string {
  return `
    <tr>
      <td>${formatYmJapanese(a.originalYearMonth)}分(月遅れ)</td>
      <td></td>
      <td class="num">${a.taxCategory === 'nontaxable' ? formatYen(a.amount) : formatYen(0)}</td>
      <td class="num">${a.taxCategory === 'taxable' ? formatYen(a.amount) : formatYen(0)}</td>
      <td class="num">${formatYen(a.amount)}</td>
      <td>${escapeHtml(a.reason || a.itemName)}</td>
    </tr>
  `;
}

function adjustmentsDetailBlockHtml(adjustments: Invoice['adjustments']): string {
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

function monthDetailBlockHtml(month: Invoice['months'][number]): string {
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

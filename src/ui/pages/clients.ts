import { store, newId } from '@/store';
import type { Client, ClientEvent, ClientEventType, CopayRatio, Invoice, PaymentMethod } from '@/types';
import { CLIENT_EVENT_TYPE_LABELS, COPAY_RATIO_LABELS, INVOICE_BILLING_CATEGORY_LABELS, PAYMENT_METHOD_LABELS } from '@/types';
import { escapeHtml } from '@/utils/format';
import { openModal } from '@/ui/components/modal';
import { showAlert, showConfirm } from '@/ui/components/dialog';
import { todayIso, formatDateJapanese, formatYmJapanese } from '@/utils/date';
import { navigate } from '@/ui/router';

type Mode = 'list' | 'history';
let mode: Mode = 'list';
let currentRoot: HTMLElement | null = null;

export function renderClientsPage(root: HTMLElement) {
  currentRoot = root;
  root.innerHTML = `
    <div style="margin-bottom:16px">
      <button class="btn btn-sm ${mode === 'list' ? 'btn-primary' : ''}" id="tab-list">👤 利用者一覧</button>
      <button class="btn btn-sm ${mode === 'history' ? 'btn-primary' : ''}" id="tab-history">🕘 変更履歴</button>
    </div>
    <div id="clients-section"></div>
  `;

  root.querySelector('#tab-list')?.addEventListener('click', () => {
    mode = 'list';
    renderClientsPage(root);
  });
  root.querySelector('#tab-history')?.addEventListener('click', () => {
    mode = 'history';
    renderClientsPage(root);
  });

  const section = root.querySelector('#clients-section') as HTMLElement;
  if (mode === 'history') {
    renderHistorySection(section);
  } else {
    renderListSection(section);
  }
}

// ==================== 利用者一覧タブ ====================

function renderListSection(section: HTMLElement) {
  const clients = [...store.getState().clients].sort((a, b) => a.kana.localeCompare(b.kana, 'ja'));
  const invoices = store.getState().invoices;

  section.innerHTML = `
    <div class="toolbar">
      <div class="page-subtitle">利用者(ご契約者)の基本情報を登録します。請求は全利用者共通で3月・7月・11月に区切って発行されます。</div>
      <button class="btn btn-primary" id="btn-add">＋ 利用者を追加</button>
    </div>
    <div class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>利用者名</th>
            <th>要介護度</th>
            <th>負担割合</th>
            <th>請求方法</th>
            <th>担当ケアマネ</th>
            <th>営業担当</th>
            <th>状態</th>
            <th>最新請求書</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="client-rows">
          ${
            clients.length === 0
              ? `<tr class="empty-row"><td colspan="9">利用者が登録されていません。「利用者を追加」から登録してください。</td></tr>`
              : clients.map((c) => rowHtml(c, invoices)).join('')
          }
        </tbody>
      </table>
    </div>
  `;

  section.querySelector('#btn-add')?.addEventListener('click', () => openClientModal());

  section.querySelector('#client-rows')?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const id = target.getAttribute('data-id');
    if (!id) return;
    if (target.classList.contains('js-edit')) {
      const client = store.getState().clients.find((c) => c.id === id);
      if (client) openClientModal(client);
    } else if (target.classList.contains('js-delete')) {
      const client = store.getState().clients.find((c) => c.id === id);
      if (
        client &&
        (await showConfirm(`「${client.name}」を削除します。関連する利用実績・請求書・履歴も削除されます。よろしいですか?`))
      ) {
        store.deleteClient(id);
      }
    } else if (target.classList.contains('js-view-invoice')) {
      navigate(`invoices/${target.getAttribute('data-invoice-id')}`);
    }
  });
}

/** その利用者の請求書のうち、対象期間(cycleEndMonth)が一番新しいもの(複数区分あれば全て) */
function latestInvoicesForClient(clientId: string, invoices: Invoice[]): Invoice[] {
  const clientInvoices = invoices.filter((i) => i.clientId === clientId);
  if (clientInvoices.length === 0) return [];
  const maxEnd = clientInvoices.reduce((max, i) => (i.cycleEndMonth > max ? i.cycleEndMonth : max), clientInvoices[0].cycleEndMonth);
  return clientInvoices.filter((i) => i.cycleEndMonth === maxEnd);
}

function latestInvoiceCellHtml(clientId: string, invoices: Invoice[]): string {
  const latest = latestInvoicesForClient(clientId, invoices);
  if (latest.length === 0) return '<span style="color:var(--color-text-muted)">-</span>';
  return latest
    .map((inv) => {
      const label = `${formatYmJapanese(inv.cycleStartMonth)}〜${formatYmJapanese(inv.cycleEndMonth)}(${INVOICE_BILLING_CATEGORY_LABELS[inv.billingCategory]})`;
      const statusBadge =
        inv.status === 'issued'
          ? ''
          : '<span class="badge badge-warning" style="margin-left:4px;font-size:11px">下書き</span>';
      return `<div><button class="btn-link js-view-invoice" data-invoice-id="${inv.id}">${escapeHtml(label)}</button>${statusBadge}</div>`;
    })
    .join('');
}

function rowHtml(c: Client, invoices: Invoice[]): string {
  return `
    <tr>
      <td>${escapeHtml(c.name)}<div style="color:#94a3b8;font-size:12px">${escapeHtml(c.kana)}</div></td>
      <td>${escapeHtml(c.careLevel)}</td>
      <td>${COPAY_RATIO_LABELS[c.copayRatio]}</td>
      <td>${c.paymentMethod === 'cash' ? '<span class="badge badge-muted">都度現金</span>' : '4か月ごと'}</td>
      <td>${escapeHtml(c.careManagerName)}</td>
      <td>${escapeHtml(c.salesRepName)}</td>
      <td>${c.active ? '<span class="badge badge-success">利用中</span>' : '<span class="badge badge-muted">終了</span>'}</td>
      <td>${latestInvoiceCellHtml(c.id, invoices)}</td>
      <td class="actions-cell">
        <button class="btn-link js-edit" data-id="${c.id}">編集</button>
        <button class="btn-link js-delete" data-id="${c.id}" style="color:#dc2626">削除</button>
      </td>
    </tr>
  `;
}

function openClientModal(existing?: Client) {
  const isEdit = !!existing;
  const { box, close } = openModal(isEdit ? '利用者情報の編集' : '利用者の新規登録');

  const c: Client = existing ?? {
    id: newId(),
    name: '',
    kana: '',
    careLevel: '',
    copayRatio: '1',
    paymentMethod: 'cycle',
    address: '',
    phone: '',
    careOfficeName: '',
    careManagerName: '',
    salesRepName: '',
    active: true,
    note: '',
  };

  box.insertAdjacentHTML(
    'beforeend',
    `
    <div class="form-grid">
      <div class="form-field">
        <label>利用者名 *</label>
        <input type="text" id="f-name" value="${escapeHtml(c.name)}" />
      </div>
      <div class="form-field">
        <label>フリガナ</label>
        <input type="text" id="f-kana" value="${escapeHtml(c.kana)}" />
      </div>
      <div class="form-field">
        <label>要介護度</label>
        <input type="text" id="f-careLevel" placeholder="例: 要介護2" value="${escapeHtml(c.careLevel)}" />
      </div>
      <div class="form-field">
        <label>利用者負担割合 *</label>
        <select id="f-copayRatio">
          ${(Object.keys(COPAY_RATIO_LABELS) as CopayRatio[])
            .map(
              (ratio) =>
                `<option value="${ratio}" ${ratio === c.copayRatio ? 'selected' : ''}>${COPAY_RATIO_LABELS[ratio]}</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="form-field">
        <label>請求方法 *</label>
        <select id="f-paymentMethod">
          ${(Object.keys(PAYMENT_METHOD_LABELS) as PaymentMethod[])
            .map(
              (m) =>
                `<option value="${m}" ${m === c.paymentMethod ? 'selected' : ''}>${PAYMENT_METHOD_LABELS[m]}</option>`
            )
            .join('')}
        </select>
      </div>
      <div class="form-field">
        <label>電話番号</label>
        <input type="text" id="f-phone" value="${escapeHtml(c.phone)}" />
      </div>
      <div class="form-field full">
        <label>住所</label>
        <input type="text" id="f-address" value="${escapeHtml(c.address)}" />
      </div>
      <div class="form-field">
        <label>居宅介護支援事業所</label>
        <input type="text" id="f-careOffice" value="${escapeHtml(c.careOfficeName)}" />
      </div>
      <div class="form-field">
        <label>担当ケアマネジャー</label>
        <input type="text" id="f-careManager" value="${escapeHtml(c.careManagerName)}" />
      </div>
      <div class="form-field">
        <label>営業担当者</label>
        <input type="text" id="f-salesRep" value="${escapeHtml(c.salesRepName)}" />
      </div>
      <div class="form-field">
        <label>状態</label>
        <select id="f-active">
          <option value="true" ${c.active ? 'selected' : ''}>利用中</option>
          <option value="false" ${!c.active ? 'selected' : ''}>終了</option>
        </select>
      </div>
      <div class="form-field full">
        <label>備考</label>
        <textarea id="f-note">${escapeHtml(c.note)}</textarea>
      </div>
    </div>
    <p style="color:#64748b;font-size:12px;margin-top:8px">
      ※ 請求サイクルは全利用者共通で、7〜10月分→11月請求、11〜2月分→3月請求、3〜6月分→7月請求です。<br />
      ※ 利用者負担割合は、月次利用入力で介護保険品目(単位数入力)の自己負担額を自動計算する際に使用します。<br />
      ※「都度現金」の方は、4か月ごとの「請求対象」に自動では表示されません(「請求書」画面から手動で作成することは可能です)。<br />
      ※ 途中解約などで4か月そろう前に請求したい場合は、「請求書」画面の「早期請求」から作成できます。<br />
      ※ 新規・変更・終了・休止などの経緯は「変更履歴」タブに記録できます。
    </p>
    <div class="form-actions">
      <button class="btn" id="btn-cancel">キャンセル</button>
      <button class="btn btn-primary" id="btn-save">保存</button>
    </div>
  `
  );

  box.querySelector('#btn-cancel')?.addEventListener('click', close);
  box.querySelector('#btn-save')?.addEventListener('click', async () => {
    const name = (box.querySelector('#f-name') as HTMLInputElement).value.trim();
    if (!name) {
      await showAlert('利用者名を入力してください。');
      return;
    }
    const updated: Client = {
      ...c,
      name,
      kana: (box.querySelector('#f-kana') as HTMLInputElement).value.trim(),
      careLevel: (box.querySelector('#f-careLevel') as HTMLInputElement).value.trim(),
      copayRatio: (box.querySelector('#f-copayRatio') as HTMLSelectElement).value as CopayRatio,
      paymentMethod: (box.querySelector('#f-paymentMethod') as HTMLSelectElement).value as PaymentMethod,
      phone: (box.querySelector('#f-phone') as HTMLInputElement).value.trim(),
      address: (box.querySelector('#f-address') as HTMLInputElement).value.trim(),
      careOfficeName: (box.querySelector('#f-careOffice') as HTMLInputElement).value.trim(),
      careManagerName: (box.querySelector('#f-careManager') as HTMLInputElement).value.trim(),
      salesRepName: (box.querySelector('#f-salesRep') as HTMLInputElement).value.trim(),
      active: (box.querySelector('#f-active') as HTMLSelectElement).value === 'true',
      note: (box.querySelector('#f-note') as HTMLTextAreaElement).value.trim(),
    };
    store.upsertClient(updated);
    close();
  });
}

// ==================== 変更履歴タブ ====================

function renderHistorySection(section: HTMLElement) {
  const clients = [...store.getState().clients].sort((a, b) => a.kana.localeCompare(b.kana, 'ja'));
  const events = [...store.getState().clientEvents].sort((a, b) => b.date.localeCompare(a.date));

  section.innerHTML = `
    <div class="toolbar">
      <div class="page-subtitle">新規・変更・終了・休止・再開などの経緯を時系列で記録します(旧Excelの「新規・終了」「休止」シートに相当)。</div>
      <button class="btn btn-primary" id="btn-add-event" ${clients.length === 0 ? 'disabled' : ''}>＋ 履歴を追加</button>
    </div>
    <div class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>日付</th>
            <th>利用者</th>
            <th>区分</th>
            <th>内容</th>
            <th>備考</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="event-rows">
          ${
            events.length === 0
              ? `<tr class="empty-row"><td colspan="6">履歴がまだありません。</td></tr>`
              : events.map((e) => eventRowHtml(e, clients)).join('')
          }
        </tbody>
      </table>
    </div>
  `;

  section.querySelector('#btn-add-event')?.addEventListener('click', () => {
    if (clients.length === 0) return;
    openEventModal(clients);
  });

  section.querySelector('#event-rows')?.addEventListener('click', async (e) => {
    const target = e.target as HTMLElement;
    const id = target.getAttribute('data-id');
    if (!id) return;
    if (target.classList.contains('js-edit')) {
      const event = store.getState().clientEvents.find((ev) => ev.id === id);
      if (event) openEventModal(clients, event);
    } else if (target.classList.contains('js-delete')) {
      if (await showConfirm('この履歴を削除します。よろしいですか?')) {
        store.deleteClientEvent(id);
      }
    }
  });
}

function eventRowHtml(e: ClientEvent, clients: Client[]): string {
  const client = clients.find((c) => c.id === e.clientId);
  return `
    <tr>
      <td>${formatDateJapanese(e.date)}</td>
      <td>${escapeHtml(client?.name ?? '(削除済み)')}</td>
      <td><span class="badge badge-muted">${CLIENT_EVENT_TYPE_LABELS[e.type]}</span></td>
      <td>${escapeHtml(e.content)}</td>
      <td>${escapeHtml(e.note)}</td>
      <td class="actions-cell">
        <button class="btn-link js-edit" data-id="${e.id}">編集</button>
        <button class="btn-link js-delete" data-id="${e.id}" style="color:#dc2626">削除</button>
      </td>
    </tr>
  `;
}

function openEventModal(clients: Client[], existing?: ClientEvent) {
  const isEdit = !!existing;
  const { box, close } = openModal(isEdit ? '履歴の編集' : '履歴の追加');

  const ev: ClientEvent = existing ?? {
    id: newId(),
    clientId: clients[0].id,
    type: '新規',
    date: todayIso(),
    content: '',
    note: '',
    createdAt: new Date().toISOString(),
  };

  box.insertAdjacentHTML(
    'beforeend',
    `
    <div class="form-grid">
      <div class="form-field">
        <label>利用者 *</label>
        <select id="f-client">
          ${clients.map((c) => `<option value="${c.id}" ${c.id === ev.clientId ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('')}
        </select>
      </div>
      <div class="form-field">
        <label>区分 *</label>
        <select id="f-type">
          ${(Object.keys(CLIENT_EVENT_TYPE_LABELS) as ClientEventType[])
            .map((t) => `<option value="${t}" ${t === ev.type ? 'selected' : ''}>${CLIENT_EVENT_TYPE_LABELS[t]}</option>`)
            .join('')}
        </select>
      </div>
      <div class="form-field">
        <label>日付 *</label>
        <input type="date" id="f-date" value="${ev.date}" />
      </div>
      <div class="form-field full">
        <label>内容</label>
        <input type="text" id="f-content" placeholder="例: 車いす、ベッド一式" value="${escapeHtml(ev.content)}" />
      </div>
      <div class="form-field full">
        <label>備考</label>
        <textarea id="f-note">${escapeHtml(ev.note)}</textarea>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn" id="btn-cancel">キャンセル</button>
      <button class="btn btn-primary" id="btn-save">保存</button>
    </div>
  `
  );

  box.querySelector('#btn-cancel')?.addEventListener('click', close);
  box.querySelector('#btn-save')?.addEventListener('click', async () => {
    const date = (box.querySelector('#f-date') as HTMLInputElement).value;
    if (!date) {
      await showAlert('日付を入力してください。');
      return;
    }
    const updated: ClientEvent = {
      ...ev,
      clientId: (box.querySelector('#f-client') as HTMLSelectElement).value,
      type: (box.querySelector('#f-type') as HTMLSelectElement).value as ClientEventType,
      date,
      content: (box.querySelector('#f-content') as HTMLInputElement).value.trim(),
      note: (box.querySelector('#f-note') as HTMLTextAreaElement).value.trim(),
    };
    store.upsertClientEvent(updated);
    close();
  });
}

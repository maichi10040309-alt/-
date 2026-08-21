import { store, newId } from '@/store';
import type { Client } from '@/types';
import { escapeHtml } from '@/utils/format';
import { openModal } from '@/ui/components/modal';
import { currentYearMonth, formatYmJapanese, isValidYearMonth } from '@/utils/date';

export function renderClientsPage(root: HTMLElement) {
  const clients = [...store.getState().clients].sort((a, b) => a.kana.localeCompare(b.kana, 'ja'));

  root.innerHTML = `
    <div class="toolbar">
      <div class="page-subtitle">利用者(ご契約者)の基本情報と、請求サイクルの起算月を登録します。</div>
      <button class="btn btn-primary" id="btn-add">＋ 利用者を追加</button>
    </div>
    <div class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>利用者名</th>
            <th>要介護度</th>
            <th>担当ケアマネ</th>
            <th>営業担当</th>
            <th>請求起算月</th>
            <th>状態</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="client-rows">
          ${
            clients.length === 0
              ? `<tr class="empty-row"><td colspan="7">利用者が登録されていません。「利用者を追加」から登録してください。</td></tr>`
              : clients.map(rowHtml).join('')
          }
        </tbody>
      </table>
    </div>
  `;

  root.querySelector('#btn-add')?.addEventListener('click', () => openClientModal());

  root.querySelector('#client-rows')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const id = target.getAttribute('data-id');
    if (!id) return;
    if (target.classList.contains('js-edit')) {
      const client = store.getState().clients.find((c) => c.id === id);
      if (client) openClientModal(client);
    } else if (target.classList.contains('js-delete')) {
      const client = store.getState().clients.find((c) => c.id === id);
      if (client && confirm(`「${client.name}」を削除します。関連する利用実績・請求書も削除されます。よろしいですか?`)) {
        store.deleteClient(id);
      }
    }
  });
}

function rowHtml(c: Client): string {
  return `
    <tr>
      <td>${escapeHtml(c.name)}<div style="color:#94a3b8;font-size:12px">${escapeHtml(c.kana)}</div></td>
      <td>${escapeHtml(c.careLevel)}</td>
      <td>${escapeHtml(c.careManagerName)}</td>
      <td>${escapeHtml(c.salesRepName)}</td>
      <td>${c.billingStartMonth ? formatYmJapanese(c.billingStartMonth) : '-'}</td>
      <td>${c.active ? '<span class="badge badge-success">利用中</span>' : '<span class="badge badge-muted">終了</span>'}</td>
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
    address: '',
    phone: '',
    careOfficeName: '',
    careManagerName: '',
    salesRepName: '',
    billingStartMonth: currentYearMonth(),
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
        <label>請求サイクル起算月 *</label>
        <input type="month" id="f-billingStart" value="${c.billingStartMonth}" />
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
      ※ 請求サイクル起算月から4か月ごとに区切って自動集計されます(例: 4月起算なら4〜7月分→8〜11月分→…)。
    </p>
    <div class="form-actions">
      <button class="btn" id="btn-cancel">キャンセル</button>
      <button class="btn btn-primary" id="btn-save">保存</button>
    </div>
  `
  );

  box.querySelector('#btn-cancel')?.addEventListener('click', close);
  box.querySelector('#btn-save')?.addEventListener('click', () => {
    const name = (box.querySelector('#f-name') as HTMLInputElement).value.trim();
    const billingStartMonth = (box.querySelector('#f-billingStart') as HTMLInputElement).value;
    if (!name) {
      alert('利用者名を入力してください。');
      return;
    }
    if (!isValidYearMonth(billingStartMonth)) {
      alert('請求サイクル起算月を選択してください。');
      return;
    }
    const updated: Client = {
      ...c,
      name,
      kana: (box.querySelector('#f-kana') as HTMLInputElement).value.trim(),
      careLevel: (box.querySelector('#f-careLevel') as HTMLInputElement).value.trim(),
      phone: (box.querySelector('#f-phone') as HTMLInputElement).value.trim(),
      address: (box.querySelector('#f-address') as HTMLInputElement).value.trim(),
      careOfficeName: (box.querySelector('#f-careOffice') as HTMLInputElement).value.trim(),
      careManagerName: (box.querySelector('#f-careManager') as HTMLInputElement).value.trim(),
      salesRepName: (box.querySelector('#f-salesRep') as HTMLInputElement).value.trim(),
      billingStartMonth,
      active: (box.querySelector('#f-active') as HTMLSelectElement).value === 'true',
      note: (box.querySelector('#f-note') as HTMLTextAreaElement).value.trim(),
    };
    store.upsertClient(updated);
    close();
  });
}

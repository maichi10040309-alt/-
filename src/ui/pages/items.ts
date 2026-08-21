import { store, newId } from '@/store';
import type { BillingType, RentalItem } from '@/types';
import { escapeHtml, formatYen } from '@/utils/format';
import { openModal } from '@/ui/components/modal';

const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  insurance: '介護保険品目(単位数×負担割合で自動計算)',
  private: '自費品目(金額を直接入力)',
};

export function renderItemsPage(root: HTMLElement) {
  const items = [...store.getState().items].sort((a, b) => a.category.localeCompare(b.category, 'ja'));

  root.innerHTML = `
    <div class="toolbar">
      <div class="page-subtitle">
        レンタル品目のマスタです。介護保険品目は月次利用入力で単位数を入れると利用者負担割合から自動計算され、
        自費品目は金額をそのまま入力します。
      </div>
      <button class="btn btn-primary" id="btn-add">＋ 品目を追加</button>
    </div>
    <div class="card">
      <table class="data-table">
        <thead>
          <tr>
            <th>分類</th>
            <th>品目名</th>
            <th>区分</th>
            <th class="num">自費目安月額</th>
            <th>備考</th>
            <th></th>
          </tr>
        </thead>
        <tbody id="item-rows">
          ${
            items.length === 0
              ? `<tr class="empty-row"><td colspan="6">品目が登録されていません。</td></tr>`
              : items.map(rowHtml).join('')
          }
        </tbody>
      </table>
    </div>
  `;

  root.querySelector('#btn-add')?.addEventListener('click', () => openItemModal());

  root.querySelector('#item-rows')?.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    const id = target.getAttribute('data-id');
    if (!id) return;
    if (target.classList.contains('js-edit')) {
      const item = store.getState().items.find((i) => i.id === id);
      if (item) openItemModal(item);
    } else if (target.classList.contains('js-delete')) {
      const item = store.getState().items.find((i) => i.id === id);
      if (item && confirm(`「${item.name}」を削除します。よろしいですか?`)) {
        store.deleteItem(id);
      }
    }
  });
}

function rowHtml(i: RentalItem): string {
  return `
    <tr>
      <td>${escapeHtml(i.category)}</td>
      <td>${escapeHtml(i.name)}</td>
      <td>${i.billingType === 'insurance' ? '<span class="badge badge-muted">保険</span>' : '<span class="badge badge-success">自費</span>'}</td>
      <td class="num">${i.billingType === 'private' ? formatYen(i.unitPrice) : '-'}</td>
      <td>${escapeHtml(i.note)}</td>
      <td class="actions-cell">
        <button class="btn-link js-edit" data-id="${i.id}">編集</button>
        <button class="btn-link js-delete" data-id="${i.id}" style="color:#dc2626">削除</button>
      </td>
    </tr>
  `;
}

function openItemModal(existing?: RentalItem) {
  const isEdit = !!existing;
  const { box, close } = openModal(isEdit ? '品目の編集' : '品目の新規登録');

  const item: RentalItem = existing ?? {
    id: newId(),
    name: '',
    category: '',
    billingType: 'insurance',
    unitPrice: 0,
    note: '',
  };

  box.insertAdjacentHTML(
    'beforeend',
    `
    <div class="form-grid">
      <div class="form-field">
        <label>品目名 *</label>
        <input type="text" id="f-name" value="${escapeHtml(item.name)}" />
      </div>
      <div class="form-field">
        <label>分類</label>
        <input type="text" id="f-category" value="${escapeHtml(item.category)}" />
      </div>
      <div class="form-field full">
        <label>区分 *</label>
        <select id="f-billingType">
          <option value="insurance" ${item.billingType === 'insurance' ? 'selected' : ''}>${BILLING_TYPE_LABELS.insurance}</option>
          <option value="private" ${item.billingType === 'private' ? 'selected' : ''}>${BILLING_TYPE_LABELS.private}</option>
        </select>
      </div>
      <div class="form-field" id="f-price-field">
        <label>自費目安月額(円)</label>
        <input type="number" id="f-price" min="0" step="1" value="${item.unitPrice}" />
      </div>
      <div class="form-field full">
        <label>備考</label>
        <textarea id="f-note">${escapeHtml(item.note)}</textarea>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn" id="btn-cancel">キャンセル</button>
      <button class="btn btn-primary" id="btn-save">保存</button>
    </div>
  `
  );

  const priceField = box.querySelector('#f-price-field') as HTMLElement;
  const typeSelect = box.querySelector('#f-billingType') as HTMLSelectElement;
  const syncPriceField = () => {
    priceField.style.display = typeSelect.value === 'private' ? '' : 'none';
  };
  syncPriceField();
  typeSelect.addEventListener('change', syncPriceField);

  box.querySelector('#btn-cancel')?.addEventListener('click', close);
  box.querySelector('#btn-save')?.addEventListener('click', () => {
    const name = (box.querySelector('#f-name') as HTMLInputElement).value.trim();
    const billingType = typeSelect.value as BillingType;
    const unitPrice = Number((box.querySelector('#f-price') as HTMLInputElement).value) || 0;
    if (!name) {
      alert('品目名を入力してください。');
      return;
    }
    if (billingType === 'private' && unitPrice < 0) {
      alert('金額を正しく入力してください。');
      return;
    }
    const updated: RentalItem = {
      ...item,
      name,
      category: (box.querySelector('#f-category') as HTMLInputElement).value.trim(),
      billingType,
      unitPrice: billingType === 'private' ? unitPrice : 0,
      note: (box.querySelector('#f-note') as HTMLTextAreaElement).value.trim(),
    };
    store.upsertItem(updated);
    close();
  });
}

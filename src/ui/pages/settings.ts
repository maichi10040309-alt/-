import { store } from '@/store';
import { openModal } from '@/ui/components/modal';

export function openCompanySettingsModal() {
  const company = store.getState().company;
  const { box, close } = openModal('事業所情報設定(請求書に印字されます)');

  box.insertAdjacentHTML(
    'beforeend',
    `
    <div class="form-grid">
      <div class="form-field full">
        <label>事業所名</label>
        <input type="text" id="f-name" value="${escapeAttr(company.companyName)}" />
      </div>
      <div class="form-field full">
        <label>住所</label>
        <input type="text" id="f-address" value="${escapeAttr(company.address)}" />
      </div>
      <div class="form-field">
        <label>電話番号</label>
        <input type="text" id="f-phone" value="${escapeAttr(company.phone)}" />
      </div>
      <div class="form-field">
        <label>FAX番号</label>
        <input type="text" id="f-fax" value="${escapeAttr(company.fax)}" />
      </div>
      <div class="form-field full">
        <label>振込先情報</label>
        <textarea id="f-bank">${escapeAttr(company.bankInfo)}</textarea>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn" id="btn-cancel">キャンセル</button>
      <button class="btn btn-primary" id="btn-save">保存</button>
    </div>
  `
  );

  box.querySelector('#btn-cancel')?.addEventListener('click', close);
  box.querySelector('#btn-save')?.addEventListener('click', () => {
    store.updateCompany({
      companyName: (box.querySelector('#f-name') as HTMLInputElement).value.trim(),
      address: (box.querySelector('#f-address') as HTMLInputElement).value.trim(),
      phone: (box.querySelector('#f-phone') as HTMLInputElement).value.trim(),
      fax: (box.querySelector('#f-fax') as HTMLInputElement).value.trim(),
      bankInfo: (box.querySelector('#f-bank') as HTMLTextAreaElement).value.trim(),
    });
    close();
  });
}

function escapeAttr(value: string): string {
  return value.replace(/"/g, '&quot;');
}

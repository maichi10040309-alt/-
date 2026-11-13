import { isSealDataUrl, readSealImage } from '@/utils/companySeal';
import { showAlert, showConfirm } from '@/ui/components/dialog';
import { escapeHtml } from '@/utils/format';
import { store } from '@/store';
import { openModal } from '@/ui/components/modal';

export function openCompanySettingsModal() {
  const company = store.getState().company;
  let sealDataUrl = isSealDataUrl(company.sealDataUrl) ? company.sealDataUrl : '';
  let processingImage = false;
  let saving = false;
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
        <label>振込先情報（請求書に印字されます）</label>
        <textarea id="f-bank">${escapeAttr(company.bankInfo)}</textarea>
      </div>
      <div class="form-field full">
        <label for="f-seal">請求書の社印</label>
        <input type="file" id="f-seal" accept="image/png,image/jpeg,image/webp" />
        <p style="font-size:12px;color:var(--color-text-muted)">画像を選ぶと社印を自動保存します。「社印を削除」で登録を解除できます。背景が透明なPNGがおすすめです。5MBまで。住所・会社名の右端に少し重ねて、2cm×2cmで印字します。</p>
        <div id="seal-status" role="status"></div>
        <div id="seal-preview" style="min-height:100px"></div>
        <button class="btn btn-sm" type="button" id="btn-remove-seal">社印を削除</button>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn" id="btn-cancel">キャンセル</button>
      <button class="btn btn-primary" id="btn-save">保存</button>
    </div>
  `
  );

  const saveButton = box.querySelector<HTMLButtonElement>('#btn-save')!;
  const sealInput = box.querySelector<HTMLInputElement>('#f-seal')!;
  const removeButton = box.querySelector<HTMLButtonElement>('#btn-remove-seal')!;
  const sealStatus = box.querySelector('#seal-status')!;
  function renderSealPreview() {
    const preview = box.querySelector('#seal-preview')!;
    preview.innerHTML = sealDataUrl
      ? `<img src="${sealDataUrl}" alt="登録済みの社印" style="width:100px;height:100px;object-fit:contain;background:#fff;border:1px solid #ddd" />`
      : '<span style="font-size:13px;color:#64748b">社印は登録されていません。</span>';
    removeButton.disabled = processingImage || saving || !sealDataUrl;
  }
  renderSealPreview();
  async function changeSeal(file?: File) {
    if (processingImage || saving) return;
    processingImage = true;
    sealStatus.textContent = file ? '社印を保存中…' : '社印を削除中…';
    saveButton.disabled = true;
    sealInput.disabled = true;
    renderSealPreview();
    try {
      const nextSeal = file ? await readSealImage(file) : '';
      if (!await store.updateCompanySeal(nextSeal)) {
        throw new Error(file ? '社印を保存できませんでした。' : '社印を削除できませんでした。');
      }
      sealDataUrl = nextSeal;
      sealStatus.textContent = file ? '社印を保存しました。' : '社印を削除しました。';
    } catch (error) {
      const message = error instanceof Error ? error.message : '社印の設定を更新できませんでした。';
      sealStatus.textContent = message;
      if (!box.isConnected) await showAlert(message);
    } finally {
      processingImage = false;
      sealInput.value = '';
      sealInput.disabled = false;
      saveButton.disabled = false;
      renderSealPreview();
    }
  }
  sealInput.addEventListener('change', () => {
    const file = sealInput.files?.[0];
    if (file) void changeSeal(file);
  });
  removeButton.addEventListener('click', async () => {
    if (await showConfirm('登録済みの社印を削除しますか？', '社印の削除')) await changeSeal();
  });
  box.querySelector('#btn-cancel')?.addEventListener('click', close);
  saveButton.addEventListener('click', async () => {
    if (saving || processingImage) return;
    saving = true;
    saveButton.disabled = true;
    sealInput.disabled = true;
    renderSealPreview();
    try {
      const bankInfo = (box.querySelector('#f-bank') as HTMLTextAreaElement).value.trim();
      const saved = await store.updateCompany({
        companyName: (box.querySelector('#f-name') as HTMLInputElement).value.trim(),
        address: (box.querySelector('#f-address') as HTMLInputElement).value.trim(),
        phone: (box.querySelector('#f-phone') as HTMLInputElement).value.trim(),
        fax: (box.querySelector('#f-fax') as HTMLInputElement).value.trim(),
        ...(bankInfo !== company.bankInfo.trim() ? { bankInfo } : {}),
      });
      if (saved) close();
      else await showAlert('設定を保存できませんでした。通信状態を確認して再度保存してください。');
    } catch { await showAlert('設定を保存できませんでした。もう一度お試しください。'); }
    finally {
      saving = false;
      saveButton.disabled = false;
      sealInput.disabled = false;
      renderSealPreview();
    }
  });
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

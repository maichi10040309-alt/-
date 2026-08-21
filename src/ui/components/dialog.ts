import { escapeHtml } from '@/utils/format';

// ブラウザ標準の alert()/confirm() は、Artifact等のサンドボックス化された iframe内では
// 許可されておらず「何も起きない」ため、自前のモーダルダイアログで代替する。

function buildDialog(title: string, message: string, buttonsHtml: string) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';

  const box = document.createElement('div');
  box.className = 'modal-box';
  box.style.maxWidth = '420px';
  box.innerHTML = `
    <h3 class="modal-title">${escapeHtml(title)}</h3>
    <p style="white-space:pre-line;font-size:13px;line-height:1.7;margin:0">${escapeHtml(message)}</p>
    <div class="form-actions">${buttonsHtml}</div>
  `;

  overlay.appendChild(box);
  document.body.appendChild(overlay);
  return { overlay, box };
}

export function showAlert(message: string, title = 'お知らせ'): Promise<void> {
  return new Promise((resolve) => {
    const { overlay, box } = buildDialog(
      title,
      message,
      `<button class="btn btn-primary" id="dlg-ok">OK</button>`
    );
    const finish = () => {
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve();
    };
    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'Enter') finish();
    }
    document.addEventListener('keydown', onKeydown);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish();
    });
    box.querySelector('#dlg-ok')?.addEventListener('click', finish);
  });
}

export function showConfirm(message: string, title = '確認'): Promise<boolean> {
  return new Promise((resolve) => {
    const { overlay, box } = buildDialog(
      title,
      message,
      `<button class="btn" id="dlg-cancel">キャンセル</button>
       <button class="btn btn-primary" id="dlg-ok">OK</button>`
    );
    let done = false;
    const finish = (result: boolean) => {
      if (done) return;
      done = true;
      overlay.remove();
      document.removeEventListener('keydown', onKeydown);
      resolve(result);
    };
    function onKeydown(e: KeyboardEvent) {
      if (e.key === 'Escape') finish(false);
      if (e.key === 'Enter') finish(true);
    }
    document.addEventListener('keydown', onKeydown);
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) finish(false);
    });
    box.querySelector('#dlg-cancel')?.addEventListener('click', () => finish(false));
    box.querySelector('#dlg-ok')?.addEventListener('click', () => finish(true));
  });
}

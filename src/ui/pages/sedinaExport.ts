import { store } from '@/store';
import { openModal } from '@/ui/components/modal';
import { addMonths, formatYmJapanese, isValidYearMonth } from '@/utils/date';
import { formatYen, escapeHtml } from '@/utils/format';
import { planSedinaTransfer, readSedinaWorkbook, writeSedinaTransfer } from '@/utils/sedinaExport';

export function openSedinaExport(startMonth: string) {
  const { box, close } = openModal('セディナ管理表に4か月分を転記');
  box.insertAdjacentHTML('beforeend', `
    <p>保存済みのレンタル・自費の利用明細を、セディナ番号ごとに合算して転記します。</p>
    <div class="form-grid">
      <div class="form-field"><label for="sedina-start">開始月（この月から4か月）</label><input type="month" id="sedina-start" value="${escapeHtml(startMonth)}"></div>
      <div class="form-field"><label for="sedina-file">セディナ管理表</label><input type="file" id="sedina-file" accept=".xlsm,.xlsx"></div>
      <div class="form-field"><label for="sedina-sheet">転記先のタブ</label><select id="sedina-sheet" disabled><option value="">タブを選択</option></select></div>
    </div>
    <div id="sedina-preview" aria-live="polite"></div>
    <div class="form-actions"><button class="btn" id="sedina-close">閉じる</button><button class="btn btn-primary" id="sedina-download" disabled>転記したExcelを保存</button></div>`);
  const start = box.querySelector<HTMLInputElement>('#sedina-start')!;
  const input = box.querySelector<HTMLInputElement>('#sedina-file')!;
  const select = box.querySelector<HTMLSelectElement>('#sedina-sheet')!;
  const preview = box.querySelector<HTMLElement>('#sedina-preview')!;
  const download = box.querySelector<HTMLButtonElement>('#sedina-download')!;
  let file: File | undefined;
  let bytes: ArrayBuffer | undefined;
  let workbook: ReturnType<typeof readSedinaWorkbook> | undefined;
  let plan: ReturnType<typeof planSedinaTransfer> | undefined;
  let revision = 0;
  const errorText = (error: unknown) => error instanceof Error ? error.message : 'Excelを処理できませんでした。';
  function updatePreview() {
    plan = undefined;
    download.disabled = true;
    preview.textContent = '';
    if (!isValidYearMonth(start.value)) { preview.textContent = '開始月を指定してください。'; return; }
    if (!workbook || !select.value) return;
    try {
      const { clients, usageEntries } = store.getState();
      plan = planSedinaTransfer(workbook, select.value, start.value, clients, usageEntries);
      preview.innerHTML = `<p>${formatYmJapanese(start.value)}〜${formatYmJapanese(addMonths(start.value, 3))} ／ 転記先：${escapeHtml(select.value)}</p>
        <p>転記対象：${plan.matched}件 ／ 非課税：${formatYen(plan.nonTaxTotal)} ／ 課税：${formatYen(plan.taxTotal)}</p>
        <p>番号未登録：${plan.withoutNumber}人 ／ 管理表にない番号：${plan.unmatchedNumbers.length}件</p>
        ${plan.unmatchedNumbers.length ? `<p>管理表にない番号：${escapeHtml(plan.unmatchedNumbers.join('、'))}</p>` : ''}
        <p>一致した行のレンタル欄を置き換えます。元のファイルは上書きされません。</p>`;
      download.disabled = !plan.matched;
    } catch (error) { preview.textContent = errorText(error); }
  }
  input.addEventListener('change', async () => {
    const request = ++revision;
    bytes = workbook = undefined;
    file = input.files?.[0];
    select.replaceChildren(new Option('タブを選択', ''));
    select.disabled = true;
    updatePreview();
    if (!file) return;
    try {
      if (!/\.(xlsm|xlsx)$/i.test(file.name)) throw new Error('Excel形式（.xlsm または .xlsx）のファイルを選んでください。');
      const buffer = await file.arrayBuffer();
      if (request !== revision) return;
      workbook = readSedinaWorkbook(buffer);
      bytes = buffer;
      for (const name of workbook.SheetNames) select.add(new Option(name, name));
      select.disabled = false;
      preview.textContent = '転記先のタブを選んでください。';
    } catch (error) { if (request === revision) preview.textContent = errorText(error); }
  });
  select.addEventListener('change', updatePreview);
  start.addEventListener('change', updatePreview);
  box.querySelector('#sedina-close')?.addEventListener('click', close);
  download.addEventListener('click', () => {
    if (!file || !bytes || !plan?.matched) return;
    try {
      const output = writeSedinaTransfer(bytes, select.value, plan.updates);
      const url = URL.createObjectURL(new Blob([Uint8Array.from(output)], { type: 'application/octet-stream' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = file.name.replace(/(\.[^.]+)$/, `_レンタル転記_${start.value}_${addMonths(start.value, 3)}$1`);
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (error) { preview.textContent = errorText(error); }
  });
}

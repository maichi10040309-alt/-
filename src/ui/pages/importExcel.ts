import { store, newId } from '@/store';
import type { Client, CopayRatio, RentalItem, UsageEntry } from '@/types';
import { COPAY_RATIO_LABELS, copayYenPerUnit } from '@/types';
import { openModal } from '@/ui/components/modal';
import { escapeHtml, formatYen } from '@/utils/format';
import { currentYearMonth, formatYmJapanese, isValidYearMonth } from '@/utils/date';
import type { ImportedClient, ImportResult } from '@/utils/excelImport';
import { clientMatchKey, parseCareExcelWorkbook, readFileAsArrayBuffer } from '@/utils/excelImport';

function lineUnitPrice(line: ImportedClient['lines'][number], copayRatio: CopayRatio): number {
  return line.billingType === 'insurance' ? copayYenPerUnit(copayRatio) : line.unitPrice;
}

function clientTotal(c: ImportedClient): number {
  return c.lines.reduce((sum, l) => sum + l.quantity * lineUnitPrice(l, c.copayRatio), 0);
}

export function openImportModal() {
  const { box, close } = openModal('Excelから一括取り込み');

  box.insertAdjacentHTML(
    'beforeend',
    `
    <p style="color:#64748b;font-size:13px;line-height:1.6;margin:0 0 16px">
      毎月の「保険(在宅)」「自費(在宅)」シートを含むExcel(.xlsx / .xlsm)を選ぶと、利用者と当月の利用状況を
      まとめて取り込めます。ファイルはこの端末のブラウザ内だけで読み込まれ、外部には送信されません。
    </p>
    <div class="form-grid">
      <div class="form-field">
        <label>対象年月 *</label>
        <input type="month" id="f-target-month" value="${currentYearMonth()}" />
      </div>
      <div class="form-field">
        <label>ファイル選択 *</label>
        <input type="file" id="f-file" accept=".xlsx,.xlsm,.xls" />
      </div>
    </div>
    <div id="import-status" style="margin-top:16px"></div>
    <div class="form-actions">
      <button class="btn" id="btn-cancel">閉じる</button>
      <button class="btn btn-primary" id="btn-commit">この内容を取り込む</button>
    </div>
  `
  );

  const statusEl = box.querySelector('#import-status') as HTMLElement;
  const fileInput = box.querySelector('#f-file') as HTMLInputElement;
  const monthInput = box.querySelector('#f-target-month') as HTMLInputElement;
  const commitBtn = box.querySelector('#btn-commit') as HTMLButtonElement;

  // 取り込みボタンは常にクリック可能にしておき、準備ができていない場合は
  // クリック時にメッセージで案内する(disabled属性の更新漏れ・環境差異による
  // 「押せているように見えるが反応しない」状態を避けるため)。
  let parsed: ImportResult | null = null;

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    parsed = null;
    statusEl.innerHTML = `<p style="color:#64748b">解析中…</p>`;
    try {
      const buffer = await readFileAsArrayBuffer(file);
      parsed = parseCareExcelWorkbook(buffer);
      renderPreview();
    } catch (err) {
      statusEl.innerHTML = `<p style="color:#c53434">ファイルの読み込みに失敗しました: ${escapeHtml(String(err))}</p>`;
    }
  });

  function renderPreview() {
    if (!parsed) return;
    const { clients, warnings } = parsed;
    const grandTotal = clients.reduce((sum, c) => sum + clientTotal(c), 0);

    statusEl.innerHTML = `
      ${
        warnings.length > 0
          ? `<div class="card" style="background:var(--color-warning-bg);border-color:var(--color-warning-bg);margin-bottom:12px">
              ${warnings.map((w) => `<div style="font-size:12px;color:var(--color-warning)">${escapeHtml(w)}</div>`).join('')}
            </div>`
          : ''
      }
      <p style="font-size:13px;margin:0 0 8px">
        <strong>${clients.length}名</strong>の利用者、合計 <strong>${formatYen(grandTotal)}</strong> を取り込みます
        (対象月: <span id="preview-month-label"></span>)。
      </p>
      <div class="table-scroll" style="max-height:280px;overflow-y:auto">
        <table class="data-table">
          <thead>
            <tr><th>利用者名</th><th>負担割合</th><th>品目数</th><th class="num">金額</th></tr>
          </thead>
          <tbody>
            ${clients
              .map(
                (c) => `
              <tr>
                <td>${escapeHtml(c.name)}<div style="color:#94a3b8;font-size:12px">${escapeHtml(c.kana)}</div></td>
                <td>${COPAY_RATIO_LABELS[c.copayRatio]}</td>
                <td>${c.lines.length}</td>
                <td class="num">${formatYen(clientTotal(c))}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>
      </div>
    `;
    updateMonthLabel();
  }

  function updateMonthLabel() {
    const label = box.querySelector('#preview-month-label');
    if (label && isValidYearMonth(monthInput.value)) {
      label.textContent = formatYmJapanese(monthInput.value);
    }
  }
  monthInput.addEventListener('change', updateMonthLabel);

  box.querySelector('#btn-cancel')?.addEventListener('click', close);
  commitBtn.addEventListener('click', () => {
    if (!parsed) {
      alert('先にファイルを選択し、解析が完了してから取り込んでください。');
      return;
    }
    if (parsed.clients.length === 0) {
      alert('取り込めるデータが見つかりませんでした。ファイルの内容をご確認ください。');
      return;
    }
    if (!isValidYearMonth(monthInput.value)) {
      alert('対象年月を選択してください。');
      return;
    }
    const targetMonth = monthInput.value;
    if (
      !confirm(
        `${parsed.clients.length}名の利用者について、${formatYmJapanese(targetMonth)}分の利用状況を取り込みます。よろしいですか?\n(既に入力済みの場合は上書きされます)`
      )
    ) {
      return;
    }
    commitImport(parsed, targetMonth);
    close();
    alert('取り込みが完了しました。「利用者マスタ」「月次利用入力」で内容をご確認ください。');
  });
}

function commitImport(result: ImportResult, targetMonth: string) {
  const state = store.getState();
  const existingKeyToId = new Map<string, string>();
  for (const c of state.clients) {
    existingKeyToId.set(clientMatchKey(c.name, c.kana), c.id);
  }
  const itemNameToId = new Map<string, string>();
  for (const i of state.items) {
    itemNameToId.set(i.name, i.id);
  }

  for (const imported of result.clients) {
    const key = clientMatchKey(imported.name, imported.kana);
    let clientId = existingKeyToId.get(key);
    if (clientId) {
      const existing = state.clients.find((c) => c.id === clientId)!;
      const updated: Client = {
        ...existing,
        name: imported.name,
        kana: imported.kana,
        careLevel: imported.careLevel || existing.careLevel,
        copayRatio: imported.copayRatio,
        careOfficeName: imported.careOfficeName || existing.careOfficeName,
        careManagerName: imported.careManagerName || existing.careManagerName,
      };
      store.upsertClient(updated);
    } else {
      clientId = newId();
      const newClient: Client = {
        id: clientId,
        name: imported.name,
        kana: imported.kana,
        careLevel: imported.careLevel,
        copayRatio: imported.copayRatio,
        address: '',
        phone: '',
        careOfficeName: imported.careOfficeName,
        careManagerName: imported.careManagerName,
        salesRepName: '',
        billingStartMonth: targetMonth,
        active: true,
        note: '',
      };
      store.upsertClient(newClient);
      existingKeyToId.set(key, clientId);
    }

    const entries: UsageEntry[] = imported.lines.map((line) => {
      let itemId = itemNameToId.get(line.itemName);
      if (!itemId) {
        itemId = newId();
        const newItem: RentalItem = {
          id: itemId,
          name: line.itemName,
          category: line.billingType === 'insurance' ? '介護保険品目' : '自費品目',
          billingType: line.billingType,
          unitPrice: line.billingType === 'private' ? line.unitPrice : 0,
          note: 'Excel取り込みにより自動追加',
        };
        store.upsertItem(newItem);
        itemNameToId.set(line.itemName, itemId);
      }
      const unitPrice = lineUnitPrice(line, imported.copayRatio);
      return {
        id: newId(),
        clientId: clientId!,
        yearMonth: targetMonth,
        itemId,
        itemName: line.itemName,
        quantity: line.quantity,
        unitPrice,
        amount: line.quantity * unitPrice,
        note: '',
        enteredAt: new Date().toISOString(),
      };
    });

    store.setUsageEntriesForMonth(clientId, targetMonth, entries);
  }
}

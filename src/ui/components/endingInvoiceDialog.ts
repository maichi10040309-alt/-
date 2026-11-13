import type { EndingCharge, Invoice } from '@/types';
import { formatYmJapanese } from '@/utils/date';
import { escapeHtml, formatYen } from '@/utils/format';

type Details = Pick<Invoice, 'months' | 'totalAmount'>;
export interface EndingSelection {
  month: string;
  charge: EndingCharge;
}
export function chooseEndingCharge(
  title: string,
  endMonths: string[],
  preview: (ending?: EndingSelection) => Details,
  appendOnly = false,
): Promise<EndingSelection | false | undefined> {
  return new Promise((resolve) => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <form class="modal-box" role="dialog" aria-modal="true" aria-label="請求内容の確認">
        <h3 class="modal-title">${escapeHtml(title)}</h3>
        <div class="form-grid">
          <div class="form-field"><label for="ending-charge">終了月分の追加</label>
            <select id="ending-charge">${appendOnly ? '' : '<option value="">追加しない</option>'}<option value="full">1か月分</option><option value="half">半月分</option></select>
          </div>
          <div class="form-field"><label for="ending-month">終了月</label>
            <select id="ending-month">${endMonths.map((month) => `<option value="${escapeHtml(month)}">${formatYmJapanese(month)}</option>`).join('')}</select>
          </div>
        </div>
        <p>終了月は、月次利用入力に保存した1か月分の金額を使います。半月分は明細ごとに半額にし、1円未満を切り捨てます。</p>
        <p data-preview role="status"></p>
        <div class="form-actions">
          <button type="button" class="btn" data-cancel>キャンセル</button>
          <button class="btn btn-primary" type="submit">${appendOnly ? '終了月分を追加' : '請求書を発行'}</button>
        </div>
      </form>`;
    document.body.appendChild(overlay);
    const form = overlay.querySelector('form')!;
    const charge = form.querySelector<HTMLSelectElement>('#ending-charge')!;
    const month = form.querySelector<HTMLSelectElement>('#ending-month')!;
    const submit = form.querySelector<HTMLButtonElement>('[type="submit"]')!;
    const selection = (): EndingSelection | undefined => charge.value
      ? { month: month.value, charge: charge.value === 'half' ? 'half' : 'full' } : undefined;
    const render = () => {
      const ending = selection();
      month.disabled = !ending;
      const details = preview(ending);
      const extra = details.months.find((row) => row.endingCharge);
      const invalid = !!ending && !extra?.subtotal;
      submit.disabled = invalid || details.totalAmount === 0;
      form.querySelector('[data-preview]')!.textContent = invalid
        ? '終了月の請求額が0円です。月次利用入力の保存内容を確認してください。'
        : `請求合計：${formatYen(details.totalAmount)}${extra ? `（うち終了月分：${formatYen(extra.subtotal)}）` : ''}`;
    };
    const finish = (value: EndingSelection | false | undefined) => {
      overlay.remove();
      document.removeEventListener('keydown', keydown);
      resolve(value);
    };
    function keydown(event: KeyboardEvent) {
      if (event.key === 'Escape') finish(false);
    }
    document.addEventListener('keydown', keydown);
    form.addEventListener('change', render);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!submit.disabled) finish(selection());
    });
    form.querySelector('[data-cancel]')!.addEventListener('click', () => finish(false));
    overlay.addEventListener('click', (event) => { if (event.target === overlay) finish(false); });
    render();
    charge.focus();
  });
}

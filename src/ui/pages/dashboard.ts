import { store } from '@/store';
import { buildInvoiceMonths, getClientCycles } from '@/utils/billing';
import { currentYearMonth, formatYmJapanese } from '@/utils/date';
import { formatYen } from '@/utils/format';
import { navigate } from '@/ui/router';

export function renderDashboardPage(root: HTMLElement) {
  const { clients, usageEntries, invoices, lateAdjustments, items } = store.getState();
  const thisMonth = currentYearMonth();

  const activeClients = clients.filter((c) => c.status === 'active');

  let dueCount = 0;
  let dueAmount = 0;
  for (const client of clients) {
    if (client.paymentMethod === 'cash') continue; // 都度現金の方は自動請求対象に含めない
    const cycles = getClientCycles(client, usageEntries, invoices, thisMonth);
    for (const cycle of cycles) {
      if (!cycle.isDue || cycle.combinedInvoice) continue;
      for (const category of ['insurance', 'private'] as const) {
        const alreadyInvoiced = category === 'insurance' ? cycle.insuranceInvoice : cycle.privateInvoice;
        if (alreadyInvoiced) continue;
        const preview = buildInvoiceMonths(cycle, usageEntries, lateAdjustments, items, category);
        const hasData = preview.months.some((m) => m.lines.length > 0) || preview.adjustments.length > 0;
        if (!hasData) continue;
        dueCount++;
        dueAmount += preview.totalAmount;
      }
    }
  }

  const draftCount = invoices.filter((i) => i.status === 'draft').length;
  const thisMonthUsageCount = new Set(
    usageEntries.filter((u) => u.yearMonth === thisMonth).map((u) => u.clientId)
  ).size;

  root.innerHTML = `
    <div class="page-subtitle" style="margin-bottom:16px">基準日: ${formatYmJapanese(thisMonth)}</div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-label">利用中の利用者数</div>
        <div class="stat-value">${activeClients.length}<span style="font-size:14px;font-weight:400"> 名</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">今月の請求対象(未請求)</div>
        <div class="stat-value">${dueCount}<span style="font-size:14px;font-weight:400"> 件</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">請求対象の見込み金額</div>
        <div class="stat-value">${formatYen(dueAmount)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">未発行の請求書(下書き)</div>
        <div class="stat-value">${draftCount}<span style="font-size:14px;font-weight:400"> 件</span></div>
      </div>
      <div class="stat-card">
        <div class="stat-label">今月の利用状況 入力済み</div>
        <div class="stat-value">${thisMonthUsageCount} / ${activeClients.length}<span style="font-size:14px;font-weight:400"> 名</span></div>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">よく使う操作</h3>
      <div class="quick-actions">
        <button class="btn btn-primary" id="go-usage">📝 今月の利用状況を入力する</button>
        <button class="btn btn-primary" id="go-invoices">🧾 請求書を確認・発行する</button>
        <button class="btn" id="go-clients">👤 利用者を登録する</button>
      </div>
    </div>

    <div class="card">
      <h3 class="card-title">このシステムについて</h3>
      <p style="color:#475569;line-height:1.7;margin:0">
        介護用品レンタルの請求は4か月ごとにまとめて行うため、営業担当が入力した「月次の利用状況」を
        自動集計し、そのまま印刷できる請求書として発行できます。左メニューの手順は
        <strong>①月次利用入力 → ②請求書</strong> の2ステップだけです。
      </p>
    </div>
  `;

  root.querySelector('#go-usage')?.addEventListener('click', () => navigate('usage'));
  root.querySelector('#go-invoices')?.addEventListener('click', () => navigate('invoices'));
  root.querySelector('#go-clients')?.addEventListener('click', () => navigate('clients'));
}

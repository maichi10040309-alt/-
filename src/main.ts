import '@/style.css';
import { store } from '@/store';
import { onRouteChange } from '@/ui/router';
import { getContentRoot, renderLayout, updateActiveNav } from '@/ui/layout';
import { renderDashboardPage } from '@/ui/pages/dashboard';
import { renderClientsPage } from '@/ui/pages/clients';
import { renderItemsPage } from '@/ui/pages/items';
import { renderUsagePage } from '@/ui/pages/usage';
import { renderInvoicesPage, renderInvoiceDetailPage } from '@/ui/pages/invoices';
import { escapeHtml } from '@/utils/format';

const appRoot = document.querySelector<HTMLDivElement>('#app')!;
renderLayout(appRoot);

// store.subscribe()は、書き込み後の再描画のために合成の'hashchange'イベントを
// 発火させている(下記参照)。実際のURL変更(=本当の画面遷移)と区別するため、
// 直前のhash値を記録しておき、実際に変わった時だけ他PCの変更を取り込む
// refreshNow()を呼ぶ(そうしないと「refreshNow→notify→合成hashchange→
// refreshNow→…」の無限ループになってしまう)。
let lastHash = window.location.hash;

onRouteChange((route) => {
  updateActiveNav(route);
  const content = getContentRoot();

  if (!store.isReady()) {
    content.innerHTML = `<div class="card">データベースに接続しています...</div>`;
    return;
  }
  const loadError = store.getLoadError();
  if (loadError) {
    content.innerHTML = `<div class="card" style="color:var(--color-danger)">${escapeHtml(loadError)}</div>`;
    return;
  }

  const currentHash = window.location.hash;
  if (currentHash !== lastHash) {
    lastHash = currentHash;
    // 他のパソコンでの変更を、実際の画面遷移のたびに取り込む(裏で取得し、届き次第再描画される)
    store.refreshNow();
  }

  switch (route.name) {
    case 'dashboard':
      renderDashboardPage(content);
      break;
    case 'clients':
      renderClientsPage(content);
      break;
    case 'items':
      renderItemsPage(content);
      break;
    case 'usage':
      renderUsagePage(content);
      break;
    case 'invoices':
      renderInvoicesPage(content);
      break;
    case 'invoiceDetail':
      renderInvoiceDetailPage(content, route.invoiceId);
      break;
  }
});

store.subscribe(() => {
  window.dispatchEvent(new HashChangeEvent('hashchange'));
});

// 他のタブ・アプリから戻ってきたタイミングでも、他のパソコンでの変更を取り込む
window.addEventListener('focus', () => store.refreshNow());
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) store.refreshNow();
});

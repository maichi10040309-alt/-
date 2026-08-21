import '@/style.css';
import { store } from '@/store';
import { onRouteChange } from '@/ui/router';
import { getContentRoot, renderLayout, updateActiveNav } from '@/ui/layout';
import { renderDashboardPage } from '@/ui/pages/dashboard';
import { renderClientsPage } from '@/ui/pages/clients';
import { renderItemsPage } from '@/ui/pages/items';
import { renderUsagePage } from '@/ui/pages/usage';
import { renderInvoicesPage, renderInvoiceDetailPage } from '@/ui/pages/invoices';

const appRoot = document.querySelector<HTMLDivElement>('#app')!;
renderLayout(appRoot);

onRouteChange((route) => {
  updateActiveNav(route);
  const content = getContentRoot();
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

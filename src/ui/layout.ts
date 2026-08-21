import type { Route } from '@/ui/router';
import { navigate } from '@/ui/router';
import { openCompanySettingsModal } from '@/ui/pages/settings';

interface NavItem {
  route: Route['name'];
  path: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { route: 'dashboard', path: '', label: 'ホーム', icon: '🏠' },
  { route: 'usage', path: 'usage', label: '月次利用入力', icon: '📝' },
  { route: 'invoices', path: 'invoices', label: '請求書', icon: '🧾' },
  { route: 'clients', path: 'clients', label: '利用者マスタ', icon: '👤' },
  { route: 'items', path: 'items', label: 'レンタル品目マスタ', icon: '🛏️' },
];

const PAGE_TITLES: Record<Route['name'], string> = {
  dashboard: 'ホーム',
  usage: '月次利用状況の入力',
  invoices: '請求書',
  invoiceDetail: '請求書',
  clients: '利用者マスタ',
  items: 'レンタル品目マスタ',
};

export function renderLayout(root: HTMLElement) {
  root.innerHTML = `
    <aside class="sidebar">
      <div class="sidebar-title">介護用品レンタル<br />請求システム</div>
      <ul class="nav-list" id="nav-list"></ul>
      <div class="sidebar-footer">
        <a href="#" id="settings-link" class="nav-link" style="padding-left:0">⚙️ 事業所情報設定</a>
      </div>
    </aside>
    <div class="main">
      <div class="topbar">
        <div>
          <h1 class="page-title" id="page-title"></h1>
        </div>
      </div>
      <div class="content" id="content"></div>
    </div>
  `;

  const navList = root.querySelector('#nav-list') as HTMLUListElement;
  navList.innerHTML = NAV_ITEMS.map(
    (item) => `
      <li>
        <a href="#/${item.path}" class="nav-link" data-route="${item.route}">
          <span class="nav-icon">${item.icon}</span>${item.label}
        </a>
      </li>`
  ).join('');

  const settingsLink = root.querySelector('#settings-link') as HTMLAnchorElement;
  settingsLink.addEventListener('click', (e) => {
    e.preventDefault();
    openCompanySettingsModal();
  });

  root.querySelector('#nav-list')?.addEventListener('click', (e) => {
    const a = (e.target as HTMLElement).closest('a[data-route]') as HTMLAnchorElement | null;
    if (!a) return;
    e.preventDefault();
    const href = a.getAttribute('href') ?? '#/';
    navigate(href.replace(/^#\/?/, ''));
  });
}

export function updateActiveNav(route: Route) {
  document.querySelectorAll('.nav-link[data-route]').forEach((el) => {
    el.classList.toggle('active', el.getAttribute('data-route') === route.name);
  });
  const titleEl = document.querySelector('#page-title');
  if (titleEl) titleEl.textContent = PAGE_TITLES[route.name];
}

export function getContentRoot(): HTMLElement {
  return document.querySelector('#content') as HTMLElement;
}

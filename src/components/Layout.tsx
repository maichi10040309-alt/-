import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'ダッシュボード', end: true },
  { to: '/customers', label: '得意先台帳' },
  { to: '/products', label: '商品台帳' },
  { to: '/documents/quotation', label: '見積書' },
  { to: '/documents/delivery', label: '納品書' },
  { to: '/documents/invoice', label: '請求書' },
  { to: '/documents/consolidated_invoice', label: '合計請求書' },
  { to: '/documents/receipt', label: '領収証' },
  { to: '/billing', label: '締め処理' },
  { to: '/receivables', label: '売掛金一覧' },
  { to: '/reports', label: '売上集計・分析' },
  { to: '/settings', label: '設定' },
  { to: '/legacy-import', label: '過去データの取り込み' },
];

export default function Layout() {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">販</span>
          <div>
            <div className="brand-title">販売管理</div>
            <div className="brand-sub">Sales Manager</div>
          </div>
        </div>
        <nav>
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

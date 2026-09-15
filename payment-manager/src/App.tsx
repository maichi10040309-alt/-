import { useState } from 'react';
import { useAppData } from './useAppData';
import { InvoiceEntry } from './components/InvoiceEntry';
import { TransferExport } from './components/TransferExport';
import { ExpenseSummary } from './components/ExpenseSummary';
import { Masters } from './components/Masters';

type MainTab = 'invoices' | 'transfer' | 'summary' | 'masters';

const TAB_LABELS: Record<MainTab, string> = {
  invoices: '請求入力',
  transfer: '振込データ作成',
  summary: '経費集計',
  masters: 'マスタ管理',
};

export default function App() {
  const [data, updateData] = useAppData();
  const [tab, setTab] = useState<MainTab>('invoices');

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>仕入支払い管理</h1>
        <nav className="main-tabs">
          {(Object.keys(TAB_LABELS) as MainTab[]).map((key) => (
            <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
              {TAB_LABELS[key]}
            </button>
          ))}
        </nav>
      </header>
      <main className="app-main">
        {tab === 'invoices' && <InvoiceEntry data={data} updateData={updateData} />}
        {tab === 'transfer' && <TransferExport data={data} updateData={updateData} />}
        {tab === 'summary' && <ExpenseSummary data={data} />}
        {tab === 'masters' && <Masters data={data} updateData={updateData} />}
      </main>
      <footer className="app-footer">データはこの端末のブラウザ内にのみ保存されます(サーバー送信なし)。</footer>
    </div>
  );
}

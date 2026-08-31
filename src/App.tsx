import { useEffect, useState } from 'react';
import { HashRouter, Routes, Route } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import CustomerList from './pages/CustomerList';
import CustomerEdit from './pages/CustomerEdit';
import ProductList from './pages/ProductList';
import ProductEdit from './pages/ProductEdit';
import DocumentList from './pages/DocumentList';
import DocumentEdit from './pages/DocumentEdit';
import DocumentPrint from './pages/DocumentPrint';
import DocumentPrintBatch from './pages/DocumentPrintBatch';
import BillingRun from './pages/BillingRun';
import Receivables from './pages/Receivables';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import LegacyImport from './pages/LegacyImport';
import { api } from './api/client';

type BootState = 'checking' | 'ready' | 'error';

function App() {
  const [boot, setBoot] = useState<BootState>('checking');

  const checkConnection = () => {
    setBoot('checking');
    api.company
      .get()
      .then(() => setBoot('ready'))
      .catch(() => setBoot('error'));
  };

  useEffect(() => {
    checkConnection();
  }, []);

  if (boot === 'checking') {
    return <div className="boot-loading">読み込み中...</div>;
  }

  if (boot === 'error') {
    return (
      <div className="boot-loading boot-error">
        <div>
          <p>サーバーに接続できません。</p>
          <p className="hint">
            起動ファイル(start-mac.command / start-windows.bat)でサーバーが起動しているか確認してください。
          </p>
          <button className="btn btn-primary" onClick={checkConnection}>
            再接続する
          </button>
        </div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/customers" element={<CustomerList />} />
          <Route path="/customers/:id" element={<CustomerEdit />} />
          <Route path="/products" element={<ProductList />} />
          <Route path="/products/:id" element={<ProductEdit />} />
          <Route path="/documents/:type" element={<DocumentList />} />
          <Route path="/documents/:type/print-batch" element={<DocumentPrintBatch />} />
          <Route path="/documents/:type/:id" element={<DocumentEdit />} />
          <Route path="/documents/:type/:id/print" element={<DocumentPrint />} />
          <Route path="/billing" element={<BillingRun />} />
          <Route path="/receivables" element={<Receivables />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/legacy-import" element={<LegacyImport />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;

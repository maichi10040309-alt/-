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
import BillingRun from './pages/BillingRun';
import Receivables from './pages/Receivables';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import { ensureCompanySeed } from './db/db';

function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    ensureCompanySeed().then(() => setReady(true));
  }, []);

  if (!ready) {
    return <div className="boot-loading">読み込み中...</div>;
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
          <Route path="/documents/:type/:id" element={<DocumentEdit />} />
          <Route path="/documents/:type/:id/print" element={<DocumentPrint />} />
          <Route path="/billing" element={<BillingRun />} />
          <Route path="/receivables" element={<Receivables />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;

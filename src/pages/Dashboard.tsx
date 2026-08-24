import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import PageHeader from '../components/PageHeader';
import { formatMoney, formatDateJa, todayISO } from '../utils/format';
import { itemAmount } from '../utils/tax';
import { calcReceivables } from '../utils/receivables';
import { DOCUMENT_TYPE_LABEL, DOCUMENT_STATUS_LABEL, type DocumentType } from '../types';

export default function Dashboard() {
  const company = useLiveQuery(() => db.company.get(1), []);
  const documents = useLiveQuery(() => db.documents.toArray(), []);
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  const products = useLiveQuery(() => db.products.toArray(), []);

  const today = todayISO();
  const thisMonth = today.slice(0, 7);

  const customerMap = useMemo(() => {
    const m = new Map<string, string>();
    customers?.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [customers]);

  const monthSales = useMemo(() => {
    if (!documents) return 0;
    return documents
      .filter((d) => (d.type === 'delivery' || d.type === 'invoice') && d.status !== 'draft' && d.issueDate.startsWith(thisMonth))
      .reduce((sum, d) => sum + d.items.reduce((s, it) => s + itemAmount(it), 0), 0);
  }, [documents, thisMonth]);

  const receivablesTotal = useMemo(() => {
    if (!documents) return 0;
    const balances = calcReceivables(documents, company?.taxRounding ?? 'floor');
    let sum = 0;
    for (const b of balances.values()) sum += b.balance;
    return sum;
  }, [documents, company]);

  const draftCount = documents?.filter((d) => d.status === 'draft').length ?? 0;

  const recent = useMemo(() => {
    if (!documents) return [];
    return [...documents].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 8);
  }, [documents]);

  return (
    <div>
      <PageHeader title="ダッシュボード" subtitle={`本日: ${formatDateJa(today)}`} />

      <div className="stat-grid">
        <div className="stat-card">
          <div className="stat-label">今月の売上(税抜)</div>
          <div className="stat-value">{formatMoney(monthSales)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">売掛残高合計</div>
          <div className="stat-value">{formatMoney(receivablesTotal)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">得意先数</div>
          <div className="stat-value">{customers?.length ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">商品数</div>
          <div className="stat-value">{products?.length ?? 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">下書き伝票</div>
          <div className="stat-value">{draftCount}</div>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">クイック作成</h2>
        <div className="quick-actions">
          <Link className="btn btn-secondary" to="/documents/quotation/new">
            + 見積書
          </Link>
          <Link className="btn btn-secondary" to="/documents/delivery/new">
            + 納品書
          </Link>
          <Link className="btn btn-secondary" to="/documents/invoice/new">
            + 請求書
          </Link>
          <Link className="btn btn-secondary" to="/documents/receipt/new">
            + 領収証
          </Link>
          <Link className="btn btn-secondary" to="/billing">
            締め処理
          </Link>
        </div>
      </div>

      <div className="card">
        <h2 className="section-title">最近更新した伝票</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>種別</th>
              <th>番号</th>
              <th>得意先</th>
              <th>状態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {recent.map((d) => (
              <tr key={d.id}>
                <td>{DOCUMENT_TYPE_LABEL[d.type as DocumentType]}</td>
                <td>{d.number}</td>
                <td>{customerMap.get(d.customerId) ?? '(不明)'}</td>
                <td>
                  <span className={`status-badge status-${d.status}`}>{DOCUMENT_STATUS_LABEL[d.status]}</span>
                </td>
                <td>
                  <Link className="link" to={`/documents/${d.type}/${d.id}`}>
                    開く
                  </Link>
                </td>
              </tr>
            ))}
            {recent.length === 0 && (
              <tr>
                <td colSpan={5} className="empty-row">
                  まだ伝票がありません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

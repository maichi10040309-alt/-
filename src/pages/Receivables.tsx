import { useMemo } from 'react';
import { useLiveQuery } from '../api/useLiveQuery';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import { calcReceivables } from '../utils/receivables';
import { formatMoney } from '../utils/format';

export default function Receivables() {
  const company = useLiveQuery(() => api.company.get(), []);
  const customers = useLiveQuery(() => api.customers.list(), []);
  const documents = useLiveQuery(() => api.documents.list(), []);

  const balances = useMemo(
    () => (documents ? calcReceivables(documents, company?.taxRounding ?? 'floor') : new Map()),
    [documents, company],
  );

  const rows = useMemo(() => {
    if (!customers) return [];
    return customers
      .map((c) => {
        const b = balances.get(c.id);
        return {
          customer: c,
          billedTotal: b?.billedTotal ?? 0,
          receiptTotal: b?.receiptTotal ?? 0,
          balance: b?.balance ?? 0,
        };
      })
      .filter((r) => r.billedTotal !== 0 || r.receiptTotal !== 0);
  }, [customers, balances]);

  const grandTotal = rows.reduce((sum, r) => sum + r.balance, 0);

  return (
    <div>
      <PageHeader title="売掛金一覧" subtitle="得意先ごとの請求額・入金額・売掛残高" />
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>得意先</th>
              <th>請求合計</th>
              <th>入金合計</th>
              <th>売掛残高</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.customer.id}>
                <td>{r.customer.name}</td>
                <td className="amount-cell">{formatMoney(r.billedTotal)}</td>
                <td className="amount-cell">{formatMoney(r.receiptTotal)}</td>
                <td className="amount-cell strong">{formatMoney(r.balance)}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={4} className="empty-row">
                  売掛データがありません。
                </td>
              </tr>
            )}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <th>合計</th>
                <td></td>
                <td></td>
                <td className="amount-cell strong">{formatMoney(grandTotal)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

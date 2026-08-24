import { useMemo, useState } from 'react';
import { useLiveQuery } from '../api/useLiveQuery';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import { formatMoney, addMonths, todayISO } from '../utils/format';
import { itemAmount } from '../utils/tax';

// 集計の二重計上を避けるため、実売上として扱うのは納品書と単発請求書のみ
// (合計請求書は納品書を束ねた請求のため、集計対象から除外する)
const SALES_TYPES = new Set(['delivery', 'invoice']);

export default function Reports() {
  const documents = useLiveQuery(() => api.documents.list(), []);
  const customers = useLiveQuery(() => api.customers.list(), []);

  const today = todayISO();
  const [from, setFrom] = useState(addMonths(today, -12).slice(0, 8) + '01');
  const [to, setTo] = useState(today);

  const customerMap = useMemo(() => {
    const m = new Map<string, string>();
    customers?.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [customers]);

  const salesDocs = useMemo(() => {
    if (!documents) return [];
    return documents.filter(
      (d) => SALES_TYPES.has(d.type) && d.status !== 'draft' && d.issueDate >= from && d.issueDate <= to,
    );
  }, [documents, from, to]);

  const byCustomer = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of salesDocs) {
      const total = d.items.reduce((s, it) => s + itemAmount(it), 0);
      m.set(d.customerId, (m.get(d.customerId) ?? 0) + total);
    }
    return Array.from(m.entries())
      .map(([customerId, amount]) => ({ name: customerMap.get(customerId) ?? '(不明)', amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 15);
  }, [salesDocs, customerMap]);

  const byProduct = useMemo(() => {
    const m = new Map<string, { amount: number; quantity: number }>();
    for (const d of salesDocs) {
      for (const it of d.items) {
        const key = it.name || '(未設定)';
        const cur = m.get(key) ?? { amount: 0, quantity: 0 };
        cur.amount += itemAmount(it);
        cur.quantity += it.quantity;
        m.set(key, cur);
      }
    }
    return Array.from(m.entries())
      .map(([name, v]) => ({ name, ...v }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 15);
  }, [salesDocs]);

  const byMonth = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of salesDocs) {
      const month = d.issueDate.slice(0, 7);
      const total = d.items.reduce((s, it) => s + itemAmount(it), 0);
      m.set(month, (m.get(month) ?? 0) + total);
    }
    return Array.from(m.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [salesDocs]);

  const grandTotal = salesDocs.reduce((s, d) => s + d.items.reduce((s2, it) => s2 + itemAmount(it), 0), 0);

  return (
    <div>
      <PageHeader title="売上集計・分析" subtitle="得意先別・商品別・期間別の売上集計(納品書・請求書ベース、税抜)" />

      <div className="card form-grid">
        <label>
          集計期間(開始)
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          集計期間(終了)
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <div className="hint">対象期間の売上合計(税抜): {formatMoney(grandTotal)}</div>
      </div>

      <div className="card">
        <h2 className="section-title">月別売上推移</h2>
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={byMonth}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis fontSize={12} tickFormatter={(v) => formatMoney(v)} width={90} />
            <Tooltip formatter={(v) => formatMoney(Number(v))} />
            <Line type="monotone" dataKey="amount" stroke="#2f6f4f" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="report-grid">
        <div className="card">
          <h2 className="section-title">得意先別売上(上位15件)</h2>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={byCustomer} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" fontSize={12} tickFormatter={(v) => formatMoney(v)} />
              <YAxis type="category" dataKey="name" fontSize={11} width={110} />
              <Tooltip formatter={(v) => formatMoney(Number(v))} />
              <Bar dataKey="amount" fill="#2f6f4f" />
            </BarChart>
          </ResponsiveContainer>
          <table className="data-table compact">
            <thead>
              <tr>
                <th>得意先</th>
                <th>売上金額</th>
              </tr>
            </thead>
            <tbody>
              {byCustomer.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="amount-cell">{formatMoney(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card">
          <h2 className="section-title">商品別売上(上位15件)</h2>
          <ResponsiveContainer width="100%" height={360}>
            <BarChart data={byProduct} layout="vertical" margin={{ left: 80 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" fontSize={12} tickFormatter={(v) => formatMoney(v)} />
              <YAxis type="category" dataKey="name" fontSize={11} width={110} />
              <Tooltip formatter={(v) => formatMoney(Number(v))} />
              <Bar dataKey="amount" fill="#a67c2e" />
            </BarChart>
          </ResponsiveContainer>
          <table className="data-table compact">
            <thead>
              <tr>
                <th>商品</th>
                <th>数量</th>
                <th>売上金額</th>
              </tr>
            </thead>
            <tbody>
              {byProduct.map((r) => (
                <tr key={r.name}>
                  <td>{r.name}</td>
                  <td className="amount-cell">{r.quantity}</td>
                  <td className="amount-cell">{formatMoney(r.amount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

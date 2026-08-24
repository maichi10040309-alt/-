import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import PageHeader from '../components/PageHeader';
import { parseCSV, toCSV, downloadCSV } from '../utils/csv';
import { newId } from '../utils/id';
import { formatMoney, todayISO } from '../utils/format';
import type { Product } from '../types';

const CSV_HEADERS = [
  '商品コード',
  '商品名',
  '分類',
  '単位',
  '税率',
  '単価1',
  '単価2',
  '単価3',
  '仕入原価',
  '備考',
];

export default function ProductList() {
  const products = useLiveQuery(() => db.products.orderBy('code').toArray(), []);
  const [keyword, setKeyword] = useState('');

  const filtered = useMemo(() => {
    if (!products) return [];
    const kw = keyword.trim().toLowerCase();
    if (!kw) return products;
    return products.filter(
      (p) => p.name.toLowerCase().includes(kw) || p.code.toLowerCase().includes(kw) || p.category.includes(kw),
    );
  }, [products, keyword]);

  const handleExport = () => {
    if (!products) return;
    const rows = products.map((p) => [
      p.code,
      p.name,
      p.category,
      p.unit,
      p.taxRate,
      p.prices.price1,
      p.prices.price2,
      p.prices.price3,
      p.prices.cost,
      p.notes,
    ]);
    downloadCSV(`商品台帳_${todayISO()}.csv`, toCSV(CSV_HEADERS, rows));
  };

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) return;
    const body = rows[0][0] === CSV_HEADERS[0] ? rows.slice(1) : rows;
    const now = new Date().toISOString();
    const records: Product[] = body
      .filter((r) => r.length > 1 && r[1])
      .map((r) => ({
        id: newId(),
        code: r[0] ?? '',
        name: r[1] ?? '',
        category: r[2] ?? '',
        unit: r[3] ?? '個',
        taxRate: (Number(r[4]) as 0 | 8 | 10) || 10,
        prices: {
          price1: Number(r[5]) || 0,
          price2: Number(r[6]) || 0,
          price3: Number(r[7]) || 0,
          cost: Number(r[8]) || 0,
        },
        notes: r[9] ?? '',
        createdAt: now,
        updatedAt: now,
      }));
    await db.products.bulkPut(records);
    alert(`${records.length}件の商品を取り込みました。`);
  };

  return (
    <div>
      <PageHeader
        title="商品台帳"
        subtitle="商品の登録・管理、複数単価の設定"
        actions={
          <>
            <input
              type="text"
              placeholder="商品名・コードで検索"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="search-input"
            />
            <button className="btn btn-secondary" onClick={handleExport}>
              CSVエクスポート
            </button>
            <label className="btn btn-secondary">
              CSVインポート
              <input
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportFile(file);
                  e.target.value = '';
                }}
              />
            </label>
            <Link className="btn btn-primary" to="/products/new">
              + 新規商品
            </Link>
          </>
        }
      />
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>コード</th>
              <th>商品名</th>
              <th>分類</th>
              <th>単位</th>
              <th>税率</th>
              <th>単価1</th>
              <th>単価2</th>
              <th>単価3</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td>{p.code}</td>
                <td>{p.name}</td>
                <td>{p.category}</td>
                <td>{p.unit}</td>
                <td>{p.taxRate}%</td>
                <td>{formatMoney(p.prices.price1)}</td>
                <td>{formatMoney(p.prices.price2)}</td>
                <td>{formatMoney(p.prices.price3)}</td>
                <td>
                  <Link className="link" to={`/products/${p.id}`}>
                    編集
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-row">
                  商品が登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

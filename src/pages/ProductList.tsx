import { useMemo, useState } from 'react';
import { useLiveQuery } from '../api/useLiveQuery';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import CsvImportButton, { type MappedValue } from '../components/CsvImportButton';
import SelectionToolbar from '../components/SelectionToolbar';
import { toCSV, downloadCSV } from '../utils/csv';
import { newId } from '../utils/id';
import { formatMoney, todayISO } from '../utils/format';
import type { ImportFieldDef } from '../utils/importMapping';
import type { Product, TaxRate } from '../types';

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

const IMPORT_FIELDS: ImportFieldDef[] = [
  { key: 'code', label: '商品コード', kind: 'text' },
  { key: 'name', label: '商品名', kind: 'text', required: true },
  { key: 'category', label: '分類', kind: 'text' },
  { key: 'unit', label: '単位', kind: 'text' },
  { key: 'taxRate', label: '税率', kind: 'taxRate' },
  { key: 'price1', label: '単価1', kind: 'number' },
  { key: 'price2', label: '単価2', kind: 'number' },
  { key: 'price3', label: '単価3', kind: 'number' },
  { key: 'cost', label: '仕入原価', kind: 'number' },
  { key: 'notes', label: '備考', kind: 'text' },
];

export default function ProductList() {
  const products = useLiveQuery(() => api.products.list(), []);
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

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

  const handleImport = async (mapped: Record<string, MappedValue>[]) => {
    const now = new Date().toISOString();
    const blankCodeCount = mapped.filter((r) => !String(r.code ?? '').trim()).length;
    const generatedCodes = blankCodeCount > 0 ? await api.products.nextCodeBatch(blankCodeCount) : [];
    let codeCursor = 0;

    const records: Product[] = mapped.map((r) => {
      const code = String(r.code ?? '').trim() || generatedCodes[codeCursor++];
      return {
        id: newId(),
        code,
        name: String(r.name ?? ''),
        category: String(r.category ?? ''),
        unit: String(r.unit ?? '個') || '個',
        taxRate: (r.taxRate as TaxRate | undefined) ?? 10,
        prices: {
          price1: Number(r.price1) || 0,
          price2: Number(r.price2) || 0,
          price3: Number(r.price3) || 0,
          cost: Number(r.cost) || 0,
        },
        notes: String(r.notes ?? ''),
        createdAt: now,
        updatedAt: now,
      };
    });
    await api.products.bulkPut(records);
  };

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selected.has(p.id));
  const toggleAll = () => {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((p) => next.delete(p.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`選択した${selected.size}件の商品を削除します。よろしいですか?`)) return;
    await api.products.bulkDelete(Array.from(selected));
    setSelected(new Set());
  };

  const handleDeleteAll = async () => {
    if (!products || products.length === 0) return;
    if (!confirm(`商品を全${products.length}件削除します。この操作は元に戻せません。よろしいですか?`)) return;
    await api.products.deleteAll();
    setSelected(new Set());
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
            <CsvImportButton label="CSVインポート" fields={IMPORT_FIELDS} onImport={handleImport} />
            <Link className="btn btn-primary" to="/products/new">
              + 新規商品
            </Link>
          </>
        }
      />
      <SelectionToolbar
        totalCount={products?.length ?? 0}
        selectedCount={selected.size}
        onDeleteSelected={handleDeleteSelected}
        onDeleteAll={handleDeleteAll}
      />
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th className="select-col">
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} />
              </th>
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
                <td className="select-col">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggle(p.id)} />
                </td>
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
                <td colSpan={10} className="empty-row">
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

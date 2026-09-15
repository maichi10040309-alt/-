import { useState } from 'react';
import type { AccountCategory, AppData } from '../types';
import { uuid } from '../storage';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

export function MasterAccountCategories({ data, updateData }: Props) {
  const [name, setName] = useState('');
  const [taxRate, setTaxRate] = useState<10 | 8 | 0>(10);

  const sorted = [...data.accountCategories].sort((a, b) => a.sortOrder - b.sortOrder);
  const usedIds = new Set(data.invoices.map((i) => i.accountCategoryId));

  function addCategory() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const cat: AccountCategory = { id: uuid(), name: trimmed, taxRate, sortOrder: sorted.length };
    updateData((prev) => ({ ...prev, accountCategories: [...prev.accountCategories, cat] }));
    setName('');
  }

  function remove(id: string) {
    if (usedIds.has(id)) {
      alert('この勘定科目は請求データで使用されているため削除できません。');
      return;
    }
    updateData((prev) => ({ ...prev, accountCategories: prev.accountCategories.filter((c) => c.id !== id) }));
  }

  function update(id: string, patch: Partial<AccountCategory>) {
    updateData((prev) => ({
      ...prev,
      accountCategories: prev.accountCategories.map((c) => (c.id === id ? { ...c, ...patch } : c)),
    }));
  }

  return (
    <div className="panel">
      <h2>勘定科目マスタ</h2>
      <p className="hint">仕入・消耗品費など請求を分類するための勘定科目と税率です。</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>科目名</th>
            <th>税率</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((c) => (
            <tr key={c.id}>
              <td>
                <input value={c.name} onChange={(e) => update(c.id, { name: e.target.value })} />
              </td>
              <td className="col-narrow">
                <select
                  value={c.taxRate}
                  onChange={(e) => update(c.id, { taxRate: Number(e.target.value) as 10 | 8 | 0 })}
                >
                  <option value={10}>10%</option>
                  <option value={8}>8%(軽減)</option>
                  <option value={0}>非課税</option>
                </select>
              </td>
              <td className="col-narrow">
                <button className="danger" onClick={() => remove(c.id)}>削除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="add-row">
        <input
          placeholder="新しい科目名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addCategory()}
        />
        <select value={taxRate} onChange={(e) => setTaxRate(Number(e.target.value) as 10 | 8 | 0)}>
          <option value={10}>10%</option>
          <option value={8}>8%(軽減)</option>
          <option value={0}>非課税</option>
        </select>
        <button onClick={addCategory}>追加</button>
      </div>
    </div>
  );
}

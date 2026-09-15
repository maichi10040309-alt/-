import { useState } from 'react';
import type { AppData, Department } from '../types';
import { uuid } from '../storage';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

export function MasterDepartments({ data, updateData }: Props) {
  const [name, setName] = useState('');

  const sorted = [...data.departments].sort((a, b) => a.sortOrder - b.sortOrder);
  const usedIds = new Set(data.invoices.map((i) => i.departmentId));

  function addDepartment() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const dept: Department = {
      id: uuid(),
      name: trimmed,
      sortOrder: sorted.length,
    };
    updateData((prev) => ({ ...prev, departments: [...prev.departments, dept] }));
    setName('');
  }

  function removeDepartment(id: string) {
    if (usedIds.has(id)) {
      alert('この部署は請求データで使用されているため削除できません。');
      return;
    }
    updateData((prev) => ({ ...prev, departments: prev.departments.filter((d) => d.id !== id) }));
  }

  function rename(id: string, newName: string) {
    updateData((prev) => ({
      ...prev,
      departments: prev.departments.map((d) => (d.id === id ? { ...d, name: newName } : d)),
    }));
  }

  function move(id: string, dir: -1 | 1) {
    const idx = sorted.findIndex((d) => d.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= sorted.length) return;
    const a = sorted[idx];
    const b = sorted[swapIdx];
    updateData((prev) => ({
      ...prev,
      departments: prev.departments.map((d) => {
        if (d.id === a.id) return { ...d, sortOrder: b.sortOrder };
        if (d.id === b.id) return { ...d, sortOrder: a.sortOrder };
        return d;
      }),
    }));
  }

  return (
    <div className="panel">
      <h2>部署マスタ</h2>
      <p className="hint">請求入力・振込データ作成・経費集計で使う部署(事業所・施設)の一覧です。</p>
      <table className="data-table">
        <thead>
          <tr>
            <th>並び替え</th>
            <th>部署名</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d, idx) => (
            <tr key={d.id}>
              <td className="col-narrow">
                <button onClick={() => move(d.id, -1)} disabled={idx === 0} title="上へ">▲</button>
                <button onClick={() => move(d.id, 1)} disabled={idx === sorted.length - 1} title="下へ">▼</button>
              </td>
              <td>
                <input value={d.name} onChange={(e) => rename(d.id, e.target.value)} />
              </td>
              <td className="col-narrow">
                <button className="danger" onClick={() => removeDepartment(d.id)}>削除</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="add-row">
        <input
          placeholder="新しい部署名"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addDepartment()}
        />
        <button onClick={addDepartment}>追加</button>
      </div>
    </div>
  );
}

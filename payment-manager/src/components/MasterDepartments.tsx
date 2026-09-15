import { Fragment, useState } from 'react';
import type { AppData, Department, Section } from '../types';
import { uuid } from '../storage';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

export function MasterDepartments({ data, updateData }: Props) {
  const [name, setName] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sorted = [...data.departments].sort((a, b) => a.sortOrder - b.sortOrder);
  const usedDeptIds = new Set(data.invoices.map((i) => i.departmentId));
  const usedSectionIds = new Set(data.invoices.map((i) => i.sectionId).filter((id): id is string => id !== null));

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
    if (usedDeptIds.has(id)) {
      alert('この部署は請求データで使用されているため削除できません。');
      return;
    }
    if (data.sections.some((s) => s.departmentId === id)) {
      alert('この部署には課が登録されています。先に課を削除してください。');
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

  function sectionsOf(deptId: string): Section[] {
    return data.sections.filter((s) => s.departmentId === deptId).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  function addSection(deptId: string, sectionName: string) {
    const trimmed = sectionName.trim();
    if (!trimmed) return;
    const sortOrder = sectionsOf(deptId).length;
    const section: Section = { id: uuid(), departmentId: deptId, name: trimmed, sortOrder };
    updateData((prev) => ({ ...prev, sections: [...prev.sections, section] }));
  }

  function renameSection(id: string, newName: string) {
    updateData((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => (s.id === id ? { ...s, name: newName } : s)),
    }));
  }

  function removeSection(id: string) {
    if (usedSectionIds.has(id)) {
      alert('この課は請求データで使用されているため削除できません。');
      return;
    }
    updateData((prev) => ({ ...prev, sections: prev.sections.filter((s) => s.id !== id) }));
  }

  function moveSection(deptId: string, id: string, dir: -1 | 1) {
    const list = sectionsOf(deptId);
    const idx = list.findIndex((s) => s.id === id);
    const swapIdx = idx + dir;
    if (idx < 0 || swapIdx < 0 || swapIdx >= list.length) return;
    const a = list[idx];
    const b = list[swapIdx];
    updateData((prev) => ({
      ...prev,
      sections: prev.sections.map((s) => {
        if (s.id === a.id) return { ...s, sortOrder: b.sortOrder };
        if (s.id === b.id) return { ...s, sortOrder: a.sortOrder };
        return s;
      }),
    }));
  }

  return (
    <div className="panel">
      <h2>部署マスタ</h2>
      <p className="hint">
        請求入力・振込データ作成・経費集計で使う部署(事業所・施設)の一覧です。1つの部署の中に複数の「課」がある場合
        (例: 給食部署の中に複数の施設がある等)は、「課を管理」から登録すると、請求入力で課ごとに分けて金額を入力できます。
      </p>
      <table className="data-table">
        <thead>
          <tr>
            <th>並び替え</th>
            <th>部署名</th>
            <th>課</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((d, idx) => {
            const sections = sectionsOf(d.id);
            return (
              <Fragment key={d.id}>
                <tr>
                  <td className="col-narrow">
                    <button onClick={() => move(d.id, -1)} disabled={idx === 0} title="上へ">▲</button>
                    <button onClick={() => move(d.id, 1)} disabled={idx === sorted.length - 1} title="下へ">▼</button>
                  </td>
                  <td>
                    <input value={d.name} onChange={(e) => rename(d.id, e.target.value)} />
                  </td>
                  <td>{sections.length > 0 ? `${sections.length}件` : '-'}</td>
                  <td className="col-narrow">
                    <button onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}>
                      {expandedId === d.id ? '閉じる' : '課を管理'}
                    </button>{' '}
                    <button className="danger" onClick={() => removeDepartment(d.id)}>削除</button>
                  </td>
                </tr>
                {expandedId === d.id && (
                  <tr>
                    <td colSpan={4}>
                      <SectionEditor
                        sections={sections}
                        onAdd={(sectionName) => addSection(d.id, sectionName)}
                        onRename={renameSection}
                        onRemove={removeSection}
                        onMove={(id, dir) => moveSection(d.id, id, dir)}
                      />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
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

interface SectionEditorProps {
  sections: Section[];
  onAdd: (name: string) => void;
  onRename: (id: string, name: string) => void;
  onRemove: (id: string) => void;
  onMove: (id: string, dir: -1 | 1) => void;
}

function SectionEditor({ sections, onAdd, onRename, onRemove, onMove }: SectionEditorProps) {
  const [name, setName] = useState('');

  function submit() {
    if (!name.trim()) return;
    onAdd(name);
    setName('');
  }

  return (
    <div className="section-editor">
      {sections.length === 0 && <p className="hint">この部署にはまだ課が登録されていません。</p>}
      {sections.map((s, idx) => (
        <div className="section-row" key={s.id}>
          <button onClick={() => onMove(s.id, -1)} disabled={idx === 0} title="上へ">▲</button>
          <button onClick={() => onMove(s.id, 1)} disabled={idx === sections.length - 1} title="下へ">▼</button>
          <input value={s.name} onChange={(e) => onRename(s.id, e.target.value)} />
          <button className="danger" onClick={() => onRemove(s.id)}>削除</button>
        </div>
      ))}
      <div className="add-row">
        <input
          placeholder="新しい課名(例: 紀三井寺苑)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
        />
        <button onClick={submit}>課を追加</button>
      </div>
    </div>
  );
}

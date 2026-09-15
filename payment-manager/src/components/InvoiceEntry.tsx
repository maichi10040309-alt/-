import { useMemo, useState } from 'react';
import type { AppData, Invoice } from '../types';
import { uuid } from '../storage';
import { currentYearMonth, formatYen } from '../utils/format';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const ALL_DEPARTMENTS = '__all__';

export function InvoiceEntry({ data, updateData }: Props) {
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [deptTab, setDeptTab] = useState<string>(data.departments[0]?.id ?? ALL_DEPARTMENTS);

  const departments = [...data.departments].sort((a, b) => a.sortOrder - b.sortOrder);
  const accountCategories = [...data.accountCategories].sort((a, b) => a.sortOrder - b.sortOrder);
  const hasAnySections = data.sections.length > 0;

  function sectionsForDepartment(departmentId: string) {
    return data.sections.filter((s) => s.departmentId === departmentId).sort((a, b) => a.sortOrder - b.sortOrder);
  }

  const rows = useMemo(() => {
    return data.invoices
      .filter((inv) => inv.yearMonth === yearMonth)
      .filter((inv) => deptTab === ALL_DEPARTMENTS || inv.departmentId === deptTab)
      .sort((a, b) => {
        const va = data.vendors.find((v) => v.id === a.vendorId)?.name ?? '';
        const vb = data.vendors.find((v) => v.id === b.vendorId)?.name ?? '';
        return va.localeCompare(vb, 'ja');
      });
  }, [data.invoices, data.vendors, yearMonth, deptTab]);

  const vendorsForTab = useMemo(() => {
    const list = [...data.vendors];
    return list.sort((a, b) => a.name.localeCompare(b.name, 'ja'));
  }, [data.vendors]);

  function addRow() {
    if (data.vendors.length === 0) {
      alert('先に「マスタ管理」タブで取引先を登録してください。');
      return;
    }
    if (data.accountCategories.length === 0) {
      alert('先に「マスタ管理」タブで勘定科目を登録してください。');
      return;
    }
    const departmentId = deptTab === ALL_DEPARTMENTS ? departments[0]?.id ?? '' : deptTab;
    if (!departmentId) {
      alert('先に「マスタ管理」タブで部署を登録してください。');
      return;
    }
    const defaultSection = sectionsForDepartment(departmentId)[0];
    const newInvoice: Invoice = {
      id: uuid(),
      yearMonth,
      departmentId,
      sectionId: defaultSection ? defaultSection.id : null,
      vendorId: vendorsForTab[0].id,
      accountCategoryId: accountCategories[0].id,
      billedAmount: 0,
      paidAmount: 0,
      carriedOverAmount: 0,
      note: '',
      isPaid: false,
      paidDate: null,
    };
    updateData((prev) => ({ ...prev, invoices: [...prev.invoices, newInvoice] }));
  }

  function update(id: string, patch: Partial<Invoice>) {
    updateData((prev) => ({
      ...prev,
      invoices: prev.invoices.map((inv) => (inv.id === id ? { ...inv, ...patch } : inv)),
    }));
  }

  function remove(id: string) {
    if (!confirm('この明細を削除しますか?')) return;
    updateData((prev) => ({ ...prev, invoices: prev.invoices.filter((inv) => inv.id !== id) }));
  }

  const totalBilled = rows.reduce((sum, r) => sum + r.billedAmount, 0);
  const totalPaid = rows.reduce((sum, r) => sum + r.paidAmount, 0);

  return (
    <div>
      <div className="toolbar">
        <label>
          対象年月
          <input
            type="month"
            value={yearMonth}
            onChange={(e) => setYearMonth(e.target.value)}
          />
        </label>
      </div>
      <div className="subtabs">
        <button className={deptTab === ALL_DEPARTMENTS ? 'active' : ''} onClick={() => setDeptTab(ALL_DEPARTMENTS)}>
          全部署
        </button>
        {departments.map((d) => (
          <button key={d.id} className={deptTab === d.id ? 'active' : ''} onClick={() => setDeptTab(d.id)}>
            {d.name}
          </button>
        ))}
      </div>
      <div className="panel">
        <table className="data-table">
          <thead>
            <tr>
              {deptTab === ALL_DEPARTMENTS && <th>部署</th>}
              {hasAnySections && <th>課</th>}
              <th>業者名</th>
              <th>勘定科目</th>
              <th>請求額</th>
              <th>繰越額</th>
              <th>支払額</th>
              <th>備考</th>
              <th>支払済</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((inv) => {
              const vendor = data.vendors.find((v) => v.id === inv.vendorId);
              const rowSections = sectionsForDepartment(inv.departmentId);
              return (
                <tr key={inv.id}>
                  {deptTab === ALL_DEPARTMENTS && (
                    <td>
                      <select
                        value={inv.departmentId}
                        onChange={(e) => {
                          const nextDept = e.target.value;
                          const nextSection = sectionsForDepartment(nextDept)[0];
                          update(inv.id, { departmentId: nextDept, sectionId: nextSection ? nextSection.id : null });
                        }}
                      >
                        {departments.map((d) => (
                          <option key={d.id} value={d.id}>{d.name}</option>
                        ))}
                      </select>
                    </td>
                  )}
                  {hasAnySections && (
                    <td>
                      {rowSections.length > 0 ? (
                        <select value={inv.sectionId ?? ''} onChange={(e) => update(inv.id, { sectionId: e.target.value || null })}>
                          {rowSections.map((s) => (
                            <option key={s.id} value={s.id}>{s.name}</option>
                          ))}
                        </select>
                      ) : (
                        '-'
                      )}
                    </td>
                  )}
                  <td>
                    <select value={inv.vendorId} onChange={(e) => update(inv.id, { vendorId: e.target.value })}>
                      {vendorsForTab.map((v) => (
                        <option key={v.id} value={v.id}>{v.name || '(未設定)'}</option>
                      ))}
                    </select>
                    {!vendor?.name && <span className="badge badge-warn">要設定</span>}
                  </td>
                  <td>
                    <select value={inv.accountCategoryId} onChange={(e) => update(inv.id, { accountCategoryId: e.target.value })}>
                      {accountCategories.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}({c.taxRate}%)</option>
                      ))}
                    </select>
                  </td>
                  <td className="col-amount">
                    <input
                      type="number"
                      value={inv.billedAmount}
                      onChange={(e) => {
                        const billed = Number(e.target.value);
                        const patch: Partial<Invoice> = { billedAmount: billed };
                        if (inv.paidAmount === 0) patch.paidAmount = billed;
                        update(inv.id, patch);
                      }}
                    />
                  </td>
                  <td className="col-amount">
                    <input
                      type="number"
                      value={inv.carriedOverAmount}
                      onChange={(e) => update(inv.id, { carriedOverAmount: Number(e.target.value) })}
                    />
                  </td>
                  <td className="col-amount">
                    <input
                      type="number"
                      value={inv.paidAmount}
                      onChange={(e) => update(inv.id, { paidAmount: Number(e.target.value) })}
                    />
                  </td>
                  <td>
                    <input value={inv.note} onChange={(e) => update(inv.id, { note: e.target.value })} />
                  </td>
                  <td className="col-narrow">
                    <input
                      type="checkbox"
                      checked={inv.isPaid}
                      onChange={(e) => update(inv.id, { isPaid: e.target.checked })}
                    />
                  </td>
                  <td className="col-narrow">
                    <button className="danger" onClick={() => remove(inv.id)}>削除</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={(deptTab === ALL_DEPARTMENTS ? 1 : 0) + (hasAnySections ? 1 : 0) + 2}>合計</td>
                <td className="col-amount">{formatYen(totalBilled)}</td>
                <td></td>
                <td className="col-amount">{formatYen(totalPaid)}</td>
                <td colSpan={3}></td>
              </tr>
            </tfoot>
          )}
        </table>
        <button onClick={addRow}>+ 明細を追加</button>
        {rows.length === 0 && <p className="hint">この年月・部署の請求明細はまだありません。</p>}
      </div>
    </div>
  );
}

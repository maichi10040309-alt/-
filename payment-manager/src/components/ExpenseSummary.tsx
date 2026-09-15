import { useMemo, useState } from 'react';
import type { AppData } from '../types';
import { downloadCsv } from '../utils/csv';
import { currentYearMonth, formatYen, formatYearMonthLabel } from '../utils/format';

interface Props {
  data: AppData;
}

function monthsInRange(from: string, to: string): string[] {
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  const start = new Date(fy, fm - 1, 1);
  const end = new Date(ty, tm - 1, 1);
  const result: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    result.push(`${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`);
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return result;
}

export function ExpenseSummary({ data }: Props) {
  const thisMonth = currentYearMonth();
  const [fromMonth, setFromMonth] = useState(thisMonth);
  const [toMonth, setToMonth] = useState(thisMonth);
  const [deptFilter, setDeptFilter] = useState<string>('__all__');

  const months = useMemo(() => monthsInRange(fromMonth, toMonth), [fromMonth, toMonth]);
  const monthSet = new Set(months);

  const departments = [...data.departments].sort((a, b) => a.sortOrder - b.sortOrder);
  const accountCategories = [...data.accountCategories].sort((a, b) => a.sortOrder - b.sortOrder);

  const filtered = useMemo(
    () =>
      data.invoices.filter(
        (inv) => monthSet.has(inv.yearMonth) && (deptFilter === '__all__' || inv.departmentId === deptFilter)
      ),
    [data.invoices, monthSet, deptFilter]
  );

  const totalBilled = filtered.reduce((s, i) => s + i.billedAmount, 0);
  const totalPaid = filtered.reduce((s, i) => s + i.paidAmount, 0);

  const byDepartment = useMemo(() => {
    return departments
      .map((d) => {
        const rows = filtered.filter((i) => i.departmentId === d.id);
        return {
          id: d.id,
          name: d.name,
          billed: rows.reduce((s, i) => s + i.billedAmount, 0),
          paid: rows.reduce((s, i) => s + i.paidAmount, 0),
        };
      })
      .filter((r) => deptFilter === r.id || r.billed !== 0 || r.paid !== 0);
  }, [departments, filtered, deptFilter]);

  const byAccount = useMemo(() => {
    return accountCategories
      .map((c) => {
        const rows = filtered.filter((i) => i.accountCategoryId === c.id);
        return {
          id: c.id,
          name: c.name,
          billed: rows.reduce((s, i) => s + i.billedAmount, 0),
          paid: rows.reduce((s, i) => s + i.paidAmount, 0),
        };
      })
      .filter((r) => r.billed !== 0 || r.paid !== 0);
  }, [accountCategories, filtered]);

  const maxDeptBilled = Math.max(1, ...byDepartment.map((r) => r.billed));

  const crosstab = useMemo(() => {
    return departments.map((d) => ({
      deptId: d.id,
      deptName: d.name,
      cells: accountCategories.map((c) => {
        const sum = filtered
          .filter((i) => i.departmentId === d.id && i.accountCategoryId === c.id)
          .reduce((s, i) => s + i.billedAmount, 0);
        return { accountId: c.id, amount: sum };
      }),
      total: filtered.filter((i) => i.departmentId === d.id).reduce((s, i) => s + i.billedAmount, 0),
    }));
  }, [departments, accountCategories, filtered]);

  function exportCrosstab() {
    const headers = ['部署', ...accountCategories.map((c) => c.name), '合計'];
    const rows = crosstab.map((r) => [r.deptName, ...r.cells.map((c) => c.amount), r.total]);
    downloadCsv(`経費集計_${fromMonth}_${toMonth}.csv`, headers, rows);
  }

  return (
    <div>
      <div className="toolbar">
        <label>
          期間(開始)
          <input type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} />
        </label>
        <label>
          期間(終了)
          <input type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)} />
        </label>
        <label>
          部署
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="__all__">全部署</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="summary-cards">
        <div className="summary-card">
          <div className="summary-label">対象期間</div>
          <div className="summary-value">
            {formatYearMonthLabel(fromMonth)} 〜 {formatYearMonthLabel(toMonth)}
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-label">合計請求額</div>
          <div className="summary-value">{formatYen(totalBilled)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">合計支払額</div>
          <div className="summary-value">{formatYen(totalPaid)}</div>
        </div>
        <div className="summary-card">
          <div className="summary-label">明細件数</div>
          <div className="summary-value">{filtered.length}件</div>
        </div>
      </div>

      <div className="panel">
        <h2>部署別集計(請求額)</h2>
        {byDepartment.length === 0 && <p className="hint">データがありません。</p>}
        <div className="bar-list">
          {byDepartment.map((r) => (
            <div className="bar-row" key={r.id}>
              <div className="bar-label">{r.name}</div>
              <div className="bar-track">
                <div className="bar-fill" style={{ width: `${(r.billed / maxDeptBilled) * 100}%` }} />
              </div>
              <div className="bar-value">{formatYen(r.billed)}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="panel">
        <h2>勘定科目別集計(請求額)</h2>
        <table className="data-table">
          <thead>
            <tr>
              <th>勘定科目</th>
              <th>請求額</th>
              <th>支払額</th>
            </tr>
          </thead>
          <tbody>
            {byAccount.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="col-amount">{formatYen(r.billed)}</td>
                <td className="col-amount">{formatYen(r.paid)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {byAccount.length === 0 && <p className="hint">データがありません。</p>}
      </div>

      <div className="panel">
        <h2>部署 × 勘定科目 クロス集計(請求額)</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr>
                <th>部署</th>
                {accountCategories.map((c) => (
                  <th key={c.id}>{c.name}</th>
                ))}
                <th>合計</th>
              </tr>
            </thead>
            <tbody>
              {crosstab.map((r) => (
                <tr key={r.deptId}>
                  <td>{r.deptName}</td>
                  {r.cells.map((c) => (
                    <td key={c.accountId} className="col-amount">{c.amount ? formatYen(c.amount) : '-'}</td>
                  ))}
                  <td className="col-amount"><strong>{formatYen(r.total)}</strong></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button onClick={exportCrosstab}>CSVでダウンロード</button>
      </div>
    </div>
  );
}

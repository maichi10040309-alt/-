import { useMemo, useState } from 'react';
import type { AppData } from '../types';
import { buildZenginTransferFile, type TransferItem } from '../utils/zengin';
import { downloadCsv, downloadTextFile } from '../utils/csv';
import { currentYearMonth, formatYen, formatYearMonthLabel } from '../utils/format';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

const ALL_DEPARTMENTS = '__all__';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function TransferExport({ data, updateData }: Props) {
  const [yearMonth, setYearMonth] = useState(currentYearMonth());
  const [deptFilter, setDeptFilter] = useState<string>(ALL_DEPARTMENTS);
  const [transferDate, setTransferDate] = useState(todayIso());
  const [includePaid, setIncludePaid] = useState(false);
  const [markPaidOnDownload, setMarkPaidOnDownload] = useState(true);

  const targetInvoices = useMemo(() => {
    return data.invoices.filter(
      (inv) =>
        inv.yearMonth === yearMonth &&
        (deptFilter === ALL_DEPARTMENTS || inv.departmentId === deptFilter) &&
        (includePaid || !inv.isPaid) &&
        inv.paidAmount > 0
    );
  }, [data.invoices, yearMonth, deptFilter, includePaid]);

  const byVendor = useMemo(() => {
    const map = new Map<string, { vendorId: string; amount: number; invoiceIds: string[] }>();
    for (const inv of targetInvoices) {
      const entry = map.get(inv.vendorId) ?? { vendorId: inv.vendorId, amount: 0, invoiceIds: [] };
      entry.amount += inv.paidAmount;
      entry.invoiceIds.push(inv.id);
      map.set(inv.vendorId, entry);
    }
    return [...map.values()].sort((a, b) => {
      const va = data.vendors.find((v) => v.id === a.vendorId)?.name ?? '';
      const vb = data.vendors.find((v) => v.id === b.vendorId)?.name ?? '';
      return va.localeCompare(vb, 'ja');
    });
  }, [targetInvoices, data.vendors]);

  const rows = byVendor.map((entry) => {
    const vendor = data.vendors.find((v) => v.id === entry.vendorId);
    const ready = Boolean(
      vendor &&
        vendor.bankCode &&
        vendor.bankNameKana &&
        vendor.branchCode &&
        vendor.branchNameKana &&
        vendor.accountNumber &&
        vendor.payeeKana
    );
    return { ...entry, vendor, ready };
  });

  const totalAmount = rows.reduce((sum, r) => sum + r.amount, 0);
  const notReadyCount = rows.filter((r) => !r.ready).length;

  function markInvoicesPaid(invoiceIds: string[]) {
    const idSet = new Set(invoiceIds);
    updateData((prev) => ({
      ...prev,
      invoices: prev.invoices.map((inv) =>
        idSet.has(inv.id) ? { ...inv, isPaid: true, paidDate: transferDate } : inv
      ),
    }));
  }

  function handleZenginDownload() {
    const readyRows = rows.filter((r) => r.ready && r.vendor);
    if (readyRows.length === 0) {
      alert('振込先情報(銀行コード・支店コード・口座番号・受取人名カナ)が登録済みの取引先がありません。');
      return;
    }
    const items: TransferItem[] = readyRows.map((r) => ({
      vendorName: r.vendor!.name,
      bankCode: r.vendor!.bankCode,
      bankNameKana: r.vendor!.bankNameKana,
      branchCode: r.vendor!.branchCode,
      branchNameKana: r.vendor!.branchNameKana,
      accountType: r.vendor!.accountType,
      accountNumber: r.vendor!.accountNumber,
      payeeKana: r.vendor!.payeeKana,
      amount: r.amount,
    }));
    const date = new Date(transferDate);
    const result = buildZenginTransferFile(data.companySettings, date, items);
    if (!result.ok || !result.bytes) {
      alert(`全銀データの作成に失敗しました:\n${result.errors.join('\n')}`);
      return;
    }
    const filename = `zengin_${yearMonth}_${transferDate}.txt`;
    downloadTextFile(filename, result.bytes, 'text/plain');
    if (markPaidOnDownload) {
      const includedIds = readyRows.flatMap((r) => r.invoiceIds);
      markInvoicesPaid(includedIds);
    }
  }

  function handleCsvDownload() {
    const headers = ['業者名', '銀行名', '銀行コード', '支店名', '支店コード', '預金種目', '口座番号', '受取人名カナ', '振込金額', '振込先情報'];
    const csvRows = rows.map((r) => [
      r.vendor?.name ?? '(不明)',
      r.vendor?.bankName ?? '',
      r.vendor?.bankCode ?? '',
      r.vendor?.branchName ?? '',
      r.vendor?.branchCode ?? '',
      r.vendor?.accountType === 'checking' ? '当座' : '普通',
      r.vendor?.accountNumber ?? '',
      r.vendor?.payeeKana ?? '',
      r.amount,
      r.ready ? '登録済み' : '未登録',
    ]);
    downloadCsv(`振込一覧_${yearMonth}.csv`, headers, csvRows);
  }

  return (
    <div>
      <div className="toolbar">
        <label>
          対象年月
          <input type="month" value={yearMonth} onChange={(e) => setYearMonth(e.target.value)} />
        </label>
        <label>
          部署
          <select value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value={ALL_DEPARTMENTS}>全部署</option>
            {data.departments.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </label>
        <label>
          振込指定日
          <input type="date" value={transferDate} onChange={(e) => setTransferDate(e.target.value)} />
        </label>
        <label className="checkbox-label">
          <input type="checkbox" checked={includePaid} onChange={(e) => setIncludePaid(e.target.checked)} />
          支払済みの明細も含める
        </label>
      </div>

      <div className="panel">
        <h2>{formatYearMonthLabel(yearMonth)} 振込対象一覧</h2>
        {notReadyCount > 0 && (
          <p className="warning">
            {notReadyCount}件の取引先で振込先情報(銀行コード等)が未登録です。全銀データにはこれらを含められません。
            「マスタ管理」→「取引先」で登録してください。
          </p>
        )}
        <table className="data-table">
          <thead>
            <tr>
              <th>業者名</th>
              <th>銀行/支店</th>
              <th>口座番号</th>
              <th>振込金額</th>
              <th>状態</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.vendorId}>
                <td>{r.vendor?.name ?? '(不明な取引先)'}</td>
                <td>{r.vendor ? `${r.vendor.bankName} ${r.vendor.branchName}` : '-'}</td>
                <td>{r.vendor?.accountNumber || '-'}</td>
                <td className="col-amount">{formatYen(r.amount)}</td>
                <td>
                  {r.ready ? <span className="badge badge-ok">OK</span> : <span className="badge badge-warn">要登録</span>}
                </td>
              </tr>
            ))}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={3}>合計</td>
                <td className="col-amount">{formatYen(totalAmount)}</td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
        {rows.length === 0 && <p className="hint">対象の支払データがありません。</p>}

        <div className="action-row">
          <label className="checkbox-label">
            <input type="checkbox" checked={markPaidOnDownload} onChange={(e) => setMarkPaidOnDownload(e.target.checked)} />
            全銀データダウンロード後、対象明細を「支払済み」にする
          </label>
        </div>
        <div className="action-row">
          <button className="primary" onClick={handleZenginDownload}>全銀形式ファイルをダウンロード(ネットバンキング取込用)</button>
          <button onClick={handleCsvDownload}>CSVでダウンロード</button>
        </div>
        <p className="hint">
          ※ 全銀形式(総合振込)は多くの金融機関のネットバンキングで利用できる標準フォーマットですが、
          銀行によって取込条件が異なる場合があります。初回はテスト振込等で必ず動作確認してください。
        </p>
      </div>
    </div>
  );
}

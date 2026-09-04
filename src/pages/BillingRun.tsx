import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from '../api/useLiveQuery';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import CustomerPicker from '../components/CustomerPicker';
import { newId } from '../utils/id';
import { todayISO, addDays, formatDateJa, formatMoney } from '../utils/format';
import { calcDocumentTotals } from '../utils/tax';
import { calcReceivables } from '../utils/receivables';
import type { SalesDocument } from '../types';

function firstDayOfMonth(iso: string) {
  return iso.slice(0, 8) + '01';
}

export default function BillingRun() {
  const navigate = useNavigate();
  const company = useLiveQuery(() => api.company.get(), []);
  const customers = useLiveQuery(() => api.customers.list(), []);
  const allDocuments = useLiveQuery(() => api.documents.list(), []);

  const today = todayISO();
  const [customerId, setCustomerId] = useState<string>('');
  const [periodFrom, setPeriodFrom] = useState(firstDayOfMonth(today));
  const [periodTo, setPeriodTo] = useState(today);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);

  const rounding = company?.taxRounding ?? 'floor';

  const receivables = useMemo(
    () => (allDocuments ? calcReceivables(allDocuments, rounding) : new Map()),
    [allDocuments, rounding],
  );

  const customerMap = useMemo(() => {
    const m = new Map<string, string>();
    customers?.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [customers]);

  const customerCodeMap = useMemo(() => {
    const m = new Map<string, string>();
    customers?.forEach((c) => m.set(c.id, c.code));
    return m;
  }, [customers]);

  // 得意先コード順(未登録の得意先は末尾)に並べ、同じ得意先内は納品日順にする
  const eligibleDeliveries = useMemo(() => {
    if (!allDocuments) return [];
    const filtered = allDocuments.filter(
      (d) =>
        d.type === 'delivery' &&
        d.status === 'issued' &&
        (!customerId || d.customerId === customerId) &&
        d.issueDate >= periodFrom &&
        d.issueDate <= periodTo,
    );
    return filtered.sort((a, b) => {
      const codeA = customerCodeMap.get(a.customerId) ?? '';
      const codeB = customerCodeMap.get(b.customerId) ?? '';
      if (codeA !== codeB) return codeA.localeCompare(codeB);
      return a.issueDate.localeCompare(b.issueDate);
    });
  }, [allDocuments, customerId, periodFrom, periodTo, customerCodeMap]);

  const handleSearch = () => {
    setSelectedIds(new Set(eligibleDeliveries.map((d) => d.id)));
    setSearched(true);
  };

  const toggle = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedDocs = eligibleDeliveries.filter((d) => selectedIds.has(d.id));
  const byCustomer = useMemo(() => {
    const m = new Map<string, typeof selectedDocs>();
    for (const d of selectedDocs) {
      if (!m.has(d.customerId)) m.set(d.customerId, []);
      m.get(d.customerId)!.push(d);
    }
    return m;
  }, [selectedDocs]);

  const [issuing, setIssuing] = useState(false);

  // 発行処理の途中でタブを閉じたりページを移動したりすると、その時点までしか
  // 発行されず「何件かしか作成されていない」状態になってしまうため、処理中は警告を出す
  useEffect(() => {
    if (!issuing) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [issuing]);

  const handleIssue = async () => {
    if (selectedDocs.length === 0) {
      alert('対象の納品書を選択してください。');
      return;
    }
    if (!confirm(`${byCustomer.size}件の得意先に対して合計請求書を発行します。よろしいですか?`)) return;

    setIssuing(true);
    try {
      const now = new Date().toISOString();
      // 請求書の発行日は締め処理を実行した日ではなく、対象期間の締め日(終了日)にする
      const issueDate = periodTo;
      const entries = Array.from(byCustomer.entries());

      // 伝票番号は1件ずつサーバーに問い合わせると得意先数が多い場合に非常に時間がかかるため、
      // 必要な件数をまとめて予約する
      const numbers = await api.documents.issueNumbers('consolidated_invoice', issueDate, entries.length);

      const newInvoices: SalesDocument[] = [];
      const closedDeliveries: SalesDocument[] = [];

      entries.forEach(([custId, docs], i) => {
        const customer = customers?.find((c) => c.id === custId);
        const items = docs.flatMap((d) => d.items.map((it) => ({ ...it, id: newId() })));
        const balance = receivables.get(custId);
        const sourceSummaries = docs.map((d) => ({
          date: d.issueDate,
          number: d.number,
          title: d.title,
          subtotal: calcDocumentTotals(d.items, rounding).subtotal,
        }));

        const newDoc: SalesDocument = {
          id: newId(),
          type: 'consolidated_invoice',
          number: numbers[i],
          customerId: custId,
          issueDate,
          validUntilDate: '',
          dueDate: addDays(issueDate, customer?.paymentDay ? 30 : 30),
          title: `${formatDateJa(periodFrom)}〜${formatDateJa(periodTo)} ご利用分`,
          items,
          notes: '',
          status: 'issued',
          sourceDocumentIds: docs.map((d) => d.id),
          convertedToDocumentId: null,
          periodFrom,
          periodTo,
          previousBalance: balance?.balance ?? 0,
          paymentsAmount: 0,
          deliveryTag: '',
          paid: false,
          paidDate: '',
          bankFee: 0,
          sourceSummaries,
          createdAt: now,
          updatedAt: now,
        };
        newInvoices.push(newDoc);
        docs.forEach((d) => closedDeliveries.push({ ...d, status: 'closed', convertedToDocumentId: newDoc.id, updatedAt: now }));
      });

      // 得意先ごとに数回ずつリクエストを送っていた以前の方式は、得意先数が多い場合に
      // 保存のたびサーバー側でデータ全体を書き出す処理が積み重なり、非常に時間がかかって
      // いた(数十件の得意先で数分かかることもあった)。作成する請求書と、請求済みにする
      // 納品書をすべてまとめて1回のリクエストで送ることで、保存処理を1回で済ませる。
      await api.documents.bulkPut([...newInvoices, ...closedDeliveries]);

      alert(`${newInvoices.length}件の合計請求書を発行しました。`);
      navigate('/documents/consolidated_invoice');
    } catch (err) {
      console.error('合計請求書の発行に失敗しました:', err);
      alert(
        '合計請求書の発行に失敗しました。請求書は作成されていません。\n' +
          `エラー内容: ${err instanceof Error ? err.message : String(err)}\n` +
          'もう一度お試しください。',
      );
    } finally {
      setIssuing(false);
    }
  };

  return (
    <div>
      <PageHeader
        title="締め処理"
        subtitle="対象期間の納品書をまとめて合計請求書を発行します"
      />

      <div className="card form-grid">
        <label>
          得意先
          <CustomerPicker
            customers={customers ?? []}
            value={customerId}
            onChange={setCustomerId}
            placeholder="全得意先(未入力で全件対象)"
          />
        </label>
        <label>
          対象期間(開始)
          <input type="date" value={periodFrom} onChange={(e) => setPeriodFrom(e.target.value)} />
        </label>
        <label>
          対象期間(終了)
          <input type="date" value={periodTo} onChange={(e) => setPeriodTo(e.target.value)} />
        </label>
        <div className="form-actions-inline">
          <button className="btn btn-primary" onClick={handleSearch} disabled={issuing}>
            対象の納品書を検索
          </button>
        </div>
      </div>

      {issuing && (
        <div className="card billing-progress">
          合計請求書を発行しています...
          <div className="billing-progress-note">
            完了するまでこのタブを閉じたり、他の画面に移動したりしないでください。
          </div>
        </div>
      )}

      {searched && (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: 32 }}></th>
                <th>納品書番号</th>
                <th>発行日</th>
                <th>得意先</th>
                <th>件名</th>
                <th>金額</th>
              </tr>
            </thead>
            <tbody>
              {eligibleDeliveries.map((d) => {
                const totals = calcDocumentTotals(d.items, rounding);
                return (
                  <tr key={d.id}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(d.id)}
                        onChange={() => toggle(d.id)}
                        disabled={issuing}
                      />
                    </td>
                    <td>{d.number}</td>
                    <td>{formatDateJa(d.issueDate)}</td>
                    <td>
                      {customerCodeMap.get(d.customerId) ? `${customerCodeMap.get(d.customerId)} ` : ''}
                      {customerMap.get(d.customerId) ?? '(不明)'}
                    </td>
                    <td>{d.title}</td>
                    <td className="amount-cell">{formatMoney(totals.grandTotal)}</td>
                  </tr>
                );
              })}
              {eligibleDeliveries.length === 0 && (
                <tr>
                  <td colSpan={6} className="empty-row">
                    対象期間に未請求の納品書はありません。
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {byCustomer.size > 0 && (
            <div className="billing-summary">
              <div>選択中: {selectedDocs.length}件の納品書 / {byCustomer.size}件の得意先</div>
              <button className="btn btn-primary" onClick={handleIssue} disabled={issuing}>
                {issuing ? '発行中...' : '合計請求書を一括発行'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useNavigate } from 'react-router-dom';
import { db } from '../db/db';
import PageHeader from '../components/PageHeader';
import { newId } from '../utils/id';
import { todayISO, addDays, formatDateJa, formatMoney } from '../utils/format';
import { calcDocumentTotals } from '../utils/tax';
import { calcReceivables } from '../utils/receivables';
import { issueDocumentNumber } from '../utils/docNumber';
import type { SalesDocument } from '../types';

function firstDayOfMonth(iso: string) {
  return iso.slice(0, 8) + '01';
}

export default function BillingRun() {
  const navigate = useNavigate();
  const company = useLiveQuery(() => db.company.get(1), []);
  const customers = useLiveQuery(() => db.customers.orderBy('code').toArray(), []);
  const allDocuments = useLiveQuery(() => db.documents.toArray(), []);

  const today = todayISO();
  const [customerId, setCustomerId] = useState<string>('');
  const [periodFrom, setPeriodFrom] = useState(firstDayOfMonth(today));
  const [periodTo, setPeriodTo] = useState(today);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [searched, setSearched] = useState(false);

  const rounding = company?.taxRounding ?? 'floor';

  const eligibleDeliveries = useMemo(() => {
    if (!allDocuments) return [];
    return allDocuments.filter(
      (d) =>
        d.type === 'delivery' &&
        d.status === 'issued' &&
        (!customerId || d.customerId === customerId) &&
        d.issueDate >= periodFrom &&
        d.issueDate <= periodTo,
    );
  }, [allDocuments, customerId, periodFrom, periodTo]);

  const receivables = useMemo(
    () => (allDocuments ? calcReceivables(allDocuments, rounding) : new Map()),
    [allDocuments, rounding],
  );

  const customerMap = useMemo(() => {
    const m = new Map<string, string>();
    customers?.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [customers]);

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

  const handleIssue = async () => {
    if (selectedDocs.length === 0) {
      alert('対象の納品書を選択してください。');
      return;
    }
    if (!confirm(`${byCustomer.size}件の得意先に対して合計請求書を発行します。よろしいですか?`)) return;

    const now = new Date().toISOString();
    const issueDate = todayISO();
    const createdIds: string[] = [];

    for (const [custId, docs] of byCustomer.entries()) {
      const items = docs.flatMap((d) => d.items.map((it) => ({ ...it, id: newId() })));
      const number = await issueDocumentNumber('consolidated_invoice', issueDate);
      const balance = receivables.get(custId);
      const customer = customers?.find((c) => c.id === custId);

      const newDoc: SalesDocument = {
        id: newId(),
        type: 'consolidated_invoice',
        number,
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
        createdAt: now,
        updatedAt: now,
      };
      await db.documents.put(newDoc);
      createdIds.push(newDoc.id);

      for (const d of docs) {
        await db.documents.update(d.id, { status: 'closed', convertedToDocumentId: newDoc.id, updatedAt: now });
      }
    }

    alert(`${createdIds.length}件の合計請求書を発行しました。`);
    navigate('/documents/consolidated_invoice');
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
          <select value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
            <option value="">全得意先</option>
            {customers?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.code} {c.name}
              </option>
            ))}
          </select>
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
          <button className="btn btn-primary" onClick={handleSearch}>
            対象の納品書を検索
          </button>
        </div>
      </div>

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
                      <input type="checkbox" checked={selectedIds.has(d.id)} onChange={() => toggle(d.id)} />
                    </td>
                    <td>{d.number}</td>
                    <td>{formatDateJa(d.issueDate)}</td>
                    <td>{customerMap.get(d.customerId) ?? '(不明)'}</td>
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
              <button className="btn btn-primary" onClick={handleIssue}>
                合計請求書を一括発行
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

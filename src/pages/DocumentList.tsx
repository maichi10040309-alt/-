import { useMemo, useState } from 'react';
import { useLiveQuery } from '../api/useLiveQuery';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import SelectionToolbar from '../components/SelectionToolbar';
import { DOCUMENT_STATUS_LABEL, DOCUMENT_TYPE_LABEL, type DocumentType } from '../types';
import { calcDocumentTotals } from '../utils/tax';
import { formatMoney, formatDateJa } from '../utils/format';

export default function DocumentList() {
  const { type } = useParams<{ type: DocumentType }>();
  const navigate = useNavigate();
  const docType = type as DocumentType;
  const label = DOCUMENT_TYPE_LABEL[docType] ?? '伝票';

  const company = useLiveQuery(() => api.company.get(), []);
  const customers = useLiveQuery(() => api.customers.list(), []);
  const documents = useLiveQuery(() => api.documents.listByType(docType), [docType]);
  const [keyword, setKeyword] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const customerMap = useMemo(() => {
    const m = new Map<string, string>();
    customers?.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [customers]);

  const filtered = useMemo(() => {
    if (!documents) return [];
    const kw = keyword.trim().toLowerCase();
    if (!kw) return documents;
    return documents.filter(
      (d) =>
        d.number.toLowerCase().includes(kw) ||
        d.title.toLowerCase().includes(kw) ||
        (customerMap.get(d.customerId) ?? '').toLowerCase().includes(kw),
    );
  }, [documents, keyword, customerMap]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = filtered.length > 0 && filtered.every((d) => selected.has(d.id));
  const toggleAll = () => {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        filtered.forEach((d) => next.delete(d.id));
        return next;
      }
      const next = new Set(prev);
      filtered.forEach((d) => next.add(d.id));
      return next;
    });
  };

  const handleDeleteSelected = async () => {
    if (!confirm(`選択した${selected.size}件の${label}を削除します。よろしいですか?`)) return;
    await api.documents.bulkDelete(Array.from(selected));
    setSelected(new Set());
  };

  const handleDeleteAll = async () => {
    if (!documents || documents.length === 0) return;
    if (!confirm(`${label}を全${documents.length}件削除します。この操作は元に戻せません。よろしいですか?`)) return;
    await api.documents.bulkDelete(documents.map((d) => d.id));
    setSelected(new Set());
  };

  const handlePrintAll = () => {
    if (!documents || documents.length === 0) return;
    navigate(`/documents/${docType}/print-batch?ids=${documents.map((d) => d.id).join(',')}`);
  };

  const handlePrintSelected = () => {
    navigate(`/documents/${docType}/print-batch?ids=${Array.from(selected).join(',')}`);
  };

  return (
    <div>
      <PageHeader
        title={label}
        subtitle={`${label}の作成・管理・印刷`}
        actions={
          <>
            <input
              type="text"
              placeholder="番号・件名・得意先名で検索"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="search-input"
            />
            {docType === 'consolidated_invoice' ? (
              <button className="btn btn-primary" onClick={() => navigate('/billing')}>
                締め処理へ
              </button>
            ) : (
              <Link className="btn btn-primary" to={`/documents/${docType}/new`}>
                + 新規{label}
              </Link>
            )}
          </>
        }
      />
      <SelectionToolbar
        totalCount={documents?.length ?? 0}
        selectedCount={selected.size}
        onDeleteSelected={handleDeleteSelected}
        onDeleteAll={handleDeleteAll}
        deleteAllLabel={`すべて削除(${documents?.length ?? 0}件)`}
        extraActions={
          <>
            <button className="btn btn-secondary" onClick={handlePrintAll}>
              全{documents?.length ?? 0}件を印刷
            </button>
            {selected.size > 0 && (
              <button className="btn btn-secondary" onClick={handlePrintSelected}>
                選択した{selected.size}件を印刷
              </button>
            )}
          </>
        }
      />
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th className="select-col">
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} />
              </th>
              <th>番号</th>
              <th>発行日</th>
              <th>得意先</th>
              <th>件名</th>
              <th>金額</th>
              <th>状態</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => {
              const totals = calcDocumentTotals(d.items, company?.taxRounding ?? 'floor');
              return (
                <tr key={d.id}>
                  <td className="select-col">
                    <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
                  </td>
                  <td>{d.number}</td>
                  <td>{formatDateJa(d.issueDate)}</td>
                  <td>{customerMap.get(d.customerId) ?? '(不明)'}</td>
                  <td>{d.title}</td>
                  <td className="amount-cell">{formatMoney(totals.grandTotal)}</td>
                  <td>
                    <span className={`status-badge status-${d.status}`}>
                      {DOCUMENT_STATUS_LABEL[d.status]}
                    </span>
                  </td>
                  <td className="row-actions">
                    <Link className="link" to={`/documents/${docType}/${d.id}`}>
                      編集
                    </Link>
                    <Link className="link" to={`/documents/${docType}/${d.id}/print`}>
                      印刷
                    </Link>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">
                  {label}が登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

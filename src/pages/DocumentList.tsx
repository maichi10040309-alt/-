import { Fragment, useMemo, useState } from 'react';
import { useLiveQuery } from '../api/useLiveQuery';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import SelectionToolbar from '../components/SelectionToolbar';
import { DOCUMENT_STATUS_LABEL, DOCUMENT_TYPE_LABEL, type DocumentType, type SalesDocument } from '../types';
import { calcDocumentTotals } from '../utils/tax';
import { formatMoney, formatDateJa, todayISO } from '../utils/format';

const PAGE_SIZE_OPTIONS = [50, 100, 200, 500];

function firstDayOfMonth(iso: string) {
  return iso.slice(0, 8) + '01';
}

export default function DocumentList() {
  const { type } = useParams<{ type: DocumentType }>();
  const navigate = useNavigate();
  const docType = type as DocumentType;
  const label = DOCUMENT_TYPE_LABEL[docType] ?? '伝票';

  const company = useLiveQuery(() => api.company.get(), []);
  const customers = useLiveQuery(() => api.customers.list(), []);
  const documents = useLiveQuery(() => api.documents.listByType(docType), [docType]);
  const [keyword, setKeyword] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  // 検索条件が変わったら表示ページを1ページ目に戻す(レンダー中に判定して即座に反映する)
  const filterKey = `${docType}|${keyword}|${dateFrom}|${dateTo}`;
  const [appliedFilterKey, setAppliedFilterKey] = useState(filterKey);
  if (filterKey !== appliedFilterKey) {
    setAppliedFilterKey(filterKey);
    setPage(1);
  }

  const customerMap = useMemo(() => {
    const m = new Map<string, string>();
    customers?.forEach((c) => m.set(c.id, c.name));
    return m;
  }, [customers]);

  const rounding = company?.taxRounding ?? 'floor';

  const totalsCache = useMemo(() => {
    const m = new Map<string, ReturnType<typeof calcDocumentTotals>>();
    documents?.forEach((d) => m.set(d.id, calcDocumentTotals(d.items, rounding)));
    return m;
  }, [documents, rounding]);

  const filtered = useMemo(() => {
    if (!documents) return [];
    const kw = keyword.trim().toLowerCase();
    let list = documents;
    if (kw) {
      list = list.filter(
        (d) =>
          d.number.toLowerCase().includes(kw) ||
          d.title.toLowerCase().includes(kw) ||
          (customerMap.get(d.customerId) ?? '').toLowerCase().includes(kw) ||
          d.items.some((it) => it.name.toLowerCase().includes(kw)),
      );
    }
    if (dateFrom) list = list.filter((d) => d.issueDate >= dateFrom);
    if (dateTo) list = list.filter((d) => d.issueDate <= dateTo);
    return list;
  }, [documents, keyword, dateFrom, dateTo, customerMap]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.issueDate !== b.issueDate) return b.issueDate.localeCompare(a.issueDate);
      return b.number.localeCompare(a.number);
    });
  }, [filtered]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageItems = useMemo(
    () => sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize),
    [sorted, currentPage, pageSize],
  );

  const filteredTotalAmount = useMemo(
    () => sorted.reduce((sum, d) => sum + (totalsCache.get(d.id)?.grandTotal ?? 0), 0),
    [sorted, totalsCache],
  );

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allFilteredSelected = sorted.length > 0 && sorted.every((d) => selected.has(d.id));
  const toggleAll = () => {
    setSelected((prev) => {
      if (allFilteredSelected) {
        const next = new Set(prev);
        sorted.forEach((d) => next.delete(d.id));
        return next;
      }
      const next = new Set(prev);
      sorted.forEach((d) => next.add(d.id));
      return next;
    });
  };

  const toggleGroup = (docs: SalesDocument[], allSelected: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      docs.forEach((d) => (allSelected ? next.delete(d.id) : next.add(d.id)));
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

  // 一括印刷は伝票IDをURLに乗せて渡す方式のため、件数が多すぎるとURLが壊れたり
  // ブラウザが大量の帳票を一度に描画してフリーズしたりする。安全のため上限を設ける。
  const MAX_BATCH_PRINT = 300;

  const handlePrintFiltered = () => {
    if (sorted.length === 0) return;
    if (sorted.length > MAX_BATCH_PRINT) {
      alert(
        `一度に一括印刷できるのは${MAX_BATCH_PRINT}件までです(現在${sorted.length}件)。発行日などで絞り込んでから印刷してください。`,
      );
      return;
    }
    navigate(`/documents/${docType}/print-batch?ids=${sorted.map((d) => d.id).join(',')}`);
  };

  const handlePrintSelected = () => {
    if (selected.size > MAX_BATCH_PRINT) {
      alert(`一度に一括印刷できるのは${MAX_BATCH_PRINT}件までです(現在${selected.size}件選択中)。`);
      return;
    }
    navigate(`/documents/${docType}/print-batch?ids=${Array.from(selected).join(',')}`);
  };

  const handleThisMonth = () => {
    const today = todayISO();
    setDateFrom(firstDayOfMonth(today));
    setDateTo(today);
  };

  const handleClearFilters = () => {
    setKeyword('');
    setDateFrom('');
    setDateTo('');
  };

  const hasFilter = !!(keyword || dateFrom || dateTo);

  const showPaidColumn = docType !== 'quotation';

  const handleTogglePaid = async (id: string, paid: boolean) => {
    await api.documents.patch(id, {
      paid,
      paidDate: paid ? new Date().toISOString().slice(0, 10) : '',
    });
  };

  if (!documents) {
    return (
      <div>
        <PageHeader title={label} subtitle={`${label}の作成・管理・印刷`} />
        <div className="card">読み込み中...</div>
      </div>
    );
  }

  // ページ内の行を発行日ごとにグループ化して表示する(日付見出しを挟む)。
  // 対象はこのページの数十件だけなので、useMemoを使わずに毎回計算しても軽い。
  const groupedRows: { date: string; docs: SalesDocument[] }[] = [];
  for (const d of pageItems) {
    const last = groupedRows[groupedRows.length - 1];
    if (last && last.date === d.issueDate) {
      last.docs.push(d);
    } else {
      groupedRows.push({ date: d.issueDate, docs: [d] });
    }
  }

  return (
    <div>
      <PageHeader
        title={label}
        subtitle={`${label}の作成・管理・印刷`}
        actions={
          docType === 'consolidated_invoice' ? (
            <button className="btn btn-primary" onClick={() => navigate('/billing')}>
              締め処理へ
            </button>
          ) : (
            <Link className="btn btn-primary" to={`/documents/${docType}/new`}>
              + 新規{label}
            </Link>
          )
        }
      />

      <div className="card doc-filter-bar">
        <div className="doc-filter-row">
          <input
            type="text"
            placeholder="番号・得意先名・件名・商品名で検索"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            className="search-input doc-filter-search"
          />
          <label className="doc-filter-date">
            発行日
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </label>
          <span className="doc-filter-tilde">〜</span>
          <label className="doc-filter-date">
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </label>
          <button type="button" className="btn btn-secondary" onClick={handleThisMonth}>
            今月
          </button>
          {hasFilter && (
            <button type="button" className="btn btn-secondary" onClick={handleClearFilters}>
              絞り込みを解除
            </button>
          )}
        </div>
        <div className="doc-filter-stats">
          表示件数 <strong>{sorted.length.toLocaleString('ja-JP')}</strong>件
          {hasFilter && documents && <span className="hint">(全{documents.length.toLocaleString('ja-JP')}件中)</span>}
          　表示合計金額 <strong>{formatMoney(filteredTotalAmount)}</strong>
        </div>
      </div>

      <SelectionToolbar
        totalCount={documents?.length ?? 0}
        selectedCount={selected.size}
        onDeleteSelected={handleDeleteSelected}
        onDeleteAll={handleDeleteAll}
        deleteAllLabel={`すべて削除(${documents?.length ?? 0}件)`}
        extraActions={
          <>
            <button className="btn btn-secondary" onClick={handlePrintFiltered}>
              {hasFilter ? `絞り込み${sorted.length}件を印刷` : `全${sorted.length}件を印刷`}
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
        <div className="doc-pagination-bar">
          <div className="doc-pagination-info">
            {sorted.length === 0
              ? '0件'
              : `${(currentPage - 1) * pageSize + 1}〜${Math.min(currentPage * pageSize, sorted.length)}件 / 全${sorted.length}件`}
          </div>
          <div className="doc-pagination-controls">
            <label>
              表示件数
              <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}>
                {PAGE_SIZE_OPTIONS.map((n) => (
                  <option key={n} value={n}>
                    {n}件
                  </option>
                ))}
              </select>
            </label>
            <button className="btn btn-secondary" disabled={currentPage <= 1} onClick={() => setPage(1)}>
              最初
            </button>
            <button className="btn btn-secondary" disabled={currentPage <= 1} onClick={() => setPage((p) => p - 1)}>
              前へ
            </button>
            <span className="doc-pagination-page">
              {currentPage} / {totalPages}
            </span>
            <button
              className="btn btn-secondary"
              disabled={currentPage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              次へ
            </button>
            <button
              className="btn btn-secondary"
              disabled={currentPage >= totalPages}
              onClick={() => setPage(totalPages)}
            >
              最後
            </button>
          </div>
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th className="select-col">
                <input type="checkbox" checked={allFilteredSelected} onChange={toggleAll} />
              </th>
              <th>番号</th>
              <th>得意先</th>
              <th>件名</th>
              <th>金額</th>
              <th>状態</th>
              {showPaidColumn && <th>入金</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {groupedRows.map((group, groupIdx) => (
              <Fragment key={`group-${groupIdx}`}>
                <tr className="doc-date-group-row">
                  <td className="select-col">
                    <input
                      type="checkbox"
                      checked={group.docs.every((d) => selected.has(d.id))}
                      onChange={() => toggleGroup(group.docs, group.docs.every((d) => selected.has(d.id)))}
                    />
                  </td>
                  <td colSpan={showPaidColumn ? 7 : 6}>{group.date ? formatDateJa(group.date) : '(発行日未設定)'}</td>
                </tr>
                {group.docs.map((d) => {
                  const totals = totalsCache.get(d.id) ?? calcDocumentTotals(d.items, rounding);
                  return (
                    <tr key={d.id}>
                      <td className="select-col">
                        <input type="checkbox" checked={selected.has(d.id)} onChange={() => toggle(d.id)} />
                      </td>
                      <td>{d.number}</td>
                      <td>{customerMap.get(d.customerId) ?? '(不明)'}</td>
                      <td>{d.title}</td>
                      <td className="amount-cell">{formatMoney(totals.grandTotal)}</td>
                      <td>
                        <span className={`status-badge status-${d.status}`}>{DOCUMENT_STATUS_LABEL[d.status]}</span>
                      </td>
                      {showPaidColumn && (
                        <td>
                          <label className="paid-toggle-cell">
                            <input
                              type="checkbox"
                              checked={!!d.paid}
                              onChange={(e) => handleTogglePaid(d.id, e.target.checked)}
                            />
                            {d.paid && '入金済'}
                          </label>
                        </td>
                      )}
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
              </Fragment>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={showPaidColumn ? 8 : 7} className="empty-row">
                  {hasFilter ? '条件に一致する伝票がありません。' : `${label}が登録されていません。`}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

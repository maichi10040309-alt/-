import { useMemo, useState } from 'react';
import { useLiveQuery } from '../api/useLiveQuery';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import CsvImportButton, { type MappedValue } from '../components/CsvImportButton';
import { toCSV, downloadCSV } from '../utils/csv';
import { newId } from '../utils/id';
import { todayISO } from '../utils/format';
import type { ImportFieldDef } from '../utils/importMapping';
import type { Customer } from '../types';

const CSV_HEADERS = [
  '得意先コード',
  '得意先名',
  'フリガナ',
  '郵便番号',
  '住所1',
  '住所2',
  '電話番号',
  'FAX',
  'メール',
  '担当者',
  '単価ランク',
  '掛率(%)',
  '締め日',
  '支払月オフセット',
  '支払日',
  '備考',
];

const IMPORT_FIELDS: ImportFieldDef[] = [
  { key: 'code', label: '得意先コード', kind: 'text' },
  { key: 'name', label: '得意先名', kind: 'text', required: true },
  { key: 'kana', label: 'フリガナ', kind: 'text' },
  { key: 'zip', label: '郵便番号', kind: 'text' },
  { key: 'address1', label: '住所1', kind: 'text' },
  { key: 'address2', label: '住所2', kind: 'text' },
  { key: 'tel', label: '電話番号', kind: 'text' },
  { key: 'fax', label: 'FAX', kind: 'text' },
  { key: 'email', label: 'メール', kind: 'text' },
  { key: 'contactPerson', label: '担当者', kind: 'text' },
  { key: 'priceTier', label: '単価ランク', kind: 'number' },
  { key: 'discountRate', label: '掛率(%)', kind: 'number' },
  { key: 'closingDay', label: '締め日', kind: 'number' },
  { key: 'paymentMonthOffset', label: '支払月オフセット', kind: 'number' },
  { key: 'paymentDay', label: '支払日', kind: 'number' },
  { key: 'notes', label: '備考', kind: 'text' },
];

export default function CustomerList() {
  const customers = useLiveQuery(() => api.customers.list(), []);
  const [keyword, setKeyword] = useState('');

  const filtered = useMemo(() => {
    if (!customers) return [];
    const kw = keyword.trim().toLowerCase();
    if (!kw) return customers;
    return customers.filter(
      (c) =>
        c.name.toLowerCase().includes(kw) ||
        c.kana.toLowerCase().includes(kw) ||
        c.code.toLowerCase().includes(kw),
    );
  }, [customers, keyword]);

  const handleExport = () => {
    if (!customers) return;
    const rows = customers.map((c) => [
      c.code,
      c.name,
      c.kana,
      c.zip,
      c.address1,
      c.address2,
      c.tel,
      c.fax,
      c.email,
      c.contactPerson,
      c.priceTier,
      c.discountRate,
      c.closingDay,
      c.paymentMonthOffset,
      c.paymentDay,
      c.notes,
    ]);
    downloadCSV(`得意先台帳_${todayISO()}.csv`, toCSV(CSV_HEADERS, rows));
  };

  const handleImport = async (mapped: Record<string, MappedValue>[]) => {
    const now = new Date().toISOString();
    const blankCodeCount = mapped.filter((r) => !String(r.code ?? '').trim()).length;
    const generatedCodes = blankCodeCount > 0 ? await api.customers.nextCodeBatch(blankCodeCount) : [];
    let codeCursor = 0;

    const records: Customer[] = mapped.map((r) => {
      const code = String(r.code ?? '').trim() || generatedCodes[codeCursor++];
      const priceTierRaw = Math.round(Number(r.priceTier) || 1);
      const priceTier = (priceTierRaw >= 1 && priceTierRaw <= 3 ? priceTierRaw : 1) as 1 | 2 | 3;
      return {
        id: newId(),
        code,
        name: String(r.name ?? ''),
        kana: String(r.kana ?? ''),
        zip: String(r.zip ?? ''),
        address1: String(r.address1 ?? ''),
        address2: String(r.address2 ?? ''),
        tel: String(r.tel ?? ''),
        fax: String(r.fax ?? ''),
        email: String(r.email ?? ''),
        contactPerson: String(r.contactPerson ?? ''),
        priceTier,
        discountRate: Number(r.discountRate) || 100,
        closingDay: Number(r.closingDay) || 31,
        paymentMonthOffset: Number(r.paymentMonthOffset) || 1,
        paymentDay: Number(r.paymentDay) || 31,
        notes: String(r.notes ?? ''),
        createdAt: now,
        updatedAt: now,
      };
    });
    await api.customers.bulkPut(records);
  };

  return (
    <div>
      <PageHeader
        title="得意先台帳"
        subtitle="得意先の登録・管理、単価ランク・掛率・締め日の設定"
        actions={
          <>
            <input
              type="text"
              placeholder="得意先名・コードで検索"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              className="search-input"
            />
            <button className="btn btn-secondary" onClick={handleExport}>
              CSVエクスポート
            </button>
            <CsvImportButton label="CSVインポート" fields={IMPORT_FIELDS} onImport={handleImport} />
            <Link className="btn btn-primary" to="/customers/new">
              + 新規得意先
            </Link>
          </>
        }
      />
      <div className="card">
        <table className="data-table">
          <thead>
            <tr>
              <th>コード</th>
              <th>得意先名</th>
              <th>フリガナ</th>
              <th>電話番号</th>
              <th>単価ランク</th>
              <th>掛率</th>
              <th>締め日</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.id}>
                <td>{c.code}</td>
                <td>{c.name}</td>
                <td>{c.kana}</td>
                <td>{c.tel}</td>
                <td>単価{c.priceTier}</td>
                <td>{c.discountRate}%</td>
                <td>{c.closingDay === 31 ? '末日' : `${c.closingDay}日`}</td>
                <td>
                  <Link className="link" to={`/customers/${c.id}`}>
                    編集
                  </Link>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8} className="empty-row">
                  得意先が登録されていません。
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

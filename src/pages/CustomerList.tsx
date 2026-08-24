import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Link } from 'react-router-dom';
import { db } from '../db/db';
import PageHeader from '../components/PageHeader';
import { parseCSV, toCSV, downloadCSV } from '../utils/csv';
import { newId } from '../utils/id';
import { todayISO } from '../utils/format';
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

export default function CustomerList() {
  const customers = useLiveQuery(() => db.customers.orderBy('code').toArray(), []);
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

  const handleImportFile = async (file: File) => {
    const text = await file.text();
    const rows = parseCSV(text);
    if (rows.length === 0) return;
    const body = rows[0][0] === CSV_HEADERS[0] ? rows.slice(1) : rows;
    const now = new Date().toISOString();
    const records: Customer[] = body
      .filter((r) => r.length > 1 && r[1])
      .map((r) => ({
        id: newId(),
        code: r[0] ?? '',
        name: r[1] ?? '',
        kana: r[2] ?? '',
        zip: r[3] ?? '',
        address1: r[4] ?? '',
        address2: r[5] ?? '',
        tel: r[6] ?? '',
        fax: r[7] ?? '',
        email: r[8] ?? '',
        contactPerson: r[9] ?? '',
        priceTier: (Number(r[10]) as 1 | 2 | 3) || 1,
        discountRate: Number(r[11]) || 100,
        closingDay: Number(r[12]) || 31,
        paymentMonthOffset: Number(r[13]) || 1,
        paymentDay: Number(r[14]) || 31,
        notes: r[15] ?? '',
        createdAt: now,
        updatedAt: now,
      }));
    await db.customers.bulkPut(records);
    alert(`${records.length}件の得意先を取り込みました。`);
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
            <label className="btn btn-secondary">
              CSVインポート
              <input
                type="file"
                accept=".csv"
                style={{ display: 'none' }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImportFile(file);
                  e.target.value = '';
                }}
              />
            </label>
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

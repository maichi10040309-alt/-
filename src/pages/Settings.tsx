import { useEffect, useState } from 'react';
import { db } from '../db/db';
import PageHeader from '../components/PageHeader';
import type { CompanyInfo } from '../types';

export default function Settings() {
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    db.company.get(1).then((c) => c && setCompany(c));
  }, []);

  if (!company) return <div className="card">読み込み中...</div>;

  const set = <K extends keyof CompanyInfo>(key: K, value: CompanyInfo[K]) =>
    setCompany((c) => (c ? { ...c, [key]: value } : c));

  const handleSave = async () => {
    await db.company.put(company);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleBackup = async () => {
    const [customers, products, documents, companyData] = await Promise.all([
      db.customers.toArray(),
      db.products.toArray(),
      db.documents.toArray(),
      db.company.toArray(),
    ]);
    const data = { customers, products, documents, company: companyData, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `販売管理バックアップ_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleRestore = async (file: File) => {
    if (!confirm('現在のデータを上書きして復元します。よろしいですか?')) return;
    const text = await file.text();
    const data = JSON.parse(text);
    await db.transaction('rw', db.customers, db.products, db.documents, db.company, async () => {
      if (Array.isArray(data.customers)) await db.customers.bulkPut(data.customers);
      if (Array.isArray(data.products)) await db.products.bulkPut(data.products);
      if (Array.isArray(data.documents)) await db.documents.bulkPut(data.documents);
      if (Array.isArray(data.company)) await db.company.bulkPut(data.company);
    });
    alert('復元が完了しました。');
    location.reload();
  };

  return (
    <div>
      <PageHeader
        title="設定"
        subtitle="自社情報・税設定・データのバックアップ"
        actions={
          <button className="btn btn-primary" onClick={handleSave}>
            {saved ? '保存しました' : '保存'}
          </button>
        }
      />

      <div className="card form-grid">
        <div className="section-divider col-span-2">自社情報(伝票に印字されます)</div>
        <label className="col-span-2">
          会社名・屋号
          <input value={company.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label>
          郵便番号
          <input value={company.zip} onChange={(e) => set('zip', e.target.value)} />
        </label>
        <label>
          代表者名
          <input value={company.representativeName} onChange={(e) => set('representativeName', e.target.value)} />
        </label>
        <label className="col-span-2">
          住所1
          <input value={company.address1} onChange={(e) => set('address1', e.target.value)} />
        </label>
        <label className="col-span-2">
          住所2
          <input value={company.address2} onChange={(e) => set('address2', e.target.value)} />
        </label>
        <label>
          電話番号
          <input value={company.tel} onChange={(e) => set('tel', e.target.value)} />
        </label>
        <label>
          FAX
          <input value={company.fax} onChange={(e) => set('fax', e.target.value)} />
        </label>
        <label>
          メールアドレス
          <input value={company.email} onChange={(e) => set('email', e.target.value)} />
        </label>
        <label>
          適格請求書発行事業者登録番号
          <input
            value={company.invoiceRegistrationNumber}
            onChange={(e) => set('invoiceRegistrationNumber', e.target.value)}
            placeholder="T1234567890123"
          />
        </label>
        <label className="col-span-2">
          振込先情報(請求書に印字)
          <textarea value={company.bankInfo} onChange={(e) => set('bankInfo', e.target.value)} rows={2} />
        </label>

        <div className="section-divider col-span-2">税設定</div>
        <label>
          既定の税率
          <select value={company.defaultTaxRate} onChange={(e) => set('defaultTaxRate', Number(e.target.value) as 0 | 8 | 10)}>
            <option value={10}>10%(標準)</option>
            <option value={8}>8%(軽減)</option>
            <option value={0}>非課税</option>
          </select>
        </label>
        <label>
          消費税の端数処理
          <select value={company.taxRounding} onChange={(e) => set('taxRounding', e.target.value as CompanyInfo['taxRounding'])}>
            <option value="floor">切り捨て</option>
            <option value="round">四捨五入</option>
            <option value="ceil">切り上げ</option>
          </select>
        </label>
      </div>

      <div className="card">
        <div className="section-divider">データのバックアップ・復元</div>
        <p className="hint">このソフトのデータはブラウザ内(端末内)に保存されます。定期的にバックアップの保存をおすすめします。</p>
        <div className="form-actions-inline">
          <button className="btn btn-secondary" onClick={handleBackup}>
            バックアップを保存(JSON)
          </button>
          <label className="btn btn-secondary">
            バックアップから復元
            <input
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleRestore(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>
    </div>
  );
}

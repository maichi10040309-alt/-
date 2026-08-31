import { useEffect, useState } from 'react';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import type { CompanyInfo } from '../types';

export default function Settings() {
  const [company, setCompany] = useState<CompanyInfo | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.company.get().then((c) => c && setCompany(c));
  }, []);

  if (!company) return <div className="card">読み込み中...</div>;

  const set = <K extends keyof CompanyInfo>(key: K, value: CompanyInfo[K]) =>
    setCompany((c) => (c ? { ...c, [key]: value } : c));

  const handleSave = async () => {
    await api.company.put(company);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const handleBackup = async () => {
    const data = await api.backup.export();
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
    if (!confirm('サーバー上の現在のデータを上書きして復元します。よろしいですか?')) return;
    const text = await file.text();
    const data = JSON.parse(text);
    await api.backup.import(data);
    alert('復元が完了しました。');
    location.reload();
  };

  const handleSealUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('画像ファイル(PNG・JPGなど)を選んでください。');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      set('sealImageDataUrl', String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const updateDeliveryTagOption = (index: number, value: string) => {
    setCompany((c) => {
      if (!c) return c;
      const next = [...c.deliveryTagOptions];
      next[index] = value;
      return { ...c, deliveryTagOptions: next };
    });
  };

  const removeDeliveryTagOption = (index: number) => {
    setCompany((c) => (c ? { ...c, deliveryTagOptions: c.deliveryTagOptions.filter((_, i) => i !== index) } : c));
  };

  const addDeliveryTagOption = () => {
    setCompany((c) => (c ? { ...c, deliveryTagOptions: [...c.deliveryTagOptions, ''] } : c));
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
        <div className="section-divider col-span-2">振込先情報(請求書・合計請求書に印字)</div>
        <label>
          銀行名・支店名
          <input
            value={company.bankBranch}
            onChange={(e) => set('bankBranch', e.target.value)}
            placeholder="例: ○○銀行 ○○支店"
          />
        </label>
        <label>
          預金種別・口座番号
          <input
            value={company.bankAccount}
            onChange={(e) => set('bankAccount', e.target.value)}
            placeholder="例: 普通 1234567"
          />
        </label>
        <label className="col-span-2">
          口座名義
          <input
            value={company.bankAccountHolder}
            onChange={(e) => set('bankAccountHolder', e.target.value)}
            placeholder="例: カ)○○ショウジ"
          />
        </label>

        <div className="col-span-2 seal-upload-row">
          <div className="seal-upload-label">会社印(印影)</div>
          <div className="seal-upload-body">
            {company.sealImageDataUrl ? (
              <img src={company.sealImageDataUrl} alt="会社印" className="seal-preview" />
            ) : (
              <div className="seal-preview seal-preview-empty">未設定</div>
            )}
            <div className="seal-upload-actions">
              <label className="btn btn-secondary">
                画像を選択
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleSealUpload(file);
                    e.target.value = '';
                  }}
                />
              </label>
              {company.sealImageDataUrl && (
                <button type="button" className="btn btn-secondary" onClick={() => set('sealImageDataUrl', '')}>
                  削除
                </button>
              )}
            </div>
          </div>
          <p className="hint">
            印影のスキャン画像・写真(背景が白いもの推奨、PNG形式で背景透過なら仕上がりがきれいです)を登録すると、
            納品書などの印刷時に自動で印字されます。保存を押すまで反映されません。
          </p>
        </div>

        <div className="col-span-2 delivery-tag-options-row">
          <div className="seal-upload-label">納品書の配送区分の選択肢</div>
          <p className="hint">
            納品書の作成画面で選べる区分です(直送・店頭・営業担当者名など、自由に追加・編集・削除できます)。
          </p>
          <div className="delivery-tag-options-list">
            {company.deliveryTagOptions.map((opt, i) => (
              <div key={i} className="delivery-tag-option-item">
                <input value={opt} onChange={(e) => updateDeliveryTagOption(i, e.target.value)} placeholder="例: 直送" />
                <button type="button" className="icon-btn danger" onClick={() => removeDeliveryTagOption(i)}>
                  削除
                </button>
              </div>
            ))}
          </div>
          <button type="button" className="btn btn-secondary" onClick={addDeliveryTagOption}>
            + 選択肢を追加
          </button>
        </div>

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
        <p className="hint">
          データはサーバー役のパソコン(server/data/db.json)に保存され、同じサーバーに接続した全端末で共有されます。
          定期的にバックアップの保存をおすすめします。
        </p>
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

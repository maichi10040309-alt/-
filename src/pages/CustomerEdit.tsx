import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import PageHeader from '../components/PageHeader';
import { newId } from '../utils/id';
import type { Customer } from '../types';

const empty = (): Customer => ({
  id: newId(),
  code: '',
  name: '',
  kana: '',
  zip: '',
  address1: '',
  address2: '',
  tel: '',
  fax: '',
  email: '',
  contactPerson: '',
  priceTier: 1,
  discountRate: 100,
  closingDay: 31,
  paymentMonthOffset: 1,
  paymentDay: 31,
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export default function CustomerEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<Customer>(empty());
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    if (isNew) return;
    api.customers
      .get(id!)
      .then((c) => setCustomer(c))
      .catch(() => {})
      .finally(() => setLoaded(true));
  }, [id, isNew]);

  const set = <K extends keyof Customer>(key: K, value: Customer[K]) =>
    setCustomer((c) => ({ ...c, [key]: value }));

  const handleSave = async () => {
    if (!customer.name.trim()) {
      alert('得意先名を入力してください。');
      return;
    }
    const now = new Date().toISOString();
    let code = customer.code;
    if (!code) {
      code = await api.customers.nextCode();
    }
    await api.customers.put({ ...customer, code, updatedAt: now });
    navigate('/customers');
  };

  const handleDelete = async () => {
    if (!confirm('この得意先を削除しますか?')) return;
    await api.customers.delete(customer.id);
    navigate('/customers');
  };

  if (!loaded) return <div className="card">読み込み中...</div>;

  return (
    <div>
      <PageHeader
        title={isNew ? '得意先の新規登録' : '得意先の編集'}
        actions={
          <>
            {!isNew && (
              <button className="btn btn-danger" onClick={handleDelete}>
                削除
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => navigate('/customers')}>
              キャンセル
            </button>
            <button className="btn btn-primary" onClick={handleSave}>
              保存
            </button>
          </>
        }
      />
      <div className="card form-grid">
        <label>
          得意先コード
          <input value={customer.code} onChange={(e) => set('code', e.target.value)} placeholder="自動採番" />
        </label>
        <label>
          得意先名 *
          <input value={customer.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label>
          フリガナ
          <input value={customer.kana} onChange={(e) => set('kana', e.target.value)} />
        </label>
        <label>
          郵便番号
          <input value={customer.zip} onChange={(e) => set('zip', e.target.value)} placeholder="100-0001" />
        </label>
        <label className="col-span-2">
          住所1
          <input value={customer.address1} onChange={(e) => set('address1', e.target.value)} />
        </label>
        <label className="col-span-2">
          住所2
          <input value={customer.address2} onChange={(e) => set('address2', e.target.value)} />
        </label>
        <label>
          電話番号
          <input value={customer.tel} onChange={(e) => set('tel', e.target.value)} />
        </label>
        <label>
          FAX
          <input value={customer.fax} onChange={(e) => set('fax', e.target.value)} />
        </label>
        <label>
          メールアドレス
          <input value={customer.email} onChange={(e) => set('email', e.target.value)} />
        </label>
        <label>
          担当者名
          <input value={customer.contactPerson} onChange={(e) => set('contactPerson', e.target.value)} />
        </label>

        <div className="section-divider col-span-2">取引条件</div>

        <label>
          適用単価ランク
          <select
            value={customer.priceTier}
            onChange={(e) => set('priceTier', Number(e.target.value) as 1 | 2 | 3)}
          >
            <option value={1}>単価1(標準)</option>
            <option value={2}>単価2</option>
            <option value={3}>単価3</option>
          </select>
        </label>
        <label>
          得意先別掛率(%)
          <input
            type="number"
            value={customer.discountRate}
            onChange={(e) => set('discountRate', Number(e.target.value))}
          />
        </label>
        <label>
          締め日
          <select value={customer.closingDay} onChange={(e) => set('closingDay', Number(e.target.value))}>
            {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}日
              </option>
            ))}
            <option value={31}>末日</option>
          </select>
        </label>
        <label>
          支払月
          <select
            value={customer.paymentMonthOffset}
            onChange={(e) => set('paymentMonthOffset', Number(e.target.value))}
          >
            <option value={0}>当月</option>
            <option value={1}>翌月</option>
            <option value={2}>翌々月</option>
          </select>
        </label>
        <label>
          支払日
          <select value={customer.paymentDay} onChange={(e) => set('paymentDay', Number(e.target.value))}>
            {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => (
              <option key={d} value={d}>
                {d}日
              </option>
            ))}
            <option value={31}>末日</option>
          </select>
        </label>

        <label className="col-span-2">
          備考
          <textarea value={customer.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
        </label>
      </div>
    </div>
  );
}

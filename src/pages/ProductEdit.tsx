import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { db } from '../db/db';
import PageHeader from '../components/PageHeader';
import { newId } from '../utils/id';
import type { Product } from '../types';

const empty = (): Product => ({
  id: newId(),
  code: '',
  name: '',
  category: '',
  unit: '個',
  taxRate: 10,
  prices: { price1: 0, price2: 0, price3: 0, cost: 0 },
  notes: '',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export default function ProductEdit() {
  const { id } = useParams();
  const isNew = id === 'new';
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product>(empty());
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    if (isNew) return;
    db.products.get(id!).then((p) => {
      if (p) setProduct(p);
      setLoaded(true);
    });
  }, [id, isNew]);

  const set = <K extends keyof Product>(key: K, value: Product[K]) =>
    setProduct((p) => ({ ...p, [key]: value }));

  const setPrice = <K extends keyof Product['prices']>(key: K, value: number) =>
    setProduct((p) => ({ ...p, prices: { ...p.prices, [key]: value } }));

  const handleSave = async () => {
    if (!product.name.trim()) {
      alert('商品名を入力してください。');
      return;
    }
    const now = new Date().toISOString();
    let code = product.code;
    if (!code) {
      const count = await db.products.count();
      code = `P${String(count + 1).padStart(4, '0')}`;
    }
    await db.products.put({ ...product, code, updatedAt: now });
    navigate('/products');
  };

  const handleDelete = async () => {
    if (!confirm('この商品を削除しますか?')) return;
    await db.products.delete(product.id);
    navigate('/products');
  };

  if (!loaded) return <div className="card">読み込み中...</div>;

  const margin1 = product.prices.price1 - product.prices.cost;

  return (
    <div>
      <PageHeader
        title={isNew ? '商品の新規登録' : '商品の編集'}
        actions={
          <>
            {!isNew && (
              <button className="btn btn-danger" onClick={handleDelete}>
                削除
              </button>
            )}
            <button className="btn btn-secondary" onClick={() => navigate('/products')}>
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
          商品コード
          <input value={product.code} onChange={(e) => set('code', e.target.value)} placeholder="自動採番" />
        </label>
        <label>
          商品名 *
          <input value={product.name} onChange={(e) => set('name', e.target.value)} />
        </label>
        <label>
          分類
          <input value={product.category} onChange={(e) => set('category', e.target.value)} />
        </label>
        <label>
          単位
          <input value={product.unit} onChange={(e) => set('unit', e.target.value)} />
        </label>
        <label>
          税率
          <select
            value={product.taxRate}
            onChange={(e) => set('taxRate', Number(e.target.value) as 0 | 8 | 10)}
          >
            <option value={10}>10%(標準)</option>
            <option value={8}>8%(軽減)</option>
            <option value={0}>非課税</option>
          </select>
        </label>

        <div className="section-divider col-span-2">複数単価設定</div>
        <label>
          単価1(標準)
          <input type="number" value={product.prices.price1} onChange={(e) => setPrice('price1', Number(e.target.value))} />
        </label>
        <label>
          単価2
          <input type="number" value={product.prices.price2} onChange={(e) => setPrice('price2', Number(e.target.value))} />
        </label>
        <label>
          単価3
          <input type="number" value={product.prices.price3} onChange={(e) => setPrice('price3', Number(e.target.value))} />
        </label>
        <label>
          仕入原価
          <input type="number" value={product.prices.cost} onChange={(e) => setPrice('cost', Number(e.target.value))} />
        </label>
        <div className="hint col-span-2">単価1での粗利: ¥{margin1.toLocaleString('ja-JP')}</div>

        <label className="col-span-2">
          備考
          <textarea value={product.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
        </label>
      </div>
    </div>
  );
}

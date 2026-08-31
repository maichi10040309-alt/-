import type { Customer, DocumentItem, Product, TaxRate } from '../types';
import { newId } from '../utils/id';
import { formatMoney } from '../utils/format';
import { itemAmount } from '../utils/tax';
import { resolveUnitPrice } from '../utils/pricing';

export default function ItemsEditor({
  items,
  onChange,
  products,
  customer,
}: {
  items: DocumentItem[];
  onChange: (items: DocumentItem[]) => void;
  products: Product[];
  customer: Customer | undefined;
}) {
  const update = (id: string, patch: Partial<DocumentItem>) => {
    onChange(items.map((it) => (it.id === id ? { ...it, ...patch } : it)));
  };

  const addRow = () => {
    onChange([
      ...items,
      {
        id: newId(),
        productId: null,
        name: '',
        unit: '',
        quantity: 1,
        unitPrice: 0,
        taxRate: 10,
      },
    ]);
  };

  const removeRow = (id: string) => {
    onChange(items.filter((it) => it.id !== id));
  };

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  const applyProduct = (id: string, productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) {
      update(id, { productId: null });
      return;
    }
    update(id, {
      productId: product.id,
      name: product.name,
      unit: product.unit,
      unitPrice: resolveUnitPrice(product, customer),
      taxRate: product.taxRate,
    });
  };

  return (
    <div className="items-editor">
      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: 32 }}></th>
            <th>商品</th>
            <th>品名</th>
            <th style={{ width: 70 }}>数量</th>
            <th style={{ width: 70 }}>単位</th>
            <th style={{ width: 110 }}>単価</th>
            <th style={{ width: 90 }}>税率</th>
            <th style={{ width: 110 }}>金額</th>
            <th style={{ width: 70 }}></th>
          </tr>
        </thead>
        <tbody>
          {items.map((item, idx) => (
            <tr key={item.id}>
              <td className="row-handle">
                <button type="button" className="icon-btn" onClick={() => move(idx, -1)} title="上へ">
                  ↑
                </button>
                <button type="button" className="icon-btn" onClick={() => move(idx, 1)} title="下へ">
                  ↓
                </button>
              </td>
              <td>
                <select
                  value={item.productId ?? ''}
                  onChange={(e) => applyProduct(item.id, e.target.value)}
                >
                  <option value="">(自由入力)</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} {p.name}
                    </option>
                  ))}
                </select>
              </td>
              <td>
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => update(item.id, { name: e.target.value })}
                  placeholder="品名・仕様"
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.quantity}
                  onChange={(e) => update(item.id, { quantity: Number(e.target.value) })}
                />
              </td>
              <td>
                <input
                  type="text"
                  value={item.unit}
                  onChange={(e) => update(item.id, { unit: e.target.value })}
                />
              </td>
              <td>
                <input
                  type="number"
                  value={item.unitPrice}
                  onChange={(e) => update(item.id, { unitPrice: Number(e.target.value) })}
                />
              </td>
              <td>
                <select
                  value={item.taxRate}
                  onChange={(e) => update(item.id, { taxRate: Number(e.target.value) as TaxRate })}
                >
                  <option value={10}>10%</option>
                  <option value={8}>8%(軽)</option>
                  <option value={5}>5%(旧税率)</option>
                  <option value={0}>非課税</option>
                </select>
              </td>
              <td className="amount-cell">{formatMoney(itemAmount(item))}</td>
              <td>
                <button type="button" className="icon-btn danger" onClick={() => removeRow(item.id)}>
                  削除
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-secondary" onClick={addRow}>
        + 明細行を追加
      </button>
    </div>
  );
}

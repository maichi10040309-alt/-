import { Fragment, useState } from 'react';
import type { AppData, Vendor } from '../types';
import { uuid } from '../storage';
import { sanitizeToZenginText } from '../utils/kana';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

function emptyVendor(): Vendor {
  return {
    id: uuid(),
    name: '',
    defaultDepartmentId: null,
    bankName: '',
    bankNameKana: '',
    bankCode: '',
    branchName: '',
    branchNameKana: '',
    branchCode: '',
    accountType: 'ordinary',
    accountNumber: '',
    payeeKana: '',
    note: '',
  };
}

export function MasterVendors({ data, updateData }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');

  const usedIds = new Set(data.invoices.map((i) => i.vendorId));
  const vendors = [...data.vendors]
    .filter((v) => v.name.includes(filter))
    .sort((a, b) => a.name.localeCompare(b.name, 'ja'));

  function addVendor() {
    const v = emptyVendor();
    updateData((prev) => ({ ...prev, vendors: [...prev.vendors, v] }));
    setExpandedId(v.id);
  }

  function update(id: string, patch: Partial<Vendor>) {
    updateData((prev) => ({
      ...prev,
      vendors: prev.vendors.map((v) => (v.id === id ? { ...v, ...patch } : v)),
    }));
  }

  function remove(id: string) {
    if (usedIds.has(id)) {
      alert('この取引先は請求データで使用されているため削除できません。');
      return;
    }
    updateData((prev) => ({ ...prev, vendors: prev.vendors.filter((v) => v.id !== id) }));
    if (expandedId === id) setExpandedId(null);
  }

  const zenginReady = (v: Vendor) =>
    v.bankCode.trim() &&
    v.bankNameKana.trim() &&
    v.branchCode.trim() &&
    v.branchNameKana.trim() &&
    v.accountNumber.trim() &&
    v.payeeKana.trim();

  return (
    <div className="panel">
      <h2>取引先マスタ</h2>
      <p className="hint">
        振込データ(全銀形式)を作成するには、銀行コード・支店コード・口座番号・受取人名(カナ)の登録が必要です。
        銀行コード/支店コードは取引先の通帳や振込先指定書、または全国銀行協会の銀行コード検索で確認してください。
      </p>
      <div className="add-row">
        <input placeholder="業者名で絞り込み" value={filter} onChange={(e) => setFilter(e.target.value)} />
        <button onClick={addVendor}>+ 取引先を追加</button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>業者名</th>
            <th>既定部署</th>
            <th>振込先情報</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {vendors.map((v) => (
            <Fragment key={v.id}>
              <tr>
                <td>{v.name || '(未入力)'}</td>
                <td>{data.departments.find((d) => d.id === v.defaultDepartmentId)?.name ?? '-'}</td>
                <td>
                  {zenginReady(v) ? (
                    <span className="badge badge-ok">登録済み</span>
                  ) : (
                    <span className="badge badge-warn">未登録</span>
                  )}
                </td>
                <td className="col-narrow">
                  <button onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}>
                    {expandedId === v.id ? '閉じる' : '編集'}
                  </button>
                  <button className="danger" onClick={() => remove(v.id)}>削除</button>
                </td>
              </tr>
              {expandedId === v.id && (
                <tr>
                  <td colSpan={4}>
                    <div className="vendor-form">
                      <label>
                        業者名
                        <input value={v.name} onChange={(e) => update(v.id, { name: e.target.value })} />
                      </label>
                      <label>
                        既定部署
                        <select
                          value={v.defaultDepartmentId ?? ''}
                          onChange={(e) => update(v.id, { defaultDepartmentId: e.target.value || null })}
                        >
                          <option value="">(指定なし)</option>
                          {data.departments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label>
                        銀行名
                        <input value={v.bankName} onChange={(e) => update(v.id, { bankName: e.target.value })} />
                      </label>
                      <label>
                        銀行名(半角カナ・15文字以内)
                        <input
                          value={v.bankNameKana}
                          maxLength={15}
                          placeholder="例: ｷｼﾕｳ"
                          onChange={(e) => update(v.id, { bankNameKana: e.target.value })}
                          onBlur={(e) => update(v.id, { bankNameKana: sanitizeToZenginText(e.target.value) })}
                        />
                      </label>
                      <label>
                        銀行コード(4桁)
                        <input
                          value={v.bankCode}
                          maxLength={4}
                          placeholder="例: 0001"
                          onChange={(e) => update(v.id, { bankCode: e.target.value.replace(/[^0-9]/g, '') })}
                        />
                      </label>
                      <label>
                        支店名
                        <input value={v.branchName} onChange={(e) => update(v.id, { branchName: e.target.value })} />
                      </label>
                      <label>
                        支店名(半角カナ・15文字以内)
                        <input
                          value={v.branchNameKana}
                          maxLength={15}
                          placeholder="例: ﾎﾝﾃﾝ"
                          onChange={(e) => update(v.id, { branchNameKana: e.target.value })}
                          onBlur={(e) => update(v.id, { branchNameKana: sanitizeToZenginText(e.target.value) })}
                        />
                      </label>
                      <label>
                        支店コード(3桁)
                        <input
                          value={v.branchCode}
                          maxLength={3}
                          placeholder="例: 001"
                          onChange={(e) => update(v.id, { branchCode: e.target.value.replace(/[^0-9]/g, '') })}
                        />
                      </label>
                      <label>
                        預金種目
                        <select
                          value={v.accountType}
                          onChange={(e) => update(v.id, { accountType: e.target.value as Vendor['accountType'] })}
                        >
                          <option value="ordinary">普通</option>
                          <option value="checking">当座</option>
                        </select>
                      </label>
                      <label>
                        口座番号(7桁以内)
                        <input
                          value={v.accountNumber}
                          maxLength={7}
                          onChange={(e) => update(v.id, { accountNumber: e.target.value.replace(/[^0-9]/g, '') })}
                        />
                      </label>
                      <label className="wide">
                        受取人名(半角カナ・30文字以内)
                        <input
                          value={v.payeeKana}
                          maxLength={30}
                          placeholder="例: (カ ｼﾞﾔﾊﾟﾝｼﾖｳｶｲ"
                          onChange={(e) => update(v.id, { payeeKana: e.target.value })}
                          onBlur={(e) => update(v.id, { payeeKana: sanitizeToZenginText(e.target.value) })}
                        />
                      </label>
                      <label className="wide">
                        備考
                        <input value={v.note} onChange={(e) => update(v.id, { note: e.target.value })} />
                      </label>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

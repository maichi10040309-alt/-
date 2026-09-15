import type { AppData, CompanySettings } from '../types';
import { sanitizeToZenginText } from '../utils/kana';

interface Props {
  data: AppData;
  updateData: (updater: (prev: AppData) => AppData) => void;
}

export function MasterCompanySettings({ data, updateData }: Props) {
  const c = data.companySettings;

  function update(patch: Partial<CompanySettings>) {
    updateData((prev) => ({ ...prev, companySettings: { ...prev.companySettings, ...patch } }));
  }

  return (
    <div className="panel">
      <h2>自社情報(振込元)設定</h2>
      <p className="hint">
        全銀形式の振込データを作成する際に必要な「委託者情報(振込元)」です。契約している金融機関から
        指定された委託者コードをご利用ください。不明な場合は取引銀行にお問い合わせください。
      </p>
      <div className="vendor-form">
        <label>
          委託者コード(10桁)
          <input
            value={c.clientCode}
            maxLength={10}
            onChange={(e) => update({ clientCode: e.target.value.replace(/[^0-9]/g, '') })}
          />
        </label>
        <label className="wide">
          委託者名(半角カナ・40文字以内)
          <input
            value={c.clientNameKana}
            maxLength={40}
            onChange={(e) => update({ clientNameKana: e.target.value })}
            onBlur={(e) => update({ clientNameKana: sanitizeToZenginText(e.target.value) })}
          />
        </label>
        <label>
          仕向銀行名
          <input value={c.bankNameKana} onChange={(e) => update({ bankNameKana: e.target.value })}
            onBlur={(e) => update({ bankNameKana: sanitizeToZenginText(e.target.value) })} />
        </label>
        <label>
          仕向銀行番号(4桁)
          <input
            value={c.bankCode}
            maxLength={4}
            onChange={(e) => update({ bankCode: e.target.value.replace(/[^0-9]/g, '') })}
          />
        </label>
        <label>
          仕向支店名
          <input value={c.branchNameKana} onChange={(e) => update({ branchNameKana: e.target.value })}
            onBlur={(e) => update({ branchNameKana: sanitizeToZenginText(e.target.value) })} />
        </label>
        <label>
          仕向支店番号(3桁)
          <input
            value={c.branchCode}
            maxLength={3}
            onChange={(e) => update({ branchCode: e.target.value.replace(/[^0-9]/g, '') })}
          />
        </label>
        <label>
          預金種目
          <select value={c.accountType} onChange={(e) => update({ accountType: e.target.value as CompanySettings['accountType'] })}>
            <option value="ordinary">普通</option>
            <option value="checking">当座</option>
          </select>
        </label>
        <label>
          口座番号(7桁以内)
          <input
            value={c.accountNumber}
            maxLength={7}
            onChange={(e) => update({ accountNumber: e.target.value.replace(/[^0-9]/g, '') })}
          />
        </label>
      </div>
    </div>
  );
}

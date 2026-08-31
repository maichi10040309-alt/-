import type { CompanyInfo, Customer, SalesDocument } from '../types';
import { calcDocumentTotals } from '../utils/tax';
import { formatDateJa, formatMoney } from '../utils/format';

// 合計請求書(掛売り請求書)はA4用紙1枚に印刷する。
// 締め処理で選択された納品書ごとに1明細行を表示し、前回請求額からの繰越計算を行う。
export default function ConsolidatedInvoicePrint({
  doc,
  customer,
  company,
}: {
  doc: SalesDocument;
  customer: Customer | undefined;
  company: CompanyInfo;
}) {
  const totals = calcDocumentTotals(doc.items, company.taxRounding);
  const carryOver = doc.previousBalance - doc.paymentsAmount - doc.bankFee;
  const currentBilling = carryOver + totals.grandTotal;
  const hasAddress = !!customer?.address1;
  const sources = doc.sourceSummaries.length > 0 ? doc.sourceSummaries : [];

  return (
    <div className="print-sheet ci-sheet">
      <div className="ci-header-row">
        <div className="ci-customer-box">
          {hasAddress && (
            <div className="ci-customer-address">
              <div>〒{customer?.zip}</div>
              <div>
                {customer?.address1}
                {customer?.address2}
              </div>
            </div>
          )}
          {(customer?.tel || customer?.fax) && (
            <div className="ci-customer-contact">
              {customer?.tel && <span>Tel：{customer.tel}</span>}
              {customer?.fax && <span>Fax：{customer.fax}</span>}
            </div>
          )}
          <div className="ci-customer-name-row">
            <span className="ci-customer-name">{customer?.name ?? '(得意先未設定)'}</span>
            <span className="ci-customer-suffix">御中</span>
          </div>
          <div className="ci-customer-code-box">お客様コードNo.　{customer?.code ?? ''}</div>
        </div>

        <div className="ci-title-block">
          <div className="ci-title-box">請求　書</div>
          <table className="ci-meta-table">
            <tbody>
              <tr>
                <th>締切分</th>
                <td>{formatDateJa(doc.periodTo)}</td>
              </tr>
              <tr>
                <th>No.</th>
                <td>{doc.number}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="ci-company-row">
        <div className="ci-company-text">
          <div className="ci-company-name">{company.name}</div>
          <div>
            〒{company.zip} {company.address1} {company.address2}
          </div>
          <div>
            TEL:{company.tel} {company.fax && `FAX:${company.fax}`}
          </div>
          {company.invoiceRegistrationNumber && <div>登録番号：{company.invoiceRegistrationNumber}</div>}
          <div className="ci-staff-line">担当：</div>
        </div>
        {company.sealImageDataUrl && (
          <img src={company.sealImageDataUrl} alt="会社印" className="ci-seal" />
        )}
      </div>

      <div className="ci-message-row">毎度ありがとうございます。下記の通り御請求申し上げます。</div>

      <div className="ci-bank-row">
        <div className="ci-bank-box">
          <div className="ci-bank-label">振込先</div>
          <div className="ci-bank-text">{company.bankInfo}</div>
        </div>
        <div className="ci-paid-box">
          {doc.paid && (
            <div className="ci-paid-mark">
              入金済
              {doc.paidDate && <div className="ci-paid-date">{formatDateJa(doc.paidDate)}</div>}
            </div>
          )}
        </div>
      </div>

      <table className="ci-summary-table">
        <thead>
          <tr>
            <th>前回御請求額</th>
            <th>御入金額</th>
            <th>振込手数料</th>
            <th>繰越金額</th>
            <th>税抜御買上額</th>
            <th>消費税</th>
            <th className="ci-summary-highlight">今回御請求額</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="num">{formatMoney(doc.previousBalance)}</td>
            <td className="num">{formatMoney(doc.paymentsAmount)}</td>
            <td className="num">{formatMoney(doc.bankFee)}</td>
            <td className="num">{formatMoney(carryOver)}</td>
            <td className="num">{formatMoney(totals.subtotal)}</td>
            <td className="num">{formatMoney(totals.taxTotal)}</td>
            <td className="num ci-summary-highlight">{formatMoney(currentBilling)}</td>
          </tr>
        </tbody>
      </table>

      <table className="ci-items-table">
        <thead>
          <tr>
            <th className="col-date">伝票日付</th>
            <th className="col-number">伝票No.</th>
            <th className="col-name">品番・品名</th>
            <th className="col-qty">数量</th>
            <th className="col-unit">単位</th>
            <th className="col-price">単価</th>
            <th className="col-amount">税抜御買上額</th>
            <th className="col-note">備考</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s, i) => (
            <tr key={`${s.number}-${i}`}>
              <td>{formatDateJa(s.date)}</td>
              <td>{s.number}</td>
              <td>{s.title}</td>
              <td className="num">1</td>
              <td>式</td>
              <td className="num">{formatMoney(s.subtotal)}</td>
              <td className="num">{formatMoney(s.subtotal)}</td>
              <td></td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="ci-tax-summary-row">
            <td colSpan={6}>【外消費税10%】</td>
            <td className="num">{formatMoney(totals.taxTotal)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>

      {doc.notes && (
        <div className="ci-notes-row">
          <div className="section-label">備考</div>
          <div>{doc.notes}</div>
        </div>
      )}
    </div>
  );
}

import type { CompanyInfo, Customer, SalesDocument } from '../types';
import { calcDocumentTotals } from '../utils/tax';
import { formatDateJa, formatMoney } from '../utils/format';

// 納品書はA4用紙1枚に「原本(上半分)」「控え(下半分)」を印刷し、
// ミシン目や手切りで2つに分けて使う想定のレイアウト。
export default function DeliveryNotePrint({
  doc,
  customer,
  company,
}: {
  doc: SalesDocument;
  customer: Customer | undefined;
  company: CompanyInfo;
}) {
  const totals = calcDocumentTotals(doc.items, company.taxRounding);

  return (
    <div className="print-sheet delivery-a4-sheet">
      <DeliveryHalf variant="original" doc={doc} customer={customer} company={company} totals={totals} />
      <div className="delivery-cut-line">
        <span>✂ きりとり線</span>
      </div>
      <DeliveryHalf variant="copy" doc={doc} customer={customer} company={company} totals={totals} />
    </div>
  );
}

function DeliveryHalf({
  variant,
  doc,
  customer,
  company,
  totals,
}: {
  variant: 'original' | 'copy';
  doc: SalesDocument;
  customer: Customer | undefined;
  company: CompanyInfo;
  totals: ReturnType<typeof calcDocumentTotals>;
}) {
  const title = variant === 'original' ? '納品書' : '納品書（控）';

  return (
    <div className="delivery-half">
      <div className="delivery-header-row">
        <div className="delivery-customer-box">
          <div className="delivery-customer-name">{customer?.name ?? '(得意先未設定)'} 様</div>
          {doc.title && <div className="delivery-doc-title">件名: {doc.title}</div>}
        </div>
        <div className="delivery-title-block">
          <div className="delivery-title-box">{title}</div>
          <table className="delivery-meta-table">
            <tbody>
              <tr>
                <th>発行日</th>
                <td>{formatDateJa(doc.issueDate)}</td>
              </tr>
              <tr>
                <th>No.</th>
                <td>{doc.number}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="delivery-company-row">
        <div className="delivery-company-text">
          <div className="delivery-company-name">{company.name}</div>
          <div>
            〒{company.zip} {company.address1} {company.address2}
          </div>
          <div>
            TEL:{company.tel} {company.fax && `FAX:${company.fax}`}
          </div>
          {company.invoiceRegistrationNumber && <div>登録番号：{company.invoiceRegistrationNumber}</div>}
        </div>
        {company.sealImageDataUrl && <img src={company.sealImageDataUrl} alt="会社印" className="delivery-seal" />}
      </div>

      <div className="delivery-message-row">
        毎度ありがとうございます。下記の通り納品致しましたのでご査収下さい。
      </div>

      <div className="delivery-items-row">
        <table className="delivery-items-table">
          <thead>
            <tr>
              <th className="col-name">品番・品名</th>
              <th className="col-qty">数量</th>
              <th className="col-unit">単位</th>
              <th className="col-price">単価</th>
              <th className="col-amount">金額</th>
              <th className="col-note">備考</th>
            </tr>
          </thead>
          <tbody>
            {doc.items.map((item) => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td className="num">{item.quantity}</td>
                <td>{item.unit}</td>
                <td className="num">{formatMoney(item.unitPrice)}</td>
                <td className="num">{formatMoney(item.quantity * item.unitPrice)}</td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="delivery-inspection-box">
          <thead>
            <tr>
              <th colSpan={2}>検印</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td></td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>

      <table className="delivery-totals-table">
        <tbody>
          <tr>
            <th>税抜合計</th>
            <td className="num">{formatMoney(totals.subtotal)}</td>
            <th>消費税額</th>
            <td className="num">{formatMoney(totals.taxTotal)}</td>
            <th>合計金額</th>
            <td className="num strong">{formatMoney(totals.grandTotal)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

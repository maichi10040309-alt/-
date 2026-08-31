import type { CompanyInfo, Customer, SalesDocument } from '../types';
import { calcDocumentTotals } from '../utils/tax';
import { formatDateJa, formatMoney } from '../utils/format';

const MIN_ITEM_ROWS = 5;

// 納品書はA4用紙1枚に「原本(上半分)」「控え(下半分)」を印刷する。
// 用紙自体にきりとり線が印刷済みのため、アプリ側では線を描画しない。
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
  const blankRowCount = Math.max(0, MIN_ITEM_ROWS - doc.items.length);
  const hasAddress = !!customer?.address1;

  return (
    <div className="delivery-half">
      <div className="delivery-header-row">
        <div className="delivery-customer-box">
          {hasAddress && (
            <div className="delivery-customer-address">
              <div>〒{customer?.zip}</div>
              <div>
                {customer?.address1}
                {customer?.address2}
              </div>
            </div>
          )}
          {(customer?.tel || customer?.fax) && (
            <div className="delivery-customer-contact">
              {customer?.tel && <span>Tel：{customer.tel}</span>}
              {customer?.fax && <span>Fax：{customer.fax}</span>}
            </div>
          )}
          <div className="delivery-customer-name-row">
            <span className="delivery-customer-name">{customer?.name ?? '(得意先未設定)'}</span>
            <span className="delivery-customer-suffix">御中</span>
          </div>
          <div className="delivery-customer-code-row">お客様番号　{customer?.code ?? ''}</div>
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
          <div className="delivery-page-indicator">Page. 1 / 1</div>
        </div>
      </div>

      <div className="delivery-company-inspection-row">
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
            <div className="delivery-tag-box">{doc.deliveryTag || ' '}</div>
          </div>
          {doc.paid && <div className="delivery-paid-mark">入金済</div>}
          {company.sealImageDataUrl && (
            <img src={company.sealImageDataUrl} alt="会社印" className="delivery-seal" />
          )}
        </div>
        <div className="delivery-inspection-group">
          <table className="delivery-inspection-box">
            <thead>
              <tr>
                <th>検印</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td></td>
              </tr>
            </tbody>
          </table>
          <table className="delivery-inspection-box">
            <thead>
              <tr>
                <th>検印</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
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
            {Array.from({ length: blankRowCount }).map((_, i) => (
              <tr key={`blank-${i}`}>
                <td>&nbsp;</td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <table className="delivery-totals-table">
        <tbody>
          <tr>
            <th className="delivery-totals-label" rowSpan={1}>
              合計
            </th>
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

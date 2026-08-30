import type { CompanyInfo, Customer, DocumentType, SalesDocument } from '../types';
import { DOCUMENT_TYPE_LABEL } from '../types';
import { calcDocumentTotals } from '../utils/tax';
import { formatDateJa, formatMoney } from '../utils/format';
import { getPaperClass } from '../utils/printPaper';
import TotalsBox from './TotalsBox';

export default function DocumentPrintSheet({
  doc,
  customer,
  company,
  docType,
}: {
  doc: SalesDocument;
  customer: Customer | undefined;
  company: CompanyInfo;
  docType: DocumentType;
}) {
  const totals = calcDocumentTotals(doc.items, company.taxRounding);
  const label = DOCUMENT_TYPE_LABEL[docType];
  const isReceipt = docType === 'receipt';
  const isConsolidated = docType === 'consolidated_invoice';
  const needsStamp = isReceipt && totals.grandTotal >= 50000;
  const paperClass = getPaperClass(docType);

  return (
    <div className={`print-sheet ${paperClass}`}>
      <h1 className="print-title">{label}</h1>

      <div className="print-top-row">
        <div className="print-customer-block">
          <div className="print-customer-name">{customer?.name ?? '(得意先未設定)'} 様</div>
          {doc.title && <div className="print-doc-title">件名: {doc.title}</div>}
        </div>
        <div className="print-meta-block">
          <table className="print-meta-table">
            <tbody>
              <tr>
                <th>{label}番号</th>
                <td>{doc.number}</td>
              </tr>
              <tr>
                <th>発行日</th>
                <td>{formatDateJa(doc.issueDate)}</td>
              </tr>
              {docType === 'quotation' && (
                <tr>
                  <th>有効期限</th>
                  <td>{formatDateJa(doc.validUntilDate)}</td>
                </tr>
              )}
              {(docType === 'invoice' || isConsolidated) && (
                <tr>
                  <th>お支払期限</th>
                  <td>{formatDateJa(doc.dueDate)}</td>
                </tr>
              )}
              {company.invoiceRegistrationNumber && (
                <tr>
                  <th>登録番号</th>
                  <td>{company.invoiceRegistrationNumber}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isReceipt ? (
        <div className="receipt-block">
          <div className="receipt-amount-row">
            <span>金額</span>
            <span className="receipt-amount">{formatMoney(totals.grandTotal)}</span>
            <span>也</span>
          </div>
          <div className="receipt-note">但し {doc.title || '代金'} として上記正に領収いたしました。</div>
          {needsStamp && <div className="receipt-stamp-note">※5万円以上のため収入印紙貼付欄</div>}
        </div>
      ) : (
        <>
          {isConsolidated && (
            <table className="print-meta-table balance-table">
              <tbody>
                <tr>
                  <th>対象期間</th>
                  <td>
                    {formatDateJa(doc.periodFrom)} 〜 {formatDateJa(doc.periodTo)}
                  </td>
                </tr>
                <tr>
                  <th>前回繰越残高</th>
                  <td>{formatMoney(doc.previousBalance)}</td>
                </tr>
                <tr>
                  <th>ご入金額</th>
                  <td>{formatMoney(doc.paymentsAmount)}</td>
                </tr>
              </tbody>
            </table>
          )}

          <table className="items-table print-items-table">
            <thead>
              <tr>
                <th>品名</th>
                <th>数量</th>
                <th>単位</th>
                <th>単価</th>
                <th>税率</th>
                <th>金額</th>
              </tr>
            </thead>
            <tbody>
              {doc.items.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td className="num">{item.quantity}</td>
                  <td>{item.unit}</td>
                  <td className="num">{formatMoney(item.unitPrice)}</td>
                  <td className="num">{item.taxRate === 0 ? '非課税' : `${item.taxRate}%`}</td>
                  <td className="num">{formatMoney(item.quantity * item.unitPrice)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="print-totals-row">
            <TotalsBox totals={totals} />
          </div>

          {isConsolidated && (
            <table className="print-meta-table balance-table">
              <tbody>
                <tr className="grand-total">
                  <th>今回御請求額(次回繰越残高)</th>
                  <td>{formatMoney(doc.previousBalance + totals.grandTotal - doc.paymentsAmount)}</td>
                </tr>
              </tbody>
            </table>
          )}

          {docType === 'invoice' && company.bankInfo && (
            <div className="print-bank-info">
              <div className="section-label">お振込先</div>
              <div>{company.bankInfo}</div>
            </div>
          )}
        </>
      )}

      {doc.notes && (
        <div className="print-notes">
          <div className="section-label">備考</div>
          <div className="print-notes-body">{doc.notes}</div>
        </div>
      )}

      <div className="print-company-block">
        <div>{company.name}</div>
        <div className="print-company-text">
          <div>
            〒{company.zip} {company.address1} {company.address2}
          </div>
          <div>
            TEL: {company.tel} {company.fax && `FAX: ${company.fax}`}
          </div>
          {company.email && <div>Email: {company.email}</div>}
          {company.representativeName && <div>{company.representativeName}</div>}
        </div>
        {company.sealImageDataUrl && (
          <img src={company.sealImageDataUrl} alt="会社印" className="print-seal-image" />
        )}
      </div>
    </div>
  );
}

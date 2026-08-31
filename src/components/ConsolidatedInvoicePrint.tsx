import type { CompanyInfo, Customer, DocumentSourceSummary, SalesDocument } from '../types';
import { calcDocumentTotals } from '../utils/tax';
import { formatDateJa, formatDateShort, formatMoney } from '../utils/format';

// 明細欄は自動で伸縮させず、1ページあたりの行数をあらかじめ固定する。
// これを超える明細がある場合は2ページ目以降に分けて印刷する。
const ROWS_PER_PAGE = 20;

// 合計請求書(掛売り請求書)。ヒサゴの合計請求書用紙のレイアウトに合わせている。
export default function ConsolidatedInvoicePrint({
  doc,
  customer,
  company,
}: {
  doc: SalesDocument;
  customer: Customer | undefined;
  company: CompanyInfo;
}) {
  // 本機能追加前に発行した合計請求書には sourceSummaries が存在しないため空配列にフォールバックする
  const sources = doc.sourceSummaries ?? [];
  const totalPages = Math.max(1, Math.ceil(sources.length / ROWS_PER_PAGE));
  const pages = Array.from({ length: totalPages }, (_, i) =>
    sources.slice(i * ROWS_PER_PAGE, (i + 1) * ROWS_PER_PAGE),
  );

  return (
    <>
      {pages.map((pageSources, i) => (
        <ConsolidatedInvoicePage
          key={i}
          doc={doc}
          customer={customer}
          company={company}
          pageSources={pageSources}
          pageNumber={i + 1}
          totalPages={totalPages}
        />
      ))}
    </>
  );
}

function ConsolidatedInvoicePage({
  doc,
  customer,
  company,
  pageSources,
  pageNumber,
  totalPages,
}: {
  doc: SalesDocument;
  customer: Customer | undefined;
  company: CompanyInfo;
  pageSources: DocumentSourceSummary[];
  pageNumber: number;
  totalPages: number;
}) {
  const totals = calcDocumentTotals(doc.items, company.taxRounding);
  const previousBalance = doc.previousBalance ?? 0;
  const paymentsAmount = doc.paymentsAmount ?? 0;
  const bankFee = doc.bankFee ?? 0;
  // 振込手数料は用紙に専用欄がないため、繰越金額に織り込んで計算する
  const carryOver = previousBalance - paymentsAmount - bankFee;
  const currentBilling = carryOver + totals.grandTotal;
  const hasAddress = !!customer?.address1;
  const blankRowCount = Math.max(0, ROWS_PER_PAGE - pageSources.length);
  const hasBankInfo = company.bankBranch || company.bankAccount || company.bankAccountHolder;

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
        </div>

        <div className="ci-title-block">
          <div className="ci-title-box">請求書</div>
          <div className="ci-meta-line">
            <span>{formatDateJa(doc.periodTo)}　締切分</span>
            <span className="ci-meta-no">No.　{doc.number}</span>
          </div>
          <div className="ci-page-indicator">
            Page. {pageNumber} / {totalPages}
          </div>
        </div>
      </div>

      <div className="ci-customer-code-row">お客様コードNo.　{customer?.code ?? ''}</div>

      <div className="ci-company-inspection-row">
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
            {hasBankInfo && (
              <div className="ci-bank-block">
                <div>お振込先：{company.bankBranch}</div>
                <div>{company.bankAccount}</div>
                <div>{company.bankAccountHolder}</div>
              </div>
            )}
          </div>
          {company.sealImageDataUrl && (
            <img src={company.sealImageDataUrl} alt="会社印" className="ci-seal" />
          )}
        </div>
        <div className="ci-inspection-group">
          <table className="ci-inspection-box">
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
          <table className="ci-inspection-box">
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

      <div className="ci-message-row">
        毎度ありがとうございます。下記の通り御請求申し上げます。
        {doc.paid && (
          <span className="ci-paid-mark">
            入金済{doc.paidDate && `(${formatDateJa(doc.paidDate)})`}
          </span>
        )}
      </div>

      <table className="ci-summary-table">
        <thead>
          <tr>
            <th>前回御請求額</th>
            <th>御入金額</th>
            <th>繰越金額</th>
            <th>税抜御買上額</th>
            <th>消費税等</th>
            <th className="ci-summary-highlight">今回御請求額</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="num">{formatMoney(previousBalance)}</td>
            <td className="num">{formatMoney(paymentsAmount)}</td>
            <td className="num">{formatMoney(carryOver)}</td>
            <td className="num">{formatMoney(totals.subtotal)}</td>
            <td className="num">{formatMoney(totals.taxTotal)}</td>
            <td className="num ci-summary-highlight">{formatMoney(currentBilling)}</td>
          </tr>
        </tbody>
      </table>

      <div className="ci-items-row">
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
            {pageSources.map((s, i) => (
              <tr key={`${s.number}-${i}`}>
                <td>{formatDateShort(s.date)}</td>
                <td>{s.number}</td>
                <td>{s.title}</td>
                <td className="num">1</td>
                <td>式</td>
                <td className="num">{formatMoney(s.subtotal)}</td>
                <td className="num">{formatMoney(s.subtotal)}</td>
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
                <td></td>
                <td></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {doc.notes && (
        <div className="ci-notes-row">
          <div className="section-label">備考</div>
          <div>{doc.notes}</div>
        </div>
      )}
    </div>
  );
}

import type { CSSProperties, ReactNode } from 'react';
import type { CompanyInfo, Customer, DocumentSourceSummary, SalesDocument } from '../types';
import { calcDocumentTotals } from '../utils/tax';
import { formatDateShort, formatMoney } from '../utils/format';

// ヒサゴ「GB1116」プレ印刷済み請求書用紙に合わせた印刷レイアウト。
// 用紙にあらかじめ罫線・項目名(請求書、前回御請求額、伝票日付...等)が印刷されているため、
// このコンポーネントは枠線や見出しを一切描画せず、数値・文字だけを実測した座標(mm)に
// 絶対配置する。座標は実際の用紙をスキャンしたPDF(A4・300dpi)から測定した値。
// 個々の印刷機の給紙ズレなどにより数mmの誤差が出ることがあるため、
// 会社設定の「合計請求書 印刷位置の微調整」(offsetX/offsetY)で吸収する。

const ROWS_PER_PAGE = 20;
// 明細欄: 上端93.68mm 〜 下端284.52mm を20行に均等割り
const ITEMS_TOP = 93.68;
const ITEMS_BOTTOM = 284.52;
const ROW_HEIGHT = (ITEMS_BOTTOM - ITEMS_TOP) / ROWS_PER_PAGE;

// 品番・品名/数量/単位/単価/税抜御買上額/備考の各列の右端(mm)。伝票日付・伝票No.は左寄せのため開始位置。
const COL = {
  date: 18.5, // 伝票日付(左寄せ開始位置)
  number: 38.5, // 伝票No.(左寄せ開始位置)
  nameLeft: 51.5, // 品番・品名(左寄せ開始位置)
  nameRight: 97.5,
  qtyRight: 112.5,
  unitRight: 122.5,
  priceRight: 148.5,
  amountRight: 173.5,
  noteLeft: 176.5,
  noteRight: 199.5,
};

// 伝票No.欄は幅が約13mmしかなく、当システムが発行する伝票番号(例: 「D-2026-0001」)は
// そのままでは収まらず省略表示になってしまう。「D-」のような種別接頭辞と、年を2桁に
// 短縮することで、実用上ほぼ収まる長さにする(旧ソフトの番号など元々短いものはそのまま)。
function shortenSlipNumber(number: string): string {
  const m = number.match(/^[A-Za-z]+-(\d{4})-(\d+)$/);
  if (!m) return number;
  const [, yearStr, seq] = m;
  return `${yearStr.slice(2)}-${seq}`;
}

function Field({
  left,
  right,
  top,
  align = 'left',
  size = 3.4,
  bold = false,
  children,
}: {
  left?: number;
  right?: number;
  top: number;
  align?: 'left' | 'right' | 'center';
  size?: number;
  bold?: boolean;
  children: ReactNode;
}) {
  const style: CSSProperties = {
    position: 'absolute',
    top: `${top}mm`,
    fontSize: `${size}mm`,
    fontWeight: bold ? 700 : 400,
    whiteSpace: 'nowrap',
  };
  if (align === 'right') {
    style.right = `${210 - (right ?? 0)}mm`;
    style.textAlign = 'right';
  } else if (align === 'center') {
    style.left = `${left}mm`;
    style.width = `${(right ?? 0) - (left ?? 0)}mm`;
    style.textAlign = 'center';
  } else {
    style.left = `${left}mm`;
    style.textAlign = 'left';
    // 右端(right)も指定されている場合、隣の列にはみ出さないよう幅を制限して省略記号で切る
    // (品番・品名など、内容が長くなりがちな左寄せ欄向け)
    if (right !== undefined && left !== undefined) {
      style.width = `${right - left}mm`;
      style.overflow = 'hidden';
      style.textOverflow = 'ellipsis';
    }
  }
  return <div style={style}>{children}</div>;
}

export default function ConsolidatedInvoicePrintHisago({
  doc,
  customer,
  company,
}: {
  doc: SalesDocument;
  customer: Customer | undefined;
  company: CompanyInfo;
}) {
  const sources = doc.sourceSummaries ?? [];
  const totalPages = Math.max(1, Math.ceil(sources.length / ROWS_PER_PAGE));
  const pages = Array.from({ length: totalPages }, (_, i) =>
    sources.slice(i * ROWS_PER_PAGE, (i + 1) * ROWS_PER_PAGE),
  );
  const offsetX = company.consolidatedInvoicePrintOffsetX ?? 0;
  const offsetY = company.consolidatedInvoicePrintOffsetY ?? 0;

  return (
    <>
      {pages.map((pageSources, i) => (
        <div className="print-sheet ci-hisago-page-outer" key={i}>
          <div className="ci-hisago-page" style={{ transform: `translate(${offsetX}mm, ${offsetY}mm)` }}>
            <ConsolidatedInvoicePageHisago
              doc={doc}
              customer={customer}
              company={company}
              pageSources={pageSources}
              pageIndex={i}
            />
          </div>
        </div>
      ))}
    </>
  );
}

function ConsolidatedInvoicePageHisago({
  doc,
  customer,
  company,
  pageSources,
  pageIndex,
}: {
  doc: SalesDocument;
  customer: Customer | undefined;
  company: CompanyInfo;
  pageSources: DocumentSourceSummary[];
  pageIndex: number;
}) {
  const totals = calcDocumentTotals(doc.items, company.taxRounding);
  const previousBalance = doc.previousBalance ?? 0;
  const paymentsAmount = doc.paymentsAmount ?? 0;
  const bankFee = doc.bankFee ?? 0;
  const carryOver = previousBalance - paymentsAmount - bankFee;
  const currentBilling = carryOver + totals.grandTotal;
  // 締め処理で新しく発行した合計請求書はperiodToを持つが、この機能を追加する前の
  // 旧ソフトからの取り込みデータにはperiodTo(対象期間)が保存されていないため、
  // その場合は発行日を締切日として代わりに使う
  const [y, m, d] = (doc.periodTo || doc.issueDate || '').split('-');

  return (
    <>
      {/* 宛先(自由配置。用紙側に罫線・見出しは無い) */}
      {customer?.zip && (
        <Field left={20} top={15} size={3.2}>
          〒{customer.zip}
        </Field>
      )}
      <Field left={20} top={19.5} size={3.2}>
        {customer?.address1}
        {customer?.address2}
      </Field>
      <Field left={20} top={33} size={4.4} bold>
        {customer?.name ?? '(得意先未設定)'}　御中
      </Field>

      {/* 締切日・請求書No.(プレ印刷の「年」「月」「日」の直前に、各数値の右端を合わせる)
          ※実際の印刷物とスキャン画像を突き合わせて位置を再計測し補正済み */}
      {pageIndex === 0 && (
        <>
          <Field right={122} top={16} align="right">
            {y}
          </Field>
          <Field right={135} top={16} align="right">
            {m ? Number(m) : ''}
          </Field>
          <Field right={148} top={16} align="right">
            {d ? Number(d) : ''}
          </Field>
        </>
      )}
      <Field left={185} top={16}>
        {doc.number}
      </Field>

      {/* 自社情報・振込先情報(用紙の「年月日締切分No.」欄と集計欄の間は印刷済みの罫線・見出しが
          無い空白部分のため、ここに設定画面で登録した内容を差し込む) */}
      {pageIndex === 0 && (
        <>
          <Field left={108} top={27} size={4} bold>
            {company.name}
          </Field>
          <Field left={108} top={32} size={2.7}>
            {company.zip && `〒${company.zip} `}
            {company.address1}
            {company.address2}
          </Field>
          <Field left={108} top={36.5} size={2.7}>
            {company.tel && `TEL:${company.tel}`} {company.fax && `FAX:${company.fax}`}
          </Field>
          {company.invoiceRegistrationNumber && (
            <Field left={108} top={41} size={2.7}>
              登録番号：{company.invoiceRegistrationNumber}
            </Field>
          )}
          {company.sealImageDataUrl && (
            <img
              src={company.sealImageDataUrl}
              alt="会社印"
              style={{ position: 'absolute', left: '178mm', top: '25mm', width: '20mm', height: '20mm', objectFit: 'contain' }}
            />
          )}
          {(company.bankBranch || company.bankAccount || company.bankAccountHolder) && (
            <>
              <Field left={108} top={54} size={2.7}>
                {company.bankBranch}
              </Field>
              <Field left={108} top={58} size={2.7}>
                {company.bankAccount}
              </Field>
              <Field left={108} top={62} size={2.7}>
                {company.bankAccountHolder}
              </Field>
            </>
          )}
        </>
      )}

      {/* お客様コードNo. */}
      <Field left={48} top={56.5}>
        {customer?.code ?? ''}
      </Field>

      {/* 集計行(1ページ目のみ。2ページ目以降は同じ値を繰り返し印字すると紛らわしいため省略) */}
      {pageIndex === 0 && (
        <>
          <Field right={41.5} top={82.5} align="right">
            {formatMoney(previousBalance)}
          </Field>
          <Field right={67} top={82.5} align="right">
            {formatMoney(paymentsAmount)}
          </Field>
          <Field right={118} top={82.5} align="right">
            {formatMoney(carryOver)}
          </Field>
          <Field right={143.5} top={82.5} align="right">
            {formatMoney(totals.subtotal)}
          </Field>
          <Field right={169} top={82.5} align="right">
            {formatMoney(totals.taxTotal)}
          </Field>
          <Field right={199} top={82.5} align="right" bold>
            {formatMoney(currentBilling)}
          </Field>
        </>
      )}

      {/* 明細行 */}
      {pageSources.map((s, i) => {
        const top = ITEMS_TOP + ROW_HEIGHT * i + ROW_HEIGHT / 2 - 1.6;
        return (
          <div key={`${s.number}-${i}`}>
            <Field left={COL.date} right={36.5} top={top} size={3}>
              {formatDateShort(s.date)}
            </Field>
            <Field left={COL.number} right={49.5} top={top} size={2.6}>
              {shortenSlipNumber(s.number)}
            </Field>
            <Field left={COL.nameLeft} right={COL.nameRight} top={top} size={3}>
              {s.title}
            </Field>
            <Field right={COL.qtyRight} top={top} align="right" size={3}>
              1
            </Field>
            <Field left={COL.qtyRight} right={COL.unitRight} top={top} align="center" size={3}>
              式
            </Field>
            <Field right={COL.priceRight} top={top} align="right" size={3}>
              {formatMoney(s.subtotal)}
            </Field>
            <Field right={COL.amountRight} top={top} align="right" size={3}>
              {formatMoney(s.subtotal)}
            </Field>
          </div>
        );
      })}
    </>
  );
}

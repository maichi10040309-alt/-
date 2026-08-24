import type { DocumentTotals } from '../utils/tax';
import { formatMoney } from '../utils/format';

export default function TotalsBox({ totals }: { totals: DocumentTotals }) {
  return (
    <table className="totals-box">
      <tbody>
        <tr>
          <th>小計</th>
          <td>{formatMoney(totals.subtotal)}</td>
        </tr>
        {totals.taxSummary.map((t) => (
          <tr key={t.rate}>
            <th>{t.rate === 0 ? '非課税対象' : `消費税(${t.rate}%対象: ${formatMoney(t.taxableAmount)})`}</th>
            <td>{formatMoney(t.taxAmount)}</td>
          </tr>
        ))}
        <tr className="grand-total">
          <th>合計金額</th>
          <td>{formatMoney(totals.grandTotal)}</td>
        </tr>
      </tbody>
    </table>
  );
}

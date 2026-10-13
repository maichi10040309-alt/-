/** A4印刷領域に、長い調整明細も含めて1ページで収める。Ctrl+Pにも対応。 */
export function fitInvoiceForPrint() {
  const sheet = document.querySelector<HTMLElement>('#invoice-sheet');
  if (!sheet) return;
  sheet.style.removeProperty('zoom');
  sheet.style.removeProperty('--invoice-page-height');
  sheet.classList.add('invoice-measure-print');
  const pageHeight = 272 * 96 / 25.4;
  const scale = Math.min(1, pageHeight / sheet.scrollHeight);
  sheet.style.setProperty('zoom', String(scale));
  sheet.style.setProperty('--invoice-page-height', `${272 / scale}mm`);
  sheet.classList.remove('invoice-measure-print');
}
window.addEventListener('beforeprint', fitInvoiceForPrint);
window.addEventListener('afterprint', () => {
  const sheet = document.querySelector<HTMLElement>('#invoice-sheet');
  sheet?.style.removeProperty('zoom');
  sheet?.style.removeProperty('--invoice-page-height');
});

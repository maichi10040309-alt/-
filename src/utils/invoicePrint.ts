/** A4印刷領域に、長い調整明細も含めて請求書ごとに1ページで収める。 */
export function fitInvoiceForPrint() {
  document.querySelectorAll<HTMLElement>('.invoice-sheet').forEach((sheet) => {
    sheet.style.removeProperty('zoom');
    sheet.style.removeProperty('--invoice-page-height');
    sheet.classList.add('invoice-measure-print');
    const pageHeight = 272 * 96 / 25.4;
    const scale = Math.min(1, pageHeight / sheet.scrollHeight);
    sheet.style.setProperty('zoom', String(scale));
    sheet.style.setProperty('--invoice-page-height', `${272 / scale}mm`);
    sheet.classList.remove('invoice-measure-print');
  });
}
window.addEventListener('beforeprint', fitInvoiceForPrint);
window.addEventListener('afterprint', () => {
  document.querySelectorAll<HTMLElement>('.invoice-sheet').forEach((sheet) => {
    sheet.style.removeProperty('zoom');
    sheet.style.removeProperty('--invoice-page-height');
  });
  document.querySelector('#invoice-batch-print')?.remove();
  document.body.classList.remove('invoice-batch-printing');
});

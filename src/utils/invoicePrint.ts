/** 初回の一括印刷でも社印の画像デコード完了を待ってから印刷する。 */
export async function waitForInvoiceImages(root: ParentNode): Promise<void> {
  await Promise.all(Array.from(root.querySelectorAll<HTMLImageElement>('.inv-company-seal')).map(async (image) => {
    if (typeof image.decode === 'function') await image.decode();
    else if (!image.complete) await new Promise<void>((resolve, reject) => {
      image.addEventListener('load', () => resolve(), { once: true });
      image.addEventListener('error', () => reject(new Error('社印の読み込みに失敗しました')), { once: true });
    });
  }));
}

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

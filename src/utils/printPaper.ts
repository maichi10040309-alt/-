import type { DocumentType } from '../types';

// 既定の帳票用紙に合わせた用紙サイズ・余白
// 納品書: A4用紙に原本(上半分)・控え(下半分)を印刷するレイアウト(DeliveryNotePrint参照)。
//   左右にわずかな余白を確保しつつ、上下は最小限にして原本・控えの境界がページ中央に来るようにする。
// 請求書: ヒサゴ 請求書 1面2穴 インボイス対応 A4(ヨコ210×タテ297mm)
export function getPaperClass(docType: DocumentType): string {
  return docType === 'invoice' ? 'print-page-invoice' : '';
}

export function getPaperCss(docType: DocumentType): string | null {
  if (docType === 'delivery') return '@page { size: 210mm 297mm; margin: 4mm 6mm; }';
  if (docType === 'invoice') return '@page { size: 210mm 297mm; margin: 15mm 15mm 15mm 22mm; }';
  return null;
}

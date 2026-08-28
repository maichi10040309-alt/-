import type { DocumentType } from '../types';

// 既定の帳票用紙に合わせた用紙サイズ・余白
// 納品書: FSC認証プリンタ帳票用紙マルチタイプ 白紙/2分割・4穴(ミシン目切離し後 タテ148.5×ヨコ210mm)
// 請求書: ヒサゴ 請求書 1面2穴 インボイス対応 A4(ヨコ210×タテ297mm)
// 穴の正確な位置は用紙により異なるため、日本の2穴パンチJIS規格(穴中心が端から12mm、
// 穴径6mm)を目安に左端へ安全マージンを確保している。実機で試し印刷し必要に応じ調整すること。
export function getPaperClass(docType: DocumentType): string {
  return docType === 'delivery' ? 'print-page-delivery' : docType === 'invoice' ? 'print-page-invoice' : '';
}

export function getPaperCss(docType: DocumentType): string | null {
  if (docType === 'delivery') return '@page { size: 210mm 148.5mm; margin: 8mm 10mm 8mm 20mm; }';
  if (docType === 'invoice') return '@page { size: 210mm 297mm; margin: 15mm 15mm 15mm 22mm; }';
  return null;
}

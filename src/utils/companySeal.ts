import type { CompanySettings } from '@/types';

export function isSealDataUrl(value: unknown): value is string {
  return typeof value === 'string' && value.length <= 2_000_000 && /^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(value);
}

// 共有設定の既存TEXT列に拡張情報を保存する。旧来の振込先テキストもそのまま読み込める。
// 既存DBの列追加が不要なため、社印を登録した直後から他の端末にも共有される。
export function encodeCompanyExtras(company: Pick<CompanySettings, 'bankInfo' | 'sealDataUrl'>): string {
  return isSealDataUrl(company.sealDataUrl)
    ? JSON.stringify({ rentalCompanyExtras: 1, bankInfo: company.bankInfo, sealDataUrl: company.sealDataUrl })
    : company.bankInfo;
}

export function decodeCompanyExtras(raw: unknown): Pick<CompanySettings, 'bankInfo' | 'sealDataUrl'> {
  const text = typeof raw === 'string' ? raw : '';
  try {
    const data = JSON.parse(text);
    if (data?.rentalCompanyExtras === 1 && typeof data.bankInfo === 'string') {
      return { bankInfo: data.bankInfo, sealDataUrl: isSealDataUrl(data.sealDataUrl) ? data.sealDataUrl : '' };
    }
  } catch { /* 従来の振込先テキスト */ }
  return { bankInfo: text, sealDataUrl: '' };
}

/** PNGに統一し、透明部分を保持したまま印刷用画像のサイズを抑える。 */
export async function readSealImage(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('PNG・JPEG・WebP形式の画像を選択してください。');
  }
  if (file.size > 5 * 1024 * 1024) throw new Error('画像は5MB以下のファイルを選択してください。');
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    if (!image.naturalWidth || !image.naturalHeight) throw new Error('画像を読み込めませんでした。');
    const ratio = Math.min(1, 600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * ratio));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * ratio));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('画像の読み込みに対応していないブラウザです。');
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/png');
    if (!isSealDataUrl(dataUrl)) throw new Error('画像を変換できませんでした。別の画像をお試しください。');
    return dataUrl;
  } finally { URL.revokeObjectURL(url); }
}

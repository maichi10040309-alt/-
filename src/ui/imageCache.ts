// 画像アセット(base64データURI)を HTMLImageElement にキャッシュして使い回す。
// data: URI はネットワーク取得が無いためほぼ同期的に読み込まれるが、
// 念のため img.complete を見て未読み込み時は描画をスキップする。

const cache = new Map<string, HTMLImageElement>();

export function getImage(src: string): HTMLImageElement {
  let img = cache.get(src);
  if (!img) {
    img = new Image();
    img.src = src;
    cache.set(src, img);
  }
  return img;
}

/** 足元(中央下端)を基準にアスペクト比を保って描画する(キャラクター用) */
export function drawSpriteAtFeet(ctx: CanvasRenderingContext2D, img: HTMLImageElement, footX: number, footY: number, height: number): void {
  if (!img.complete || !img.naturalWidth) return;
  const scale = height / img.naturalHeight;
  const w = img.naturalWidth * scale;
  ctx.drawImage(img, footX - w / 2, footY - height, w, height);
}

/** 矩形内にアスペクト比を保って収め、下端揃え・中央寄せで描画する(建物用) */
export function drawImageFitBottom(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, maxW: number, maxH: number): void {
  if (!img.complete || !img.naturalWidth) return;
  const scale = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  const dx = x + (maxW - w) / 2;
  const dy = y + (maxH - h);
  ctx.drawImage(img, dx, dy, w, h);
}

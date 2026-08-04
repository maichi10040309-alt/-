import type { CharacterDef } from '@/types';
import { CHARACTER_PORTRAITS, SHOP_ROOM_IMAGES } from '@/data/imageAssets';
import { getImage, drawSpriteAtFeet } from './imageCache';
import { drawShadow } from './pixelArt';
import { CANVAS_W, CANVAS_H, type PlayerSprite } from './mapRenderer';

export interface InteriorLayout {
  imgX: number;
  imgY: number;
  imgW: number;
  imgH: number;
  entrance: { x: number; y: number };
  characterSpot: { x: number; y: number };
}

const MARGIN_X = 40;
const MARGIN_TOP = 66;
const MARGIN_BOTTOM = 76;

/** 部屋画像の自然サイズに合わせて、キャンバス内に収まるレイアウトを計算する */
export function computeInteriorLayout(roomKey: string): InteriorLayout {
  const img = getImage(SHOP_ROOM_IMAGES[roomKey]);
  const naturalW = img.naturalWidth || 320;
  const naturalH = img.naturalHeight || 180;
  const maxW = CANVAS_W - MARGIN_X * 2;
  const maxH = CANVAS_H - MARGIN_TOP - MARGIN_BOTTOM;
  const scale = Math.min(maxW / naturalW, maxH / naturalH);
  const imgW = naturalW * scale;
  const imgH = naturalH * scale;
  const imgX = (CANVAS_W - imgW) / 2;
  const imgY = MARGIN_TOP + (maxH - imgH) / 2;
  return {
    imgX,
    imgY,
    imgW,
    imgH,
    entrance: { x: CANVAS_W / 2, y: imgY + imgH - 16 },
    characterSpot: { x: CANVAS_W / 2, y: imgY + imgH * 0.42 },
  };
}

export type InteriorHit = { type: 'character' } | { type: 'exit' } | null;

const CHARACTER_HIT_RADIUS = 50;
const EXIT_HIT_W = 140;

export function hitTestInterior(x: number, y: number, layout: InteriorLayout): InteriorHit {
  const dx = x - layout.characterSpot.x;
  const dy = y - layout.characterSpot.y;
  if (Math.hypot(dx, dy) < CHARACTER_HIT_RADIUS) return { type: 'character' };

  const ex = layout.entrance.x;
  const ey = layout.entrance.y;
  if (x >= ex - EXIT_HIT_W / 2 && x <= ex + EXIT_HIT_W / 2 && y >= ey - 30 && y <= ey + 30) {
    return { type: 'exit' };
  }
  return null;
}

/** プレイヤーの移動先を部屋の床範囲内に収める(棚の裏や壁の外へは歩かせない簡易クランプ) */
export function clampToInterior(x: number, y: number, layout: InteriorLayout): { x: number; y: number } {
  const padX = 28;
  return {
    x: Math.min(layout.imgX + layout.imgW - padX, Math.max(layout.imgX + padX, x)),
    y: Math.min(layout.imgY + layout.imgH - 12, Math.max(layout.imgY + layout.imgH * 0.4, y)),
  };
}

function drawInteriorBackdrop(ctx: CanvasRenderingContext2D): void {
  const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  bg.addColorStop(0, '#4a3560');
  bg.addColorStop(1, '#2c1e40');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

export function renderShopInterior(
  ctx: CanvasRenderingContext2D,
  roomKey: string,
  char: CharacterDef | null,
  title: string,
  animClock: number,
  player: PlayerSprite
): InteriorLayout {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawInteriorBackdrop(ctx);

  const layout = computeInteriorLayout(roomKey);
  const roomImg = getImage(SHOP_ROOM_IMAGES[roomKey]);
  if (roomImg.complete && roomImg.naturalWidth) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 24;
    ctx.drawImage(roomImg, layout.imgX, layout.imgY, layout.imgW, layout.imgH);
    ctx.restore();
  }

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#ffe6f4';
  ctx.fillText(title, CANVAS_W / 2, layout.imgY - 24);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.fillText('入口をクリックすると外に出ます', CANVAS_W / 2, Math.min(CANVAS_H - 78, layout.imgY + layout.imgH + 20));

  if (char) {
    // キャラクター(固定位置に立っていて、idleでゆっくり揺れる)
    const bob = Math.sin(animClock * 1.3) * 2;
    drawShadow(ctx, layout.characterSpot.x, layout.characterSpot.y + 8, 30);
    const charImg = getImage(CHARACTER_PORTRAITS[char.portrait]);
    drawSpriteAtFeet(ctx, charImg, layout.characterSpot.x, layout.characterSpot.y + bob, 46);
  } else {
    // 自分の店: キャラの代わりにレジカウンターの目印を表示
    const bob = Math.sin(animClock * 1.3) * 2;
    drawShadow(ctx, layout.characterSpot.x, layout.characterSpot.y + 10, 26);
    ctx.save();
    ctx.font = '34px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('🧾', layout.characterSpot.x, layout.characterSpot.y + bob);
    ctx.font = 'bold 11px sans-serif';
    ctx.fillStyle = '#ffe6f4';
    ctx.fillText('レジ(クリックでお店を管理)', layout.characterSpot.x, layout.characterSpot.y + bob + 20);
    ctx.restore();
  }

  // プレイヤー
  const playerImg = getImage(CHARACTER_PORTRAITS.strawberry);
  const walkBob = player.moving ? Math.abs(Math.sin(animClock * 9)) * 3 : Math.sin(animClock * 1.2) * 1.2;
  drawShadow(ctx, player.x, player.y, 30);
  drawSpriteAtFeet(ctx, playerImg, player.x, player.y - walkBob, 46);

  return layout;
}

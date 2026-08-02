import type { GameState } from '@/types';
import { SHOPS, PLAYER_SHOP } from '@/data/shops';
import { getCharacter } from '@/data/characters';

export const CANVAS_W = 960;
export const CANVAS_H = 540;

const GRID_LEFT = 40;
const GRID_TOP = 175;
const CELL_W = 148;
const CELL_H = 100;

const PLAYER_SHOP_X = CANVAS_W / 2 - 90;
const PLAYER_SHOP_Y = 78;
const PLAYER_SHOP_W = 180;
const PLAYER_SHOP_H = 90;

interface ShopRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function shopRect(gridX: number, gridY: number): ShopRect {
  return {
    x: GRID_LEFT + gridX * CELL_W,
    y: GRID_TOP + gridY * CELL_H,
    w: CELL_W - 14,
    h: CELL_H - 16,
  };
}

export type MapHit = { type: 'shop'; id: string } | { type: 'player_shop' } | null;

export function hitTestMap(x: number, y: number): MapHit {
  if (x >= PLAYER_SHOP_X && x <= PLAYER_SHOP_X + PLAYER_SHOP_W && y >= PLAYER_SHOP_Y && y <= PLAYER_SHOP_Y + PLAYER_SHOP_H) {
    return { type: 'player_shop' };
  }
  for (const shop of SHOPS) {
    const r = shopRect(shop.gridX, shop.gridY);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      return { type: 'shop', id: shop.id };
    }
  }
  return null;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function renderMap(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  // 背景(フロア)
  const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  bg.addColorStop(0, '#fff3e6');
  bg.addColorStop(1, '#ffe3ef');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b3446c';
  ctx.fillText('スイーツデパート 1F フロアマップ', CANVAS_W / 2, 60);

  // プレイヤーの店
  ctx.fillStyle = '#ffd166';
  roundRect(ctx, PLAYER_SHOP_X, PLAYER_SHOP_Y, PLAYER_SHOP_W, PLAYER_SHOP_H, 14);
  ctx.fill();
  ctx.strokeStyle = '#b3446c';
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.fillStyle = '#4a2c2a';
  ctx.font = 'bold 14px sans-serif';
  ctx.fillText(PLAYER_SHOP.name, PLAYER_SHOP_X + PLAYER_SHOP_W / 2, PLAYER_SHOP_Y + PLAYER_SHOP_H / 2 + 5);
  ctx.font = '11px sans-serif';
  ctx.fillText(`棚: ${state.shelf.length}点`, PLAYER_SHOP_X + PLAYER_SHOP_W / 2, PLAYER_SHOP_Y + PLAYER_SHOP_H / 2 + 22);

  // 18店舗
  for (const shop of SHOPS) {
    const r = shopRect(shop.gridX, shop.gridY);
    const char = getCharacter(shop.characterId);
    const affinity = state.characterAffinity[shop.characterId];

    ctx.fillStyle = char.color;
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = shop.type === 'material' ? '#6fa892' : '#d9678f';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    roundRect(ctx, r.x + 4, r.y + 4, r.w - 8, r.h * 0.4, 8);
    ctx.fill();

    ctx.fillStyle = '#3a2a20';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText(shop.name, r.x + r.w / 2, r.y + 16);
    ctx.font = '10px sans-serif';
    ctx.fillText(`${char.name}(${shop.type === 'material' ? '素材店' : 'スイーツ店'})`, r.x + r.w / 2, r.y + r.h - 22);

    const hearts = '♥'.repeat(affinity.level) + '♡'.repeat(5 - affinity.level);
    ctx.fillStyle = '#d94f70';
    ctx.font = '10px sans-serif';
    ctx.fillText(hearts, r.x + r.w / 2, r.y + r.h - 8);

    if (affinity.pendingEventLevel) {
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath();
      ctx.arc(r.x + r.w - 10, r.y + 10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('!', r.x + r.w - 10, r.y + 14);
    }
  }
}

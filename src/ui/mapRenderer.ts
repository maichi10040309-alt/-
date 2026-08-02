import type { GameState } from '@/types';
import { SHOPS, PLAYER_SHOP } from '@/data/shops';
import { getCharacter } from '@/data/characters';
import { drawShopBuilding } from './pixelArt';

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

// 星空(夜)は毎回ランダムだとちらつくため、固定シードの座標をあらかじめ生成しておく
const STARS: { x: number; y: number; r: number }[] = (() => {
  let seed = 42;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 1000;
  };
  const stars = [];
  for (let i = 0; i < 46; i++) {
    stars.push({ x: rand() * CANVAS_W, y: rand() * (CANVAS_H * 0.55), r: 0.6 + rand() * 1.4 });
  }
  return stars;
})();

function drawBackground(ctx: CanvasRenderingContext2D, timeOfDay: GameState['timeOfDay']): void {
  const bg = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  if (timeOfDay === 'morning') {
    bg.addColorStop(0, '#fff3e6');
    bg.addColorStop(1, '#ffe3ef');
  } else if (timeOfDay === 'noon') {
    bg.addColorStop(0, '#fff9e9');
    bg.addColorStop(1, '#ffe9d6');
  } else {
    bg.addColorStop(0, '#241a3d');
    bg.addColorStop(1, '#3c2450');
  }
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  if (timeOfDay === 'night') {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    for (const s of STARS) {
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // 床のタイルパターン(市松模様)
  const tileSize = 40;
  ctx.save();
  ctx.globalAlpha = timeOfDay === 'night' ? 0.05 : 0.06;
  ctx.fillStyle = timeOfDay === 'night' ? '#ffffff' : '#b3446c';
  for (let ty = 0; ty * tileSize < CANVAS_H; ty++) {
    for (let tx = 0; tx * tileSize < CANVAS_W; tx++) {
      if ((tx + ty) % 2 === 0) {
        ctx.fillRect(tx * tileSize, ty * tileSize, tileSize, tileSize);
      }
    }
  }
  ctx.restore();
}

export function renderMap(ctx: CanvasRenderingContext2D, state: GameState): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawBackground(ctx, state.timeOfDay);
  const isNight = state.timeOfDay === 'night';

  ctx.font = 'bold 15px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = isNight ? '#ffd6e8' : '#b3446c';
  ctx.fillText('スイーツデパート 1F フロアマップ', CANVAS_W / 2, 40);

  // プレイヤーの店
  ctx.fillStyle = isNight ? 'rgba(60,40,70,0.55)' : 'rgba(255,255,255,0.55)';
  roundRect(ctx, PLAYER_SHOP_X, PLAYER_SHOP_Y, PLAYER_SHOP_W, PLAYER_SHOP_H, 14);
  ctx.fill();
  ctx.strokeStyle = '#ffd166';
  ctx.lineWidth = 3;
  ctx.stroke();
  drawShopBuilding(ctx, PLAYER_SHOP_X + PLAYER_SHOP_W / 2 - 24, PLAYER_SHOP_Y + 4, 48, '#ffd166', 'sweets', isNight);
  ctx.fillStyle = isNight ? '#ffe6f4' : '#4a2c2a';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText(PLAYER_SHOP.name, PLAYER_SHOP_X + PLAYER_SHOP_W / 2, PLAYER_SHOP_Y + PLAYER_SHOP_H - 16);
  ctx.font = '10px sans-serif';
  ctx.fillText(`棚: ${state.shelf.length}点`, PLAYER_SHOP_X + PLAYER_SHOP_W / 2, PLAYER_SHOP_Y + PLAYER_SHOP_H - 4);

  // 18店舗
  for (const shop of SHOPS) {
    const r = shopRect(shop.gridX, shop.gridY);
    const char = getCharacter(shop.characterId);
    const affinity = state.characterAffinity[shop.characterId];

    ctx.fillStyle = isNight ? 'rgba(50,35,65,0.55)' : 'rgba(255,255,255,0.7)';
    roundRect(ctx, r.x, r.y, r.w, r.h, 12);
    ctx.fill();
    ctx.strokeStyle = shop.type === 'material' ? '#6fa892' : '#d9678f';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    drawShopBuilding(ctx, r.x + r.w / 2 - 20, r.y + 4, 40, char.color, shop.type, isNight);

    ctx.fillStyle = isNight ? '#ffe6f4' : '#3a2a20';
    ctx.font = 'bold 10.5px sans-serif';
    ctx.fillText(shop.name, r.x + r.w / 2, r.y + r.h - 24);
    ctx.font = '9.5px sans-serif';
    ctx.fillStyle = isNight ? '#e6c9e0' : '#6b4a3a';
    ctx.fillText(`${char.name}(${shop.type === 'material' ? '素材店' : 'スイーツ店'})`, r.x + r.w / 2, r.y + r.h - 12);

    const hearts = '♥'.repeat(affinity.level) + '♡'.repeat(5 - affinity.level);
    ctx.fillStyle = '#ff6f91';
    ctx.font = '10px sans-serif';
    ctx.fillText(hearts, r.x + r.w / 2, r.y + r.h - 1);

    if (affinity.pendingEventLevel) {
      ctx.save();
      ctx.shadowColor = 'rgba(255,77,109,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = '#ff4d6d';
      ctx.beginPath();
      ctx.arc(r.x + r.w - 10, r.y + 10, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText('!', r.x + r.w - 10, r.y + 14);
    }
  }
}

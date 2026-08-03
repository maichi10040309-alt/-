import type { GameState } from '@/types';
import { SHOPS, PLAYER_SHOP, FLOORS, getShopsOnFloor } from '@/data/shops';
import { getCharacter } from '@/data/characters';
import { drawShopBuilding, drawCharacterOnMap, drawPlayerOnMap } from './pixelArt';

export const CANVAS_W = 960;
export const CANVAS_H = 540;

const GRID_LEFT = 60;
const GRID_TOP = 110;
const CELL_W = 280;
const CELL_H = 190;

const PLAYER_SHOP_X = CANVAS_W / 2 - 110;
const PLAYER_SHOP_Y = 130;
const PLAYER_SHOP_W = 220;
const PLAYER_SHOP_H = 160;

export const ELEVATOR_RECT = { x: CANVAS_W - 150, y: 120, w: 100, h: 200 };

export interface PlayerSprite {
  x: number;
  y: number;
  moving: boolean;
}

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
    w: CELL_W - 30,
    h: CELL_H - 30,
  };
}

export type MapHit = { type: 'shop'; id: string } | { type: 'player_shop' } | { type: 'elevator' } | null;

export function hitTestMap(x: number, y: number, floor: number): MapHit {
  if (x >= ELEVATOR_RECT.x && x <= ELEVATOR_RECT.x + ELEVATOR_RECT.w && y >= ELEVATOR_RECT.y && y <= ELEVATOR_RECT.y + ELEVATOR_RECT.h) {
    return { type: 'elevator' };
  }
  if (floor === 1) {
    if (x >= PLAYER_SHOP_X && x <= PLAYER_SHOP_X + PLAYER_SHOP_W && y >= PLAYER_SHOP_Y && y <= PLAYER_SHOP_Y + PLAYER_SHOP_H) {
      return { type: 'player_shop' };
    }
    return null;
  }
  for (const shop of getShopsOnFloor(floor)) {
    const r = shopRect(shop.gridX, shop.gridY);
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
      return { type: 'shop', id: shop.id };
    }
  }
  return null;
}

/** クリックされた店/設備の「立ち位置」(プレイヤーが歩いていく目的地)を返す */
export function getStandingSpot(hit: MapHit): { x: number; y: number } {
  if (!hit) return { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  if (hit.type === 'elevator') {
    return { x: ELEVATOR_RECT.x + ELEVATOR_RECT.w / 2, y: ELEVATOR_RECT.y + ELEVATOR_RECT.h + 16 };
  }
  if (hit.type === 'player_shop') {
    return { x: PLAYER_SHOP_X + PLAYER_SHOP_W / 2, y: PLAYER_SHOP_Y + PLAYER_SHOP_H + 16 };
  }
  const shop = SHOPS.find((s) => s.id === hit.id)!;
  const r = shopRect(shop.gridX, shop.gridY);
  return { x: r.x + r.w / 2, y: Math.min(r.y + r.h + 14, CANVAS_H - 60) };
}

export const PLAYER_HOME_SPOT = { x: PLAYER_SHOP_X + PLAYER_SHOP_W / 2, y: PLAYER_SHOP_Y + PLAYER_SHOP_H + 16 };
export const ELEVATOR_SPOT = { x: ELEVATOR_RECT.x + ELEVATOR_RECT.w / 2, y: ELEVATOR_RECT.y + ELEVATOR_RECT.h + 16 };

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

function floorLabel(floor: number): string {
  return FLOORS.find((f) => f.floor === floor)?.name ?? `${floor}F`;
}

function drawElevator(ctx: CanvasRenderingContext2D, isNight: boolean): void {
  const { x, y, w, h } = ELEVATOR_RECT;
  ctx.fillStyle = isNight ? '#5a3f6b' : '#c9a877';
  roundRect(ctx, x, y, w, h, 10);
  ctx.fill();
  ctx.strokeStyle = '#8a5a3c';
  ctx.lineWidth = 3;
  ctx.stroke();

  // 扉
  const doorPad = 10;
  ctx.fillStyle = isNight ? '#2f2140' : '#7a5230';
  ctx.fillRect(x + doorPad, y + doorPad, (w - doorPad * 2) / 2 - 2, h - doorPad * 2);
  ctx.fillRect(x + w / 2 + 2, y + doorPad, (w - doorPad * 2) / 2 - 2, h - doorPad * 2);

  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(x + w / 2, y - 14, 11, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#4a2c2a';
  ctx.font = 'bold 12px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('EV', x + w / 2, y - 10);

  ctx.fillStyle = isNight ? '#ffe6f4' : '#4a2c2a';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('エレベーター', x + w / 2, y + h + 16 - 20);
}

export function renderMap(ctx: CanvasRenderingContext2D, state: GameState, floor: number, animClock: number, player: PlayerSprite): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawBackground(ctx, state.timeOfDay);
  const isNight = state.timeOfDay === 'night';

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = isNight ? '#ffd6e8' : '#b3446c';
  ctx.fillText(floorLabel(floor), CANVAS_W / 2, 36);

  drawElevator(ctx, isNight);

  if (floor === 1) {
    ctx.fillStyle = isNight ? 'rgba(60,40,70,0.55)' : 'rgba(255,255,255,0.6)';
    roundRect(ctx, PLAYER_SHOP_X, PLAYER_SHOP_Y, PLAYER_SHOP_W, PLAYER_SHOP_H, 16);
    ctx.fill();
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 3;
    ctx.stroke();
    drawShopBuilding(ctx, PLAYER_SHOP_X + PLAYER_SHOP_W / 2 - 30, PLAYER_SHOP_Y + 10, 60, '#ffd166', 'sweets', isNight);
    ctx.fillStyle = isNight ? '#ffe6f4' : '#4a2c2a';
    ctx.font = 'bold 15px sans-serif';
    ctx.fillText(PLAYER_SHOP.name, PLAYER_SHOP_X + PLAYER_SHOP_W / 2, PLAYER_SHOP_Y + PLAYER_SHOP_H - 24);
    ctx.font = '11px sans-serif';
    ctx.fillText(`棚: ${state.shelf.length}点`, PLAYER_SHOP_X + PLAYER_SHOP_W / 2, PLAYER_SHOP_Y + PLAYER_SHOP_H - 8);

    ctx.fillStyle = isNight ? '#e6c9e0' : '#8a5a3c';
    ctx.font = '13px sans-serif';
    ctx.fillText('エレベーターで各階のお店へ行けます', CANVAS_W / 2 - 60, CANVAS_H - 70);
  } else {
    for (const shop of getShopsOnFloor(floor)) {
      const r = shopRect(shop.gridX, shop.gridY);
      const char = getCharacter(shop.characterId);
      const affinity = state.characterAffinity[shop.characterId];

      ctx.fillStyle = isNight ? 'rgba(50,35,65,0.55)' : 'rgba(255,255,255,0.7)';
      roundRect(ctx, r.x, r.y, r.w, r.h, 14);
      ctx.fill();
      ctx.strokeStyle = shop.type === 'material' ? '#6fa892' : '#d9678f';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = 'center';
      drawShopBuilding(ctx, r.x + r.w / 2 - 26, r.y + 6, 52, char.color, shop.type, isNight);
      drawCharacterOnMap(ctx, r.x + r.w / 2 - 15, r.y + 40, 30, char.id, char.color, animClock);

      ctx.fillStyle = isNight ? '#ffe6f4' : '#3a2a20';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(shop.name, r.x + r.w / 2, r.y + r.h - 38);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = isNight ? '#e6c9e0' : '#6b4a3a';
      ctx.fillText(`${char.name}(${shop.type === 'material' ? '素材店' : 'スイーツ店'})`, r.x + r.w / 2, r.y + r.h - 22);

      const hearts = '♥'.repeat(affinity.level) + '♡'.repeat(5 - affinity.level);
      ctx.fillStyle = '#ff6f91';
      ctx.font = '12px sans-serif';
      ctx.fillText(hearts, r.x + r.w / 2, r.y + r.h - 6);

      if (affinity.pendingEventLevel) {
        ctx.save();
        ctx.shadowColor = 'rgba(255,77,109,0.8)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#ff4d6d';
        ctx.beginPath();
        ctx.arc(r.x + r.w - 14, r.y + 14, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.fillText('!', r.x + r.w - 14, r.y + 19);
      }
    }
  }

  // プレイヤー本人(常に最前面)
  ctx.textAlign = 'center';
  drawPlayerOnMap(ctx, player.x - 13, player.y - 24, 26, animClock, player.moving);
}

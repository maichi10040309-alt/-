import type { GameState } from '@/types';
import { SHOPS, PLAYER_SHOP, FLOORS, getShopsOnFloor } from '@/data/shops';
import { getCharacter } from '@/data/characters';
import { CHARACTER_PORTRAITS, SHOP_BUILDING_IMAGES, DEPARTMENT_HALL_IMAGE } from '@/data/imageAssets';
import { getImage, drawSpriteAtFeet, drawImageFitBottom } from './imageCache';
import { drawShadow } from './pixelArt';

export const CANVAS_W = 960;
export const CANVAS_H = 540;

const GRID_LEFT = 60;
const GRID_TOP = 110;
const CELL_W = 280;
const CELL_H = 190;

export const ELEVATOR_RECT = { x: CANVAS_W - 150, y: 120, w: 100, h: 200 };

// 1F(エントランス)は「デパート内観(中央ホール)」の実イラストを背景に使い、
// 画像上の自然座標系(870x315)で入口/エスカレーターの当たり判定を定義する。
const HALL_MARGIN_X = 20;
const HALL_MARGIN_TOP = 66;
const HALL_MARGIN_BOTTOM = 90;

interface HallLayout {
  imgX: number;
  imgY: number;
  imgW: number;
  imgH: number;
  scale: number;
}

function computeHallLayout(): HallLayout {
  const img = getImage(DEPARTMENT_HALL_IMAGE);
  const naturalW = img.naturalWidth || 870;
  const naturalH = img.naturalHeight || 315;
  const maxW = CANVAS_W - HALL_MARGIN_X * 2;
  const maxH = CANVAS_H - HALL_MARGIN_TOP - HALL_MARGIN_BOTTOM;
  const scale = Math.min(maxW / naturalW, maxH / naturalH);
  const imgW = naturalW * scale;
  const imgH = naturalH * scale;
  const imgX = (CANVAS_W - imgW) / 2;
  const imgY = HALL_MARGIN_TOP + (maxH - imgH) / 2;
  return { imgX, imgY, imgW, imgH, scale };
}

function hallToCanvas(layout: HallLayout, nx: number, ny: number): { x: number; y: number } {
  return { x: layout.imgX + nx * layout.scale, y: layout.imgY + ny * layout.scale };
}

// 画像内(870x315)でのいちごケーキ店の入口/立ち位置、エスカレーターの当たり判定
const HALL_SHOP_HIT = { x0: 12, y0: 30, x1: 155, y1: 150 };
const HALL_SHOP_SPOT_NATURAL = { x: 95, y: 152 };
const HALL_ESCALATOR_HIT = { x0: 325, y0: 230, x1: 510, y1: 315 };
const HALL_ESCALATOR_SPOT_NATURAL = { x: 420, y: 258 };
// 装飾のみ(データ上の店舗が無いため非クリック)の他テナント扉のラベル位置
const HALL_DECOR_DOORS = [
  { num: 2, x: 250, y: 55 },
  { num: 3, x: 585, y: 55 },
  { num: 4, x: 700, y: 65 },
  { num: 5, x: 800, y: 75 },
];

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

// キャラクターごとに一意だが決定的なゆらぎ位相を作る(全員が同期して揺れないように)
function phaseFor(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000;
}

export type MapHit = { type: 'shop'; id: string } | { type: 'player_shop' } | { type: 'elevator' } | null;

export function hitTestMap(x: number, y: number, floor: number): MapHit {
  if (floor === 1) {
    const layout = computeHallLayout();
    const nx = (x - layout.imgX) / layout.scale;
    const ny = (y - layout.imgY) / layout.scale;
    if (nx >= HALL_SHOP_HIT.x0 && nx <= HALL_SHOP_HIT.x1 && ny >= HALL_SHOP_HIT.y0 && ny <= HALL_SHOP_HIT.y1) {
      return { type: 'player_shop' };
    }
    if (nx >= HALL_ESCALATOR_HIT.x0 && nx <= HALL_ESCALATOR_HIT.x1 && ny >= HALL_ESCALATOR_HIT.y0 && ny <= HALL_ESCALATOR_HIT.y1) {
      return { type: 'elevator' };
    }
    return null;
  }
  if (x >= ELEVATOR_RECT.x && x <= ELEVATOR_RECT.x + ELEVATOR_RECT.w && y >= ELEVATOR_RECT.y && y <= ELEVATOR_RECT.y + ELEVATOR_RECT.h) {
    return { type: 'elevator' };
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
export function getStandingSpot(hit: MapHit, floor = 1): { x: number; y: number } {
  if (!hit) return { x: CANVAS_W / 2, y: CANVAS_H / 2 };
  if (floor === 1 && (hit.type === 'elevator' || hit.type === 'player_shop')) {
    const layout = computeHallLayout();
    const natural = hit.type === 'elevator' ? HALL_ESCALATOR_SPOT_NATURAL : HALL_SHOP_SPOT_NATURAL;
    return hallToCanvas(layout, natural.x, natural.y);
  }
  if (hit.type === 'elevator') {
    return { x: ELEVATOR_RECT.x + ELEVATOR_RECT.w / 2, y: ELEVATOR_RECT.y + ELEVATOR_RECT.h + 16 };
  }
  if (hit.type === 'player_shop') {
    return getHallShopSpot();
  }
  const shop = SHOPS.find((s) => s.id === hit.id)!;
  const r = shopRect(shop.gridX, shop.gridY);
  return { x: r.x + r.w / 2, y: Math.min(r.y + r.h + 14, CANVAS_H - 60) };
}

export function getHallShopSpot(): { x: number; y: number } {
  return hallToCanvas(computeHallLayout(), HALL_SHOP_SPOT_NATURAL.x, HALL_SHOP_SPOT_NATURAL.y);
}

export function getHallEscalatorSpot(): { x: number; y: number } {
  return hallToCanvas(computeHallLayout(), HALL_ESCALATOR_SPOT_NATURAL.x, HALL_ESCALATOR_SPOT_NATURAL.y);
}

export const PLAYER_HOME_SPOT = getHallShopSpot();
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

// 環境パーティクル(昼は花びら、夜はきらめき)。固定シードでちらつきを防ぐ。
interface AmbientParticle {
  x: number;
  speed: number;
  drift: number;
  phase: number;
  size: number;
}

const AMBIENT_PARTICLES: AmbientParticle[] = (() => {
  let seed = 7;
  const rand = () => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return (seed % 1000) / 1000;
  };
  const list: AmbientParticle[] = [];
  for (let i = 0; i < 16; i++) {
    list.push({ x: rand() * CANVAS_W, speed: 10 + rand() * 14, drift: 14 + rand() * 26, phase: rand() * Math.PI * 2, size: 2 + rand() * 2.5 });
  }
  return list;
})();

function drawAmbientParticles(ctx: CanvasRenderingContext2D, animClock: number, isNight: boolean): void {
  ctx.save();
  for (const p of AMBIENT_PARTICLES) {
    const cycle = CANVAS_H + 40;
    const fallY = ((animClock * p.speed + p.phase * 60) % cycle) - 20;
    const x = p.x + Math.sin(animClock * 0.5 + p.phase) * p.drift * 0.4;
    ctx.globalAlpha = isNight ? 0.55 + Math.sin(animClock * 2 + p.phase) * 0.25 : 0.4;
    ctx.fillStyle = isNight ? '#ffe9a8' : '#ffb6c8';
    ctx.beginPath();
    ctx.arc(x, fallY, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

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

function renderHallFloor(ctx: CanvasRenderingContext2D, state: GameState, isNight: boolean): void {
  const layout = computeHallLayout();
  const img = getImage(DEPARTMENT_HALL_IMAGE);
  if (img.complete && img.naturalWidth) {
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,0.4)';
    ctx.shadowBlur = 20;
    ctx.drawImage(img, layout.imgX, layout.imgY, layout.imgW, layout.imgH);
    ctx.restore();
  }

  // いちごケーキ店(プレイヤーの店)の入口を光らせて誘導する
  const glowSpot = hallToCanvas(layout, (HALL_SHOP_HIT.x0 + HALL_SHOP_HIT.x1) / 2, HALL_SHOP_HIT.y0 + 6);
  ctx.save();
  ctx.globalAlpha = 0.55 + Math.sin(performance.now() / 400) * 0.15;
  ctx.shadowColor = '#ff9ec4';
  ctx.shadowBlur = 14;
  ctx.fillStyle = '#fff2f7';
  ctx.beginPath();
  ctx.arc(glowSpot.x, glowSpot.y, 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  ctx.textAlign = 'center';
  ctx.fillStyle = isNight ? '#ffe6f4' : '#4a2c2a';
  ctx.font = 'bold 12px sans-serif';
  const shopLabelSpot = hallToCanvas(layout, HALL_SHOP_SPOT_NATURAL.x, HALL_SHOP_HIT.y1 + 14);
  ctx.fillText(PLAYER_SHOP.name, shopLabelSpot.x, shopLabelSpot.y);
  ctx.font = '10px sans-serif';
  ctx.fillText(`棚: ${state.shelf.length}点`, shopLabelSpot.x, shopLabelSpot.y + 13);

  const escLabelSpot = hallToCanvas(layout, HALL_ESCALATOR_SPOT_NATURAL.x, HALL_ESCALATOR_HIT.y0 - 8);
  ctx.fillStyle = isNight ? '#e6c9e0' : '#8a5a3c';
  ctx.font = 'bold 12px sans-serif';
  ctx.fillText('エスカレーターで各階へ', escLabelSpot.x, escLabelSpot.y);

  ctx.font = '10px sans-serif';
  ctx.fillStyle = isNight ? 'rgba(255,255,255,0.6)' : 'rgba(80,50,40,0.55)';
  for (const door of HALL_DECOR_DOORS) {
    const p = hallToCanvas(layout, door.x, door.y);
    ctx.fillText('準備中', p.x, p.y);
  }
}

export function renderMap(ctx: CanvasRenderingContext2D, state: GameState, floor: number, animClock: number, player: PlayerSprite): void {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawBackground(ctx, state.timeOfDay);
  const isNight = state.timeOfDay === 'night';
  drawAmbientParticles(ctx, animClock, isNight);

  ctx.textAlign = 'center';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = isNight ? '#ffd6e8' : '#b3446c';
  ctx.fillText(floorLabel(floor), CANVAS_W / 2, 36);

  if (floor === 1) {
    renderHallFloor(ctx, state, isNight);
  } else {
    drawElevator(ctx, isNight);
  }

  if (floor !== 1) {
    for (const shop of getShopsOnFloor(floor)) {
      const r = shopRect(shop.gridX, shop.gridY);
      const char = getCharacter(shop.characterId);
      const affinity = state.characterAffinity[shop.characterId];

      ctx.fillStyle = isNight ? 'rgba(50,35,65,0.55)' : 'rgba(255,255,255,0.7)';
      roundRect(ctx, r.x, r.y, r.w, r.h, 14);
      ctx.fill();
      ctx.strokeStyle = shop.type === 'bookstore' ? '#8a7ab5' : '#d9678f';
      ctx.lineWidth = 3;
      ctx.stroke();

      ctx.textAlign = 'center';
      const buildingImg = getImage(SHOP_BUILDING_IMAGES[char.portrait]);
      drawImageFitBottom(ctx, buildingImg, r.x + 10, r.y + 4, r.w - 20, r.h * 0.56);

      const bob = Math.sin(animClock * 1.3 + phaseFor(char.id) * 10) * 2;
      drawShadow(ctx, r.x + r.w / 2, r.y + r.h - 28, r.w * 0.3);
      const charImg = getImage(CHARACTER_PORTRAITS[char.portrait]);
      drawSpriteAtFeet(ctx, charImg, r.x + r.w / 2, r.y + r.h - 30 + bob, r.h * 0.46);

      ctx.fillStyle = isNight ? '#ffe6f4' : '#3a2a20';
      ctx.font = 'bold 13px sans-serif';
      ctx.fillText(shop.name, r.x + r.w / 2, r.y + r.h - 16);
      ctx.font = '11px sans-serif';
      ctx.fillStyle = isNight ? '#e6c9e0' : '#6b4a3a';
      const hearts = '♥'.repeat(affinity.level) + '♡'.repeat(5 - affinity.level);
      ctx.fillText(`${char.name} ${hearts}`, r.x + r.w / 2, r.y + r.h - 3);

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
  const playerImg = getImage(CHARACTER_PORTRAITS.strawberry);
  const walkBob = player.moving ? Math.abs(Math.sin(animClock * 9)) * 3 : Math.sin(animClock * 1.2) * 1.2;
  drawShadow(ctx, player.x, player.y, 34);
  drawSpriteAtFeet(ctx, playerImg, player.x, player.y - walkBob, 46);
}

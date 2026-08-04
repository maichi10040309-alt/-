import type { GameState, OwnedShopDecoration, ShopLayerPlacement } from '@/types';
import { getCurrentUpgradeLevel } from '@/data/shopUpgrades';
import { getInteriorAsset, getDisplayAsset, getRegisterAsset, getOvenAsset, getDecorAsset } from '@/data/strawberryShopAssets';
import {
  STRAWBERRY_SHOP_BACKGROUND_PLACEMENT,
  STRAWBERRY_SHOP_DISPLAY_PLACEMENT,
  STRAWBERRY_SHOP_REGISTER_PLACEMENT,
  STRAWBERRY_SHOP_OVEN_PLACEMENT,
  STRAWBERRY_SHOP_DECOR_SLOTS,
  STRAWBERRY_SHOP_ENTRANCE_POINT,
  STRAWBERRY_SHOP_WALK_AREA,
  STRAWBERRY_SHOP_CHARACTER_Z_INDEX,
  DEBUG_SHOP_LAYOUT,
} from '@/data/strawberryShopLayout';
import { getImage, drawImageFitBottom, drawSpriteAtFeet } from './imageCache';
import { drawShadow } from './pixelArt';
import { CANVAS_W, CANVAS_H, type PlayerSprite } from './mapRenderer';
import { CHARACTER_PORTRAITS } from '@/data/imageAssets';
import type { InteriorLayout } from './interiorRenderer';

/** ストロベリー店専用のレイアウト(interiorRenderer.tsの汎用InteriorLayoutと同じ形にして、
 *  入口/接客ホットスポットのヒットテスト・クランプ処理をそのまま再利用できるようにしている)。
 *  imgX/imgY/imgW/imgHは「歩き回れる床範囲」を表す(背景画像は常にキャンバス全体に敷く)。
 */
export function computeStrawberryShopLayout(): InteriorLayout {
  return {
    imgX: STRAWBERRY_SHOP_WALK_AREA.x,
    imgY: STRAWBERRY_SHOP_WALK_AREA.y,
    imgW: STRAWBERRY_SHOP_WALK_AREA.width,
    imgH: STRAWBERRY_SHOP_WALK_AREA.height,
    entrance: STRAWBERRY_SHOP_ENTRANCE_POINT,
    characterSpot: { x: STRAWBERRY_SHOP_REGISTER_PLACEMENT.x + STRAWBERRY_SHOP_REGISTER_PLACEMENT.width / 2, y: STRAWBERRY_SHOP_REGISTER_PLACEMENT.y + STRAWBERRY_SHOP_REGISTER_PLACEMENT.height },
  };
}

interface RenderLayer {
  zIndex: number;
  draw: () => void;
}

/** 画像が未登録の設備を、アイコン+レベル表示で仮描画する(ビルドを壊さない安全なフォールバック) */
function drawFallbackEquipment(ctx: CanvasRenderingContext2D, placement: ShopLayerPlacement, icon: string, label: string): void {
  const cx = placement.x + placement.width / 2;
  const groundY = placement.y + placement.height;
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.font = `${Math.round(Math.min(placement.width, placement.height) * 0.6)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(icon, cx, groundY - 6);
  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = '#8a5a3c';
  ctx.fillText(label, cx, groundY + 12);
  ctx.restore();
}

function drawEquipmentLayer(ctx: CanvasRenderingContext2D, placement: ShopLayerPlacement, imageSrc: string | null, icon: string, label: string): void {
  if (imageSrc) {
    const img = getImage(imageSrc);
    if (img.complete && img.naturalWidth) {
      drawImageFitBottom(ctx, img, placement.x, placement.y, placement.width, placement.height);
      return;
    }
  }
  drawFallbackEquipment(ctx, placement, icon, label);
}

function drawDecorLayers(ctx: CanvasRenderingContext2D, decorations: OwnedShopDecoration[]): RenderLayer[] {
  const layers: RenderLayer[] = [];
  for (const owned of decorations) {
    if (!owned.visible) continue;
    const slot = STRAWBERRY_SHOP_DECOR_SLOTS.find((s) => s.id === owned.placementId);
    if (!slot) continue;
    const imageSrc = getDecorAsset(owned.id);
    layers.push({
      zIndex: slot.placement.zIndex,
      draw: () => {
        if (imageSrc) {
          const img = getImage(imageSrc);
          if (img.complete && img.naturalWidth) {
            drawImageFitBottom(ctx, img, slot.placement.x, slot.placement.y, slot.placement.width, slot.placement.height);
          }
        }
      },
    });
  }
  return layers;
}

function drawDebugBox(ctx: CanvasRenderingContext2D, placement: ShopLayerPlacement, color: string, label: string): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.setLineDash([5, 4]);
  ctx.strokeRect(placement.x, placement.y, placement.width, placement.height);
  ctx.setLineDash([]);
  const groundX = placement.x + placement.width / 2;
  const groundY = placement.y + placement.height;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(groundX, groundY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, placement.x + 2, placement.y + 11);
  ctx.restore();
}

function drawDebugOverlay(ctx: CanvasRenderingContext2D): void {
  drawDebugBox(ctx, STRAWBERRY_SHOP_DISPLAY_PLACEMENT, '#ff3b3b', '①陳列棚');
  drawDebugBox(ctx, STRAWBERRY_SHOP_REGISTER_PLACEMENT, '#ff6fb0', '②レジ');
  drawDebugBox(ctx, STRAWBERRY_SHOP_OVEN_PLACEMENT, '#2ecc71', '③オーブン');
  for (const slot of STRAWBERRY_SHOP_DECOR_SLOTS) {
    drawDebugBox(ctx, slot.placement, '#3b8bff', `④${slot.name}`);
  }
  ctx.save();
  ctx.fillStyle = '#ffd166';
  ctx.beginPath();
  ctx.arc(STRAWBERRY_SHOP_ENTRANCE_POINT.x, STRAWBERRY_SHOP_ENTRANCE_POINT.y, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 10px sans-serif';
  ctx.fillText('入口', STRAWBERRY_SHOP_ENTRANCE_POINT.x + 6, STRAWBERRY_SHOP_ENTRANCE_POINT.y);
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.strokeRect(STRAWBERRY_SHOP_WALK_AREA.x, STRAWBERRY_SHOP_WALK_AREA.y, STRAWBERRY_SHOP_WALK_AREA.width, STRAWBERRY_SHOP_WALK_AREA.height);
  ctx.restore();
}

/**
 * ストロベリー店(プレイヤーの店)の店内を、設備レベルに応じたレイヤー合成で描画する。
 * 背景/陳列棚/レジ/オーブン/装飾/プレイヤーをzIndex順に重ね、ownedDecorations(将来の
 * 装飾所持データ。今回は未実装のため空配列で良い)があればその位置にも重ねる。
 */
export function renderStrawberryShopInterior(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  animClock: number,
  player: PlayerSprite,
  ownedDecorations: OwnedShopDecoration[] = []
): InteriorLayout {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);

  const interiorLevel = getCurrentUpgradeLevel(state, 'interior');
  const displayLevel = getCurrentUpgradeLevel(state, 'display');
  const registerLevel = getCurrentUpgradeLevel(state, 'register');
  const ovenLevel = getCurrentUpgradeLevel(state, 'oven');

  const layers: RenderLayer[] = [
    {
      zIndex: STRAWBERRY_SHOP_BACKGROUND_PLACEMENT.zIndex,
      draw: () => {
        const bgSrc = getInteriorAsset(interiorLevel);
        const bg = bgSrc ? getImage(bgSrc) : null;
        if (bg && bg.complete && bg.naturalWidth) {
          ctx.drawImage(bg, 0, 0, CANVAS_W, CANVAS_H);
        } else {
          // 内装画像が1枚も無い場合の最終フォールバック(起動停止を避けるための単色背景)
          ctx.fillStyle = '#f7e3d8';
          ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
        }
      },
    },
    { zIndex: STRAWBERRY_SHOP_OVEN_PLACEMENT.zIndex, draw: () => drawEquipmentLayer(ctx, STRAWBERRY_SHOP_OVEN_PLACEMENT, getOvenAsset(ovenLevel), '🔥', `オーブンLv.${ovenLevel}`) },
    { zIndex: STRAWBERRY_SHOP_DISPLAY_PLACEMENT.zIndex, draw: () => drawEquipmentLayer(ctx, STRAWBERRY_SHOP_DISPLAY_PLACEMENT, getDisplayAsset(displayLevel), '🧁', `陳列棚Lv.${displayLevel}`) },
    { zIndex: STRAWBERRY_SHOP_REGISTER_PLACEMENT.zIndex, draw: () => drawEquipmentLayer(ctx, STRAWBERRY_SHOP_REGISTER_PLACEMENT, getRegisterAsset(registerLevel), '💳', `レジLv.${registerLevel}`) },
    ...drawDecorLayers(ctx, ownedDecorations),
    {
      zIndex: STRAWBERRY_SHOP_CHARACTER_Z_INDEX,
      draw: () => {
        const walkBob = player.moving ? Math.abs(Math.sin(animClock * 9)) * 3 : Math.sin(animClock * 1.2) * 1.2;
        drawShadow(ctx, player.x, player.y, 30);
        drawSpriteAtFeet(ctx, getImage(CHARACTER_PORTRAITS.strawberry), player.x, player.y - walkBob, 46);
      },
    },
  ];

  for (const layer of layers.slice().sort((a, b) => a.zIndex - b.zIndex)) {
    layer.draw();
  }

  const layout = computeStrawberryShopLayout();

  // タイトル/ヒントのy座標は、上部hud-barと下部hud-menuに隠れないよう
  // interiorRenderer.ts の renderShopInterior と同じ安全マージンに合わせている。
  ctx.save();
  ctx.textAlign = 'center';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillStyle = '#fff2f7';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 6;
  ctx.fillText('いちごケーキ店', CANVAS_W / 2, 64);
  ctx.font = '12px sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText('入口をクリックすると外に出ます', CANVAS_W / 2, CANVAS_H - 78);
  ctx.restore();

  if (DEBUG_SHOP_LAYOUT) {
    drawDebugOverlay(ctx);
  }

  return layout;
}

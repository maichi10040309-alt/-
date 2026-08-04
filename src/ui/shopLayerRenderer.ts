import type { GameState, OwnedShopDecoration, ShopLayerLevelAdjustment, ShopLayerPlacement, ShopLayerShadowAdjustment, ShopLayerVisualAdjustment, ShopUpgradeLevel } from '@/types';
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
  SHOP_LAYER_VISUAL_ADJUSTMENTS,
  STRAWBERRY_SHOP_DISPLAY_LEVEL_ADJUSTMENTS,
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

// レジ/オーブンはレベル別微調整テーブルをまだ持たないため、恒等値を都度渡す。
const NEUTRAL_LEVEL_ADJUSTMENT: ShopLayerLevelAdjustment = { offsetX: 0, offsetY: 0, scale: 1 };

interface EffectiveBox {
  x: number;
  y: number;
  width: number;
  height: number;
  anchorX: number; // 接地基準点(下端中央 + オフセット)
  anchorY: number;
}

/**
 * 配置スペース(placement)の下端中央を接地基準点とし、見た目補正(offsetX/offsetY/scale)と
 * レベル別微調整を重ねて実際に描画へ使う矩形を求める。配置スペース自体は動かさず、
 * 「基準点をずらしてから、その基準点を固定して拡大縮小する」ことで、常に接地位置を
 * 保ったまま位置調整・拡大ができる。
 */
function computeEffectiveBox(placement: ShopLayerPlacement, adjustment: ShopLayerVisualAdjustment, levelAdjustment: ShopLayerLevelAdjustment): EffectiveBox {
  const anchorX = placement.x + placement.width / 2 + adjustment.offsetX + levelAdjustment.offsetX;
  const anchorY = placement.y + placement.height + adjustment.offsetY + levelAdjustment.offsetY;
  const scale = adjustment.scale * levelAdjustment.scale;
  const width = placement.width * scale;
  const height = placement.height * scale;
  return { x: anchorX - width / 2, y: anchorY - height, width, height, anchorX, anchorY };
}

/** drawImageFitBottom(imageCache.ts)と同じ「箱の中でアスペクト比を保ち下端中央寄せ」の
 *  計算をローカルでも行い、実際の描画矩形(接地影の幅算出等に必要)を取得する。 */
function fitBottomRect(img: HTMLImageElement, box: EffectiveBox): { dx: number; dy: number; w: number; h: number } {
  const scale = Math.min(box.width / img.naturalWidth, box.height / img.naturalHeight);
  const w = img.naturalWidth * scale;
  const h = img.naturalHeight * scale;
  return { dx: box.x + (box.width - w) / 2, dy: box.y + (box.height - h), w, h };
}

/** 設備の底面に短く薄い暖色の接地影を描く(棚全体を縁取る強いドロップシャドウにはしない) */
function drawGroundShadow(ctx: CanvasRenderingContext2D, groundX: number, groundY: number, footprintWidth: number, shadow: ShopLayerShadowAdjustment): void {
  if (shadow.alpha <= 0) return;
  const cx = groundX + shadow.offsetX;
  const cy = groundY + shadow.offsetY;
  const rx = Math.max(4, (footprintWidth * 0.7) / 2);
  const ry = Math.max(3, shadow.blur * 0.7);
  ctx.save();
  const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, rx);
  gradient.addColorStop(0, `rgba(120, 74, 46, ${shadow.alpha})`);
  gradient.addColorStop(1, 'rgba(120, 74, 46, 0)');
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** 画像が未登録の設備を、アイコン+レベル表示で仮描画する(ビルドを壊さない安全なフォールバック) */
function drawFallbackEquipment(ctx: CanvasRenderingContext2D, box: EffectiveBox, icon: string, label: string): void {
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.font = `${Math.round(Math.min(box.width, box.height) * 0.6)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.fillText(icon, box.anchorX, box.anchorY - 6);
  ctx.font = 'bold 10px sans-serif';
  ctx.fillStyle = '#8a5a3c';
  ctx.fillText(label, box.anchorX, box.anchorY + 12);
  ctx.restore();
}

function buildFilterString(adjustment: ShopLayerVisualAdjustment): string {
  const parts: string[] = [];
  if (adjustment.brightness !== 1) parts.push(`brightness(${adjustment.brightness})`);
  if (adjustment.saturate !== 1) parts.push(`saturate(${adjustment.saturate})`);
  if (adjustment.contrast !== 1) parts.push(`contrast(${adjustment.contrast})`);
  return parts.length ? parts.join(' ') : 'none';
}

function drawEquipmentLayer(
  ctx: CanvasRenderingContext2D,
  placement: ShopLayerPlacement,
  imageSrc: string | null,
  icon: string,
  label: string,
  adjustment: ShopLayerVisualAdjustment,
  levelAdjustment: ShopLayerLevelAdjustment
): void {
  const box = computeEffectiveBox(placement, adjustment, levelAdjustment);
  if (imageSrc) {
    const img = getImage(imageSrc);
    if (img.complete && img.naturalWidth) {
      const rect = fitBottomRect(img, box);
      // 影→色調補正→本体描画の順。save/restoreで囲み、他レイヤーへfilter/alphaが
      // 引き継がれないようにする(二重適用防止)。
      ctx.save();
      drawGroundShadow(ctx, box.anchorX, box.anchorY, rect.w, adjustment.shadow);
      ctx.filter = buildFilterString(adjustment);
      ctx.globalAlpha = adjustment.opacity;
      ctx.drawImage(img, rect.dx, rect.dy, rect.w, rect.h);
      ctx.restore();
      return;
    }
  }
  drawFallbackEquipment(ctx, box, icon, label);
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

function drawDebugBox(ctx: CanvasRenderingContext2D, box: { x: number; y: number; width: number; height: number }, color: string, label: string, dashed = true): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  if (dashed) ctx.setLineDash([5, 4]);
  ctx.strokeRect(box.x, box.y, box.width, box.height);
  ctx.setLineDash([]);
  const groundX = box.x + box.width / 2;
  const groundY = box.y + box.height;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(groundX, groundY, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 10px sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText(label, box.x + 2, box.y + 11);
  ctx.restore();
}

/** 設備1つ分のデバッグ情報(配置スペース・実際の描画範囲・接地基準点・元画像サイズ・適用scale) */
function drawEquipmentDebugInfo(
  ctx: CanvasRenderingContext2D,
  placement: ShopLayerPlacement,
  adjustment: ShopLayerVisualAdjustment,
  levelAdjustment: ShopLayerLevelAdjustment,
  imageSrc: string | null,
  color: string,
  label: string
): void {
  // 配置スペース(レイアウト図基準・不変)を破線で表示
  drawDebugBox(ctx, placement, `${color}88`, `${label}(スペース)`, true);
  // 見た目補正を適用した実効ボックス(接地基準点+offset/scale後)を実線で表示
  const box = computeEffectiveBox(placement, adjustment, levelAdjustment);
  drawDebugBox(ctx, box, color, `${label} x:${Math.round(box.x)} y:${Math.round(box.y)} w:${Math.round(box.width)} h:${Math.round(box.height)}`, false);

  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(box.anchorX, box.anchorY, 4, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'left';
  const scale = adjustment.scale * levelAdjustment.scale;
  const img = imageSrc ? getImage(imageSrc) : null;
  const naturalInfo = img && img.complete && img.naturalWidth ? `元画像:${img.naturalWidth}x${img.naturalHeight}` : '元画像:未読込/未登録';
  ctx.fillText(`接地点(${Math.round(box.anchorX)},${Math.round(box.anchorY)}) scale:${scale.toFixed(2)} ${naturalInfo}`, box.x + 2, box.y + box.height + 13);
  ctx.restore();
}

function drawDebugOverlay(ctx: CanvasRenderingContext2D, displayLevel: ShopUpgradeLevel, registerLevel: ShopUpgradeLevel, ovenLevel: ShopUpgradeLevel): void {
  drawEquipmentDebugInfo(
    ctx,
    STRAWBERRY_SHOP_DISPLAY_PLACEMENT,
    SHOP_LAYER_VISUAL_ADJUSTMENTS.display,
    STRAWBERRY_SHOP_DISPLAY_LEVEL_ADJUSTMENTS[displayLevel],
    getDisplayAsset(displayLevel),
    '#ff3b3b',
    '①陳列棚'
  );
  drawEquipmentDebugInfo(ctx, STRAWBERRY_SHOP_REGISTER_PLACEMENT, SHOP_LAYER_VISUAL_ADJUSTMENTS.register, NEUTRAL_LEVEL_ADJUSTMENT, getRegisterAsset(registerLevel), '#ff6fb0', '②レジ');
  drawEquipmentDebugInfo(ctx, STRAWBERRY_SHOP_OVEN_PLACEMENT, SHOP_LAYER_VISUAL_ADJUSTMENTS.oven, NEUTRAL_LEVEL_ADJUSTMENT, getOvenAsset(ovenLevel), '#2ecc71', '③オーブン');
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
    {
      zIndex: STRAWBERRY_SHOP_OVEN_PLACEMENT.zIndex,
      draw: () => drawEquipmentLayer(ctx, STRAWBERRY_SHOP_OVEN_PLACEMENT, getOvenAsset(ovenLevel), '🔥', `オーブンLv.${ovenLevel}`, SHOP_LAYER_VISUAL_ADJUSTMENTS.oven, NEUTRAL_LEVEL_ADJUSTMENT),
    },
    {
      zIndex: STRAWBERRY_SHOP_DISPLAY_PLACEMENT.zIndex,
      draw: () =>
        drawEquipmentLayer(
          ctx,
          STRAWBERRY_SHOP_DISPLAY_PLACEMENT,
          getDisplayAsset(displayLevel),
          '🧁',
          `陳列棚Lv.${displayLevel}`,
          SHOP_LAYER_VISUAL_ADJUSTMENTS.display,
          STRAWBERRY_SHOP_DISPLAY_LEVEL_ADJUSTMENTS[displayLevel]
        ),
    },
    {
      zIndex: STRAWBERRY_SHOP_REGISTER_PLACEMENT.zIndex,
      draw: () => drawEquipmentLayer(ctx, STRAWBERRY_SHOP_REGISTER_PLACEMENT, getRegisterAsset(registerLevel), '💳', `レジLv.${registerLevel}`, SHOP_LAYER_VISUAL_ADJUSTMENTS.register, NEUTRAL_LEVEL_ADJUSTMENT),
    },
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
    drawDebugOverlay(ctx, displayLevel, registerLevel, ovenLevel);
  }

  return layout;
}

import type { ShopUpgradeLevel } from '@/types';

// ストロベリー店の店内レイヤー画像。既存の画像アセット管理(src/assets/配下を
// Viteでbase64インライン化する方式)に合わせている。
//
// 現時点では背景(内装Lv.1)の実イラストのみが揃っており、他レベル・他レイヤーの
// 画像はまだ存在しない。静的importは「ファイルが無いとビルドエラーになる」ため、
// ここでは実在する画像だけをimportし、未登録レベルは undefined を返して
// shopLayerRenderer側でアイコン等へフォールバックする構造にしている。
// 今後 src/assets/shops/strawberry/{background,display,register,oven}/*.png|jpg を
// 追加したら、対応するレコードへ1行足すだけで反映される。

import interiorLv1 from '@/assets/shops/strawberry/background/interior_lv1.jpg';
import displayLv1 from '@/assets/shops/strawberry/display/display_lv1.webp';
import displayLv2 from '@/assets/shops/strawberry/display/display_lv2.webp';
import displayLv3 from '@/assets/shops/strawberry/display/display_lv3.webp';

const INTERIOR_IMAGES: Partial<Record<ShopUpgradeLevel, string>> = {
  1: interiorLv1,
  // 2: interiorLv2, 3: interiorLv3, 4: interiorLv4, // 画像が揃い次第追加
};

const DISPLAY_IMAGES: Partial<Record<ShopUpgradeLevel, string>> = {
  1: displayLv1,
  2: displayLv2,
  3: displayLv3,
  // 4: displayLv4, // 画像が揃い次第追加
};

const REGISTER_IMAGES: Partial<Record<ShopUpgradeLevel, string>> = {
  // 1: registerLv1, 2: registerLv2, 3: registerLv3, 4: registerLv4, // 画像が揃い次第追加
};

const OVEN_IMAGES: Partial<Record<ShopUpgradeLevel, string>> = {
  // 1: ovenLv1, 2: ovenLv2, 3: ovenLv3, 4: ovenLv4, // 画像が揃い次第追加
};

// 装飾画像(id -> データURI)。今回は取得システム自体は未実装のため空のまま。
const DECOR_IMAGES: Record<string, string> = {};

/** レベルに対応する画像が無い場合、より低いレベルの画像へフォールバックする */
function resolveWithFallback(images: Partial<Record<ShopUpgradeLevel, string>>, level: ShopUpgradeLevel): string | null {
  for (let l = level; l >= 1; l--) {
    const found = images[l as ShopUpgradeLevel];
    if (found) return found;
  }
  return null;
}

export function getInteriorAsset(level: ShopUpgradeLevel): string | null {
  return resolveWithFallback(INTERIOR_IMAGES, level);
}

export function getDisplayAsset(level: ShopUpgradeLevel): string | null {
  return resolveWithFallback(DISPLAY_IMAGES, level);
}

export function getRegisterAsset(level: ShopUpgradeLevel): string | null {
  return resolveWithFallback(REGISTER_IMAGES, level);
}

export function getOvenAsset(level: ShopUpgradeLevel): string | null {
  return resolveWithFallback(OVEN_IMAGES, level);
}

export function getDecorAsset(decorId: string): string | null {
  return DECOR_IMAGES[decorId] ?? null;
}

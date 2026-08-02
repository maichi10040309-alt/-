import type { RecipeDef } from '@/types';

// ランク関連の調整可能パラメータ (DESIGN.md 参照)
export const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
export type Rank = (typeof RANKS)[number];

// 累計「成功作成回数」がこの値に達するとそのインデックスのランクになる(調整可能)
export const MASTERY_THRESHOLDS = [0, 3, 7, 12, 18, 25, 35];

// ランクごとの販売価格倍率(調整可能)
export const RANK_PRICE_MULTIPLIER = [1, 1.15, 1.3, 1.5, 1.75, 2.1, 2.5];

// レシピは最終的に200種類を想定(RECIPE_TOTAL_TARGET)。まずは15種で実装。
export const RECIPE_TOTAL_TARGET = 200;

export const RECIPES: RecipeDef[] = [
  {
    id: 'recipe_shortcake',
    name: 'いちごのショートケーキ',
    category: 'cake',
    ingredients: [
      { materialId: 'mat_flour', qty: 2 },
      { materialId: 'mat_egg', qty: 2 },
      { materialId: 'mat_cream', qty: 1 },
      { materialId: 'mat_strawberry', qty: 2 },
    ],
    baseSuccessRate: 0.75,
    basePrice: 320,
    difficulty: 2,
    initiallyKnown: true,
  },
  {
    id: 'recipe_cookie',
    name: 'バタークッキー',
    category: 'cookie',
    ingredients: [
      { materialId: 'mat_flour', qty: 2 },
      { materialId: 'mat_butter', qty: 1 },
      { materialId: 'mat_sugar', qty: 1 },
    ],
    baseSuccessRate: 0.9,
    basePrice: 120,
    difficulty: 1,
    initiallyKnown: true,
  },
  {
    id: 'recipe_pudding',
    name: 'なめらかプリン',
    category: 'pastry',
    ingredients: [
      { materialId: 'mat_egg', qty: 2 },
      { materialId: 'mat_milk', qty: 2 },
      { materialId: 'mat_sugar', qty: 1 },
    ],
    baseSuccessRate: 0.85,
    basePrice: 160,
    difficulty: 1,
    initiallyKnown: true,
  },
  {
    id: 'recipe_choco_truffle',
    name: 'チョコトリュフ',
    category: 'chocolate',
    ingredients: [
      { materialId: 'mat_chocolate', qty: 2 },
      { materialId: 'mat_cream', qty: 1 },
    ],
    baseSuccessRate: 0.7,
    basePrice: 280,
    difficulty: 2,
    initiallyKnown: true,
  },
  {
    id: 'recipe_caramel_candy',
    name: 'キャラメルキャンディ',
    category: 'candy',
    ingredients: [
      { materialId: 'mat_sugar', qty: 2 },
      { materialId: 'mat_butter', qty: 1 },
      { materialId: 'mat_honey', qty: 1 },
    ],
    baseSuccessRate: 0.8,
    basePrice: 150,
    difficulty: 1,
    initiallyKnown: true,
  },
  {
    id: 'recipe_apple_pie',
    name: 'アップルパイ',
    category: 'pastry',
    ingredients: [
      { materialId: 'mat_flour', qty: 2 },
      { materialId: 'mat_butter', qty: 1 },
      { materialId: 'mat_apple', qty: 2 },
      { materialId: 'mat_sugar', qty: 1 },
    ],
    baseSuccessRate: 0.65,
    basePrice: 340,
    difficulty: 3,
    initiallyKnown: false,
  },
  {
    id: 'recipe_madeleine',
    name: 'マドレーヌ',
    category: 'cookie',
    ingredients: [
      { materialId: 'mat_flour', qty: 1 },
      { materialId: 'mat_egg', qty: 1 },
      { materialId: 'mat_honey', qty: 1 },
    ],
    baseSuccessRate: 0.85,
    basePrice: 140,
    difficulty: 1,
    initiallyKnown: false,
  },
  {
    id: 'recipe_lemon_tart',
    name: 'レモンタルト',
    category: 'pastry',
    ingredients: [
      { materialId: 'mat_flour', qty: 2 },
      { materialId: 'mat_lemon', qty: 2 },
      { materialId: 'mat_egg', qty: 1 },
      { materialId: 'mat_sugar', qty: 1 },
    ],
    baseSuccessRate: 0.6,
    basePrice: 360,
    difficulty: 3,
    initiallyKnown: false,
  },
  {
    id: 'recipe_matcha_roll',
    name: '抹茶ロールケーキ',
    category: 'cake',
    ingredients: [
      { materialId: 'mat_flour', qty: 2 },
      { materialId: 'mat_matcha', qty: 1 },
      { materialId: 'mat_cream', qty: 1 },
      { materialId: 'mat_egg', qty: 2 },
    ],
    baseSuccessRate: 0.6,
    basePrice: 380,
    difficulty: 3,
    initiallyKnown: false,
  },
  {
    id: 'recipe_almond_chocolate',
    name: 'アーモンドチョコ',
    category: 'chocolate',
    ingredients: [
      { materialId: 'mat_almond', qty: 2 },
      { materialId: 'mat_chocolate', qty: 2 },
    ],
    baseSuccessRate: 0.7,
    basePrice: 260,
    difficulty: 2,
    initiallyKnown: false,
  },
  {
    id: 'recipe_vanilla_icecream',
    name: 'バニラアイス',
    category: 'pastry',
    ingredients: [
      { materialId: 'mat_milk', qty: 2 },
      { materialId: 'mat_cream', qty: 1 },
      { materialId: 'mat_vanilla', qty: 1 },
      { materialId: 'mat_sugar', qty: 1 },
    ],
    baseSuccessRate: 0.65,
    basePrice: 300,
    difficulty: 2,
    initiallyKnown: false,
  },
  {
    id: 'recipe_honey_madeleine_deluxe',
    name: 'はちみつデラックスマドレーヌ',
    category: 'cookie',
    ingredients: [
      { materialId: 'mat_flour', qty: 2 },
      { materialId: 'mat_honey', qty: 2 },
      { materialId: 'mat_butter', qty: 1 },
      { materialId: 'mat_egg', qty: 1 },
    ],
    baseSuccessRate: 0.55,
    basePrice: 300,
    difficulty: 3,
    initiallyKnown: false,
  },
  {
    id: 'recipe_star_mousse',
    name: '星屑ムース',
    category: 'cake',
    ingredients: [
      { materialId: 'mat_cream', qty: 2 },
      { materialId: 'mat_star_sugar', qty: 1 },
      { materialId: 'mat_egg', qty: 1 },
    ],
    baseSuccessRate: 0.4,
    basePrice: 700,
    difficulty: 5,
    initiallyKnown: false,
  },
  {
    id: 'recipe_moonlight_tart',
    name: '月夜のタルト',
    category: 'pastry',
    ingredients: [
      { materialId: 'mat_flour', qty: 2 },
      { materialId: 'mat_moon_honey', qty: 1 },
      { materialId: 'mat_cream', qty: 1 },
    ],
    baseSuccessRate: 0.4,
    basePrice: 680,
    difficulty: 5,
    initiallyKnown: false,
  },
  {
    id: 'recipe_rainbow_parfait',
    name: '虹色パフェ',
    category: 'cake',
    ingredients: [
      { materialId: 'mat_rainbow_berry', qty: 1 },
      { materialId: 'mat_cream', qty: 2 },
      { materialId: 'mat_vanilla', qty: 1 },
    ],
    baseSuccessRate: 0.35,
    basePrice: 750,
    difficulty: 5,
    initiallyKnown: false,
  },
];

export function getRecipe(id: string): RecipeDef {
  const r = RECIPES.find((x) => x.id === id);
  if (!r) throw new Error(`unknown recipe: ${id}`);
  return r;
}

export function rankLabel(rankIndex: number): Rank {
  return RANKS[Math.max(0, Math.min(RANKS.length - 1, rankIndex))];
}

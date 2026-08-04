import type { GameState, ShelfItem } from '@/types';
import { getRecipe, MASTERY_THRESHOLDS, RANK_PRICE_MULTIPLIER, rankLabel } from '@/data/recipes';
import { getShelfCapacity, getOvenSuccessBonus } from '@/data/shopUpgrades';
import { addLog, addInventory, getInventoryQty, removeInventory } from './gameState';

// 調整可能パラメータ: 陳列棚に置ける商品数の上限(レベル1=未強化状態の初期容量)。
// 実際の上限は店舗設備(陳列棚)のレベルによって変わるため、判定には getShelfCapacity() を使うこと。
export const SHELF_CAPACITY = 8;

/** レシピ基本成功率にオーブン設備の補正を加えた、実際の調合成功率(最大95%)を返す */
export function getEffectiveCraftSuccessRate(state: GameState, recipeId: string): number {
  const recipe = getRecipe(recipeId);
  return Math.min(0.95, recipe.baseSuccessRate + getOvenSuccessBonus(state));
}

export interface CraftResult {
  ok: boolean;
  reason?: 'unknown_recipe' | 'not_enough_materials' | 'shelf_full';
  success?: boolean;
  rank?: string;
  price?: number;
}

export function canCraft(state: GameState, recipeId: string): boolean {
  const recipe = getRecipe(recipeId);
  return recipe.ingredients.every((ing) => getInventoryQty(state, ing.materialId) >= ing.qty);
}

let shelfInstanceSeq = 0;

/** 素材+レシピでスイーツを作成する。成功/失敗判定とランク付けを行う。 */
export function craftSweet(state: GameState, recipeId: string): CraftResult {
  if (!state.knownRecipeIds.includes(recipeId)) {
    return { ok: false, reason: 'unknown_recipe' };
  }
  const recipe = getRecipe(recipeId);

  if (!canCraft(state, recipeId)) {
    return { ok: false, reason: 'not_enough_materials' };
  }

  if (state.shelf.length >= getShelfCapacity(state)) {
    return { ok: false, reason: 'shelf_full' };
  }

  // 素材は挑戦時点で消費する(調整可能: 失敗時に半分だけ消費する等の変更も可能)
  for (const ing of recipe.ingredients) {
    removeInventory(state, ing.materialId, ing.qty);
  }

  const success = Math.random() < getEffectiveCraftSuccessRate(state, recipeId);
  if (!success) {
    addLog(state, `${recipe.name}作りに失敗してしまった……素材が無駄になった。`);
    return { ok: true, success: false };
  }

  const mastery = state.recipeMastery[recipeId] ?? { timesMade: 0, rankIndex: 0 };
  mastery.timesMade += 1;
  mastery.rankIndex = computeRankIndex(mastery.timesMade);
  state.recipeMastery[recipeId] = mastery;

  const price = Math.round(recipe.basePrice * RANK_PRICE_MULTIPLIER[mastery.rankIndex]);
  const item: ShelfItem = {
    id: `shelf_${Date.now()}_${shelfInstanceSeq++}`,
    recipeId,
    rankIndex: mastery.rankIndex,
    price,
  };
  state.shelf.push(item);

  addLog(state, `${recipe.name}(${rankLabel(mastery.rankIndex)}ランク)が完成!棚に並べられる。`);
  return { ok: true, success: true, rank: rankLabel(mastery.rankIndex), price };
}

export function computeRankIndex(timesMade: number): number {
  let idx = 0;
  for (let i = 0; i < MASTERY_THRESHOLDS.length; i++) {
    if (timesMade >= MASTERY_THRESHOLDS[i]) idx = i;
  }
  return idx;
}

export function computeFairPrice(recipeId: string, rankIndex: number): number {
  const recipe = getRecipe(recipeId);
  return Math.round(recipe.basePrice * RANK_PRICE_MULTIPLIER[rankIndex]);
}

// 調整可能パラメータ: 適正価格からどこまで値付けを動かせるか(客の値ごろ感に直結)
export const PRICE_ADJUST_MIN_RATIO = 0.7;
export const PRICE_ADJUST_MAX_RATIO = 1.6;
export const PRICE_ADJUST_STEP = 10;

export function priceRangeFor(recipeId: string, rankIndex: number): { min: number; max: number; fair: number } {
  const fair = computeFairPrice(recipeId, rankIndex);
  return {
    min: Math.max(10, Math.round(fair * PRICE_ADJUST_MIN_RATIO)),
    max: Math.round(fair * PRICE_ADJUST_MAX_RATIO),
    fair,
  };
}

export function adjustShelfPrice(state: GameState, shelfItemId: string, delta: number): boolean {
  const item = state.shelf.find((i) => i.id === shelfItemId);
  if (!item) return false;
  const { min, max } = priceRangeFor(item.recipeId, item.rankIndex);
  item.price = Math.max(min, Math.min(max, item.price + delta));
  return true;
}

export function buyMaterial(state: GameState, materialId: string, price: number, qty: number): boolean {
  const total = price * qty;
  if (state.money < total) return false;
  state.money -= total;
  addInventory(state, materialId, qty);
  return true;
}

import type { GameState, ShelfItem } from '@/types';
import { getRecipe, MASTERY_THRESHOLDS, RANK_PRICE_MULTIPLIER, rankLabel } from '@/data/recipes';
import { addLog, addInventory, getInventoryQty, removeInventory } from './gameState';

export interface CraftResult {
  ok: boolean;
  reason?: 'unknown_recipe' | 'not_enough_materials';
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

  // 素材は挑戦時点で消費する(調整可能: 失敗時に半分だけ消費する等の変更も可能)
  for (const ing of recipe.ingredients) {
    removeInventory(state, ing.materialId, ing.qty);
  }

  const success = Math.random() < recipe.baseSuccessRate;
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

export function buyMaterial(state: GameState, materialId: string, price: number, qty: number): boolean {
  const total = price * qty;
  if (state.money < total) return false;
  state.money -= total;
  addInventory(state, materialId, qty);
  return true;
}

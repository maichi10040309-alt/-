import type { GameState } from '@/types';
import { CHARACTERS } from '@/data/characters';
import { RECIPES } from '@/data/recipes';
import { createDefaultShopUpgrades } from '@/data/shopUpgrades';

export const SAVE_VERSION = 1;
export const STARTING_MONEY = 3000;

/** その日の「本日のおすすめ」レシピをランダムに1つ選ぶ */
export function pickDailyRecommendation(): string {
  const idx = Math.floor(Math.random() * RECIPES.length);
  return RECIPES[idx].id;
}

export function createInitialState(): GameState {
  const characterAffinity: GameState['characterAffinity'] = {};
  for (const c of CHARACTERS) {
    characterAffinity[c.id] = {
      points: 0,
      level: 1,
      completedEventLevels: [],
      pendingEventLevel: null,
    };
  }

  return {
    version: SAVE_VERSION,
    day: 1,
    timeOfDay: 'morning',
    money: STARTING_MONEY,
    inventory: [
      { materialId: 'mat_flour', qty: 4 },
      { materialId: 'mat_sugar', qty: 4 },
      { materialId: 'mat_egg', qty: 3 },
      { materialId: 'mat_butter', qty: 2 },
      { materialId: 'mat_milk', qty: 2 },
      { materialId: 'mat_strawberry', qty: 2 },
    ],
    knownRecipeIds: RECIPES.filter((r) => r.initiallyKnown).map((r) => r.id),
    recipeMastery: {},
    characterAffinity,
    shelf: [],
    monthlyRecords: [],
    currentMonthPlayerSales: 0,
    currentMonthRivalSales: 0,
    contestStageCleared: 0,
    endingSeen: false,
    researchCount: 0,
    actionsThisSlot: 0,
    logs: [],
    logSeq: 0,
    todaysRecommendationRecipeId: pickDailyRecommendation(),
    shopUpgrades: createDefaultShopUpgrades(),
  };
}

export function addLog(state: GameState, text: string): void {
  state.logSeq += 1;
  state.logs.unshift({ id: state.logSeq, day: state.day, timeOfDay: state.timeOfDay, text });
  if (state.logs.length > 50) state.logs.length = 50;
}

export function getInventoryQty(state: GameState, materialId: string): number {
  return state.inventory.find((i) => i.materialId === materialId)?.qty ?? 0;
}

export function addInventory(state: GameState, materialId: string, qty: number): void {
  const entry = state.inventory.find((i) => i.materialId === materialId);
  if (entry) entry.qty += qty;
  else state.inventory.push({ materialId, qty });
}

export function removeInventory(state: GameState, materialId: string, qty: number): boolean {
  const entry = state.inventory.find((i) => i.materialId === materialId);
  if (!entry || entry.qty < qty) return false;
  entry.qty -= qty;
  return true;
}

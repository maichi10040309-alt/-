import type { GameState } from '@/types';
import { SAVE_VERSION, pickDailyRecommendation } from './gameState';
import { sanitizeShopUpgradeState } from '@/data/shopUpgrades';

const SAVE_KEY = 'sweets-department-save-v1';

export function saveGame(state: GameState): void {
  localStorage.setItem(SAVE_KEY, JSON.stringify(state));
}

export function loadGame(): GameState | null {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as GameState;
    if (parsed.version !== SAVE_VERSION) return null;
    if (!parsed.todaysRecommendationRecipeId) parsed.todaysRecommendationRecipeId = pickDailyRecommendation();
    // 店舗設備システム追加前のセーブデータには shopUpgrades が存在しないため、
    // 不正な値も含めて安全に補完する(すべて未強化のレベル1として扱う)。
    parsed.shopUpgrades = sanitizeShopUpgradeState(parsed.shopUpgrades);
    return parsed;
  } catch {
    return null;
  }
}

export function hasSaveData(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function deleteSaveGame(): void {
  localStorage.removeItem(SAVE_KEY);
}

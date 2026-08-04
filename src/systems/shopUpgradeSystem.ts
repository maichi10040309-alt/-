import type { GameState, ShopUpgradeId, ShopUpgradeLevel } from '@/types';
import { findShopUpgrade, getCurrentUpgradeLevel, getNextUpgradeLevelDef, isMaxUpgradeLevel } from '@/data/shopUpgrades';
import { addLog } from './gameState';

export type UpgradePurchaseFailureReason = 'unknown_upgrade' | 'max_level' | 'not_enough_money';

export interface UpgradePurchaseResult {
  ok: boolean;
  reason?: UpgradePurchaseFailureReason;
  upgradeId?: ShopUpgradeId;
  previousLevel?: ShopUpgradeLevel;
  newLevel?: ShopUpgradeLevel;
  cost?: number;
}

/** 店舗設備を1段階アップグレードする。失敗時は所持金・設備レベルを一切変更しない。 */
export function purchaseShopUpgrade(state: GameState, upgradeId: ShopUpgradeId): UpgradePurchaseResult {
  const def = findShopUpgrade(upgradeId);
  if (!def) {
    return { ok: false, reason: 'unknown_upgrade' };
  }

  if (isMaxUpgradeLevel(state, upgradeId)) {
    return { ok: false, reason: 'max_level' };
  }

  const nextDef = getNextUpgradeLevelDef(state, upgradeId);
  if (!nextDef) {
    return { ok: false, reason: 'max_level' };
  }

  if (state.money < nextDef.cost) {
    return { ok: false, reason: 'not_enough_money' };
  }

  const previousLevel = getCurrentUpgradeLevel(state, upgradeId);
  state.money -= nextDef.cost;
  state.shopUpgrades[upgradeId] = nextDef.level;

  addLog(state, `${def.icon} ${def.name}を「${nextDef.name}」へアップグレードした!`);

  return { ok: true, upgradeId, previousLevel, newLevel: nextDef.level, cost: nextDef.cost };
}

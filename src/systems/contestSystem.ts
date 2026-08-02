import type { GameState } from '@/types';
import { CONTEST_STAGES, getContestStage } from '@/data/contest';
import { getRecipe, rankLabel } from '@/data/recipes';
import { addLog, addInventory } from './gameState';

export interface ContestResult {
  ok: boolean;
  reason?: 'no_more_stages' | 'not_enough_money' | 'item_not_found';
  won?: boolean;
  stage?: number;
}

/** ランクが要求水準を満たしているかで勝率を決める簡易判定式(調整可能) */
function winProbability(itemRankIndex: number, requiredRankIndex: number): number {
  const margin = itemRankIndex - requiredRankIndex;
  if (margin >= 0) return Math.min(0.95, 0.7 + margin * 0.08);
  return Math.max(0.05, 0.25 + margin * 0.1);
}

export function enterContest(state: GameState, shelfItemId: string): ContestResult {
  const nextStage = state.contestStageCleared + 1;
  if (nextStage > CONTEST_STAGES.length) {
    return { ok: false, reason: 'no_more_stages' };
  }
  const stageDef = getContestStage(nextStage);

  if (state.money < stageDef.entryFee) {
    return { ok: false, reason: 'not_enough_money' };
  }
  const itemIdx = state.shelf.findIndex((i) => i.id === shelfItemId);
  if (itemIdx === -1) {
    return { ok: false, reason: 'item_not_found' };
  }
  const item = state.shelf[itemIdx];
  const recipe = getRecipe(item.recipeId);

  state.money -= stageDef.entryFee;
  state.shelf.splice(itemIdx, 1);

  const prob = winProbability(item.rankIndex, stageDef.requiredRankIndex);
  const won = Math.random() < prob;

  addLog(state, `【${stageDef.name}】${recipe.name}(${rankLabel(item.rankIndex)})でエントリー……`);

  if (won) {
    state.contestStageCleared = nextStage;
    state.money += stageDef.rewardMoney;
    if (stageDef.rewardMaterialId) addInventory(state, stageDef.rewardMaterialId, 3);
    if (stageDef.rewardRecipeId && !state.knownRecipeIds.includes(stageDef.rewardRecipeId)) {
      state.knownRecipeIds.push(stageDef.rewardRecipeId);
    }
    addLog(state, `優勝!${stageDef.rewardMoney}ベリーと素材/レシピを獲得した!`);
    if (nextStage === CONTEST_STAGES.length) {
      state.endingSeen = true;
      addLog(state, '世界スイーツグランプリ優勝!スタッフロールが流れる……');
    }
  } else {
    addLog(state, `惜しくも敗退……もっと腕を磨いて再挑戦しよう。`);
  }

  return { ok: true, won, stage: nextStage };
}

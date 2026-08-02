import type { GameState } from '@/types';
import { RECIPES } from '@/data/recipes';
import { addLog } from './gameState';

// 調整可能パラメータ: この回数研究するごとにランダムな未習得レシピを1つ解放する
export const RESEARCH_UNLOCK_INTERVAL = 4;

export interface ResearchResult {
  unlockedRecipeName?: string;
}

/** 研究ロジックのみを行う(時間消費の判定は systems/actions.ts 側で行う) */
export function doResearch(state: GameState): ResearchResult {
  state.researchCount += 1;
  addLog(state, 'スイーツ研究に励んだ。新しい知識が身についた気がする。');

  let unlockedRecipeName: string | undefined;
  if (state.researchCount % RESEARCH_UNLOCK_INTERVAL === 0) {
    const locked = RECIPES.filter((r) => !state.knownRecipeIds.includes(r.id));
    if (locked.length > 0) {
      const picked = locked[Math.floor(Math.random() * locked.length)];
      state.knownRecipeIds.push(picked.id);
      unlockedRecipeName = picked.name;
      addLog(state, `研究の成果で新レシピ「${picked.name}」を思いついた!`);
    }
  }

  return { unlockedRecipeName };
}

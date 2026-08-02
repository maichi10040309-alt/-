import type { ContestStageDef } from '@/types';

// コンテスト: 年1回開催、全5段階。requiredRankIndex は RANKS 配列のインデックス
// (0=F ... 6=S)。段階が上がるほど要求ランクが上がる(調整可能パラメータ)。
export const CONTEST_STAGES: ContestStageDef[] = [
  { stage: 1, name: '町内お菓子コンクール', requiredRankIndex: 1, entryFee: 50, rewardMoney: 500, rewardMaterialId: 'mat_chocolate' },
  { stage: 2, name: 'デパート予選', requiredRankIndex: 2, entryFee: 100, rewardMoney: 900, rewardMaterialId: 'mat_star_sugar' },
  { stage: 3, name: '地区大会', requiredRankIndex: 3, entryFee: 200, rewardMoney: 1500, rewardRecipeId: 'recipe_star_mousse' },
  { stage: 4, name: '全国大会', requiredRankIndex: 4, entryFee: 350, rewardMoney: 2500, rewardMaterialId: 'mat_rainbow_berry' },
  { stage: 5, name: '世界スイーツグランプリ', requiredRankIndex: 5, entryFee: 500, rewardMoney: 5000, rewardRecipeId: 'recipe_rainbow_parfait' },
];

export function getContestStage(stage: number): ContestStageDef {
  const s = CONTEST_STAGES.find((x) => x.stage === stage);
  if (!s) throw new Error(`unknown contest stage: ${stage}`);
  return s;
}

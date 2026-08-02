import type { EventRewardDef, EventTemplateDef, EventTemplateId } from '@/types';
import { CHARACTERS } from './characters';
import { RECIPES } from './recipes';

// 汎用イベントテンプレート(2種類)。18人全員に流用し、後から個別シナリオへ
// 1人ずつ差し替えていく方針(DESIGN.md 参照)。
export const EVENT_TEMPLATES: EventTemplateDef[] = [
  {
    id: 'consultation',
    title: 'お悩み相談',
    description: '最近ちょっと悩んでいることがあって……少しだけ聞いてくれる?',
  },
  {
    id: 'minigame',
    title: 'お手伝いミニゲーム',
    description: 'お店のお手伝いをしてくれない?いいタイミングでお願いね。',
  },
];

const UNCOMMON_MATERIALS = ['mat_chocolate', 'mat_vanilla', 'mat_cream', 'mat_lemon', 'mat_almond', 'mat_matcha'];
const RARE_MATERIALS = ['mat_star_sugar', 'mat_moon_honey', 'mat_rainbow_berry', 'mat_fairy_flour', 'mat_dream_cacao', 'mat_crystal_mint'];
const UNLOCKABLE_RECIPES = RECIPES.filter((r) => !r.initiallyKnown).map((r) => r.id);

// 調整可能パラメータ: 好感度レベルごとの基本報酬金額
const REWARD_MONEY_BY_LEVEL: Record<number, number> = { 2: 150, 3: 250, 4: 400, 5: 600 };

/**
 * 18人 × 好感度Lv2〜5 = 72件のイベント報酬を、キャラindexとlevelから
 * 決定的なルールで自動生成する。個別シナリオを書きたくなったら、この配列の
 * 該当エントリだけを手書きの値に差し替えればよい。
 */
export function generateEventRewards(): EventRewardDef[] {
  const rewards: EventRewardDef[] = [];
  CHARACTERS.forEach((char, i) => {
    for (let level = 2; level <= 5; level++) {
      const templateId: EventTemplateId = (i + level) % 2 === 0 ? 'consultation' : 'minigame';
      const rewardMoney = REWARD_MONEY_BY_LEVEL[level];
      let rewardMaterialId: string | undefined;
      let rewardRecipeId: string | undefined;

      if (level === 2) {
        rewardMaterialId = UNCOMMON_MATERIALS[i % UNCOMMON_MATERIALS.length];
      } else if (level === 3) {
        rewardMaterialId = RARE_MATERIALS[i % RARE_MATERIALS.length];
      } else if (level === 4) {
        rewardRecipeId = UNLOCKABLE_RECIPES[i % UNLOCKABLE_RECIPES.length];
      } else {
        rewardMaterialId = RARE_MATERIALS[(i + 3) % RARE_MATERIALS.length];
        rewardRecipeId = UNLOCKABLE_RECIPES[(i + 5) % UNLOCKABLE_RECIPES.length];
      }

      rewards.push({
        characterId: char.id,
        affinityLevel: level,
        templateId,
        rewardMaterialId,
        rewardRecipeId,
        rewardMoney,
      });
    }
  });
  return rewards;
}

export const EVENT_REWARDS: EventRewardDef[] = generateEventRewards();

export function getEventReward(characterId: string, level: number): EventRewardDef | undefined {
  return EVENT_REWARDS.find((e) => e.characterId === characterId && e.affinityLevel === level);
}

export function getTemplate(id: EventTemplateId): EventTemplateDef {
  const t = EVENT_TEMPLATES.find((x) => x.id === id);
  if (!t) throw new Error(`unknown template: ${id}`);
  return t;
}

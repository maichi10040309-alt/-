import type { GameState, EventRewardDef } from '@/types';
import { getCharacter } from '@/data/characters';
import { getMaterial } from '@/data/materials';
import { getRecipe } from '@/data/recipes';
import { getEventReward, getTemplate } from '@/data/events';
import { addLog, addInventory } from './gameState';

export interface PendingEventInfo {
  level: number;
  reward: EventRewardDef;
  templateTitle: string;
  templateDescription: string;
}

export function getPendingEvent(state: GameState, characterId: string): PendingEventInfo | null {
  const affinity = state.characterAffinity[characterId];
  if (!affinity.pendingEventLevel) return null;
  const reward = getEventReward(characterId, affinity.pendingEventLevel);
  if (!reward) return null;
  const template = getTemplate(reward.templateId);
  return { level: affinity.pendingEventLevel, reward, templateTitle: template.title, templateDescription: template.description };
}

/** 「お悩み相談」テンプレート用: キャラindexとlevelから正解の選択肢を決定的に導く */
export function correctConsultationChoice(characterId: string, level: number): number {
  const idx = getCharacter(characterId).id.charCodeAt(characterId.length - 1);
  return (idx + level) % 3;
}

type EventGrade = 'full' | 'partial' | 'fail';

function applyEventGrade(state: GameState, characterId: string, grade: EventGrade): void {
  const affinity = state.characterAffinity[characterId];
  const level = affinity.pendingEventLevel;
  if (!level) return;
  const reward = getEventReward(characterId, level);
  const char = getCharacter(characterId);
  if (!reward) return;

  if (grade === 'fail') {
    addLog(state, `${char.name}のイベントはうまくいかなかった……また今度挑戦しよう。`);
    return; // pendingEventLevel は維持し、再挑戦可能にする
  }

  const moneyMult = grade === 'full' ? 1 : 0.4;
  state.money += Math.round(reward.rewardMoney * moneyMult);

  if (reward.rewardMaterialId) {
    const qty = grade === 'full' ? 3 : 1;
    addInventory(state, reward.rewardMaterialId, qty);
    addLog(state, `${getMaterial(reward.rewardMaterialId).name}を${qty}個手に入れた!`);
  }
  if (grade === 'full' && reward.rewardRecipeId && !state.knownRecipeIds.includes(reward.rewardRecipeId)) {
    state.knownRecipeIds.push(reward.rewardRecipeId);
    addLog(state, `新しいレシピ「${getRecipe(reward.rewardRecipeId).name}」を手に入れた!`);
  }

  affinity.completedEventLevels.push(level);
  affinity.pendingEventLevel = null;
  addLog(state, `${char.name}のイベントをクリアした!`);
}

export function resolveConsultationEvent(state: GameState, characterId: string, choiceIndex: number): EventGrade {
  const affinity = state.characterAffinity[characterId];
  const level = affinity.pendingEventLevel;
  const grade: EventGrade = level && choiceIndex === correctConsultationChoice(characterId, level) ? 'full' : 'partial';
  applyEventGrade(state, characterId, grade);
  return grade;
}

/** ミニゲーム用: hitValue は 0-100 のタイミング精度(50が完璧) */
export function resolveMinigameEvent(state: GameState, characterId: string, hitValue: number): EventGrade {
  const diff = Math.abs(hitValue - 50);
  const grade: EventGrade = diff <= 12 ? 'full' : diff <= 28 ? 'partial' : 'fail';
  applyEventGrade(state, characterId, grade);
  return grade;
}

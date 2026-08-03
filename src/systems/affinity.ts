import type { GameState } from '@/types';
import { getCharacter } from '@/data/characters';
import { addLog } from './gameState';

// 調整可能パラメータ: 各好感度Lv(1〜5)に到達するために必要な累計会話回数。
// インデックス0=Lv1(初期到達済み)、インデックス4=Lv5。
export const AFFINITY_TALK_THRESHOLDS = [0, 4, 9, 15, 22];
export const AFFINITY_MAX_LEVEL = 5;

export interface TalkResult {
  leveledUp: boolean;
  newLevel: number;
  eventUnlocked: boolean;
  greeting: string;
}

export function talkToCharacter(state: GameState, characterId: string): TalkResult {
  const affinity = state.characterAffinity[characterId];
  const char = getCharacter(characterId);
  affinity.points += 1;

  let leveledUp = false;
  while (affinity.level < AFFINITY_MAX_LEVEL && affinity.points >= AFFINITY_TALK_THRESHOLDS[affinity.level]) {
    affinity.level += 1;
    leveledUp = true;
  }

  let eventUnlocked = false;
  if (leveledUp && affinity.level >= 2 && !affinity.completedEventLevels.includes(affinity.level)) {
    affinity.pendingEventLevel = affinity.level;
    eventUnlocked = true;
  }

  const greeting = char.talkLines[affinity.level - 1];
  addLog(state, `${char.name}と会話した。「${greeting}」`);
  if (leveledUp) {
    addLog(state, `${char.name}との好感度がLv${affinity.level}になった!`);
  }
  if (eventUnlocked) {
    addLog(state, `${char.name}が話したいことがあるみたい……(イベント発生)`);
  }

  return { leveledUp, newLevel: affinity.level, eventUnlocked, greeting };
}

import type { GameState } from '@/types';
import { registerTimeConsumingAction, ACTIONS_TO_ADVANCE_TALK } from './time';
import { talkToCharacter, type TalkResult } from './affinity';
import { doResearch, type ResearchResult } from './research';
import { onDayAdvanced } from './sales';

/**
 * 時間を消費する行動をまとめて処理する。時間帯が進んだ場合は日付が
 * 変わったかどうかを検知し、ライバル売上・月末集計フックを呼び出す。
 */
function consumeTime(state: GameState, requiredCount: number): boolean {
  const dayBefore = state.day;
  const advanced = registerTimeConsumingAction(state, requiredCount);
  if (advanced && state.day !== dayBefore) {
    onDayAdvanced(state);
  }
  return advanced;
}

export interface TalkActionResult extends TalkResult {
  timeAdvanced: boolean;
}

export function performTalk(state: GameState, characterId: string): TalkActionResult {
  const talkResult = talkToCharacter(state, characterId);
  const timeAdvanced = consumeTime(state, ACTIONS_TO_ADVANCE_TALK);
  return { ...talkResult, timeAdvanced };
}

export interface ResearchActionResult extends ResearchResult {
  timeAdvanced: boolean;
}

export function performResearch(state: GameState): ResearchActionResult {
  const researchResult = doResearch(state);
  const timeAdvanced = consumeTime(state, 1);
  return { ...researchResult, timeAdvanced };
}

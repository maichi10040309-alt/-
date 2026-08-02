import type { GameState, TimeOfDay } from '@/types';
import { TIME_ORDER } from '@/types';
import { addLog } from './gameState';

// 調整可能パラメータ: 1タイムスロットで時間を消費する行動の必要回数。
// 「スイーツ研究をする」は1回で即時間が進む。
// 「他キャラクターに話しかける」は2回目で時間が進む(1回目では進まない)。
export const ACTIONS_TO_ADVANCE_TALK = 2;

export function advanceTimeSlot(state: GameState): void {
  const idx = TIME_ORDER.indexOf(state.timeOfDay);
  if (idx < TIME_ORDER.length - 1) {
    state.timeOfDay = TIME_ORDER[idx + 1] as TimeOfDay;
    addLog(state, timeLabel(state.timeOfDay) + 'になりました。');
  } else {
    state.day += 1;
    state.timeOfDay = 'morning';
    addLog(state, `${state.day}日目の朝を迎えました。`);
  }
  state.actionsThisSlot = 0;
}

export function timeLabel(t: TimeOfDay): string {
  if (t === 'morning') return '朝';
  if (t === 'noon') return '昼';
  return '夜';
}

/**
 * 時間を消費する行動を1回分記録する。必要回数(cost)に達したら自動で
 * 時間を1つ進める。研究は cost=1(即進む)、会話は cost=1 だが
 * ACTIONS_TO_ADVANCE_TALK=2 回分溜まらないと進まない、という呼び出し方をする。
 */
export function registerTimeConsumingAction(state: GameState, requiredCount: number): boolean {
  state.actionsThisSlot += 1;
  if (state.actionsThisSlot >= requiredCount) {
    advanceTimeSlot(state);
    return true;
  }
  return false;
}

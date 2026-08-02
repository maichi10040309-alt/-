import type { GameState } from '@/types';
import { getRecipe, rankLabel } from '@/data/recipes';
import { rollRivalDailySales } from '@/data/rivals';
import { addLog } from './gameState';

// 調整可能パラメータ
export const DAYS_PER_MONTH = 10; // 月間競争のサイクル(短縮版)
export const BASE_CUSTOMERS_PER_SHIFT = 6; // 1回の接客あたりの基準来店客数
export const CUSTOMER_VARIANCE = 3;
export const TARGET_SALES_BASE = 1800; // 月間目標売上(基準値)
export const TARGET_SALES_GROWTH = 250; // 月が進むごとに増える目標額

export interface SalesShiftResult {
  customers: number;
  itemsSold: number;
  revenue: number;
}

/** ランクと価格から購入確率を算出する簡易式(調整可能) */
function purchaseProbability(rankIndex: number, price: number, basePrice: number): number {
  const rankBonus = rankIndex * 0.06;
  const priceStress = Math.max(0, (price - basePrice) / basePrice) * 0.3;
  return Math.min(0.95, Math.max(0.05, 0.35 + rankBonus - priceStress));
}

/** プレイヤーの店で接客を行い、棚の商品が売れるかシミュレーションする */
export function runSalesShift(state: GameState): SalesShiftResult {
  const result: SalesShiftResult = { customers: 0, itemsSold: 0, revenue: 0 };
  if (state.shelf.length === 0) {
    addLog(state, '棚に商品がないので、お客さんは何も買わずに帰っていった。');
    return result;
  }

  const customers = Math.max(1, Math.round(BASE_CUSTOMERS_PER_SHIFT + (Math.random() * 2 - 1) * CUSTOMER_VARIANCE));
  result.customers = customers;

  for (let i = 0; i < customers; i++) {
    if (state.shelf.length === 0) break;
    const itemIdx = Math.floor(Math.random() * state.shelf.length);
    const item = state.shelf[itemIdx];
    const recipe = getRecipe(item.recipeId);
    const prob = purchaseProbability(item.rankIndex, item.price, recipe.basePrice);
    if (Math.random() < prob) {
      state.shelf.splice(itemIdx, 1);
      state.money += item.price;
      state.currentMonthPlayerSales += item.price;
      result.itemsSold += 1;
      result.revenue += item.price;
      addLog(state, `お客さんが${recipe.name}(${rankLabel(item.rankIndex)})を${item.price}ベリーで購入!`);
    }
  }

  if (result.itemsSold === 0) {
    addLog(state, `${customers}人のお客さんが来たけれど、今回は誰も買わなかった。`);
  } else {
    addLog(state, `接客終了: ${result.itemsSold}個売れて${result.revenue}ベリーの売上!`);
  }
  return result;
}

/** 日が進んだ際に呼び出す。ライバル店の売上加算と月末集計を行う。 */
export function onDayAdvanced(state: GameState): void {
  state.currentMonthRivalSales += rollRivalDailySales();

  const dayInMonth = ((state.day - 1) % DAYS_PER_MONTH) + 1;
  if (dayInMonth === 1 && state.day > 1) {
    finalizeMonth(state);
  }
}

function finalizeMonth(state: GameState): void {
  const monthNumber = state.monthlyRecords.length + 1;
  const target = TARGET_SALES_BASE + (monthNumber - 1) * TARGET_SALES_GROWTH;
  const won = state.currentMonthPlayerSales >= state.currentMonthRivalSales || state.currentMonthPlayerSales >= target;

  state.monthlyRecords.unshift({
    monthNumber,
    playerSales: state.currentMonthPlayerSales,
    rivalSales: state.currentMonthRivalSales,
    targetSales: target,
    result: won ? 'win' : 'lose',
  });

  if (won) {
    const bonus = 300 + monthNumber * 50;
    state.money += bonus;
    addLog(state, `【月間売上ランキング】${monthNumber}か月目、目標達成!ボーナス${bonus}ベリー獲得!`);
  } else {
    addLog(state, `【月間売上ランキング】${monthNumber}か月目は目標未達成……次の月こそ頑張ろう。`);
  }

  state.currentMonthPlayerSales = 0;
  state.currentMonthRivalSales = 0;
}

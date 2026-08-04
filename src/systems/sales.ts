import type { CustomerTypeDef, CustomerTypeId, CustomerVisitResult, GameState, SalesShiftResult, ShelfItem } from '@/types';
import { getRecipe, rankLabel } from '@/data/recipes';
import { pickCustomerType, rollCustomerBudget } from '@/data/customers';
import { rollRivalDailySales } from '@/data/rivals';
import { addLog, pickDailyRecommendation } from './gameState';
import { computeFairPrice } from './crafting';

// 調整可能パラメータ
export const DAYS_PER_MONTH = 10; // 月間競争のサイクル(短縮版)
export const BASE_CUSTOMERS_PER_SHIFT = 6; // 1回の接客あたりの基準来店客数
export const CUSTOMER_VARIANCE = 3;
export const TARGET_SALES_BASE = 1800; // 月間目標売上(基準値)
export const TARGET_SALES_GROWTH = 250; // 月が進むごとに増える目標額
export const RECOMMENDATION_PURCHASE_BONUS = 0.2; // 「本日のおすすめ」に一致する商品の購入確率ボーナス(基準値)

// お客さんの商品選択・購入確率にかかわる調整可能パラメータ
export const CUSTOMER_RANK_BONUS_PER_INDEX = 0.03; // ランクが高いほど全客層に共通でわずかに有利
export const CUSTOMER_PRICE_EFFECT_UP = 0.6; // 適正価格より高いときの減点係数
export const CUSTOMER_PRICE_EFFECT_DOWN = 0.35; // 適正価格より安いときの加点係数
export const CUSTOMER_OVER_BUDGET_HARD_RATIO = 1.2; // 予算のこの倍率を超えると購入候補から除外
export const CUSTOMER_OVER_BUDGET_SOFT_PENALTY = 0.3; // 予算〜予算1.2倍ゾーンでの基準ペナルティ
export const CUSTOMER_SCORE_JITTER = 0.08; // 商品選択スコアに加える少量のランダム値の振れ幅
export const CUSTOMER_SCORE_CANDIDATE_POOL = 3; // 上位何件から重み付き抽選するか

export function priceFeelLabel(price: number, fairPrice: number): string {
  const ratio = price / fairPrice;
  if (ratio <= 0.85) return '🟢 お買い得';
  if (ratio <= 1.1) return '🙂 ちょうど良い';
  if (ratio <= 1.35) return '🟡 やや高め';
  return '🔴 高すぎるかも';
}

/**
 * ランクに見合った「適正価格」からの乖離で購入確率を算出する簡易式(調整可能)。
 * 適正価格ちょうどなら基準確率、それより安ければ加点、高ければ減点する。
 * お客さんタイプを考慮しない汎用版。互換性のため残している(現在は内部からは未使用)。
 */
export function purchaseProbability(rankIndex: number, price: number, fairPrice: number, isRecommended = false): number {
  const rankBonus = rankIndex * CUSTOMER_RANK_BONUS_PER_INDEX;
  const deviation = (price - fairPrice) / fairPrice; // 正なら割高、負なら割安
  const priceEffect = deviation >= 0 ? deviation * CUSTOMER_PRICE_EFFECT_UP : deviation * CUSTOMER_PRICE_EFFECT_DOWN;
  const recommendationBonus = isRecommended ? RECOMMENDATION_PURCHASE_BONUS : 0;
  return Math.min(0.95, Math.max(0.05, 0.55 + rankBonus - priceEffect + recommendationBonus));
}

// ------------------------------------------------------------
// お客さんタイプ別の商品選択・購入確率
// ------------------------------------------------------------

function isOverHardBudget(price: number, budget: number): boolean {
  return price > budget * CUSTOMER_OVER_BUDGET_HARD_RATIO;
}

function isOverSoftBudget(price: number, budget: number): boolean {
  return price > budget;
}

/** 適正価格からの乖離を、客の価格感度で重みづけした増減値を返す(高いほどマイナス) */
function priceDeviationEffect(customer: CustomerTypeDef, price: number, fairPrice: number): number {
  const deviation = (price - fairPrice) / fairPrice;
  const effect = deviation >= 0 ? deviation * CUSTOMER_PRICE_EFFECT_UP : deviation * CUSTOMER_PRICE_EFFECT_DOWN;
  return effect * customer.priceSensitivity;
}

/** その客にとっての商品ランクの好みによる加点/減点 */
function rankPreferenceEffect(customer: CustomerTypeDef, rankIndex: number): number {
  let effect = 0;
  if (customer.preferredMinRankIndex !== undefined && rankIndex >= customer.preferredMinRankIndex) {
    effect += customer.preferredRankBonus ?? 0;
  }
  if (customer.lowRankPenaltyThreshold !== undefined && rankIndex <= customer.lowRankPenaltyThreshold) {
    effect -= customer.lowRankPenalty ?? 0;
  }
  return effect;
}

interface ScoredItem {
  item: ShelfItem;
  score: number;
  overBudgetSoft: boolean;
}

/** 客がその商品をどれだけ手に取りたいと思うか(商品選択の候補選定に使うスコア) */
function scoreShelfItemForCustomer(customer: CustomerTypeDef, budget: number, item: ShelfItem, state: GameState): ScoredItem {
  const recipe = getRecipe(item.recipeId);
  const fairPrice = computeFairPrice(item.recipeId, item.rankIndex);

  let score = 0.5;
  if (customer.preferredCategories.includes(recipe.category)) {
    score += customer.categoryBonus;
  }
  score += rankPreferenceEffect(customer, item.rankIndex);
  if (item.recipeId === state.todaysRecommendationRecipeId) {
    score += RECOMMENDATION_PURCHASE_BONUS * customer.recommendationMultiplier;
  }
  score -= priceDeviationEffect(customer, item.price, fairPrice);

  const overBudgetSoft = isOverSoftBudget(item.price, budget);
  if (overBudgetSoft) {
    score -= CUSTOMER_OVER_BUDGET_SOFT_PENALTY * (customer.budgetPenaltyFactor ?? 1);
  }

  score += (Math.random() * 2 - 1) * CUSTOMER_SCORE_JITTER;

  return { item, score, overBudgetSoft };
}

interface CandidateSearch {
  scored: ScoredItem[];
  anyWithinBudget: boolean;
}

/** 棚から、その客が検討しうる商品(予算1.2倍以内かつスコアが正)を集める */
function gatherCandidates(customer: CustomerTypeDef, budget: number, state: GameState): CandidateSearch {
  let anyWithinBudget = false;
  const scored: ScoredItem[] = [];
  for (const item of state.shelf) {
    if (isOverHardBudget(item.price, budget)) continue;
    anyWithinBudget = true;
    const scoredItem = scoreShelfItemForCustomer(customer, budget, item, state);
    if (scoredItem.score > 0) scored.push(scoredItem);
  }
  return { scored, anyWithinBudget };
}

/** スコア上位数件から重み付き抽選で1つ選ぶ(常に最高スコア品を選ばせないための工夫) */
function pickWeightedItem(scored: ScoredItem[]): ScoredItem {
  const pool = [...scored].sort((a, b) => b.score - a.score).slice(0, CUSTOMER_SCORE_CANDIDATE_POOL);
  const totalScore = pool.reduce((sum, s) => sum + s.score, 0);
  let roll = Math.random() * totalScore;
  for (const s of pool) {
    roll -= s.score;
    if (roll < 0) return s;
  }
  return pool[pool.length - 1];
}

/**
 * 「これを買おうか」と手に取った商品1つに対する、最終的な購入確率(5%〜95%)。
 * 予算1.2倍を超える商品はこの関数を呼ぶ前に候補から除外しておくこと。
 */
export function calculateCustomerPurchaseProbability(customer: CustomerTypeDef, budget: number, item: ShelfItem, state: GameState): number {
  const recipe = getRecipe(item.recipeId);
  const fairPrice = computeFairPrice(item.recipeId, item.rankIndex);

  let prob = 0.55 + item.rankIndex * CUSTOMER_RANK_BONUS_PER_INDEX;
  prob -= priceDeviationEffect(customer, item.price, fairPrice);
  prob += rankPreferenceEffect(customer, item.rankIndex);

  if (item.recipeId === state.todaysRecommendationRecipeId) {
    prob += RECOMMENDATION_PURCHASE_BONUS * customer.recommendationMultiplier;
  }
  if (customer.preferredCategories.includes(recipe.category)) {
    prob += customer.categoryBonus;
  }
  if (isOverSoftBudget(item.price, budget)) {
    prob -= CUSTOMER_OVER_BUDGET_SOFT_PENALTY * (customer.budgetPenaltyFactor ?? 1);
  }

  return Math.min(0.95, Math.max(0.05, prob));
}

// 買わなかった理由(内部判定できる範囲でシンプルに)
const REASON_SHELF_EMPTY = '棚の商品が売り切れていた';
const REASON_NO_BUDGET_FIT = '予算に合う商品がなかった';
const REASON_NO_PREFERENCE_MATCH = '好みの商品が見つからなかった';
const REASON_PRICE_TOO_HIGH = '値段が少し高いと感じた';
const REASON_WANTS_HIGHER_RANK = 'もっと高ランクの商品を探している';
const REASON_HESITATED = '迷ったけれど今回は買わなかった';

/** お客さん1人分の来店を処理する。購入が決まった場合は state を直接更新する。 */
function simulateCustomerVisit(state: GameState, customer: CustomerTypeDef, budget: number): CustomerVisitResult {
  const base = {
    customerTypeId: customer.id,
    customerName: customer.name,
    customerIcon: customer.icon,
    budget,
  };

  if (state.shelf.length === 0) {
    return { ...base, purchased: false, reason: REASON_SHELF_EMPTY };
  }

  const { scored, anyWithinBudget } = gatherCandidates(customer, budget, state);
  if (scored.length === 0) {
    return { ...base, purchased: false, reason: anyWithinBudget ? REASON_NO_PREFERENCE_MATCH : REASON_NO_BUDGET_FIT };
  }

  const chosen = pickWeightedItem(scored);
  const prob = calculateCustomerPurchaseProbability(customer, budget, chosen.item, state);

  if (Math.random() < prob) {
    const recipe = getRecipe(chosen.item.recipeId);
    const rank = rankLabel(chosen.item.rankIndex);
    const price = chosen.item.price;
    state.shelf = state.shelf.filter((i) => i.id !== chosen.item.id);
    state.money += price;
    state.currentMonthPlayerSales += price;
    return { ...base, purchased: true, purchasedItemName: recipe.name, purchasedItemRank: rank, purchasedPrice: price };
  }

  if (chosen.overBudgetSoft) {
    return { ...base, purchased: false, reason: REASON_PRICE_TOO_HIGH };
  }
  if (customer.preferredMinRankIndex !== undefined && chosen.item.rankIndex < customer.preferredMinRankIndex) {
    return { ...base, purchased: false, reason: REASON_WANTS_HIGHER_RANK };
  }
  return { ...base, purchased: false, reason: REASON_HESITATED };
}

/** プレイヤーの店で接客を行い、来店客ごとに棚の商品が売れるかシミュレーションする */
export function runSalesShift(state: GameState): SalesShiftResult {
  const customers = Math.max(1, Math.round(BASE_CUSTOMERS_PER_SHIFT + (Math.random() * 2 - 1) * CUSTOMER_VARIANCE));
  const visits: CustomerVisitResult[] = [];
  const customerBreakdown: Partial<Record<CustomerTypeId, number>> = {};
  let itemsSold = 0;
  let revenue = 0;

  for (let i = 0; i < customers; i++) {
    const customerType = pickCustomerType();
    const budget = rollCustomerBudget(customerType);
    customerBreakdown[customerType.id] = (customerBreakdown[customerType.id] ?? 0) + 1;

    const visit = simulateCustomerVisit(state, customerType, budget);
    visits.push(visit);

    if (visit.purchased) {
      itemsSold += 1;
      revenue += visit.purchasedPrice ?? 0;
      addLog(state, `${visit.customerIcon} ${visit.customerName}が${visit.purchasedItemName}(${visit.purchasedItemRank}ランク)を${visit.purchasedPrice}ベリーで購入!`);
    }
  }

  addLog(state, `接客終了: ${customers}人来店、${itemsSold}個売れて${revenue}ベリーの売上!`);

  return { customers, itemsSold, revenue, customerBreakdown, visits };
}

/** 日が進んだ際に呼び出す。ライバル店の売上加算と月末集計を行う。 */
export function onDayAdvanced(state: GameState): void {
  state.currentMonthRivalSales += rollRivalDailySales();
  state.todaysRecommendationRecipeId = pickDailyRecommendation();

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

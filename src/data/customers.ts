import type { CustomerTypeDef, CustomerTypeId, GameState } from '@/types';
import { getInteriorCustomerWeightBonuses } from './shopUpgrades';

// お客さんタイプ定義。予算・好みカテゴリー・重視ランクによって「売れやすい商品」が
// 客層ごとに変わるようにするための一時データ(接客のたびに抽選するだけで、
// GameStateへは保存しない)。
export const CUSTOMER_TYPES: CustomerTypeDef[] = [
  {
    id: 'child',
    name: '子ども',
    icon: '👦',
    weight: 30,
    baseBudget: 180,
    budgetVariance: 40,
    preferredCategories: ['candy', 'cookie'],
    categoryBonus: 0.2,
    recommendationMultiplier: 1,
    priceSensitivity: 1.15, // 高額な商品ほど手が出にくい
  },
  {
    id: 'student',
    name: '学生',
    icon: '🎓',
    weight: 25,
    baseBudget: 300,
    budgetVariance: 70,
    preferredCategories: ['cookie', 'chocolate', 'candy'],
    categoryBonus: 0.12,
    recommendationMultiplier: 1.8, // 「本日のおすすめ」に強く反応する
    priceSensitivity: 1,
  },
  {
    id: 'family',
    name: 'ファミリー',
    icon: '👪',
    weight: 25,
    baseBudget: 400,
    budgetVariance: 100,
    preferredCategories: ['cake', 'cookie', 'pastry'],
    categoryBonus: 0.15,
    recommendationMultiplier: 1.3,
    priceSensitivity: 0.85, // 定番商品の値段には比較的おおらか
  },
  {
    id: 'gourmet',
    name: 'グルメ',
    icon: '🧐',
    weight: 15,
    baseBudget: 650,
    budgetVariance: 120,
    preferredCategories: ['cake', 'cookie', 'chocolate', 'candy', 'pastry'],
    categoryBonus: 0.05,
    preferredMinRankIndex: 4, // Bランク以上
    preferredRankBonus: 0.2,
    lowRankPenaltyThreshold: 2, // Dランク以下
    lowRankPenalty: 0.25,
    recommendationMultiplier: 0.5,
    priceSensitivity: 0.6, // 価格より品質を重視
  },
  {
    id: 'celebrity',
    name: 'セレブ',
    icon: '💎',
    weight: 5,
    baseBudget: 1000,
    budgetVariance: 200,
    preferredCategories: ['cake', 'cookie', 'chocolate', 'candy', 'pastry'],
    categoryBonus: 0.05,
    preferredMinRankIndex: 5, // Aランク以上
    preferredRankBonus: 0.3,
    lowRankPenaltyThreshold: 3, // Cランク以下
    lowRankPenalty: 0.35,
    recommendationMultiplier: 0.4,
    priceSensitivity: 0.4,
    budgetPenaltyFactor: 0.35, // 予算超過ペナルティを弱める(値段よりランク優先)
  },
];

export function getCustomerType(id: CustomerTypeId): CustomerTypeDef {
  const found = CUSTOMER_TYPES.find((c) => c.id === id);
  if (!found) throw new Error(`unknown customer type: ${id}`);
  return found;
}

/**
 * 出現ウェイトに応じてお客さんタイプを1人抽選する(ウェイト合計が100でなくても正しく動く汎用処理)。
 * weights を渡すとタイプごとの最終ウェイトとして使う(省略時は CUSTOMER_TYPES の基本ウェイトのみ)。
 */
export function pickCustomerType(weights?: Record<CustomerTypeId, number>): CustomerTypeDef {
  const effectiveWeights = weights ?? getBaseCustomerWeights();
  const totalWeight = CUSTOMER_TYPES.reduce((sum, c) => sum + (effectiveWeights[c.id] ?? 0), 0);
  let roll = Math.random() * totalWeight;
  for (const customer of CUSTOMER_TYPES) {
    roll -= effectiveWeights[customer.id] ?? 0;
    if (roll < 0) return customer;
  }
  return CUSTOMER_TYPES[CUSTOMER_TYPES.length - 1];
}

function getBaseCustomerWeights(): Record<CustomerTypeId, number> {
  return Object.fromEntries(CUSTOMER_TYPES.map((c) => [c.id, c.weight])) as Record<CustomerTypeId, number>;
}

/**
 * 最終的な出現ウェイト(基本ウェイト＋店舗内装補正)を組み立てる。
 * 将来「客層トレンド補正」「季節補正」などを追加する場合も、この関数へ同じ形で
 * 加算していけば pickCustomerTypeForState 側の変更は不要になる。
 */
export function getEffectiveCustomerWeights(state: GameState): Record<CustomerTypeId, number> {
  const interiorBonuses = getInteriorCustomerWeightBonuses(state);
  const weights = getBaseCustomerWeights();
  for (const customer of CUSTOMER_TYPES) {
    weights[customer.id] += interiorBonuses[customer.id] ?? 0;
  }
  return weights;
}

/** 店舗設備(内装)の補正を反映した最終ウェイトで、お客さんタイプを1人抽選する */
export function pickCustomerTypeForState(state: GameState): CustomerTypeDef {
  return pickCustomerType(getEffectiveCustomerWeights(state));
}

// 予算が極端に小さくなりすぎないための下限(調整可能)
const MIN_CUSTOMER_BUDGET = 30;

/** 基本予算と変動幅から、その来店客の今回の予算を決める */
export function rollCustomerBudget(customer: CustomerTypeDef): number {
  const offset = (Math.random() * 2 - 1) * customer.budgetVariance;
  return Math.max(MIN_CUSTOMER_BUDGET, Math.round(customer.baseBudget + offset));
}

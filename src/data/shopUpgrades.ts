import type { CustomerTypeId, GameState, ShopUpgradeDef, ShopUpgradeId, ShopUpgradeLevel, ShopUpgradeLevelDef, ShopUpgradeState } from '@/types';

// 店舗設備の定義一覧(調整可能パラメータ)。レベル1が初期状態、レベル4が最大。
// 各設備の「レベル1の初期値」は crafting.ts の SHELF_CAPACITY / sales.ts の
// BASE_CUSTOMERS_PER_SHIFT と意図的に一致させている(互換性のため残した定数の説明を参照)。
export const SHOP_UPGRADES: ShopUpgradeDef[] = [
  {
    id: 'display',
    name: '陳列棚',
    icon: '🧁',
    description: '商品を置ける数を増やす。',
    levels: [
      { level: 1, name: '小さな陳列棚', description: '商品を8点まで陳列できます', cost: 0, effect: { kind: 'display', shelfCapacity: 8 } },
      { level: 2, name: '広々陳列棚', description: '商品を10点まで陳列できます', cost: 4000, effect: { kind: 'display', shelfCapacity: 10 } },
      { level: 3, name: 'ショーケース棚', description: '商品を13点まで陳列できます', cost: 10000, effect: { kind: 'display', shelfCapacity: 13 } },
      { level: 4, name: 'プレミアムショーケース', description: '商品を16点まで陳列できます', cost: 22000, effect: { kind: 'display', shelfCapacity: 16 } },
    ],
  },
  {
    id: 'oven',
    name: 'オーブン',
    icon: '🔥',
    description: '調合成功率を少し上げる。',
    levels: [
      { level: 1, name: '家庭用オーブン', description: '調合成功率への補正はありません', cost: 0, effect: { kind: 'oven', successRateBonus: 0 } },
      { level: 2, name: '業務用オーブン', description: '調合成功率 +5%', cost: 5000, effect: { kind: 'oven', successRateBonus: 0.05 } },
      { level: 3, name: '高性能オーブン', description: '調合成功率 +10%', cost: 13000, effect: { kind: 'oven', successRateBonus: 0.1 } },
      { level: 4, name: '魔法のパティシエオーブン', description: '調合成功率 +15%', cost: 28000, effect: { kind: 'oven', successRateBonus: 0.15 } },
    ],
  },
  {
    id: 'register',
    name: 'レジ',
    icon: '💳',
    description: '1回の接客で対応できる基準来店客数を増やす。',
    levels: [
      { level: 1, name: 'シンプルレジ', description: '基準来店客数 6人', cost: 0, effect: { kind: 'register', baseCustomers: 6 } },
      { level: 2, name: 'スムーズレジ', description: '基準来店客数 7人', cost: 6000, effect: { kind: 'register', baseCustomers: 7 } },
      { level: 3, name: '高速レジ', description: '基準来店客数 8人', cost: 15000, effect: { kind: 'register', baseCustomers: 8 } },
      { level: 4, name: 'スマートレジ', description: '基準来店客数 10人', cost: 32000, effect: { kind: 'register', baseCustomers: 10 } },
    ],
  },
  {
    id: 'interior',
    name: '店舗内装',
    icon: '🛋',
    description: '高級志向のお客さんが少し来店しやすくなる。',
    levels: [
      { level: 1, name: 'シンプルな店内', description: '客層補正なし', cost: 0, effect: { kind: 'interior', customerWeightBonuses: {} } },
      {
        level: 2,
        name: 'かわいいカフェ風',
        description: 'グルメとセレブが少し来店しやすくなります',
        cost: 7000,
        effect: { kind: 'interior', customerWeightBonuses: { gourmet: 2, celebrity: 1 } },
      },
      {
        level: 3,
        name: '上品なパティスリー風',
        description: 'グルメとセレブがさらに来店しやすくなります',
        cost: 18000,
        effect: { kind: 'interior', customerWeightBonuses: { gourmet: 5, celebrity: 3 } },
      },
      {
        level: 4,
        name: '高級ホテルラウンジ風',
        description: 'グルメとセレブがぐっと来店しやすくなります',
        cost: 38000,
        effect: { kind: 'interior', customerWeightBonuses: { gourmet: 8, celebrity: 6 } },
      },
    ],
  },
];

export const SHOP_UPGRADE_IDS: ShopUpgradeId[] = SHOP_UPGRADES.map((u) => u.id);

export function findShopUpgrade(id: string): ShopUpgradeDef | undefined {
  return SHOP_UPGRADES.find((u) => u.id === id);
}

export function isShopUpgradeId(value: string): value is ShopUpgradeId {
  return findShopUpgrade(value) !== undefined;
}

export function getShopUpgrade(id: ShopUpgradeId): ShopUpgradeDef {
  const found = findShopUpgrade(id);
  if (!found) throw new Error(`unknown shop upgrade: ${id}`);
  return found;
}

export function getCurrentUpgradeLevel(state: GameState, id: ShopUpgradeId): ShopUpgradeLevel {
  return state.shopUpgrades[id];
}

export function getCurrentUpgradeLevelDef(state: GameState, id: ShopUpgradeId): ShopUpgradeLevelDef {
  const def = getShopUpgrade(id);
  const level = getCurrentUpgradeLevel(state, id);
  return def.levels[level - 1];
}

export function getNextUpgradeLevelDef(state: GameState, id: ShopUpgradeId): ShopUpgradeLevelDef | null {
  const def = getShopUpgrade(id);
  const level = getCurrentUpgradeLevel(state, id);
  return def.levels[level] ?? null; // 配列インデックス = 次のレベル(0始まりのため level がそのまま次要素を指す)
}

export function isMaxUpgradeLevel(state: GameState, id: ShopUpgradeId): boolean {
  return getNextUpgradeLevelDef(state, id) === null;
}

export function getNextUpgradeCost(state: GameState, id: ShopUpgradeId): number | null {
  return getNextUpgradeLevelDef(state, id)?.cost ?? null;
}

/** 陳列棚レベルから、商品を置ける上限数を取得する */
export function getShelfCapacity(state: GameState): number {
  const effect = getCurrentUpgradeLevelDef(state, 'display').effect;
  if (effect.kind !== 'display') throw new Error('display upgrade effect mismatch');
  return effect.shelfCapacity;
}

/** オーブンレベルから、調合成功率に加算する補正値(0〜0.15)を取得する */
export function getOvenSuccessBonus(state: GameState): number {
  const effect = getCurrentUpgradeLevelDef(state, 'oven').effect;
  if (effect.kind !== 'oven') throw new Error('oven upgrade effect mismatch');
  return effect.successRateBonus;
}

/** レジレベルから、1回の接客の基準来店客数を取得する */
export function getRegisterCustomerCapacity(state: GameState): number {
  const effect = getCurrentUpgradeLevelDef(state, 'register').effect;
  if (effect.kind !== 'register') throw new Error('register upgrade effect mismatch');
  return effect.baseCustomers;
}

/** 店舗内装レベルから、お客さんタイプの出現ウェイトへの補正値を取得する */
export function getInteriorCustomerWeightBonuses(state: GameState): Partial<Record<CustomerTypeId, number>> {
  const effect = getCurrentUpgradeLevelDef(state, 'interior').effect;
  if (effect.kind !== 'interior') throw new Error('interior upgrade effect mismatch');
  return effect.customerWeightBonuses;
}

export function createDefaultShopUpgrades(): ShopUpgradeState {
  return { display: 1, oven: 1, register: 1, interior: 1 };
}

function sanitizeUpgradeLevel(value: unknown): ShopUpgradeLevel {
  const n = typeof value === 'number' ? Math.floor(value) : NaN;
  if (n === 1 || n === 2 || n === 3 || n === 4) return n;
  return 1;
}

/**
 * セーブデータ由来の不明な値から、安全な ShopUpgradeState を組み立てる。
 * shopUpgrades自体が存在しない/null、一部設備が欠けている、レベルが0や5以上・
 * 小数・文字列・不明な設備IDを含む、といった不正データもすべて1へ補正する。
 */
export function sanitizeShopUpgradeState(raw: unknown): ShopUpgradeState {
  const source = raw && typeof raw === 'object' ? (raw as Partial<Record<ShopUpgradeId, unknown>>) : {};
  return {
    display: sanitizeUpgradeLevel(source.display),
    oven: sanitizeUpgradeLevel(source.oven),
    register: sanitizeUpgradeLevel(source.register),
    interior: sanitizeUpgradeLevel(source.interior),
  };
}

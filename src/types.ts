// ============================================================
// 共通型定義。詳細な設計意図は DESIGN.md を参照。
// ============================================================

export type TimeOfDay = 'morning' | 'noon' | 'night';

export const TIME_ORDER: TimeOfDay[] = ['morning', 'noon', 'night'];

export type ShopType = 'sweets' | 'bookstore';

export interface ShopDef {
  id: string;
  name: string;
  type: ShopType;
  characterId: string;
  floor: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  shopId: string;
  personality: string;
  favoriteMaterialId: string;
  color: string;
  portrait: string;
  // 店内でキャラクターに近づいた(タッチした)ときの第一声
  greetings: [string, string, string, string, string];
  // 「話しかける」ボタンを押したときの一言(greetingsとは別内容)
  talkLines: [string, string, string, string, string];
}

export type MaterialCategory = 'grain' | 'dairy' | 'fruit' | 'sweetener' | 'flavor' | 'rare';
export type Rarity = 'common' | 'uncommon' | 'rare';

export interface MaterialDef {
  id: string;
  name: string;
  category: MaterialCategory;
  rarity: Rarity;
  buyPrice: number | null;
  soldAtShopId: string | null;
  color: string;
}

export type RecipeCategory = 'cake' | 'cookie' | 'chocolate' | 'candy' | 'pastry';

export interface RecipeDef {
  id: string;
  name: string;
  category: RecipeCategory;
  ingredients: { materialId: string; qty: number }[];
  baseSuccessRate: number;
  basePrice: number;
  difficulty: number;
  initiallyKnown: boolean;
}

export type EventTemplateId = 'consultation' | 'minigame';

export interface EventTemplateDef {
  id: EventTemplateId;
  title: string;
  description: string;
}

export interface EventRewardDef {
  characterId: string;
  affinityLevel: number; // 2-5
  templateId: EventTemplateId;
  rewardMaterialId?: string;
  rewardRecipeId?: string;
  rewardMoney: number;
}

export interface ContestStageDef {
  stage: number;
  name: string;
  requiredRankIndex: number;
  entryFee: number;
  rewardMoney: number;
  rewardMaterialId?: string;
  rewardRecipeId?: string;
}

// ------------------------------------------------------------
// プレイヤー / ゲーム進行状態
// ------------------------------------------------------------

export interface AffinityState {
  points: number;
  level: number; // 1-5
  completedEventLevels: number[]; // クリア済みイベントの affinityLevel 一覧
  pendingEventLevel: number | null; // 発生可能だが未消化のイベント
}

export interface RecipeMasteryState {
  timesMade: number;
  rankIndex: number;
}

export interface InventoryEntry {
  materialId: string;
  qty: number;
}

export interface ShelfItem {
  id: string; // 一意なインスタンスID
  recipeId: string;
  rankIndex: number;
  price: number;
}

export interface MonthlyRecord {
  monthNumber: number;
  playerSales: number;
  rivalSales: number;
  targetSales: number;
  result: 'win' | 'lose' | 'pending';
}

// ------------------------------------------------------------
// お客さんタイプ(接客シミュレーション用。GameStateへは保存しない一時データ)
// ------------------------------------------------------------

export type CustomerTypeId = 'child' | 'student' | 'family' | 'gourmet' | 'celebrity';

export interface CustomerTypeDef {
  id: CustomerTypeId;
  name: string;
  icon: string;
  weight: number; // 出現ウェイト(合計は100である必要はない)
  baseBudget: number;
  budgetVariance: number;
  preferredCategories: RecipeCategory[];
  categoryBonus: number;
  preferredMinRankIndex?: number; // このランク以上を好む
  preferredRankBonus?: number;
  lowRankPenaltyThreshold?: number; // このランク以下は敬遠される
  lowRankPenalty?: number;
  recommendationMultiplier: number; // 「本日のおすすめ」ボーナスへの反応の強さ
  priceSensitivity: number; // 適正価格からの乖離にどれだけ敏感か
  // 予算超過(予算〜予算1.2倍)ゾーンでのペナルティを弱める倍率。省略時は1(標準)。
  budgetPenaltyFactor?: number;
}

export interface CustomerVisitResult {
  customerTypeId: CustomerTypeId;
  customerName: string;
  customerIcon: string;
  budget: number;
  purchased: boolean;
  purchasedItemName?: string;
  purchasedItemRank?: string;
  purchasedPrice?: number;
  reason?: string;
}

export interface SalesShiftResult {
  customers: number;
  itemsSold: number;
  revenue: number;
  customerBreakdown: Partial<Record<CustomerTypeId, number>>;
  visits: CustomerVisitResult[];
}

export interface ContestRecord {
  stage: number;
  cleared: boolean;
}

export interface LogEntry {
  id: number;
  day: number;
  timeOfDay: TimeOfDay;
  text: string;
}

export interface GameState {
  version: number;
  day: number;
  timeOfDay: TimeOfDay;
  money: number;
  inventory: InventoryEntry[];
  knownRecipeIds: string[];
  recipeMastery: Record<string, RecipeMasteryState>;
  characterAffinity: Record<string, AffinityState>;
  shelf: ShelfItem[];
  monthlyRecords: MonthlyRecord[];
  currentMonthPlayerSales: number;
  currentMonthRivalSales: number;
  contestStageCleared: number; // 直近までクリアした段階数(0=未挑戦)
  endingSeen: boolean;
  researchCount: number;
  actionsThisSlot: number; // このタイムスロット内で行った「時間を消費する行動」の回数
  logs: LogEntry[];
  logSeq: number;
  todaysRecommendationRecipeId: string; // 本日のおすすめ(日替わりで抽選)
}

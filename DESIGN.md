# データ設計 & 調整可能パラメータ

このドキュメントは実装前提のデータ構造(JSON相当のTS型)と、初期値として提案する
数値バランスをまとめたものです。すべて `src/data/*.ts` に外出しされており、
`調整可能なパラメータ` とコメントされている値は後から自由に変更できます。

## 1. キャラクター (18人) — `src/data/characters.ts`

```ts
interface CharacterDef {
  id: string;              // "char_01" ... "char_18"
  name: string;             // 表示名
  shopId: string;           // 常駐する店舗ID (shops.ts と対応)
  personality: string;      // 性格フレーバーテキスト(一言)
  favoriteMaterialId: string; // 好物素材(イベント/贈り物テンプレで使用)
  color: string;            // プレースホルダー用の色(#rrggbb)
  portrait: string;         // 差し替え用画像パス(未使用時はプレースホルダー描画)
  greetings: [string, string, string, string, string]; // 好感度Lv1〜5の会話セリフ
}
```

- 18人分すべて実データとして定義済み(店舗配置・基本会話・好感度枠組みは最初から完成)。
- イベントの個別シナリオは持たず、`events.ts` の汎用テンプレートを ID 参照で
  割り当てる(後から1人ずつ専用イベントに差し替え可能な構造)。

## 2. 店舗 (18 NPC店 + プレイヤー店) — `src/data/shops.ts`

```ts
interface ShopDef {
  id: string;
  name: string;
  type: 'sweets' | 'material';
  characterId: string;
  gridX: number; // フロアマップ配置(6列×3行グリッド)
  gridY: number;
}
```

プレイヤー自身の店は `PLAYER_SHOP` として別定数で管理(18店には含めない)。

## 3. 素材 — `src/data/materials.ts`

```ts
interface MaterialDef {
  id: string;
  name: string;
  category: 'grain' | 'dairy' | 'fruit' | 'sweetener' | 'flavor' | 'rare';
  rarity: 'common' | 'uncommon' | 'rare';
  buyPrice: number | null; // null = 店では買えない(イベント入手専用のレア素材)
  soldAtShopId: string | null;
  color: string;
}
```

20種類(common 8 / uncommon 6 / rare 6)。レア素材はイベント報酬専用。

## 4. レシピ — `src/data/recipes.ts`

```ts
interface RecipeDef {
  id: string;
  name: string;
  category: 'cake' | 'cookie' | 'chocolate' | 'candy' | 'pastry';
  ingredients: { materialId: string; qty: number }[];
  baseSuccessRate: number;  // 0-1、調整可能パラメータ
  basePrice: number;        // Fランク時の販売価格
  difficulty: number;       // 1-5、コンテスト審査で使用
  initiallyKnown: boolean;  // false のものはイベント/購入で解放
}
```

まず15種類実装(定数 `RECIPE_TOTAL_TARGET = 200` として将来拡張を明示)。

### ランク & 習熟度(調整可能パラメータ)

```ts
const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S'] as const;
const MASTERY_THRESHOLDS = [0, 3, 7, 12, 18, 25, 35]; // 累計成功作成回数
const RANK_PRICE_MULTIPLIER = [1, 1.15, 1.3, 1.5, 1.75, 2.1, 2.5];
```

同じレシピを成功させるたびに `timesMade` が増え、閾値を超えるとランクアップ。

## 5. 好感度システム(調整可能パラメータ)— `src/systems/affinity.ts`

```ts
const AFFINITY_LEVELS = 5;
const AFFINITY_TALK_THRESHOLDS = [0, 4, 9, 15, 22]; // 各Lvに到達するための累計会話回数
```

- 会話1回 = `talkPoints += 1`。閾値を超えるとレベルアップし、そのレベル用の
  イベントが「発生可能」になる(Lv2〜Lv5 の4イベント/人)。
- 時間進行ルール: 同じキャラに **同じ時間帯内で2回話す**と時間が1つ進む
  (1回目は「進まない」、2回目で進む、という仕様どおりに実装)。

## 6. イベントテンプレート — `src/data/events.ts`

汎用テンプレートを2種類実装し、18人×Lv2〜5に自動割当(交互に配分)。

1. `consultation`(お悩み相談・選択肢式): 3択のうち性格に応じた「正解」を選ぶと
   高評価、外しても再挑戦可能。クリアで報酬。
2. `minigame`(お手伝いミニゲーム・タイミングクリック式): ゲージが動く中で
   ちょうど良いタイミングでクリックする簡易ミニゲーム。成功で報酬。

```ts
interface EventTemplateDef {
  id: 'consultation' | 'minigame';
  title: string;
  description: string;
}

interface EventRewardDef {
  characterId: string;
  affinityLevel: number; // 2-5
  templateId: 'consultation' | 'minigame';
  rewardMaterialId?: string;
  rewardRecipeId?: string;
  rewardMoney: number;
}
```

`generateEventRewards()` が18人×4段階=72件を決定的なルールで自動生成する
(乱数シードではなくキャラindex×levelから一意に導出)。個別シナリオを書きたく
なったら、この自動生成テーブルの該当エントリだけを手書きで上書きすればよい。

## 7. 売上・経営(調整可能パラメータ)— `src/systems/sales.ts`

```ts
const DAYS_PER_MONTH = 10;         // 月間競争のサイクル(短縮版)
const BASE_CUSTOMERS_PER_SHIFT = 6; // 1回の接客あたり来店客数の基準値
const RIVAL_BASE_SALES_PER_DAY = 250; // ライバル店の1日あたり平均売上
```

- プレイヤーは自分の店で「接客する」を選ぶと、店に並べた商品(レシピ×ランク)から
  客が価格とランクを見て確率的に購入するシミュレーションを実行。
- 購入確率 = `clamp(0.3 + rankBonus - priceStress, 0.05, 0.95)` という単純式
  (rankBonus はランクが高いほど+、priceStress は基本価格からの乖離)。
- `DAYS_PER_MONTH` 経過ごとに月間集計し、プレイヤー合計 vs ライバル合計で
  ランキング表示、目標達成時にボーナス。

## 8. コンテスト — `src/data/contest.ts`

```ts
interface ContestStageDef {
  stage: number;         // 1-5
  name: string;
  requiredRankIndex: number; // RANKS 内の最低ランク(審査基準)
  entryFee: number;
  rewardMoney: number;
  rewardMaterialId?: string;
  rewardRecipeId?: string;
}
```

年1回開催(ゲーム内 `DAYS_PER_MONTH * 12` 相当)。エントリーしたスイーツの
ランクが `requiredRankIndex` 以上なら基本勝利、僅差判定に軽い乱数を加味。
第5段階優勝でエンディング(スタッフロール風画面)を表示。

## 9. セーブデータ — `src/systems/save.ts`

`localStorage` キー `sweets-department-save-v1` に `GameState` 全体を JSON で
保存。バージョン番号を持たせ、将来のスキーマ変更に耐える。

// ライバル店(NPC)のデータ。月間売上競争の比較対象として使用。
// 調整可能パラメータ: 平均売上と日々のブレ幅。
export interface RivalShopDef {
  id: string;
  name: string;
  avgDailySales: number;
  variance: number; // ±変動幅
}

export const RIVAL_SHOPS: RivalShopDef[] = [
  { id: 'rival_01', name: 'キラキラスイーツ本店', avgDailySales: 260, variance: 60 },
  { id: 'rival_02', name: '老舗どうぶつ洋菓子店', avgDailySales: 220, variance: 40 },
];

export function rollRivalDailySales(): number {
  return RIVAL_SHOPS.reduce((sum, r) => {
    const noise = (Math.random() * 2 - 1) * r.variance;
    return sum + Math.max(0, Math.round(r.avgDailySales + noise));
  }, 0);
}

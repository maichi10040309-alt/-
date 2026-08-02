import type { MaterialDef } from '@/types';

// 素材一覧: common 8 / uncommon 6 / rare 6 = 20種
// buyPrice が null のものはイベント報酬専用(店では買えないレア素材)。
export const MATERIALS: MaterialDef[] = [
  // --- common ---
  { id: 'mat_flour', name: '小麦粉', category: 'grain', rarity: 'common', buyPrice: 20, soldAtShopId: 'shop_02', color: '#f2e2c4' },
  { id: 'mat_sugar', name: '砂糖', category: 'sweetener', rarity: 'common', buyPrice: 20, soldAtShopId: 'shop_02', color: '#ffffff' },
  { id: 'mat_egg', name: 'たまご', category: 'dairy', rarity: 'common', buyPrice: 15, soldAtShopId: 'shop_04', color: '#fff3b0' },
  { id: 'mat_butter', name: 'バター', category: 'dairy', rarity: 'common', buyPrice: 30, soldAtShopId: 'shop_04', color: '#ffe066' },
  { id: 'mat_milk', name: '牛乳', category: 'dairy', rarity: 'common', buyPrice: 18, soldAtShopId: 'shop_04', color: '#fbfbf5' },
  { id: 'mat_strawberry', name: 'いちご', category: 'fruit', rarity: 'common', buyPrice: 35, soldAtShopId: 'shop_06', color: '#ff6b81' },
  { id: 'mat_apple', name: 'りんご', category: 'fruit', rarity: 'common', buyPrice: 25, soldAtShopId: 'shop_06', color: '#e63946' },
  { id: 'mat_honey', name: 'はちみつ', category: 'sweetener', rarity: 'common', buyPrice: 28, soldAtShopId: 'shop_08', color: '#f4a300' },
  // --- uncommon ---
  { id: 'mat_chocolate', name: 'チョコレート', category: 'flavor', rarity: 'uncommon', buyPrice: 60, soldAtShopId: 'shop_10', color: '#5a3825' },
  { id: 'mat_vanilla', name: 'バニラビーンズ', category: 'flavor', rarity: 'uncommon', buyPrice: 70, soldAtShopId: 'shop_10', color: '#3d2b1f' },
  { id: 'mat_cream', name: '生クリーム', category: 'dairy', rarity: 'uncommon', buyPrice: 45, soldAtShopId: 'shop_12', color: '#fffaf0' },
  { id: 'mat_lemon', name: 'レモン', category: 'fruit', rarity: 'uncommon', buyPrice: 40, soldAtShopId: 'shop_06', color: '#fff275' },
  { id: 'mat_almond', name: 'アーモンド', category: 'grain', rarity: 'uncommon', buyPrice: 55, soldAtShopId: 'shop_14', color: '#c8a165' },
  { id: 'mat_matcha', name: '抹茶', category: 'flavor', rarity: 'uncommon', buyPrice: 65, soldAtShopId: 'shop_14', color: '#6a994e' },
  // --- rare (イベント専用) ---
  { id: 'mat_star_sugar', name: '星の砂糖', category: 'rare', rarity: 'rare', buyPrice: null, soldAtShopId: null, color: '#ffe6ff' },
  { id: 'mat_moon_honey', name: '月夜のはちみつ', category: 'rare', rarity: 'rare', buyPrice: null, soldAtShopId: null, color: '#ffd97d' },
  { id: 'mat_rainbow_berry', name: '虹色ベリー', category: 'rare', rarity: 'rare', buyPrice: null, soldAtShopId: null, color: '#a0e7e5' },
  { id: 'mat_fairy_flour', name: '妖精の粉', category: 'rare', rarity: 'rare', buyPrice: null, soldAtShopId: null, color: '#e0bbe4' },
  { id: 'mat_dream_cacao', name: '夢見るカカオ', category: 'rare', rarity: 'rare', buyPrice: null, soldAtShopId: null, color: '#4a2c2a' },
  { id: 'mat_crystal_mint', name: '結晶ミント', category: 'rare', rarity: 'rare', buyPrice: null, soldAtShopId: null, color: '#b5ead7' },
];

export function getMaterial(id: string): MaterialDef {
  const m = MATERIALS.find((x) => x.id === id);
  if (!m) throw new Error(`unknown material: ${id}`);
  return m;
}

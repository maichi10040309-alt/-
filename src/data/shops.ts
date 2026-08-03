import type { ShopDef } from '@/types';

// 17店舗を 2F/3F/4F の3フロアに配置(2F・3F=6店舗、4F=5店舗)。
// 1F はプレイヤー(ストロベリー、いちごケーキ店主)のお店とエレベーターのみ。
export const SHOPS: ShopDef[] = [
  { id: 'shop_white', name: '高級ケーキ店', type: 'sweets', characterId: 'white', floor: 2, gridX: 0, gridY: 0 },
  { id: 'shop_bitter', name: 'チョコレート工房', type: 'sweets', characterId: 'bitter', floor: 2, gridX: 1, gridY: 0 },
  { id: 'shop_milk', name: '焼き菓子・パン屋', type: 'sweets', characterId: 'milk', floor: 2, gridX: 2, gridY: 0 },
  { id: 'shop_matcha', name: '抹茶茶房・和菓子屋', type: 'sweets', characterId: 'matcha', floor: 2, gridX: 0, gridY: 1 },
  { id: 'shop_crunch', name: 'クッキー専門店', type: 'sweets', characterId: 'crunch', floor: 2, gridX: 1, gridY: 1 },
  { id: 'shop_marron', name: 'モンブラン・栗菓子店', type: 'sweets', characterId: 'marron', floor: 2, gridX: 2, gridY: 1 },

  { id: 'shop_champagne', name: '高級パティスリー', type: 'sweets', characterId: 'champagne', floor: 3, gridX: 0, gridY: 0 },
  { id: 'shop_peche', name: '桃のお菓子屋', type: 'sweets', characterId: 'peche', floor: 3, gridX: 1, gridY: 0 },
  { id: 'shop_pomme', name: 'アップルパイ専門店', type: 'sweets', characterId: 'pomme', floor: 3, gridX: 2, gridY: 0 },
  { id: 'shop_almond', name: '本屋(アーモンドの店)', type: 'bookstore', characterId: 'almond', floor: 3, gridX: 0, gridY: 1 },
  { id: 'shop_honey', name: 'ハニースイーツ店', type: 'sweets', characterId: 'honey', floor: 3, gridX: 1, gridY: 1 },
  { id: 'shop_caramel', name: 'キャラメル工房', type: 'sweets', characterId: 'caramel', floor: 3, gridX: 2, gridY: 1 },

  { id: 'shop_blueberry', name: 'ベリータルト店', type: 'sweets', characterId: 'blueberry', floor: 4, gridX: 0, gridY: 0 },
  { id: 'shop_maple', name: 'パンケーキカフェ', type: 'sweets', characterId: 'maple', floor: 4, gridX: 1, gridY: 0 },
  { id: 'shop_cinnamon', name: 'シナモンベイク店', type: 'sweets', characterId: 'cinnamon', floor: 4, gridX: 2, gridY: 0 },
  { id: 'shop_lemon', name: 'レモンケーキ店', type: 'sweets', characterId: 'lemon', floor: 4, gridX: 0, gridY: 1 },
  { id: 'shop_vanilla', name: 'バニラクリーム店', type: 'sweets', characterId: 'vanilla', floor: 4, gridX: 1, gridY: 1 },
];

// プレイヤー自身の店(1F エントランスに配置、17店には含めない)
export const PLAYER_SHOP = {
  id: 'player_shop',
  name: 'いちごケーキ店',
  portrait: 'strawberry',
  floor: 1,
};

export const PLAYER_HOME_FLOOR = 1;

export interface FloorDef {
  floor: number;
  name: string;
}

export const FLOORS: FloorDef[] = [
  { floor: 1, name: '1F エントランス' },
  { floor: 2, name: '2F にぎわい通り' },
  { floor: 3, name: '3F キラキラ通り' },
  { floor: 4, name: '4F ほっこり通り' },
];

export function getShop(id: string): ShopDef {
  const s = SHOPS.find((x) => x.id === id);
  if (!s) throw new Error(`unknown shop: ${id}`);
  return s;
}

export function getShopByCharacter(characterId: string): ShopDef {
  const s = SHOPS.find((x) => x.characterId === characterId);
  if (!s) throw new Error(`no shop for character: ${characterId}`);
  return s;
}

export function getShopsOnFloor(floor: number): ShopDef[] {
  return SHOPS.filter((s) => s.floor === floor);
}

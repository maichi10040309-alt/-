import type { ShopDef } from '@/types';

// 18店舗を 2F/3F/4F の3フロアに6店舗ずつ配置(各フロア3列×2行)。
// 1F はプレイヤー自身の店とエレベーターのみのエントランスフロア。
export const SHOPS: ShopDef[] = [
  { id: 'shop_01', name: 'ふわふわケーキ堂', type: 'sweets', characterId: 'char_01', floor: 2, gridX: 0, gridY: 0 },
  { id: 'shop_02', name: '粉と砂糖の倉庫', type: 'material', characterId: 'char_02', floor: 2, gridX: 1, gridY: 0 },
  { id: 'shop_03', name: 'クッキーの詩', type: 'sweets', characterId: 'char_03', floor: 2, gridX: 2, gridY: 0 },
  { id: 'shop_04', name: '牧場直送デイリー', type: 'material', characterId: 'char_04', floor: 2, gridX: 0, gridY: 1 },
  { id: 'shop_05', name: 'プリン専門店ぷるん', type: 'sweets', characterId: 'char_05', floor: 2, gridX: 1, gridY: 1 },
  { id: 'shop_06', name: '果樹園マルシェ', type: 'material', characterId: 'char_06', floor: 2, gridX: 2, gridY: 1 },

  { id: 'shop_07', name: 'チョコレート工房', type: 'sweets', characterId: 'char_07', floor: 3, gridX: 0, gridY: 0 },
  { id: 'shop_08', name: 'はちみつ蜂の巣店', type: 'material', characterId: 'char_08', floor: 3, gridX: 1, gridY: 0 },
  { id: 'shop_09', name: 'キャンディキャンドル', type: 'sweets', characterId: 'char_09', floor: 3, gridX: 2, gridY: 0 },
  { id: 'shop_10', name: 'カカオ&バニラ商会', type: 'material', characterId: 'char_10', floor: 3, gridX: 0, gridY: 1 },
  { id: 'shop_11', name: 'アップルパイ工房', type: 'sweets', characterId: 'char_11', floor: 3, gridX: 1, gridY: 1 },
  { id: 'shop_12', name: 'クリームの泉', type: 'material', characterId: 'char_12', floor: 3, gridX: 2, gridY: 1 },

  { id: 'shop_13', name: 'タルト&タルトレット', type: 'sweets', characterId: 'char_13', floor: 4, gridX: 0, gridY: 0 },
  { id: 'shop_14', name: 'ナッツ&抹茶問屋', type: 'material', characterId: 'char_14', floor: 4, gridX: 1, gridY: 0 },
  { id: 'shop_15', name: 'ロールケーキ横丁', type: 'sweets', characterId: 'char_15', floor: 4, gridX: 2, gridY: 0 },
  { id: 'shop_16', name: '不思議素材コレクター', type: 'material', characterId: 'char_16', floor: 4, gridX: 0, gridY: 1 },
  { id: 'shop_17', name: 'アイスクリーム城', type: 'sweets', characterId: 'char_17', floor: 4, gridX: 1, gridY: 1 },
  { id: 'shop_18', name: '星屑バザール', type: 'material', characterId: 'char_18', floor: 4, gridX: 2, gridY: 1 },
];

// プレイヤー自身の店(1F エントランスに配置、18店には含めない)
export const PLAYER_SHOP = {
  id: 'player_shop',
  name: 'あなたのお店',
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

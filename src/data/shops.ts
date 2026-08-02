import type { ShopDef } from '@/types';

// 18店舗を 6列×3行のグリッドに配置。奇数IDを sweets、偶数IDを material にして
// materials.ts の soldAtShopId 参照と対応させている。
export const SHOPS: ShopDef[] = [
  { id: 'shop_01', name: 'ふわふわケーキ堂', type: 'sweets', characterId: 'char_01', gridX: 0, gridY: 0 },
  { id: 'shop_02', name: '粉と砂糖の倉庫', type: 'material', characterId: 'char_02', gridX: 1, gridY: 0 },
  { id: 'shop_03', name: 'クッキーの詩', type: 'sweets', characterId: 'char_03', gridX: 2, gridY: 0 },
  { id: 'shop_04', name: '牧場直送デイリー', type: 'material', characterId: 'char_04', gridX: 3, gridY: 0 },
  { id: 'shop_05', name: 'プリン専門店ぷるん', type: 'sweets', characterId: 'char_05', gridX: 4, gridY: 0 },
  { id: 'shop_06', name: '果樹園マルシェ', type: 'material', characterId: 'char_06', gridX: 5, gridY: 0 },
  { id: 'shop_07', name: 'チョコレート工房', type: 'sweets', characterId: 'char_07', gridX: 0, gridY: 1 },
  { id: 'shop_08', name: 'はちみつ蜂の巣店', type: 'material', characterId: 'char_08', gridX: 1, gridY: 1 },
  { id: 'shop_09', name: 'キャンディキャンドル', type: 'sweets', characterId: 'char_09', gridX: 2, gridY: 1 },
  { id: 'shop_10', name: 'カカオ&バニラ商会', type: 'material', characterId: 'char_10', gridX: 3, gridY: 1 },
  { id: 'shop_11', name: 'アップルパイ工房', type: 'sweets', characterId: 'char_11', gridX: 4, gridY: 1 },
  { id: 'shop_12', name: 'クリームの泉', type: 'material', characterId: 'char_12', gridX: 5, gridY: 1 },
  { id: 'shop_13', name: 'タルト&タルトレット', type: 'sweets', characterId: 'char_13', gridX: 0, gridY: 2 },
  { id: 'shop_14', name: 'ナッツ&抹茶問屋', type: 'material', characterId: 'char_14', gridX: 1, gridY: 2 },
  { id: 'shop_15', name: 'ロールケーキ横丁', type: 'sweets', characterId: 'char_15', gridX: 2, gridY: 2 },
  { id: 'shop_16', name: '不思議素材コレクター', type: 'material', characterId: 'char_16', gridX: 3, gridY: 2 },
  { id: 'shop_17', name: 'アイスクリーム城', type: 'sweets', characterId: 'char_17', gridX: 4, gridY: 2 },
  { id: 'shop_18', name: '星屑バザール', type: 'material', characterId: 'char_18', gridX: 5, gridY: 2 },
];

// プレイヤー自身の店(18店には含めない、別枠管理)
export const PLAYER_SHOP = {
  id: 'player_shop',
  name: 'あなたのお店',
  gridX: 2.5,
  gridY: -1.2,
};

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

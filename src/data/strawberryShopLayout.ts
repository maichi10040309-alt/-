import type { ShopLayerPlacement } from '@/types';

// ストロベリー店(プレイヤーの店)の店内レイヤー配置。
// 添付の「ストロベリー店 レイアウト図(設備配置スペース設計図)」を基準に、
// ゲーム基準キャンバス(960x540, 16:9, 正面から少し斜め上を見下ろす固定カメラ)の
// 座標へ変換したもの。今後レベルアップや季節イベントが増えても、この1ファイルの
// 数値だけを調整すれば良いように、描画コード側には座標をハードコードしない。
//
// 各設備の接地基準点(床/カウンター上面/キッチン入口床面に接する下端中央)は
// レベルが変わっても動かさない。実際の描画は drawImageFitBottom 相当の
// 「箱の中でアスペクト比を保ちつつ下端中央寄せ」で行うため、画像の縦横比が
// レベルごとに違っても接地位置はズレない。

export const STRAWBERRY_SHOP_CANVAS_WIDTH = 960;
export const STRAWBERRY_SHOP_CANVAS_HEIGHT = 540;

export const STRAWBERRY_SHOP_BACKGROUND_PLACEMENT: ShopLayerPlacement = {
  x: 0,
  y: 0,
  width: STRAWBERRY_SHOP_CANVAS_WIDTH,
  height: STRAWBERRY_SHOP_CANVAS_HEIGHT,
  zIndex: 0,
};

// ①陳列棚スペース(左側・床面・横幅の広い空きスペース。壁や通路には密着させない)
export const STRAWBERRY_SHOP_DISPLAY_PLACEMENT: ShopLayerPlacement = {
  x: 60,
  y: 240,
  width: 260,
  height: 160,
  zIndex: 20,
};

// ②レジスペース(右手前・L字カウンターの上面。カウンター本体は背景に含まれる)
export const STRAWBERRY_SHOP_REGISTER_PLACEMENT: ShopLayerPlacement = {
  x: 691,
  y: 215,
  width: 110,
  height: 85,
  zIndex: 30,
};

// ③オーブンスペース(奥・キッチン入口の中。キッチン入口自体は背景に含まれる)
export const STRAWBERRY_SHOP_OVEN_PLACEMENT: ShopLayerPlacement = {
  x: 367,
  y: 84,
  width: 110,
  height: 140,
  zIndex: 15,
};

// ④装飾スペース候補(奥の壁面・左右の壁面・固定棚付近)。
// トロフィー/季節装飾/写真/プレゼントなどを将来ここへ差し込める枠だけ用意する。
export interface DecorSlotDef {
  id: string;
  name: string;
  placement: ShopLayerPlacement;
}

export const STRAWBERRY_SHOP_DECOR_SLOTS: DecorSlotDef[] = [
  { id: 'shelf_window_side', name: '窓側の固定棚', placement: { x: 201, y: 69, width: 98, height: 55, zIndex: 5 } },
  { id: 'shelf_kitchen_side', name: 'キッチン側の固定棚', placement: { x: 548, y: 55, width: 107, height: 45, zIndex: 5 } },
  { id: 'frame_right_wall', name: '右壁の額縁付近', placement: { x: 747, y: 86, width: 60, height: 50, zIndex: 5 } },
  { id: 'floor_front_left', name: '手前左側の床', placement: { x: 20, y: 470, width: 80, height: 60, zIndex: 35 } },
];

// 入口(店の外へ出るクリック判定/歩いていく目的地)。レイアウト図の「入口位置:中央下」に対応。
// 画面下部のボタンバー(hud-menu)がキャンバス下端 約80px を覆うため、それより
// 上に置いて確実にクリックできるようにしている。
export const STRAWBERRY_SHOP_ENTRANCE_POINT = { x: 480, y: 455 };

// プレイヤーが自由に歩き回れる床範囲(interiorRenderer.ts の clampToInterior と
// 同じ考え方の簡易矩形)。設備の接地点そのものより少し広めに取り、
// キャラクターへ近づく操作(レジへ歩み寄る等)は別途この範囲を無視して目的地へ直行する。
export const STRAWBERRY_SHOP_WALK_AREA = { x: 40, y: 230, width: 880, height: 280 };

// 描画順(zIndex)の全体像。値そのものより前後関係が重要:
// 背景(0) < 奥側装飾(5) < オーブン(15) < 陳列棚(20) < レジ(30) < 手前側装飾(35)
// < 商品(40) < キャラクター(50)。商品レイヤーは今回まだ描画しないが、将来
// 陳列棚の手前に商品サムネイルを重ねられるよう領域だけ確保しておく。
export const STRAWBERRY_SHOP_PRODUCT_Z_INDEX = 40;
export const STRAWBERRY_SHOP_CHARACTER_Z_INDEX = 50;

// 開発中のみ、設備配置スペースを確認するためのデバッグ枠表示。本番はfalseのままにする。
export const DEBUG_SHOP_LAYOUT = false;

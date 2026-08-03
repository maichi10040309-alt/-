// 簡易ドット絵風スプライトのプロシージャル描画。
// 実際の画像素材が来るまでの代替として、テンプレートのドットパターンを
// キャラクター/店舗ごとの色でパレット差し替え(リカラー)して個性を出す。
// 左半分のグリッドだけ定義し、水平反転して描画することで対称性を保証する。

export type PixelGrid = number[][];
export type Palette = Record<number, string>;

export function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) >>> 0;
  }
  return h;
}

export function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  let r = (num >> 16) & 0xff;
  let g = (num >> 8) & 0xff;
  let b = num & 0xff;
  const amt = Math.round(2.55 * percent);
  r = Math.max(0, Math.min(255, r + amt));
  g = Math.max(0, Math.min(255, g + amt));
  b = Math.max(0, Math.min(255, b + amt));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/** 左半分グリッド(0=透明)を左右反転して cellSize px のドットで描画する */
function drawMirrored(ctx: CanvasRenderingContext2D, x: number, y: number, cellSize: number, half: PixelGrid, palette: Palette): void {
  const halfW = half[0].length;
  for (let row = 0; row < half.length; row++) {
    for (let col = 0; col < halfW; col++) {
      const v = half[row][col];
      if (!v) continue;
      const color = palette[v];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(Math.round(x + col * cellSize), Math.round(y + row * cellSize), cellSize + 0.5, cellSize + 0.5);
      const mirrorCol = halfW * 2 - 1 - col;
      ctx.fillRect(Math.round(x + mirrorCol * cellSize), Math.round(y + row * cellSize), cellSize + 0.5, cellSize + 0.5);
    }
  }
}

// ---------------------------------------------------------
// キャラクターアバター(10x10、頭身の高いちびキャラ風アイコン)
// ---------------------------------------------------------

const AVATAR_BASE: PixelGrid = [
  [0, 0, 1, 1, 1],
  [0, 1, 1, 1, 1],
  [1, 1, 1, 1, 1],
  [1, 2, 2, 2, 2],
  [1, 2, 3, 2, 2],
  [1, 2, 2, 2, 2],
  [1, 2, 4, 2, 2],
  [0, 2, 2, 2, 2],
  [0, 0, 5, 5, 0],
  [0, 0, 0, 0, 0],
];

export function drawCharacterAvatar(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, characterId: string, baseColor: string): void {
  const seed = hashSeed(characterId);
  const variant = seed % 3;
  const grid = AVATAR_BASE.map((row) => row.slice());
  if (variant === 1) {
    grid[1] = [0, 0, 1, 1, 1]; // 前髪短め
  }
  if (variant === 2) {
    grid[0][4] = 5; // 髪飾り
  }
  if (seed % 2 === 0) {
    grid[4][2] = 0; // ウインク(片目を閉じる)
  }

  const eyeColor = ['#3a2a20', '#3d6ea5', '#c98a2e'][seed % 3];
  const palette: Palette = {
    1: baseColor,
    2: '#ffe3c6',
    3: eyeColor,
    4: '#ff9eb5',
    5: shadeColor(baseColor, -25),
  };

  const cell = size / 10;
  ctx.save();
  drawMirrored(ctx, x, y, cell, grid, palette);
  ctx.restore();
}

// ---------------------------------------------------------
// マップ上を歩く全身スプライト(頭+胴体+脚、5x14の半分グリッド)
// ---------------------------------------------------------

// 胴体・頭部のみ(脚は歩行アニメーションのため別途描画する)
const BODY_TORSO: PixelGrid = [
  [0, 0, 1, 1, 1],
  [0, 1, 1, 1, 1],
  [1, 1, 1, 1, 1],
  [1, 2, 2, 2, 2],
  [1, 2, 3, 2, 2],
  [1, 2, 2, 2, 2],
  [0, 2, 2, 2, 2],
  [0, 0, 6, 6, 6],
  [0, 6, 6, 6, 6],
  [0, 6, 6, 6, 6],
  [0, 6, 6, 6, 6],
];

/**
 * 胴体+脚を描画する。legPhase!=0 のときは左右の脚が逆位相で前後に振れる
 * 実際の「歩行」アニメーションになり、legPhase=0 のときは直立姿勢になる。
 */
function drawBodySprite(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, palette: Palette, bobOffset: number, legPhase = 0): void {
  const cell = size / 10;
  const top = y - bobOffset;
  drawMirrored(ctx, x, top, cell, BODY_TORSO, palette);

  const stride = Math.sin(legPhase) * cell * 1.3;
  const legY = top + 11 * cell;
  const footY = top + 12 * cell;
  const leftX = x + 2 * cell + stride;
  const rightX = x + 7 * cell - stride;

  ctx.fillStyle = palette[7];
  ctx.fillRect(leftX, legY, cell, cell);
  ctx.fillRect(rightX, legY, cell, cell);
  ctx.fillStyle = palette[8];
  ctx.fillRect(leftX, footY, cell, cell);
  ctx.fillRect(rightX, footY, cell, cell);
}

export function drawShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(40,20,20,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, w / 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/**
 * マップ上に常時立っているキャラクター(店番)を描画する。idleでゆっくり上下に揺れる。
 * 制服(胴体・脚)は誰でも読み取りやすいよう固定のクリーム色に統一し、
 * 髪色だけを店のテーマカラーで塗り分けて個性を出す(暗い店カラーでも視認性を保つため)。
 */
export function drawCharacterOnMap(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, characterId: string, baseColor: string, animPhase: number): void {
  const seed = hashSeed(characterId);
  const eyeColor = ['#3a2a20', '#3d6ea5', '#c98a2e'][seed % 3];
  const palette: Palette = {
    1: baseColor,
    2: '#ffe3c6',
    3: eyeColor,
    6: '#fff4e8',
    7: shadeColor(baseColor, 10),
    8: '#4a2c2a',
  };
  const bob = Math.sin(animPhase * 1.4 + seed) * 1.4;
  drawShadow(ctx, x + size / 2, y + size * 1.15, size * 0.7);
  drawBodySprite(ctx, x, y, size, palette, bob);
}

// 調整可能パラメータ: プレイヤーの歩行速度に対する脚振り速度の倍率
const WALK_CYCLE_SPEED = 9;

/** プレイヤーの全身スプライト。歩行中は脚が交互に振れて進み、待機中はゆっくり揺れる。 */
export function drawPlayerOnMap(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, animPhase: number, walking: boolean): void {
  const palette: Palette = {
    1: '#7a4a2a',
    2: '#ffe3c6',
    3: '#3a2a20',
    6: '#fff2df',
    7: '#e0776b',
    8: '#4a2c2a',
  };
  const bob = walking ? Math.abs(Math.sin(animPhase * WALK_CYCLE_SPEED)) * 2.5 : Math.sin(animPhase * 1.2) * 1.2;
  const legPhase = walking ? animPhase * WALK_CYCLE_SPEED : 0;
  drawShadow(ctx, x + size / 2, y + size * 1.15, size * 0.75);
  drawBodySprite(ctx, x, y, size, palette, bob, legPhase);
}

// ---------------------------------------------------------
// 店舗の建物アイコン(12x12)
// ---------------------------------------------------------

const SHOP_BASE: PixelGrid = [
  [0, 0, 0, 0, 6, 6],
  [0, 0, 0, 6, 6, 6],
  [0, 0, 6, 6, 6, 6],
  [0, 6, 6, 6, 6, 6],
  [6, 6, 6, 6, 6, 6],
  [7, 7, 7, 7, 7, 7],
  [7, 8, 7, 8, 7, 8],
  [7, 8, 7, 8, 7, 8],
  [7, 7, 7, 7, 7, 7],
  [7, 7, 9, 9, 7, 7],
  [7, 7, 9, 9, 7, 7],
  [0, 0, 0, 0, 0, 0],
];

// スイーツ店の軒先に付くキャンディストライプ柄のオーニング(日よけ)
const AWNING_ROW: number[] = [10, 11, 10, 11, 10, 11];

export function drawShopBuilding(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
  baseColor: string,
  shopType: 'sweets' | 'material',
  isNight: boolean
): void {
  const grid = SHOP_BASE.map((row) => row.slice());
  const roofColor = shadeColor(baseColor, -15);
  const wallColor = shadeColor(baseColor, 30);
  const windowColor = isNight ? '#ffe98a' : '#bfe9f2';
  const doorColor = shopType === 'sweets' ? '#c9506f' : '#6f8f5a';

  if (shopType === 'sweets') {
    grid[8] = AWNING_ROW.slice();
  }

  const palette: Palette = {
    6: roofColor,
    7: wallColor,
    8: windowColor,
    9: doorColor,
    10: '#fff7fa',
    11: shadeColor(baseColor, -5),
  };

  const cell = size / 12;

  // 建物の足元に落ちる影(地面に立っている感を出す)
  ctx.save();
  ctx.fillStyle = 'rgba(40,20,20,0.18)';
  ctx.beginPath();
  ctx.ellipse(x + size / 2, y + 11 * cell + cell * 0.4, size * 0.52, cell * 0.9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  drawMirrored(ctx, x, y, cell, grid, palette);

  // 店種を示す看板マーク(スイーツ店=丸いアイコン、素材店=四角いアイコン)
  ctx.fillStyle = shopType === 'sweets' ? '#ff6b81' : '#a97c50';
  const signX = x + size / 2;
  const signY = y - cell * 1.4;
  if (shopType === 'sweets') {
    ctx.beginPath();
    ctx.arc(signX, signY, cell * 1.1, 0, Math.PI * 2);
    ctx.fill();
  } else {
    ctx.fillRect(signX - cell, signY - cell, cell * 2, cell * 2);
  }
}

// ---------------------------------------------------------
// スイーツアイコン(カテゴリ別、10x10)
// ---------------------------------------------------------

const SWEET_TEMPLATES: Record<string, PixelGrid> = {
  cake: [
    [0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 2, 0, 0],
    [0, 3, 3, 3, 3],
    [3, 4, 4, 4, 4],
    [3, 4, 4, 4, 4],
    [3, 4, 4, 4, 4],
    [3, 5, 5, 5, 5],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  cookie: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1],
    [1, 1, 2, 1, 1],
    [1, 2, 1, 1, 1],
    [1, 1, 1, 2, 1],
    [0, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  chocolate: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 1, 1, 1, 1],
    [1, 1, 1, 1, 2],
    [1, 1, 1, 2, 1],
    [1, 1, 2, 1, 1],
    [0, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  candy: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
    [1, 1, 1, 1, 1],
    [0, 1, 1, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
  ],
  pastry: [
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 1, 1],
    [0, 0, 1, 1, 1],
    [0, 1, 1, 1, 1],
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 0],
  ],
};

const CATEGORY_TINT: Record<string, string> = {
  cake: '#ffb6c1',
  cookie: '#d9a066',
  chocolate: '#6f4518',
  candy: '#ff8fa3',
  pastry: '#f4c95d',
};

export const RANK_GLOW_COLORS = ['#b0b0b0', '#8fbf8f', '#7cb7d9', '#a58fd9', '#e0a3e0', '#f4b942', '#ff5fa2'];

export function drawSweetIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, category: string, rankIndex: number): void {
  const grid = SWEET_TEMPLATES[category] ?? SWEET_TEMPLATES.cookie;
  const tint = CATEGORY_TINT[category] ?? '#d9a066';
  const glow = RANK_GLOW_COLORS[Math.max(0, Math.min(RANK_GLOW_COLORS.length - 1, rankIndex))];

  const cell = size / 10;
  const cx = x + size / 2;
  const cy = y + size / 2;

  // ランクの輝きリング
  ctx.save();
  ctx.strokeStyle = glow;
  ctx.lineWidth = Math.max(1.5, cell * 0.35);
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2 + cell * 0.6, 0, Math.PI * 2);
  ctx.globalAlpha = 0.85;
  ctx.stroke();
  ctx.restore();

  if (rankIndex >= 5) {
    // A/S ランクはきらめきを追加
    ctx.fillStyle = glow;
    const sparkles = [
      [x - cell, y - cell],
      [x + size + cell * 0.2, y + size * 0.3],
      [x - cell * 0.5, y + size + cell * 0.2],
    ];
    for (const [sx, sy] of sparkles) {
      drawStar(ctx, sx, sy, cell * 0.9);
    }
  }

  const palette: Palette = {
    1: tint,
    2: shadeColor(tint, -30),
    3: '#ffe9f2',
    4: shadeColor(tint, 10),
    5: '#f2e2c4',
  };
  drawMirrored(ctx, x, y, cell, grid, palette);
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number): void {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 4; i++) {
    ctx.rotate(Math.PI / 2);
    ctx.moveTo(0, 0);
    ctx.lineTo(r, r * 0.25);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

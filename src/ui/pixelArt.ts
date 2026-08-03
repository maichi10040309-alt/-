// スイーツ/素材アイコンのプロシージャル描画、および共通の描画ヘルパー。
// キャラクター・建物は実イラスト素材(imageAssets.ts)に置き換え済みのため、
// ここでは差し替え前提のドット絵ロジックのうち、まだ実素材が無いスイーツ
// アイコン(レシピのランク表示)だけを担当する。

export type PixelGrid = number[][];
export type Palette = Record<number, string>;

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

export function drawShadow(ctx: CanvasRenderingContext2D, cx: number, cy: number, w: number): void {
  ctx.save();
  ctx.fillStyle = 'rgba(40,20,20,0.25)';
  ctx.beginPath();
  ctx.ellipse(cx, cy, w / 2, w / 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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

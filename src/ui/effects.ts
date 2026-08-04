// 演出まわり(トースト通知・紙吹雪バースト)。
import { CANVAS_W, CANVAS_H } from './mapRenderer';

let toastContainer: HTMLElement | null = null;

export function initEffects(root: HTMLElement): void {
  toastContainer = document.createElement('div');
  toastContainer.className = 'toast-stack';
  toastContainer.style.pointerEvents = 'none';
  root.appendChild(toastContainer);
}

export type ToastKind = 'info' | 'money' | 'love' | 'success' | 'warn';

export function showToast(text: string, kind: ToastKind = 'info'): void {
  if (!toastContainer) return;
  const el = document.createElement('div');
  el.className = `toast toast-${kind}`;
  el.textContent = text;
  toastContainer.appendChild(el);
  requestAnimationFrame(() => el.classList.add('toast-in'));
  setTimeout(() => {
    el.classList.remove('toast-in');
    el.classList.add('toast-out');
    setTimeout(() => el.remove(), 350);
  }, 1800);
}

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  vr: number;
}

const CONFETTI_COLORS = ['#ff9ebb', '#ffd166', '#a9d6c9', '#c8a2f0', '#90e0ef', '#ffffff'];

/** キャンバス上に紙吹雪を短時間バーストさせる(コンテスト優勝・月間達成などの大きな成功演出用) */
export function burstConfetti(canvas: HTMLCanvasElement, originX: number, originY: number): void {
  const overlayCanvas = document.createElement('canvas');
  overlayCanvas.width = canvas.width;
  overlayCanvas.height = canvas.height;
  overlayCanvas.style.position = 'absolute';
  overlayCanvas.style.inset = '0';
  overlayCanvas.style.width = '100%';
  overlayCanvas.style.height = '100%';
  overlayCanvas.style.pointerEvents = 'none';
  canvas.parentElement?.appendChild(overlayCanvas);
  const ctx = overlayCanvas.getContext('2d')!;
  // overlayCanvas は canvas(高DPI対応で実ピクセル解像度を持つ)と同じ実解像度で
  // 作っているため、以降は論理座標系(CANVAS_W x CANVAS_H)で描けるようスケールを合わせる。
  const scale = overlayCanvas.width / CANVAS_W;
  ctx.scale(scale, scale);

  const particles: ConfettiParticle[] = [];
  for (let i = 0; i < 60; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 2 + Math.random() * 5;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 2,
      size: 4 + Math.random() * 5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      rotation: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.4,
    });
  }

  const start = performance.now();
  function tick(now: number): void {
    const elapsed = now - start;
    ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
    for (const p of particles) {
      p.vy += 0.15;
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.vr;
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
      ctx.restore();
    }
    if (elapsed < 1300) {
      requestAnimationFrame(tick);
    } else {
      overlayCanvas.remove();
    }
  }
  requestAnimationFrame(tick);
}

// 調整可能パラメータ: エレベーターの扉が閉まる/開く時間、閉まりきってからの間
const ELEVATOR_CLOSE_MS = 260;
const ELEVATOR_HOLD_MS = 150;
const ELEVATOR_OPEN_MS = 280;

/**
 * エレベーターの扉が閉まる→(この間にonMidpointで階を切り替える)→開く、
 * という画面転換演出。フロア移動を単なる瞬間切り替えではなく「移動した」
 * という手触りにするための演出。
 */
export function playElevatorTransition(canvas: HTMLCanvasElement, onMidpoint: () => void): void {
  const overlay = document.createElement('canvas');
  overlay.width = canvas.width;
  overlay.height = canvas.height;
  overlay.style.position = 'absolute';
  overlay.style.inset = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.pointerEvents = 'none';
  canvas.parentElement?.appendChild(overlay);
  const ctx = overlay.getContext('2d');
  if (!ctx) {
    onMidpoint();
    overlay.remove();
    return;
  }
  const w = overlay.width;
  const h = overlay.height;
  const total = ELEVATOR_CLOSE_MS + ELEVATOR_HOLD_MS + ELEVATOR_OPEN_MS;
  let firedMidpoint = false;
  const start = performance.now();

  function drawDoors(closedRatio: number): void {
    ctx!.clearRect(0, 0, w, h);
    const doorW = (w / 2) * closedRatio;
    ctx!.fillStyle = '#241a2e';
    ctx!.fillRect(0, 0, doorW, h);
    ctx!.fillRect(w - doorW, 0, doorW, h);
    ctx!.strokeStyle = '#ffd166';
    ctx!.lineWidth = 3;
    ctx!.beginPath();
    ctx!.moveTo(doorW, 0);
    ctx!.lineTo(doorW, h);
    ctx!.moveTo(w - doorW, 0);
    ctx!.lineTo(w - doorW, h);
    ctx!.stroke();
  }

  function tick(now: number): void {
    const elapsed = now - start;
    if (elapsed < ELEVATOR_CLOSE_MS) {
      drawDoors(elapsed / ELEVATOR_CLOSE_MS);
    } else if (elapsed < ELEVATOR_CLOSE_MS + ELEVATOR_HOLD_MS) {
      if (!firedMidpoint) {
        firedMidpoint = true;
        onMidpoint();
      }
      drawDoors(1);
    } else if (elapsed < total) {
      const openElapsed = elapsed - ELEVATOR_CLOSE_MS - ELEVATOR_HOLD_MS;
      drawDoors(1 - openElapsed / ELEVATOR_OPEN_MS);
    } else {
      overlay.remove();
      return;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

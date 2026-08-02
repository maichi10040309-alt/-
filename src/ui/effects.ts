// 演出まわり(トースト通知・紙吹雪バースト)。

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
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
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

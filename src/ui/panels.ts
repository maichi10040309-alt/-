// DOMオーバーレイの共通ヘルパー。モーダルパネルの開閉を一元管理する。

let overlayRoot: HTMLElement | null = null;

export function initOverlay(root: HTMLElement): void {
  overlayRoot = root;
}

export function openModal(innerHtml: string): HTMLElement {
  closeModal();
  if (!overlayRoot) throw new Error('overlay not initialized');
  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = 'active-modal';
  const panel = document.createElement('div');
  panel.className = 'modal-panel';
  panel.innerHTML = innerHtml;
  backdrop.appendChild(panel);
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });
  overlayRoot.appendChild(backdrop);
  return panel;
}

export function closeModal(): void {
  const existing = document.getElementById('active-modal');
  if (existing) existing.remove();
}

export function closeButtonHtml(label = '閉じる'): string {
  return `<div class="modal-close-row"><button class="secondary" data-action="close-modal">${label}</button></div>`;
}

export function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

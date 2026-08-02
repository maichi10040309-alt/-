import type { GameState } from '@/types';
import { timeLabel } from '@/systems/time';

export interface HudHandlers {
  onResearch: () => void;
  onCraft: () => void;
  onInventory: () => void;
  onMyShop: () => void;
  onContest: () => void;
  onSave: () => void;
}

export function buildHud(topBar: HTMLElement, bottomBar: HTMLElement, handlers: HudHandlers): void {
  bottomBar.innerHTML = '';
  const buttons: [string, () => void][] = [
    ['🔬 研究する', handlers.onResearch],
    ['🍰 調合する', handlers.onCraft],
    ['🎒 在庫', handlers.onInventory],
    ['🏪 自分の店', handlers.onMyShop],
    ['🏆 コンテスト', handlers.onContest],
    ['💾 セーブ', handlers.onSave],
  ];
  for (const [label, fn] of buttons) {
    const btn = document.createElement('button');
    btn.textContent = label;
    btn.addEventListener('click', fn);
    bottomBar.appendChild(btn);
  }
  renderTopBar(topBar, null);
}

export function renderTopBar(topBar: HTMLElement, state: GameState | null): void {
  if (!state) {
    topBar.innerHTML = '';
    return;
  }
  topBar.innerHTML = `
    <span class="hud-chip">${state.day}日目</span>
    <span class="hud-chip">${timeLabel(state.timeOfDay)}</span>
    <span class="hud-chip">💰 ${state.money}ベリー</span>
    <span class="hud-spacer"></span>
    <span class="hud-chip">🏆 コンテスト段階: ${state.contestStageCleared}/5</span>
  `;
}

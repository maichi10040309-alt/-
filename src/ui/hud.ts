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

export function renderTopBar(topBar: HTMLElement, state: GameState | null, floor?: number): void {
  if (!state) {
    topBar.innerHTML = '';
    return;
  }
  const leading = state.currentMonthPlayerSales >= state.currentMonthRivalSales;
  const rankChip =
    state.currentMonthPlayerSales === 0 && state.currentMonthRivalSales === 0
      ? ''
      : `<span class="hud-chip ${leading ? 'hud-chip-lead' : 'hud-chip-behind'}">${leading ? '🥇 首位' : '🥈 2位'}(${state.currentMonthPlayerSales} vs ${state.currentMonthRivalSales})</span>`;
  const floorChip = floor !== undefined ? `<span class="hud-chip hud-chip-floor">🏢 ${floor}F</span>` : '';

  topBar.innerHTML = `
    <span class="hud-chip">${state.day}日目</span>
    <span class="hud-chip">${timeLabel(state.timeOfDay)}</span>
    <span class="hud-chip">💰 ${state.money}ベリー</span>
    ${floorChip}
    ${rankChip}
    <span class="hud-spacer"></span>
    <span class="hud-chip">🏆 コンテスト段階: ${state.contestStageCleared}/5</span>
  `;
}

import type { GameState } from '@/types';
import { createInitialState } from '@/systems/gameState';
import { saveGame, loadGame, hasSaveData } from '@/systems/save';
import { timeLabel } from '@/systems/time';
import { performTalk, performResearch } from '@/systems/actions';
import { craftSweet, canCraft, buyMaterial, SHELF_CAPACITY, priceRangeFor, adjustShelfPrice, PRICE_ADJUST_STEP } from '@/systems/crafting';
import { runSalesShift, priceFeelLabel } from '@/systems/sales';
import { enterContest, previewWinProbability } from '@/systems/contestSystem';
import { getPendingEvent, resolveConsultationEvent, resolveMinigameEvent } from '@/systems/eventSystem';

import { CHARACTERS, getCharacter } from '@/data/characters';
import { getShop, getShopByCharacter, PLAYER_SHOP, FLOORS, PLAYER_HOME_FLOOR, getShopsOnFloor } from '@/data/shops';
import { MATERIALS, getMaterial } from '@/data/materials';
import { RECIPES, getRecipe, rankLabel } from '@/data/recipes';
import { CONTEST_STAGES, getContestStage } from '@/data/contest';
import { CHARACTER_PORTRAITS } from '@/data/imageAssets';

import { initOverlay, openModal, closeModal, closeButtonHtml, escapeHtml } from '@/ui/panels';
import { renderMap, hitTestMap, getStandingSpot, PLAYER_HOME_SPOT, ELEVATOR_SPOT, getHallEscalatorSpot, CANVAS_W, CANVAS_H, type PlayerSprite } from '@/ui/mapRenderer';
import { renderShopInterior, computeInteriorLayout, hitTestInterior, clampToInterior } from '@/ui/interiorRenderer';
import { buildHud, renderTopBar } from '@/ui/hud';
import { drawSweetIcon } from '@/ui/pixelArt';
import { initEffects, showToast, burstConfetti, playElevatorTransition } from '@/ui/effects';

// 調整可能パラメータ: 本屋でレシピを購入するときの価格倍率(基本価格に対して)
const RECIPE_BOOK_PRICE_MULTIPLIER = 3;

function portraitHtml(portraitKey: string, name: string, extraClass = ''): string {
  return `<img class="avatar-canvas ${extraClass}" src="${CHARACTER_PORTRAITS[portraitKey]}" alt="${escapeHtml(name)}">`;
}

const PLAYER_SPEED = 260; // 論理キャンバス座標 px/秒

export class Game {
  private state: GameState = createInitialState();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private overlay: HTMLElement;
  private topBar: HTMLElement;
  private bottomBar: HTMLElement;
  private dialogueBox: HTMLElement;
  private minigameRaf: number | null = null;
  private dayStartMoney = 0;

  private player: PlayerSprite & { targetX: number; targetY: number } = {
    x: PLAYER_HOME_SPOT.x,
    y: PLAYER_HOME_SPOT.y,
    targetX: PLAYER_HOME_SPOT.x,
    targetY: PLAYER_HOME_SPOT.y,
    moving: false,
  };
  private pendingArrival: (() => void) | null = null;
  private animClock = 0;
  private lastTs = 0;
  private rafId: number | null = null;
  private currentFloor = PLAYER_HOME_FLOOR;
  private insideShopId: string | null = null;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context not available');
    this.ctx = ctx;

    this.topBar = document.createElement('div');
    this.topBar.className = 'hud-bar';
    this.bottomBar = document.createElement('div');
    this.bottomBar.className = 'hud-menu';
    this.dialogueBox = document.createElement('div');
    this.dialogueBox.className = 'dialogue-box';

    this.overlay = overlay;
    initOverlay(overlay);
    initEffects(overlay);

    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));

    // #game-root は overflow:hidden で角丸クリップしているだけで本来スクロール
    // させたくないが、モーダル内のボタンにフォーカスが移ると一部ブラウザ/自動化
    // ツールが「フォーカス要素を表示範囲内へ」と game-root を暗黙のスクロール
    // コンテナとして扱い scrollTop を書き換えてしまうことがある。描画内容が
    // ずれるのを防ぐため、スクロールが発生したら即座に 0 へ戻す。
    const gameRoot = this.canvas.parentElement;
    if (gameRoot) {
      gameRoot.addEventListener('scroll', () => {
        gameRoot.scrollTop = 0;
        gameRoot.scrollLeft = 0;
      });
    }
  }

  start(): void {
    this.showTitleScreen();
  }

  // ---------------------------------------------------------
  // ゲームループ / プレイヤー移動
  // ---------------------------------------------------------

  private loopTick = (ts: number): void => {
    if (!this.lastTs) this.lastTs = ts;
    const dt = Math.min(0.05, (ts - this.lastTs) / 1000);
    this.lastTs = ts;
    this.animClock += dt;
    this.updatePlayerMovement(dt);
    this.render();
    this.rafId = requestAnimationFrame(this.loopTick);
  };

  private startLoop(): void {
    if (this.rafId !== null) return;
    this.lastTs = 0;
    this.rafId = requestAnimationFrame(this.loopTick);
  }

  private stopLoop(): void {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private updatePlayerMovement(dt: number): void {
    const dx = this.player.targetX - this.player.x;
    const dy = this.player.targetY - this.player.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 2) {
      this.player.x = this.player.targetX;
      this.player.y = this.player.targetY;
      this.player.moving = false;
      if (this.pendingArrival) {
        const fn = this.pendingArrival;
        this.pendingArrival = null;
        fn();
      }
      return;
    }
    this.player.moving = true;
    const step = Math.min(dist, PLAYER_SPEED * dt);
    this.player.x += (dx / dist) * step;
    this.player.y += (dy / dist) * step;
  }

  private walkTo(target: { x: number; y: number }, onArrive?: () => void): void {
    this.player.targetX = target.x;
    this.player.targetY = target.y;
    this.pendingArrival = onArrive ?? null;
  }

  private handleCanvasClick(e: MouseEvent): void {
    if (document.getElementById('active-modal') || document.getElementById('title-screen')) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    this.hideDialogue();

    if (this.insideShopId) {
      this.handleInteriorClick(x, y);
      return;
    }

    const hit = hitTestMap(x, y, this.currentFloor);
    if (!hit) {
      this.walkTo({ x, y });
      return;
    }
    const spot = getStandingSpot(hit, this.currentFloor);
    this.walkTo(spot, () => {
      if (hit.type === 'player_shop') this.openPlayerShop();
      else if (hit.type === 'elevator') this.openFloorSelect();
      else this.enterShopInterior(hit.id);
    });
  }

  private handleInteriorClick(x: number, y: number): void {
    const shopId = this.insideShopId;
    if (!shopId) return;
    const char = getCharacter(getShop(shopId).characterId);
    const layout = computeInteriorLayout(char.portrait);
    const hit = hitTestInterior(x, y, layout);

    if (hit?.type === 'exit') {
      this.walkTo(layout.entrance, () => this.exitShopInterior());
      return;
    }
    if (hit?.type === 'character') {
      this.walkTo(layout.characterSpot, () => this.openCharacterDialogue(shopId));
      return;
    }
    this.walkTo(clampToInterior(x, y, layout));
  }

  // ---------------------------------------------------------
  // 店舗の内装(店内マップを歩き回れるシーン)
  // ---------------------------------------------------------

  private enterShopInterior(shopId: string): void {
    const char = getCharacter(getShop(shopId).characterId);
    const layout = computeInteriorLayout(char.portrait);
    this.insideShopId = shopId;
    this.player.x = layout.entrance.x;
    this.player.y = layout.entrance.y;
    this.player.targetX = layout.entrance.x;
    this.player.targetY = layout.entrance.y;
    this.player.moving = false;
    this.hideDialogue();
  }

  private exitShopInterior(): void {
    if (!this.insideShopId) return;
    const spot = getStandingSpot({ type: 'shop', id: this.insideShopId });
    this.insideShopId = null;
    this.player.x = spot.x;
    this.player.y = spot.y;
    this.player.targetX = spot.x;
    this.player.targetY = spot.y;
    this.player.moving = false;
    this.hideDialogue();
  }

  // ---------------------------------------------------------
  // 画面の再描画 / アイコン差し込み
  // ---------------------------------------------------------

  private render(): void {
    if (this.insideShopId) {
      const char = getCharacter(getShop(this.insideShopId).characterId);
      renderShopInterior(this.ctx, char.portrait, char, this.animClock, this.player);
    } else {
      renderMap(this.ctx, this.state, this.currentFloor, this.animClock, this.player);
    }
    renderTopBar(this.topBar, this.state, this.currentFloor);
  }

  /** モーダル/会話ボックスHTML内の <canvas data-sweet> にランク付きスイーツアイコンを描画する */
  private hydrateIcons(container: HTMLElement): void {
    container.querySelectorAll<HTMLCanvasElement>('canvas[data-sweet]').forEach((canvas) => {
      const recipeId = canvas.dataset.sweet!;
      const rankIndex = Number(canvas.dataset.rank ?? 0);
      const recipe = getRecipe(recipeId);
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawSweetIcon(ctx, 14, 14, 32, recipe.category, rankIndex);
    });
  }

  private mountHud(): void {
    this.overlay.innerHTML = '';
    initEffects(this.overlay);
    this.overlay.appendChild(this.topBar);
    this.overlay.appendChild(this.bottomBar);
    this.overlay.appendChild(this.dialogueBox);
    buildHud(this.topBar, this.bottomBar, {
      onResearch: () => this.doResearch(),
      onCraft: () => this.openCraftPanel(),
      onInventory: () => this.openInventoryPanel(),
      onMyShop: () => this.openPlayerShop(),
      onContest: () => this.openContestPanel(),
      onSave: () => this.doSave(),
    });
    this.dayStartMoney = this.state.money;
    this.currentFloor = PLAYER_HOME_FLOOR;
    this.insideShopId = null;
    this.player = { x: PLAYER_HOME_SPOT.x, y: PLAYER_HOME_SPOT.y, targetX: PLAYER_HOME_SPOT.x, targetY: PLAYER_HOME_SPOT.y, moving: false };
    this.startLoop();
  }

  // ---------------------------------------------------------
  // エレベーター(フロア移動)
  // ---------------------------------------------------------

  private openFloorSelect(): void {
    const panel = openModal(`
      <h2>🛗 フロア移動</h2>
      <p>行き先の階を選んでください。</p>
      <div class="list">
        ${FLOORS.map((f) => {
          const isHere = f.floor === this.currentFloor;
          const sub = f.floor === PLAYER_HOME_FLOOR ? 'あなたのお店' : `${getShopsOnFloor(f.floor).length}店舗`;
          return `
          <div class="card">
            <div class="info"><div class="title">${escapeHtml(f.name)}</div><div class="sub">${sub}</div></div>
            <button data-floor="${f.floor}" ${isHere ? 'disabled' : ''}>${isHere ? '現在地' : '移動する'}</button>
          </div>`;
        }).join('')}
      </div>
      ${closeButtonHtml()}
    `);
    panel.querySelectorAll<HTMLButtonElement>('[data-floor]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const floor = Number(btn.dataset.floor);
        closeModal();
        playElevatorTransition(this.canvas, () => this.changeFloor(floor));
      });
    });
    this.attachCloseHandlers();
  }

  private changeFloor(floor: number): void {
    this.currentFloor = floor;
    const spot = floor === 1 ? getHallEscalatorSpot() : ELEVATOR_SPOT;
    this.player.x = spot.x;
    this.player.y = spot.y;
    this.player.targetX = spot.x;
    this.player.targetY = spot.y;
    this.player.moving = false;
    this.hideDialogue();
    const label = FLOORS.find((f) => f.floor === floor)?.name ?? `${floor}F`;
    showToast(`🛗 ${label}に到着`, 'info');
  }

  // ---------------------------------------------------------
  // タイトル画面
  // ---------------------------------------------------------

  private showTitleScreen(): void {
    this.stopLoop();
    this.overlay.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'title-screen';
    screen.id = 'title-screen';
    screen.innerHTML = `
      <h1>🍰 スイーツデパート物語 🍩</h1>
      <p>いちごケーキ店を営むストロベリーになって、デパートの17人の店主と仲良くなろう。</p>
      <p class="sub">マップをクリックすると、その場所まで歩いていきます。</p>
      <div class="row" style="justify-content:center">
        <button id="btn-new-game">はじめから</button>
        <button class="secondary" id="btn-continue" ${hasSaveData() ? '' : 'disabled'}>つづきから</button>
      </div>
    `;
    this.overlay.appendChild(screen);
    screen.querySelector('#btn-new-game')!.addEventListener('click', () => {
      this.state = createInitialState();
      this.mountHud();
    });
    screen.querySelector('#btn-continue')!.addEventListener('click', () => {
      const loaded = loadGame();
      if (loaded) this.state = loaded;
      this.mountHud();
    });
  }

  // ---------------------------------------------------------
  // 会話ボックス(マップを覆わないビジュアルノベル風パネル)
  // ---------------------------------------------------------

  private showDialogueHtml(html: string): HTMLElement {
    this.dialogueBox.innerHTML = html;
    this.dialogueBox.classList.add('open');
    return this.dialogueBox;
  }

  private hideDialogue(): void {
    this.dialogueBox.classList.remove('open');
  }

  // ---------------------------------------------------------
  // 基本アクション
  // ---------------------------------------------------------

  private doResearch(): void {
    const dayBefore = this.state.day;
    const result = performResearch(this.state);
    const dayChanged = this.state.day !== dayBefore;

    openModal(`
      <h2>🔬 スイーツ研究</h2>
      <p>今日も研究に励んだ。${result.unlockedRecipeName ? `新レシピ「${escapeHtml(result.unlockedRecipeName)}」を思いついた!` : '地道な積み重ねが力になる。'}</p>
      ${this.logHtml()}
      ${dayChanged ? this.daySummaryBlock(dayBefore) : ''}
      ${closeButtonHtml()}
    `);
    this.attachCloseHandlers();

    if (result.unlockedRecipeName) showToast(`📖 新レシピ「${result.unlockedRecipeName}」を思いついた!`, 'success');
    if (result.timeAdvanced) showToast(`🕐 ${timeLabel(this.state.timeOfDay)}になった`, 'info');
    if (this.state.endingSeen) setTimeout(() => this.showEnding(), 600);
  }

  private doSave(): void {
    saveGame(this.state);
    showToast('💾 セーブしました', 'info');
    openModal(`<h2>💾 セーブ完了</h2><p>ゲームを保存しました。</p>${closeButtonHtml()}`);
    this.attachCloseHandlers();
  }

  private daySummaryBlock(prevDay: number): string {
    const delta = this.state.money - this.dayStartMoney;
    const sign = delta >= 0 ? '+' : '';
    const html = `
      <div class="day-summary">
        <h3>🌙 ${prevDay}日目のまとめ</h3>
        <p>収支: ${sign}${delta}ベリー / 所持金 ${this.state.money}ベリー</p>
      </div>
    `;
    this.dayStartMoney = this.state.money;
    return html;
  }

  private logHtml(): string {
    const recent = this.state.logs.slice(0, 4);
    if (recent.length === 0) return '';
    return `<div class="log-box">${recent.map((l) => `<div>[${l.day}日目/${timeLabel(l.timeOfDay)}] ${escapeHtml(l.text)}</div>`).join('')}</div>`;
  }

  private attachCloseHandlers(): void {
    document.querySelectorAll('[data-action="close-modal"]').forEach((el) => {
      el.addEventListener('click', () => {
        this.stopMinigameLoop();
        closeModal();
      });
    });
  }

  // ---------------------------------------------------------
  // キャラクター会話(マップ下部のビジュアルノベル風ダイアログ)
  // ---------------------------------------------------------

  private openCharacterDialogue(shopId: string, view: 'greet' | 'materials' | 'books' = 'greet'): void {
    const shop = getShop(shopId);
    const char = getCharacter(shop.characterId);
    const affinity = this.state.characterAffinity[char.id];
    const pending = getPendingEvent(this.state, char.id);
    const sold = MATERIALS.filter((m) => m.soldAtShopId === shop.id);

    let bodyHtml: string;
    if (view === 'materials') {
      bodyHtml = `
        <div class="dlg-name">🛒 ${escapeHtml(shop.name)}の品揃え</div>
        <div class="dlg-material-list">
          ${sold
            .map(
              (m) => `
            <div class="dlg-material">
              <div class="swatch" style="background:${m.color}"></div>
              <span class="dlg-material-name">${escapeHtml(m.name)}</span>
              <span class="sub">${m.buyPrice}ベリー</span>
              <button data-buy="${m.id}" data-price="${m.buyPrice}">購入</button>
            </div>`
            )
            .join('')}
        </div>
        <div class="dlg-actions"><button class="secondary" id="dlg-back">戻る</button></div>
      `;
    } else if (view === 'books') {
      const unknown = RECIPES.filter((r) => !this.state.knownRecipeIds.includes(r.id));
      bodyHtml = `
        <div class="dlg-name">📖 ${escapeHtml(shop.name)}のレシピ本</div>
        <div class="dlg-material-list">
          ${
            unknown
              .map((r) => {
                const price = r.basePrice * RECIPE_BOOK_PRICE_MULTIPLIER;
                return `
            <div class="dlg-material">
              <span class="dlg-material-name">${escapeHtml(r.name)}</span>
              <span class="sub">${price}ベリー</span>
              <button data-buy-recipe="${r.id}" data-price="${price}">購入</button>
            </div>`;
              })
              .join('') || '<p class="sub">今のところ、これ以上のレシピ本はないみたい。</p>'
          }
        </div>
        <div class="dlg-actions"><button class="secondary" id="dlg-back">戻る</button></div>
      `;
    } else {
      bodyHtml = `
        <div class="dlg-name">${escapeHtml(char.name)} <span class="dlg-sub">好感度 Lv${affinity.level}/5 ${'♥'.repeat(affinity.level)}${'♡'.repeat(5 - affinity.level)}</span></div>
        <div class="dlg-text" id="dlg-text">「${escapeHtml(char.greetings[affinity.level - 1])}」</div>
        <div class="dlg-actions">
          <button id="dlg-talk">話しかける</button>
          ${pending ? `<button id="dlg-event">✨ ${escapeHtml(pending.templateTitle)}</button>` : ''}
          ${sold.length > 0 ? `<button class="secondary" id="dlg-shop">🛒 素材を見る</button>` : ''}
          ${shop.type === 'bookstore' ? `<button class="secondary" id="dlg-books">📖 レシピ本を見る</button>` : ''}
          <button class="secondary" id="dlg-close">立ち去る</button>
        </div>
      `;
    }

    const box = this.showDialogueHtml(`
      ${portraitHtml(char.portrait, char.name, 'dlg-portrait')}
      <div class="dlg-body">${bodyHtml}</div>
    `);
    this.hydrateIcons(box);

    if (view === 'materials') {
      box.querySelector('#dlg-back')!.addEventListener('click', () => this.openCharacterDialogue(shopId, 'greet'));
      box.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const materialId = btn.dataset.buy!;
          const price = Number(btn.dataset.price);
          if (buyMaterial(this.state, materialId, price, 1)) {
            showToast(`🛒 ${getMaterial(materialId).name}を購入した`, 'money');
          } else {
            showToast('😢 所持金が足りません', 'warn');
          }
          this.openCharacterDialogue(shopId, 'materials');
        });
      });
      return;
    }

    if (view === 'books') {
      box.querySelector('#dlg-back')!.addEventListener('click', () => this.openCharacterDialogue(shopId, 'greet'));
      box.querySelectorAll<HTMLButtonElement>('[data-buy-recipe]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const recipeId = btn.dataset.buyRecipe!;
          const price = Number(btn.dataset.price);
          if (this.state.money >= price) {
            this.state.money -= price;
            this.state.knownRecipeIds.push(recipeId);
            showToast(`📖 新レシピ「${getRecipe(recipeId).name}」を購入した!`, 'success');
          } else {
            showToast('😢 所持金が足りません', 'warn');
          }
          this.openCharacterDialogue(shopId, 'books');
        });
      });
      return;
    }

    box.querySelector('#dlg-talk')!.addEventListener('click', () => {
      const dayBefore = this.state.day;
      const result = performTalk(this.state, char.id);
      const textEl = box.querySelector('#dlg-text');
      if (textEl) textEl.textContent = `「${result.greeting}」`;

      if (result.leveledUp) showToast(`💖 ${char.name}の好感度がLv${result.newLevel}になった!`, 'love');
      if (result.eventUnlocked) showToast(`✨ ${char.name}が話したいことがあるみたい`, 'info');

      if (result.timeAdvanced) {
        showToast(`🕐 ${timeLabel(this.state.timeOfDay)}になった`, 'info');
        const dayChanged = this.state.day !== dayBefore;
        this.hideDialogue();
        if (dayChanged) {
          openModal(`
            <h2>${escapeHtml(char.name)}と話した</h2>
            <p>「${escapeHtml(result.greeting)}」</p>
            ${this.daySummaryBlock(dayBefore)}
            ${closeButtonHtml('おやすみ')}
          `);
          this.attachCloseHandlers();
        }
        if (this.state.endingSeen) setTimeout(() => this.showEnding(), 600);
        return;
      }
      this.openCharacterDialogue(shopId, 'greet');
    });

    const eventBtn = box.querySelector('#dlg-event');
    if (eventBtn) eventBtn.addEventListener('click', () => this.openEventPanel(char.id));

    const shopBtn = box.querySelector('#dlg-shop');
    if (shopBtn) shopBtn.addEventListener('click', () => this.openCharacterDialogue(shopId, 'materials'));

    const booksBtn = box.querySelector('#dlg-books');
    if (booksBtn) booksBtn.addEventListener('click', () => this.openCharacterDialogue(shopId, 'books'));

    box.querySelector('#dlg-close')!.addEventListener('click', () => this.hideDialogue());
  }

  // ---------------------------------------------------------
  // イベント(お悩み相談 / ミニゲーム)
  // ---------------------------------------------------------

  private openEventPanel(characterId: string): void {
    const pending = getPendingEvent(this.state, characterId);
    const char = getCharacter(characterId);
    if (!pending) return;

    if (pending.reward.templateId === 'consultation') {
      const choices = ['じっくり話を聞いてあげる', '元気になる言葉をかける', '一緒に解決策を考える'];
      const panel = openModal(`
        <h2>💬 ${escapeHtml(pending.templateTitle)}</h2>
        <div class="row">
          ${portraitHtml(char.portrait, char.name)}
          <p style="flex:1">${escapeHtml(char.name)}「${escapeHtml(pending.templateDescription)}」</p>
        </div>
        <p class="sub">どう返事する?一番寄り添えそうな選択肢を選ぼう。</p>
        <div class="list">
          ${choices.map((c, i) => `<button data-choice="${i}" style="text-align:left">${escapeHtml(c)}</button>`).join('')}
        </div>
        <div id="event-result"></div>
        ${closeButtonHtml('とじる')}
      `);
      this.hydrateIcons(panel);
      panel.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.choice);
          const grade = resolveConsultationEvent(this.state, characterId, idx);
          panel.querySelectorAll('[data-choice]').forEach((b) => b.setAttribute('disabled', 'true'));
          panel.querySelector('#event-result')!.innerHTML = this.eventGradeMessage(grade);
          this.handleEventGradeEffects(grade);
          this.openCharacterDialogue(getShopByCharacter(characterId).id, 'greet');
        });
      });
      this.attachCloseHandlers();
      return;
    }

    // minigame
    const panel = openModal(`
      <h2>🧁 ${escapeHtml(pending.templateTitle)}</h2>
      <div class="row">
        ${portraitHtml(char.portrait, char.name)}
        <p style="flex:1">${escapeHtml(char.name)}「${escapeHtml(pending.templateDescription)}」</p>
      </div>
      <p class="sub">カーソルがちょうど良い位置(色のついた枠)に来たタイミングでクリックしてね!</p>
      <div class="minigame-bar"><div class="minigame-target"></div><div class="minigame-cursor" id="mg-cursor"></div></div>
      <div class="row"><button id="mg-click">クリック!</button></div>
      <div id="event-result"></div>
      ${closeButtonHtml('とじる')}
    `);
    this.hydrateIcons(panel);

    let t = 0;
    const cursor = panel.querySelector<HTMLElement>('#mg-cursor')!;
    const tick = () => {
      t += 0.045;
      const pos = (Math.sin(t) + 1) / 2; // 0-1
      cursor.style.left = `${pos * 96}%`;
      this.minigameRaf = requestAnimationFrame(tick);
    };
    this.minigameRaf = requestAnimationFrame(tick);

    panel.querySelector('#mg-click')!.addEventListener('click', () => {
      this.stopMinigameLoop();
      const leftPercent = parseFloat(cursor.style.left || '0');
      const hitValue = Math.min(100, Math.max(0, (leftPercent / 96) * 100));
      const grade = resolveMinigameEvent(this.state, characterId, hitValue);
      (panel.querySelector('#mg-click') as HTMLButtonElement).setAttribute('disabled', 'true');
      panel.querySelector('#event-result')!.innerHTML = this.eventGradeMessage(grade);
      this.handleEventGradeEffects(grade);
      this.openCharacterDialogue(getShopByCharacter(characterId).id, 'greet');
    });

    this.attachCloseHandlers();
  }

  private handleEventGradeEffects(grade: 'full' | 'partial' | 'fail'): void {
    if (grade === 'full') {
      showToast('🎉 大成功!素材・レシピをたくさん手に入れた!', 'success');
      burstConfetti(this.canvas, CANVAS_W / 2, CANVAS_H / 2);
    } else if (grade === 'partial') {
      showToast('まずまずの結果。ちょっとした報酬をもらえた。', 'info');
    } else {
      showToast('うまくいかなかった……また今度挑戦しよう。', 'warn');
    }
  }

  private stopMinigameLoop(): void {
    if (this.minigameRaf !== null) {
      cancelAnimationFrame(this.minigameRaf);
      this.minigameRaf = null;
    }
  }

  private eventGradeMessage(grade: 'full' | 'partial' | 'fail'): string {
    if (grade === 'full') return '<p>🎉 大成功!素材・レシピをたくさん手に入れた!</p>';
    if (grade === 'partial') return '<p>まずまずの結果。ちょっとした報酬をもらえた。</p>';
    return '<p>うまくいかなかった……また今度挑戦しよう。</p>';
  }

  // ---------------------------------------------------------
  // 調合(キッチンシーン)
  // ---------------------------------------------------------

  private openCraftPanel(): void {
    const known = RECIPES.filter((r) => this.state.knownRecipeIds.includes(r.id));
    const shelfFull = this.state.shelf.length >= SHELF_CAPACITY;
    const panel = openModal(`
      <h2>🍳 キッチン - スイーツ調合</h2>
      <p class="sub">陳列棚: ${this.state.shelf.length} / ${SHELF_CAPACITY}点 ${shelfFull ? '(満杯!自分の店で商品を整理しよう)' : ''}</p>
      <div class="list">
        ${known
          .map((r) => {
            const mastery = this.state.recipeMastery[r.id];
            const rankIndex = mastery?.rankIndex ?? 0;
            const ok = canCraft(this.state, r.id) && !shelfFull;
            const rankText = mastery ? `現在${rankLabel(mastery.rankIndex)}ランク(${mastery.timesMade}回成功)` : 'まだ未作成';
            const ingredientsText = r.ingredients
              .map((ing) => `${getMaterial(ing.materialId).name}×${ing.qty}`)
              .join(' / ');
            const label = shelfFull ? '棚が満杯' : ok ? '作る' : '素材不足';
            return `
            <div class="card" style="align-items:flex-start">
              <canvas class="sweet-canvas" width="60" height="60" data-sweet="${r.id}" data-rank="${rankIndex}"></canvas>
              <div class="info">
                <div class="title">${escapeHtml(r.name)} <span class="sub">(成功率${Math.round(r.baseSuccessRate * 100)}%)</span></div>
                <div class="sub">${escapeHtml(ingredientsText)}</div>
                <div class="sub">${escapeHtml(rankText)}</div>
              </div>
              <button data-craft="${r.id}" ${ok ? '' : 'disabled'}>${label}</button>
            </div>`;
          })
          .join('')}
      </div>
      <div id="craft-result"></div>
      ${closeButtonHtml()}
    `);
    this.hydrateIcons(panel);

    panel.querySelectorAll<HTMLButtonElement>('[data-craft]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const recipeId = btn.dataset.craft!;
        const result = craftSweet(this.state, recipeId);
        const resultBox = panel.querySelector('#craft-result')!;

        if (!result.ok) {
          const msg = result.reason === 'shelf_full' ? '棚がいっぱいで並べられません。' : '作成できませんでした。';
          resultBox.innerHTML = `<p>${msg}</p>`;
          return;
        }

        panel.querySelectorAll<HTMLButtonElement>('[data-craft]').forEach((b) => b.setAttribute('disabled', 'true'));
        resultBox.innerHTML = `<canvas id="mix-canvas" width="240" height="130"></canvas>`;
        const mixCanvas = resultBox.querySelector('#mix-canvas') as HTMLCanvasElement;
        this.runMixAnimation(mixCanvas, !!result.success, () => {
          if (result.success) {
            resultBox.innerHTML = `<p>🎉 ${escapeHtml(getRecipe(recipeId).name)}が完成!<span class="rank-badge">${result.rank}</span> ${result.price}ベリーで棚に並べた!</p>`;
            showToast(`🎉 ${getRecipe(recipeId).name}(${result.rank})が完成!`, 'success');
            const mastery = this.state.recipeMastery[recipeId];
            if (mastery && mastery.rankIndex >= 5) burstConfetti(this.canvas, CANVAS_W / 2, CANVAS_H / 2);
          } else {
            resultBox.innerHTML = `<p>😢 失敗してしまった……素材が無駄になった。</p>`;
            showToast('😢 調合に失敗した……', 'warn');
          }
          this.openCraftPanel();
        });
      });
    });

    this.attachCloseHandlers();
  }

  /** ボウルが揺れて湯気があがる「調合中」演出。完了後に onDone を呼ぶ。 */
  private runMixAnimation(canvas: HTMLCanvasElement, success: boolean, onDone: () => void): void {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      onDone();
      return;
    }
    const start = performance.now();
    const duration = 900;

    const tick = (ts: number) => {
      const elapsed = ts - start;
      const t = Math.min(1, elapsed / duration);
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const shakeX = Math.sin(elapsed / 35) * (1 - t) * 7;
      ctx.save();
      ctx.translate(canvas.width / 2 + shakeX, canvas.height / 2 + 16);
      ctx.fillStyle = '#f0d3de';
      ctx.beginPath();
      ctx.ellipse(0, 0, 62, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#b3446c';
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();

      for (let i = 0; i < 6; i++) {
        const cycle = (elapsed / 8 + i * 22) % 90;
        const px = canvas.width / 2 + Math.sin(elapsed / 220 + i) * 16 + (i - 3) * 9;
        const py = canvas.height / 2 - 6 - cycle;
        const alpha = Math.max(0, 1 - cycle / 90);
        ctx.fillStyle = `rgba(255,255,255,${alpha * 0.7})`;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.fillStyle = '#8a5a3c';
      ctx.font = 'bold 13px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(success ? '混ぜ混ぜ中...🥄' : '……あれ?', canvas.width / 2, canvas.height - 10);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        onDone();
      }
    };
    requestAnimationFrame(tick);
  }

  // ---------------------------------------------------------
  // 在庫
  // ---------------------------------------------------------

  private openInventoryPanel(): void {
    openModal(`
      <h2>🎒 在庫</h2>
      <div class="list">
        ${this.state.inventory
          .filter((i) => i.qty > 0)
          .map((i) => {
            const m = getMaterial(i.materialId);
            return `<div class="card"><div class="swatch" style="background:${m.color}"></div><div class="info"><div class="title">${escapeHtml(m.name)}</div></div><div>${i.qty}個</div></div>`;
          })
          .join('') || '<p>素材がありません。</p>'}
      </div>
      <h3>📖 習得レシピ</h3>
      <div class="list">
        ${this.state.knownRecipeIds
          .map((id) => `<div class="card"><div class="info"><div class="title">${escapeHtml(getRecipe(id).name)}</div></div></div>`)
          .join('')}
      </div>
      ${closeButtonHtml()}
    `);
    this.attachCloseHandlers();
  }

  // ---------------------------------------------------------
  // 自分の店(棚 / 接客)
  // ---------------------------------------------------------

  private openPlayerShop(): void {
    const panel = openModal(`
      <h2>🏪 ${escapeHtml(PLAYER_SHOP.name)}</h2>
      <div class="row">
        ${portraitHtml(PLAYER_SHOP.portrait, 'ストロベリー')}
        <p style="flex:1">今月の売上: ${this.state.currentMonthPlayerSales}ベリー(ライバル: ${this.state.currentMonthRivalSales}ベリー)</p>
      </div>
      <div class="row"><button id="btn-shift">接客する</button></div>
      <div id="shift-result"></div>
      <h3>🧁 陳列棚(${this.state.shelf.length} / ${SHELF_CAPACITY}点)</h3>
      <div class="list">
        ${
          this.state.shelf
            .map((item) => {
              const r = getRecipe(item.recipeId);
              const range = priceRangeFor(item.recipeId, item.rankIndex);
              const feel = priceFeelLabel(item.price, range.fair);
              return `<div class="card">
                <canvas class="sweet-canvas" width="60" height="60" data-sweet="${item.recipeId}" data-rank="${item.rankIndex}"></canvas>
                <div class="info">
                  <div class="title">${escapeHtml(r.name)} <span class="rank-badge">${rankLabel(item.rankIndex)}</span></div>
                  <div class="row" style="gap:4px">
                    <button class="secondary price-btn" data-price-down="${item.id}">-${PRICE_ADJUST_STEP}</button>
                    <span class="price-value">${item.price}ベリー</span>
                    <button class="secondary price-btn" data-price-up="${item.id}">+${PRICE_ADJUST_STEP}</button>
                  </div>
                  <div class="sub">${feel}(適正: ${range.fair}ベリー)</div>
                </div>
                <button class="danger" data-remove="${item.id}">下げる</button>
              </div>`;
            })
            .join('') || '<p>棚には何も並んでいません。調合してスイーツを作ろう!</p>'
        }
      </div>
      ${this.monthlyHistoryHtml()}
      ${closeButtonHtml()}
    `);
    this.hydrateIcons(panel);

    panel.querySelector('#btn-shift')!.addEventListener('click', () => {
      const result = runSalesShift(this.state);
      panel.querySelector('#shift-result')!.innerHTML = `<p>${result.customers}人来店 / ${result.itemsSold}個販売 / ${result.revenue}ベリーの売上</p>`;
      if (result.itemsSold > 0) showToast(`💰 +${result.revenue}ベリーの売上!`, 'money');
      if (result.itemsSold >= 3) burstConfetti(this.canvas, CANVAS_W / 2, CANVAS_H * 0.3);
      this.openPlayerShop();
    });

    panel.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.remove!;
        this.state.shelf = this.state.shelf.filter((i) => i.id !== id);
        this.openPlayerShop();
      });
    });

    panel.querySelectorAll<HTMLButtonElement>('[data-price-up]').forEach((btn) => {
      btn.addEventListener('click', () => {
        adjustShelfPrice(this.state, btn.dataset.priceUp!, PRICE_ADJUST_STEP);
        this.openPlayerShop();
      });
    });
    panel.querySelectorAll<HTMLButtonElement>('[data-price-down]').forEach((btn) => {
      btn.addEventListener('click', () => {
        adjustShelfPrice(this.state, btn.dataset.priceDown!, -PRICE_ADJUST_STEP);
        this.openPlayerShop();
      });
    });

    this.attachCloseHandlers();
  }

  private monthlyHistoryHtml(): string {
    if (this.state.monthlyRecords.length === 0) return '';
    const rows = this.state.monthlyRecords
      .slice(0, 3)
      .map(
        (m) =>
          `<div class="card"><div class="info"><div class="title">${m.monthNumber}か月目: ${m.result === 'win' ? '✅目標達成' : '❌未達成'}</div><div class="sub">自店 ${m.playerSales} / ライバル ${m.rivalSales} / 目標 ${m.targetSales}</div></div></div>`
      )
      .join('');
    return `<h3>📊 月間売上ランキング履歴</h3><div class="list">${rows}</div>`;
  }

  // ---------------------------------------------------------
  // コンテスト
  // ---------------------------------------------------------

  private openContestPanel(): void {
    const nextStage = this.state.contestStageCleared + 1;
    const stageDef = nextStage <= CONTEST_STAGES.length ? getContestStage(nextStage) : null;

    const panel = openModal(`
      <h2>🏆 コンテスト</h2>
      <p>クリア済み段階: ${this.state.contestStageCleared} / ${CONTEST_STAGES.length}</p>
      ${
        stageDef
          ? `<h3>次の挑戦: ${escapeHtml(stageDef.name)}(参加費 ${stageDef.entryFee}ベリー / 要求ランク ${rankLabel(stageDef.requiredRankIndex)}以上)</h3>
             <p>棚から出品するスイーツを選んでください。</p>
             <div class="list">
               ${
                 this.state.shelf
                   .map((item) => {
                     const r = getRecipe(item.recipeId);
                     const prob = Math.round(previewWinProbability(item.rankIndex, stageDef.requiredRankIndex) * 100);
                     return `<div class="card">
                       <canvas class="sweet-canvas" width="60" height="60" data-sweet="${item.recipeId}" data-rank="${item.rankIndex}"></canvas>
                       <div class="info">
                         <div class="title">${escapeHtml(r.name)} <span class="rank-badge">${rankLabel(item.rankIndex)}</span></div>
                         <div class="sub">予想勝率: 約${prob}%</div>
                       </div>
                       <button data-enter="${item.id}">出品する</button>
                     </div>`;
                   })
                   .join('') || '<p>出品できるスイーツが棚にありません。調合して用意しよう。</p>'
               }
             </div>`
          : '<p>全ての段階をクリアしました!あなたはスイーツデパート一の職人です。</p>'
      }
      <div id="contest-result"></div>
      ${closeButtonHtml()}
    `);
    this.hydrateIcons(panel);

    panel.querySelectorAll<HTMLButtonElement>('[data-enter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const shelfItemId = btn.dataset.enter!;
        const result = enterContest(this.state, shelfItemId);
        const box = panel.querySelector('#contest-result')!;
        if (!result.ok) {
          box.innerHTML = `<p>エントリーできませんでした(${result.reason})。</p>`;
        } else if (result.won) {
          box.innerHTML = `<p>🎉優勝しました!</p>`;
          showToast(`🏆 ${stageDef ? stageDef.name : 'コンテスト'}優勝!`, 'success');
          burstConfetti(this.canvas, CANVAS_W / 2, CANVAS_H / 2);
        } else {
          box.innerHTML = `<p>惜しくも敗退……</p>`;
          showToast('惜しくも敗退……また挑戦しよう', 'warn');
        }
        if (this.state.endingSeen) {
          setTimeout(() => this.showEnding(), 600);
        } else {
          this.openContestPanel();
        }
      });
    });

    this.attachCloseHandlers();
  }

  // ---------------------------------------------------------
  // エンディング
  // ---------------------------------------------------------

  private showEnding(): void {
    this.stopLoop();
    closeModal();
    this.overlay.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'ending-screen';
    screen.innerHTML = `
      <h1>🎉 世界スイーツグランプリ優勝 🎉</h1>
      <p>あなたの作るスイーツは、デパート中の、そして世界中の人々を笑顔にしました。</p>
      <p>17人の店主たちとの絆も、たくさんの美味しいスイーツも、すべてあなたの努力の証です。</p>
      <p style="opacity:0.7">-- STAFF ROLL --</p>
      <p style="opacity:0.7">ストロベリー(あなた) ・ ${CHARACTERS.map((c) => c.name).join(' ・ ')}</p>
      <button id="btn-back-title">タイトルへ戻る</button>
    `;
    this.overlay.appendChild(screen);
    screen.querySelector('#btn-back-title')!.addEventListener('click', () => this.showTitleScreen());
  }
}

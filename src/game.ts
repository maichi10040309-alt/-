import type { GameState } from '@/types';
import { createInitialState } from '@/systems/gameState';
import { saveGame, loadGame, hasSaveData } from '@/systems/save';
import { timeLabel } from '@/systems/time';
import { performTalk, performResearch } from '@/systems/actions';
import { craftSweet, canCraft, buyMaterial } from '@/systems/crafting';
import { runSalesShift } from '@/systems/sales';
import { enterContest } from '@/systems/contestSystem';
import { getPendingEvent, resolveConsultationEvent, resolveMinigameEvent } from '@/systems/eventSystem';

import { CHARACTERS, getCharacter } from '@/data/characters';
import { getShop } from '@/data/shops';
import { MATERIALS, getMaterial } from '@/data/materials';
import { RECIPES, getRecipe, rankLabel } from '@/data/recipes';
import { CONTEST_STAGES, getContestStage } from '@/data/contest';

import { initOverlay, openModal, closeModal, closeButtonHtml, escapeHtml } from '@/ui/panels';
import { renderMap, hitTestMap, CANVAS_W, CANVAS_H } from '@/ui/mapRenderer';
import { buildHud, renderTopBar } from '@/ui/hud';

export class Game {
  private state: GameState = createInitialState();
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private overlay: HTMLElement;
  private topBar: HTMLElement;
  private bottomBar: HTMLElement;
  private minigameRaf: number | null = null;

  constructor(canvas: HTMLCanvasElement, overlay: HTMLElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d context not available');
    this.ctx = ctx;

    this.topBar = document.createElement('div');
    this.topBar.className = 'hud-bar';
    this.bottomBar = document.createElement('div');
    this.bottomBar.className = 'hud-menu';

    this.overlay = overlay;
    initOverlay(overlay);

    this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
  }

  start(): void {
    this.showTitleScreen();
  }

  private handleCanvasClick(e: MouseEvent): void {
    if (document.getElementById('active-modal') || document.getElementById('title-screen')) return;
    const rect = this.canvas.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * CANVAS_W;
    const y = ((e.clientY - rect.top) / rect.height) * CANVAS_H;
    const hit = hitTestMap(x, y);
    if (!hit) return;
    if (hit.type === 'player_shop') this.openPlayerShop();
    else this.openShop(hit.id);
  }

  // ---------------------------------------------------------
  // 画面の再描画
  // ---------------------------------------------------------

  private render(): void {
    renderMap(this.ctx, this.state);
    renderTopBar(this.topBar, this.state);
  }

  private mountHud(): void {
    this.overlay.innerHTML = '';
    this.overlay.appendChild(this.topBar);
    this.overlay.appendChild(this.bottomBar);
    buildHud(this.topBar, this.bottomBar, {
      onResearch: () => this.doResearch(),
      onCraft: () => this.openCraftPanel(),
      onInventory: () => this.openInventoryPanel(),
      onMyShop: () => this.openPlayerShop(),
      onContest: () => this.openContestPanel(),
      onSave: () => this.doSave(),
    });
    this.render();
  }

  // ---------------------------------------------------------
  // タイトル画面
  // ---------------------------------------------------------

  private showTitleScreen(): void {
    this.overlay.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'title-screen';
    screen.id = 'title-screen';
    screen.innerHTML = `
      <h1>🍰 スイーツデパート物語 🍩</h1>
      <p>デパートで自分のお店を育てながら、18人の店主と仲良くなろう。</p>
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
  // 基本アクション
  // ---------------------------------------------------------

  private doResearch(): void {
    const result = performResearch(this.state);
    this.render();
    openModal(`
      <h2>🔬 スイーツ研究</h2>
      <p>今日も研究に励んだ。${result.unlockedRecipeName ? `新レシピ「${escapeHtml(result.unlockedRecipeName)}」を思いついた!` : '地道な積み重ねが力になる。'}</p>
      ${this.logHtml()}
      ${closeButtonHtml()}
    `);
    this.attachCloseHandlers();
    if (result.timeAdvanced) this.afterTimeAdvance();
  }

  private doSave(): void {
    saveGame(this.state);
    openModal(`<h2>💾 セーブ完了</h2><p>ゲームを保存しました。</p>${closeButtonHtml()}`);
    this.attachCloseHandlers();
  }

  private afterTimeAdvance(): void {
    this.render();
    if (this.state.endingSeen) {
      setTimeout(() => this.showEnding(), 400);
    }
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
  // キャラクター/店舗パネル
  // ---------------------------------------------------------

  private openShop(shopId: string): void {
    const shop = getShop(shopId);
    const char = getCharacter(shop.characterId);
    const affinity = this.state.characterAffinity[char.id];
    const pending = getPendingEvent(this.state, char.id);

    let materialsHtml = '';
    if (shop.type === 'material') {
      const sold = MATERIALS.filter((m) => m.soldAtShopId === shop.id);
      materialsHtml = `
        <h3>🛒 取扱素材</h3>
        <div class="list">
          ${sold
            .map(
              (m) => `
            <div class="card">
              <div class="swatch" style="background:${m.color}"></div>
              <div class="info"><div class="title">${escapeHtml(m.name)}</div><div class="sub">${m.buyPrice}ベリー</div></div>
              <button data-buy="${m.id}" data-price="${m.buyPrice}">購入</button>
            </div>`
            )
            .join('')}
        </div>
      `;
    }

    const panel = openModal(`
      <h2>${escapeHtml(shop.name)}</h2>
      <div class="card">
        <div class="swatch" style="background:${char.color}"></div>
        <div class="info">
          <div class="title">${escapeHtml(char.name)}(${escapeHtml(char.personality)})</div>
          <div class="sub">好感度 Lv${affinity.level} / 5 &nbsp; ${'♥'.repeat(affinity.level)}${'♡'.repeat(5 - affinity.level)}</div>
        </div>
      </div>
      <p id="talk-line" style="min-height:36px">「${escapeHtml(char.greetings[affinity.level - 1])}」</p>
      <div class="row">
        <button id="btn-talk">話しかける</button>
        ${pending ? `<button id="btn-event">✨ ${escapeHtml(pending.templateTitle)}をする</button>` : ''}
      </div>
      ${materialsHtml}
      ${closeButtonHtml()}
    `);

    panel.querySelector('#btn-talk')!.addEventListener('click', () => {
      const result = performTalk(this.state, char.id);
      panel.querySelector('#talk-line')!.textContent = `「${result.greeting}」`;
      this.render();
      if (result.timeAdvanced) {
        this.afterTimeAdvance();
        closeModal();
        return;
      }
      // 好感度・イベント状況が変わった可能性があるのでパネルを開き直す
      this.openShop(shopId);
    });

    const eventBtn = panel.querySelector('#btn-event');
    if (eventBtn) {
      eventBtn.addEventListener('click', () => this.openEventPanel(char.id));
    }

    panel.querySelectorAll<HTMLButtonElement>('[data-buy]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const materialId = btn.dataset.buy!;
        const price = Number(btn.dataset.price);
        if (buyMaterial(this.state, materialId, price, 1)) {
          this.render();
          this.openShop(shopId);
        } else {
          alert('所持金が足りません。');
        }
      });
    });

    this.attachCloseHandlers();
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
        <p>${escapeHtml(char.name)}「${escapeHtml(pending.templateDescription)}」</p>
        <p class="sub">どう返事する?一番寄り添えそうな選択肢を選ぼう。</p>
        <div class="list">
          ${choices.map((c, i) => `<button data-choice="${i}" style="text-align:left">${escapeHtml(c)}</button>`).join('')}
        </div>
        <div id="event-result"></div>
        ${closeButtonHtml('とじる')}
      `);
      panel.querySelectorAll<HTMLButtonElement>('[data-choice]').forEach((btn) => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.choice);
          const grade = resolveConsultationEvent(this.state, characterId, idx);
          panel.querySelectorAll('[data-choice]').forEach((b) => b.setAttribute('disabled', 'true'));
          panel.querySelector('#event-result')!.innerHTML = this.eventGradeMessage(grade);
          this.render();
        });
      });
      this.attachCloseHandlers();
      return;
    }

    // minigame
    const panel = openModal(`
      <h2>🧁 ${escapeHtml(pending.templateTitle)}</h2>
      <p>${escapeHtml(char.name)}「${escapeHtml(pending.templateDescription)}」</p>
      <p class="sub">カーソルがちょうど良い位置(色のついた枠)に来たタイミングでクリックしてね!</p>
      <div class="minigame-bar"><div class="minigame-target"></div><div class="minigame-cursor" id="mg-cursor"></div></div>
      <div class="row"><button id="mg-click">クリック!</button></div>
      <div id="event-result"></div>
      ${closeButtonHtml('とじる')}
    `);

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
      this.render();
    });

    this.attachCloseHandlers();
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
  // 調合(クラフト)
  // ---------------------------------------------------------

  private openCraftPanel(): void {
    const known = RECIPES.filter((r) => this.state.knownRecipeIds.includes(r.id));
    const panel = openModal(`
      <h2>🍰 スイーツ調合</h2>
      <div class="list">
        ${known
          .map((r) => {
            const ok = canCraft(this.state, r.id);
            const mastery = this.state.recipeMastery[r.id];
            const rankText = mastery ? `現在${rankLabel(mastery.rankIndex)}ランク(${mastery.timesMade}回成功)` : 'まだ未作成';
            const ingredientsText = r.ingredients
              .map((ing) => `${getMaterial(ing.materialId).name}×${ing.qty}`)
              .join(' / ');
            return `
            <div class="card" style="align-items:flex-start">
              <div class="info">
                <div class="title">${escapeHtml(r.name)} <span class="sub">(成功率${Math.round(r.baseSuccessRate * 100)}%)</span></div>
                <div class="sub">${escapeHtml(ingredientsText)}</div>
                <div class="sub">${escapeHtml(rankText)}</div>
              </div>
              <button data-craft="${r.id}" ${ok ? '' : 'disabled'}>${ok ? '作る' : '素材不足'}</button>
            </div>`;
          })
          .join('')}
      </div>
      <div id="craft-result"></div>
      ${closeButtonHtml()}
    `);

    panel.querySelectorAll<HTMLButtonElement>('[data-craft]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const recipeId = btn.dataset.craft!;
        const result = craftSweet(this.state, recipeId);
        const resultBox = panel.querySelector('#craft-result')!;
        if (!result.ok) {
          resultBox.innerHTML = `<p>作成できませんでした。</p>`;
        } else if (result.success) {
          resultBox.innerHTML = `<p>🎉 ${escapeHtml(getRecipe(recipeId).name)}が完成!<span class="rank-badge">${result.rank}</span> ${result.price}ベリーで棚に並べた!</p>`;
        } else {
          resultBox.innerHTML = `<p>😢 失敗してしまった……素材が無駄になった。</p>`;
        }
        this.render();
        this.openCraftPanel();
      });
    });

    this.attachCloseHandlers();
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
      <h2>🏪 あなたのお店</h2>
      <p>今月の売上: ${this.state.currentMonthPlayerSales}ベリー(ライバル: ${this.state.currentMonthRivalSales}ベリー)</p>
      <div class="row"><button id="btn-shift">接客する</button></div>
      <div id="shift-result"></div>
      <h3>🧁 陳列棚(${this.state.shelf.length}点)</h3>
      <div class="list">
        ${
          this.state.shelf
            .map((item) => {
              const r = getRecipe(item.recipeId);
              return `<div class="card">
                <div class="info"><div class="title">${escapeHtml(r.name)} <span class="rank-badge">${rankLabel(item.rankIndex)}</span></div><div class="sub">${item.price}ベリー</div></div>
                <button class="danger" data-remove="${item.id}">下げる</button>
              </div>`;
            })
            .join('') || '<p>棚には何も並んでいません。調合してスイーツを作ろう!</p>'
        }
      </div>
      ${this.monthlyHistoryHtml()}
      ${closeButtonHtml()}
    `);

    panel.querySelector('#btn-shift')!.addEventListener('click', () => {
      const result = runSalesShift(this.state);
      panel.querySelector('#shift-result')!.innerHTML = `<p>${result.customers}人来店 / ${result.itemsSold}個販売 / ${result.revenue}ベリーの売上</p>`;
      this.render();
      this.openPlayerShop();
    });

    panel.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.remove!;
        this.state.shelf = this.state.shelf.filter((i) => i.id !== id);
        this.render();
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
                     return `<div class="card"><div class="info"><div class="title">${escapeHtml(r.name)} <span class="rank-badge">${rankLabel(item.rankIndex)}</span></div></div><button data-enter="${item.id}">出品する</button></div>`;
                   })
                   .join('') || '<p>出品できるスイーツが棚にありません。調合して用意しよう。</p>'
               }
             </div>`
          : '<p>全ての段階をクリアしました!あなたはスイーツデパート一の職人です。</p>'
      }
      <div id="contest-result"></div>
      ${closeButtonHtml()}
    `);

    panel.querySelectorAll<HTMLButtonElement>('[data-enter]').forEach((btn) => {
      btn.addEventListener('click', () => {
        const shelfItemId = btn.dataset.enter!;
        const result = enterContest(this.state, shelfItemId);
        const box = panel.querySelector('#contest-result')!;
        if (!result.ok) {
          box.innerHTML = `<p>エントリーできませんでした(${result.reason})。</p>`;
        } else {
          box.innerHTML = `<p>${result.won ? '🎉優勝しました!' : '惜しくも敗退……'}</p>`;
        }
        this.render();
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
    closeModal();
    this.overlay.innerHTML = '';
    const screen = document.createElement('div');
    screen.className = 'ending-screen';
    screen.innerHTML = `
      <h1>🎉 世界スイーツグランプリ優勝 🎉</h1>
      <p>あなたの作るスイーツは、デパート中の、そして世界中の人々を笑顔にしました。</p>
      <p>18人の店主たちとの絆も、たくさんの美味しいスイーツも、すべてあなたの努力の証です。</p>
      <p style="opacity:0.7">-- STAFF ROLL --</p>
      <p style="opacity:0.7">${CHARACTERS.map((c) => c.name).join(' ・ ')}</p>
      <button id="btn-back-title">タイトルへ戻る</button>
    `;
    this.overlay.appendChild(screen);
    screen.querySelector('#btn-back-title')!.addEventListener('click', () => this.showTitleScreen());
  }
}

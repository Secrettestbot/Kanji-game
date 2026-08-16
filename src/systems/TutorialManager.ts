import Phaser from 'phaser';
import { COLORS, TILE_SIZE } from '../config';
import { MachineType } from '../types';

interface TutorialStep {
  id: string;
  message: string;
  hint: string;
  highlightTiles?: { x: number; y: number }[];
  requiredAction?: 'place_extractor' | 'place_belt' | 'place_furnace' | 'place_dispatch' | 'wait_extraction' | 'wait_production' | 'wait_ship';
  arrow?: { x: number; y: number; dir: 'up' | 'down' | 'left' | 'right' };
}

const TUTORIAL_STEPS: TutorialStep[] = [
  {
    id: 'welcome',
    message: 'Welcome to Sumi Kōjō! 墨工場\nYour goal: extract radicals from ore, combine them into kanji, and ship them.',
    hint: 'Click anywhere to continue.',
  },
  {
    id: 'ore_intro',
    message: 'The green circles on the map are ore nodes.\nEach one contains a radical (部首) — a building block of kanji.',
    hint: 'Click to continue.',
  },
  {
    id: 'place_extractor',
    message: 'Step 1: Place an Extractor (採) next to an ore node.\nPress [1] or click "Extractor" in the Build panel, then click a tile adjacent to an ore node.',
    hint: 'Place the extractor touching an ore node. Output goes to the RIGHT →',
    requiredAction: 'place_extractor',
  },
  {
    id: 'place_belt_1',
    message: 'Step 2: Connect a belt from the extractor output.\nPress [3] or click "Belt", then click tiles to lay a path to the right.\nBelts carry items in the direction you place them.',
    hint: 'Lay 3-4 belt tiles to the right of the extractor.',
    requiredAction: 'place_belt',
  },
  {
    id: 'place_furnace',
    message: 'Step 3: Place a Furnace (炉) at the end of the belt.\nThe furnace takes radicals IN from the left and combines them into kanji.',
    hint: 'Place the furnace so its left edge touches the end of your belt.',
    requiredAction: 'place_furnace',
  },
  {
    id: 'place_belt_2',
    message: 'Step 4: Add more belts from the furnace output (right side) →\nThese will carry produced kanji to a dispatch board.',
    hint: 'Lay belt tiles from the furnace\'s right side.',
    requiredAction: 'place_belt',
  },
  {
    id: 'place_dispatch',
    message: 'Step 5: Place a Dispatch Board (送) at the end of this belt.\nKanji delivered here earn you ink points (墨)!',
    hint: 'Place the dispatch board at the end of your second belt chain.',
    requiredAction: 'place_dispatch',
  },
  {
    id: 'wait_extraction',
    message: 'Excellent! Now watch — the extractor is mining radicals.\nYou\'ll see them appear as green circles on the belt.',
    hint: 'Wait for a radical to appear on the belt...',
    requiredAction: 'wait_extraction',
  },
  {
    id: 'wait_gate',
    message: 'When the furnace produces a new kanji, a Pronunciation Gate will appear.\nAnswer the quiz to unlock the kanji!',
    hint: 'Wait for the furnace to produce and answer the quiz.',
    requiredAction: 'wait_production',
  },
  {
    id: 'wait_ship',
    message: 'The kanji is now traveling to the dispatch board.\nWhen it arrives, you earn ink points!',
    hint: 'Watch the kanji travel to the dispatch board.',
    requiredAction: 'wait_ship',
  },
  {
    id: 'complete',
    message: 'You\'ve built your first production line! 🎉\n\nTips:\n• Click a Furnace (with no build tool selected) to pin it to a specific kanji — otherwise it builds whatever it can from the radicals it has\n• Feed a furnace two different radicals to make compound kanji, e.g. 木 + 日 = 東\n• Check Dispatch Orders (top-left) for bonus ink\n• Press [C] to open the Codex and review learned kanji',
    hint: 'Click to close the tutorial. Have fun!',
  },
];

export class TutorialManager {
  private scene: Phaser.Scene;
  private currentStep = 0;
  private overlay?: Phaser.GameObjects.Container;
  private active = false;
  private stepCompleteCallback?: () => void;

  // Track what the player has done
  private extractorPlaced = false;
  private beltCount = 0;
  private furnacePlaced = false;
  private dispatchPlaced = false;
  private extractionSeen = false;
  private productionSeen = false;
  private shipSeen = false;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
  }

  isActive(): boolean {
    return this.active;
  }

  start(): void {
    this.active = true;
    this.currentStep = 0;
    this.showStep();
  }

  // Called by GameScene when machines/belts are placed
  notifyAction(action: string): void {
    if (!this.active) return;

    // Record progress unconditionally. Recording only while a step is waiting
    // on that action would ignore anything the player did during a narration
    // step, forcing them to redo it once the matching step appears.
    switch (action) {
      case 'place_extractor':
        this.extractorPlaced = true;
        break;
      case 'place_belt':
        this.beltCount++;
        break;
      case 'place_furnace':
        this.furnacePlaced = true;
        break;
      case 'place_dispatch':
        this.dispatchPlaced = true;
        break;
      case 'radical_extracted':
        this.extractionSeen = true;
        break;
      case 'kanji_produced':
        this.productionSeen = true;
        break;
      case 'kanji_shipped':
        this.shipSeen = true;
        break;
    }

    this.checkStepCompletion();
  }

  private checkStepCompletion(): void {
    const step = TUTORIAL_STEPS[this.currentStep];
    if (!step?.requiredAction) return;

    let done = false;
    switch (step.requiredAction) {
      case 'place_extractor': done = this.extractorPlaced; break;
      case 'place_belt': done = this.beltCount >= 2; break;
      case 'place_furnace': done = this.furnacePlaced; break;
      case 'place_dispatch': done = this.dispatchPlaced; break;
      case 'wait_extraction': done = this.extractionSeen; break;
      case 'wait_production': done = this.productionSeen; break;
      case 'wait_ship': done = this.shipSeen; break;
    }

    if (done) {
      // Reset belt count for next belt step
      if (step.requiredAction === 'place_belt') this.beltCount = 0;
      this.advanceStep();
    }
  }

  private advanceStep(): void {
    this.currentStep++;
    if (this.currentStep >= TUTORIAL_STEPS.length) {
      this.complete();
      return;
    }
    this.showStep();
  }

  private showStep(): void {
    this.clearOverlay();

    const step = TUTORIAL_STEPS[this.currentStep];
    const cam = this.scene.cameras.main;

    this.overlay = this.scene.add.container(0, 0).setScrollFactor(0).setDepth(3000);

    // Semi-transparent backdrop at bottom
    const panelH = 140;
    const panelY = cam.height - panelH - 10;
    const panelW = Math.min(700, cam.width - 40);
    const panelX = (cam.width - panelW) / 2;

    const bg = this.scene.add.rectangle(
      panelX + panelW / 2, panelY + panelH / 2,
      panelW, panelH,
      COLORS.SUMI_BLACK, 0.92
    ).setStrokeStyle(2, COLORS.GOLD);
    this.overlay.add(bg);

    // Step indicator
    const stepNum = `${this.currentStep + 1}/${TUTORIAL_STEPS.length}`;
    const stepText = this.scene.add.text(panelX + 15, panelY + 10, `Tutorial ${stepNum}`, {
      fontSize: '11px',
      color: '#c4a747',
      fontFamily: '"Noto Sans JP", sans-serif',
    });
    this.overlay.add(stepText);

    // Main message
    const msgText = this.scene.add.text(panelX + 15, panelY + 28, step.message, {
      fontSize: '14px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
      wordWrap: { width: panelW - 30 },
      lineSpacing: 4,
    });
    this.overlay.add(msgText);

    // Hint
    const hintText = this.scene.add.text(panelX + 15, panelY + panelH - 25, step.hint, {
      fontSize: '11px',
      color: '#8b7d6b',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'italic',
    });
    this.overlay.add(hintText);

    // If no required action, advance on click
    if (!step.requiredAction) {
      const clickZone = this.scene.add.rectangle(
        cam.width / 2, cam.height / 2,
        cam.width, cam.height,
        0x000000, 0.001
      ).setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.advanceStep());
      this.overlay.add(clickZone);

      // "Click to continue" indicator
      const contText = this.scene.add.text(panelX + panelW - 15, panelY + panelH - 25, '▶ Click to continue', {
        fontSize: '11px',
        color: '#c4a747',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(1, 0);
      this.overlay.add(contText);
      this.scene.tweens.add({ targets: contText, alpha: 0.4, duration: 600, yoyo: true, repeat: -1 });
    }

    // Skip button
    const skipBg = this.scene.add.rectangle(panelX + panelW - 50, panelY + 12, 70, 20, COLORS.SUMI_MEDIUM, 0.8)
      .setStrokeStyle(1, COLORS.SUMI_LIGHT)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.complete())
      .on('pointerover', () => skipBg.setFillStyle(COLORS.SUMI_LIGHT))
      .on('pointerout', () => skipBg.setFillStyle(COLORS.SUMI_MEDIUM));
    this.overlay.add(skipBg);
    this.overlay.add(this.scene.add.text(panelX + panelW - 50, panelY + 12, 'Skip ✕', {
      fontSize: '10px',
      color: '#f5f0e1',
      fontFamily: 'sans-serif',
    }).setOrigin(0.5));
  }

  private clearOverlay(): void {
    if (this.overlay) {
      this.overlay.destroy(true);
      this.overlay = undefined;
    }
  }

  private complete(): void {
    this.clearOverlay();
    this.active = false;
    // Mark tutorial as done in localStorage
    try { localStorage.setItem('sumi_kojo_tutorial_done', '1'); } catch { /* */ }
  }

  static hasCompleted(): boolean {
    try { return localStorage.getItem('sumi_kojo_tutorial_done') === '1'; } catch { return false; }
  }

  static reset(): void {
    try { localStorage.removeItem('sumi_kojo_tutorial_done'); } catch { /* */ }
  }

  destroy(): void {
    this.clearOverlay();
    this.active = false;
  }
}

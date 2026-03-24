import Phaser from 'phaser';
import { COLORS } from '../config';
import { GameState } from '../state/GameState';
import { SaveManager } from '../state/SaveManager';
import { ScrollCatalog } from '../data/ScrollCatalog';
import type { ScrollData } from '../types';

export class MainMenuScene extends Phaser.Scene {
  private scrollSelectPanel?: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, COLORS.SUMI_BLACK);

    // Decorative ink drops
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = 2 + Math.random() * 6;
      const alpha = 0.05 + Math.random() * 0.15;
      this.add.circle(x, y, size, COLORS.SUMI_MEDIUM, alpha);
    }

    // Title
    const titleJp = this.add.text(width / 2, height * 0.18, '墨工場', {
      fontSize: '72px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    const titleEn = this.add.text(width / 2, height * 0.30, 'Sumi Kōjō — Ink Factory', {
      fontSize: '20px',
      color: '#8b7d6b',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5).setAlpha(0);

    const subtitle = this.add.text(width / 2, height * 0.36, 'A kanji-learning factory simulation', {
      fontSize: '14px',
      color: '#4a3f35',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5).setAlpha(0);

    // Animate title
    this.tweens.add({ targets: titleJp, alpha: 1, y: titleJp.y - 10, duration: 800, ease: 'Power2' });
    this.tweens.add({ targets: titleEn, alpha: 1, duration: 800, delay: 300 });
    this.tweens.add({ targets: subtitle, alpha: 1, duration: 800, delay: 500 });

    // Menu buttons
    const hasSave = SaveManager.hasSave();
    const dueCount = GameState.getKanjiDueForReview().length;

    const buttons: { label: string; action: () => void; color?: number }[] = [];

    if (hasSave) {
      buttons.push({ label: '続ける Continue', action: () => this.continueGame() });
    }

    buttons.push({ label: '新規 New Game (Sandbox)', action: () => this.startSandbox() });
    buttons.push({ label: '巻物 Campaign Scrolls', action: () => this.showScrollSelect() });

    if (dueCount > 0) {
      buttons.push({
        label: `復習 Review (${dueCount} due)`,
        action: () => this.scene.start('SRSReviewScene'),
        color: COLORS.SKY,
      });
    } else {
      buttons.push({
        label: '復習 Review (none due)',
        action: () => this.scene.start('SRSReviewScene'),
      });
    }

    const menuY = height * 0.48;
    buttons.forEach((btn, i) => {
      const y = menuY + i * 50;
      const container = this.add.container(width / 2, y).setAlpha(0);

      const bg = this.add.rectangle(0, 0, 320, 40, COLORS.SUMI_DARK)
        .setStrokeStyle(2, COLORS.SUMI_MEDIUM)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', btn.action)
        .on('pointerover', () => {
          bg.setStrokeStyle(2, btn.color || COLORS.VERMILLION);
          label.setColor(btn.color ? '#7eb8da' : '#c53d43');
        })
        .on('pointerout', () => {
          bg.setStrokeStyle(2, COLORS.SUMI_MEDIUM);
          label.setColor('#f5f0e1');
        });

      const label = this.add.text(0, 0, btn.label, {
        fontSize: '16px',
        color: '#f5f0e1',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5);

      container.add([bg, label]);

      this.tweens.add({
        targets: container,
        alpha: 1,
        y: y - 5,
        duration: 600,
        delay: 700 + i * 120,
        ease: 'Power2',
      });
    });

    // Stats at bottom
    const unlocked = GameState.getAllUnlockedKanji().length;
    const completed = GameState.getCompletedScrolls().length;
    const totalScrolls = ScrollCatalog.getScrollCount();

    if (unlocked > 0) {
      this.add.text(width / 2, height * 0.88, `${unlocked} kanji unlocked  |  ${completed}/${totalScrolls} scrolls complete`, {
        fontSize: '12px',
        color: '#4a3f35',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5);
    }

    // Version
    this.add.text(width - 10, height - 10, 'v0.3.0', {
      fontSize: '10px',
      color: '#2d2520',
      fontFamily: 'sans-serif',
    }).setOrigin(1, 1);
  }

  private continueGame(): void {
    SaveManager.load();
    this.scene.start('GameScene');
  }

  private startSandbox(): void {
    GameState.reset();
    this.scene.start('GameScene');
  }

  private showScrollSelect(): void {
    if (this.scrollSelectPanel) {
      this.scrollSelectPanel.destroy();
      this.scrollSelectPanel = undefined;
      return;
    }

    const { width, height } = this.cameras.main;
    this.scrollSelectPanel = this.add.container(width / 2, height / 2);

    // Background
    const bg = this.add.rectangle(0, 0, 600, 420, COLORS.SUMI_DARK, 0.97)
      .setStrokeStyle(3, COLORS.VERMILLION)
      .setInteractive();
    this.scrollSelectPanel.add(bg);

    // Title
    this.scrollSelectPanel.add(this.add.text(0, -190, '巻物 Campaign Scrolls — Chapter 1: Foundations', {
      fontSize: '16px',
      color: '#c53d43',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    // Close button
    const closeBtn = this.add.text(280, -190, '✕', {
      fontSize: '22px',
      color: '#f5f0e1',
      fontFamily: 'sans-serif',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scrollSelectPanel?.destroy();
        this.scrollSelectPanel = undefined;
      })
      .on('pointerover', () => closeBtn.setColor('#c53d43'))
      .on('pointerout', () => closeBtn.setColor('#f5f0e1'));
    this.scrollSelectPanel.add(closeBtn);

    // Scroll cards
    const scrolls = ScrollCatalog.getScrollsByChapter(1);
    const cols = 3;
    const cardW = 170;
    const cardH = 140;
    const gap = 15;
    const startX = -((cols - 1) * (cardW + gap)) / 2;

    scrolls.forEach((scroll, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * (cardW + gap);
      const y = -100 + row * (cardH + gap);

      const completed = GameState.isScrollCompleted(scroll.id);
      const available = i === 0 || GameState.isScrollCompleted(scrolls[i - 1]?.id);

      const card = this.add.container(x, y);

      const cardBg = this.add.rectangle(0, 0, cardW, cardH,
        completed ? 0x2a3a2a : available ? COLORS.SUMI_MEDIUM : 0x1a1410
      ).setStrokeStyle(2, completed ? COLORS.JADE : available ? COLORS.SUMI_LIGHT : 0x2d2520);

      if (available) {
        cardBg.setInteractive({ useHandCursor: true })
          .on('pointerdown', () => this.startScroll(scroll))
          .on('pointerover', () => cardBg.setStrokeStyle(2, COLORS.VERMILLION))
          .on('pointerout', () => cardBg.setStrokeStyle(2, completed ? COLORS.JADE : COLORS.SUMI_LIGHT));
      }

      card.add(cardBg);

      // Scroll number
      card.add(this.add.text(0, -50, `${i + 1}`, {
        fontSize: '24px',
        color: completed ? '#68be8d' : available ? '#f5f0e1' : '#2d2520',
        fontFamily: '"Noto Sans JP", sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5));

      // Title
      card.add(this.add.text(0, -20, scroll.titleJp, {
        fontSize: '16px',
        color: completed ? '#68be8d' : available ? '#f5f0e1' : '#4a3f35',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5));

      card.add(this.add.text(0, 2, scroll.title, {
        fontSize: '11px',
        color: available ? '#8b7d6b' : '#2d2520',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5));

      // New kanji preview
      card.add(this.add.text(0, 28, scroll.newKanji.join(' '), {
        fontSize: '14px',
        color: available ? '#c4a747' : '#2d2520',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5));

      // Status
      const statusText = completed ? '✓ Complete' : available ? 'Available' : 'Locked';
      card.add(this.add.text(0, 52, statusText, {
        fontSize: '10px',
        color: completed ? '#68be8d' : available ? '#8b7d6b' : '#2d2520',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5));

      this.scrollSelectPanel!.add(card);
    });
  }

  private startScroll(scroll: ScrollData): void {
    this.scrollSelectPanel?.destroy();
    this.scrollSelectPanel = undefined;
    // Pass scroll data to GameScene
    this.scene.start('GameScene', { scroll });
  }
}

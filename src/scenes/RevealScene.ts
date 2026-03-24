import Phaser from 'phaser';
import { COLORS } from '../config';
import { GameState } from '../state/GameState';
import { SaveManager } from '../state/SaveManager';
import type { ScrollData } from '../types';

export class RevealScene extends Phaser.Scene {
  private scroll?: ScrollData;
  private stats?: { kanjiUnlocked: number; totalShipped: number; timePlayed: number };

  constructor() {
    super({ key: 'RevealScene' });
  }

  init(data: { scroll?: ScrollData; stats?: { kanjiUnlocked: number; totalShipped: number; timePlayed: number } }): void {
    this.scroll = data.scroll;
    this.stats = data.stats;
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Dark background
    this.add.rectangle(width / 2, height / 2, width, height, COLORS.SUMI_BLACK);

    // Scroll unfurling animation
    const scrollBg = this.add.rectangle(width / 2, height / 2, 0, 0, COLORS.WASHI_CREAM, 0.95)
      .setStrokeStyle(3, COLORS.SUMI_MEDIUM);

    // Unfurl animation
    this.tweens.add({
      targets: scrollBg,
      width: 600,
      height: 500,
      duration: 1200,
      ease: 'Back.easeOut',
      onComplete: () => this.showContent(),
    });

    // Ink drops floating
    for (let i = 0; i < 30; i++) {
      const drop = this.add.circle(
        Math.random() * width,
        height + 20,
        2 + Math.random() * 4,
        COLORS.SUMI_MEDIUM,
        0.2 + Math.random() * 0.3
      );
      this.tweens.add({
        targets: drop,
        y: -20,
        x: drop.x + (Math.random() - 0.5) * 100,
        alpha: 0,
        duration: 3000 + Math.random() * 4000,
        delay: Math.random() * 2000,
        repeat: -1,
      });
    }
  }

  private showContent(): void {
    const { width, height } = this.cameras.main;
    const cx = width / 2;
    const cy = height / 2;

    // Completion banner
    const title = this.add.text(cx, cy - 200, '巻物完成', {
      fontSize: '36px',
      color: '#c53d43',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    const subtitle = this.add.text(cx, cy - 160, 'Scroll Complete!', {
      fontSize: '18px',
      color: '#8b7d6b',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5).setAlpha(0);

    this.tweens.add({ targets: title, alpha: 1, y: title.y + 5, duration: 600, delay: 200 });
    this.tweens.add({ targets: subtitle, alpha: 1, duration: 600, delay: 400 });

    if (this.scroll) {
      // Scroll title
      const scrollTitle = this.add.text(cx, cy - 120,
        `${this.scroll.titleJp} — ${this.scroll.title}`, {
        fontSize: '20px',
        color: '#1a1410',
        fontFamily: '"Noto Sans JP", sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({ targets: scrollTitle, alpha: 1, duration: 600, delay: 600 });

      // The source text — now readable!
      const sourceText = this.add.text(cx, cy - 40, this.scroll.sourceText, {
        fontSize: '18px',
        color: '#1a1410',
        fontFamily: '"Noto Sans JP", sans-serif',
        wordWrap: { width: 500 },
        lineSpacing: 8,
        align: 'center',
      }).setOrigin(0.5, 0).setAlpha(0);

      this.tweens.add({ targets: sourceText, alpha: 1, duration: 800, delay: 800 });

      // Translation
      if (this.scroll.translation) {
        const transText = this.add.text(cx, cy + 40, this.scroll.translation, {
          fontSize: '13px',
          color: '#4a3f35',
          fontFamily: '"Noto Sans JP", sans-serif',
          wordWrap: { width: 500 },
          lineSpacing: 4,
          align: 'center',
          fontStyle: 'italic',
        }).setOrigin(0.5, 0).setAlpha(0);

        this.tweens.add({ targets: transText, alpha: 1, duration: 600, delay: 1200 });
      }

      // Cultural note
      if (this.scroll.culturalNote) {
        const noteText = this.add.text(cx, cy + 100, this.scroll.culturalNote, {
          fontSize: '11px',
          color: '#8b7d6b',
          fontFamily: '"Noto Sans JP", sans-serif',
          wordWrap: { width: 480 },
          lineSpacing: 3,
          align: 'center',
        }).setOrigin(0.5, 0).setAlpha(0);

        this.tweens.add({ targets: noteText, alpha: 1, duration: 600, delay: 1600 });
      }

      // Kanji unlocked in this scroll
      const kanjiLine = this.scroll.newKanji.join('  ');
      const kanjiText = this.add.text(cx, cy + 160, kanjiLine, {
        fontSize: '24px',
        color: '#c4a747',
        fontFamily: '"Noto Sans JP", sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({ targets: kanjiText, alpha: 1, duration: 600, delay: 1800 });
    }

    // Stats card
    if (this.stats) {
      const statsY = cy + 190;
      const mins = Math.floor(this.stats.timePlayed / 60);
      const statsLine = `Kanji unlocked: ${this.stats.kanjiUnlocked}  |  Shipped: ${this.stats.totalShipped}  |  Time: ${mins}m`;
      const statsText = this.add.text(cx, statsY, statsLine, {
        fontSize: '12px',
        color: '#8b7d6b',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5).setAlpha(0);

      this.tweens.add({ targets: statsText, alpha: 1, duration: 600, delay: 2000 });
    }

    // Continue button
    const btnY = cy + 220;
    const btn = this.add.container(cx, btnY).setAlpha(0);
    const bg = this.add.rectangle(0, 0, 240, 42, COLORS.VERMILLION)
      .setStrokeStyle(2, COLORS.SUMI_LIGHT)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        if (this.scroll) {
          GameState.completeScroll(this.scroll.id);
          SaveManager.save();
        }
        this.scene.start('MainMenuScene');
      })
      .on('pointerover', () => bg.setFillStyle(0xe04e55))
      .on('pointerout', () => bg.setFillStyle(COLORS.VERMILLION));
    btn.add([bg, this.add.text(0, 0, '次へ Continue', {
      fontSize: '16px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5)]);

    this.tweens.add({ targets: btn, alpha: 1, duration: 600, delay: 2400 });
  }
}

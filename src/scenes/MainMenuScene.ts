import Phaser from 'phaser';
import { COLORS } from '../config';
import { GameState } from '../state/GameState';
import { SaveManager } from '../state/SaveManager';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super({ key: 'MainMenuScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, COLORS.SUMI_BLACK);

    // Decorative ink drops (particle-like)
    for (let i = 0; i < 20; i++) {
      const x = Math.random() * width;
      const y = Math.random() * height;
      const size = 2 + Math.random() * 6;
      const alpha = 0.05 + Math.random() * 0.15;
      this.add.circle(x, y, size, COLORS.SUMI_MEDIUM, alpha);
    }

    // Title
    const titleJp = this.add.text(width / 2, height * 0.22, '墨工場', {
      fontSize: '72px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5).setAlpha(0);

    const titleEn = this.add.text(width / 2, height * 0.35, 'Sumi Kōjō — Ink Factory', {
      fontSize: '20px',
      color: '#8b7d6b',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5).setAlpha(0);

    const subtitle = this.add.text(width / 2, height * 0.42, 'A kanji-learning factory simulation', {
      fontSize: '14px',
      color: '#4a3f35',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5).setAlpha(0);

    // Animate title in
    this.tweens.add({ targets: titleJp, alpha: 1, y: titleJp.y - 10, duration: 800, ease: 'Power2' });
    this.tweens.add({ targets: titleEn, alpha: 1, duration: 800, delay: 300 });
    this.tweens.add({ targets: subtitle, alpha: 1, duration: 800, delay: 500 });

    // Menu buttons
    const hasSave = SaveManager.hasSave();
    const buttons = [
      ...(hasSave ? [{ label: '続ける Continue', action: () => this.continueGame() }] : []),
      { label: '新規 New Game', action: () => this.newGame() },
      { label: '遊ぶ Sandbox Mode', action: () => this.startSandbox() },
    ];

    const menuY = height * 0.58;
    buttons.forEach((btn, i) => {
      const y = menuY + i * 55;
      const container = this.add.container(width / 2, y).setAlpha(0);

      const bg = this.add.rectangle(0, 0, 300, 44, COLORS.SUMI_DARK)
        .setStrokeStyle(2, COLORS.SUMI_MEDIUM)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', btn.action)
        .on('pointerover', () => {
          bg.setStrokeStyle(2, COLORS.VERMILLION);
          label.setColor('#c53d43');
        })
        .on('pointerout', () => {
          bg.setStrokeStyle(2, COLORS.SUMI_MEDIUM);
          label.setColor('#f5f0e1');
        });

      const label = this.add.text(0, 0, btn.label, {
        fontSize: '18px',
        color: '#f5f0e1',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5);

      container.add([bg, label]);

      this.tweens.add({
        targets: container,
        alpha: 1,
        y: y - 5,
        duration: 600,
        delay: 700 + i * 150,
        ease: 'Power2',
      });
    });

    // Stats at bottom if save exists
    if (hasSave) {
      const unlocked = GameState.getAllUnlockedKanji().length;
      const statsText = this.add.text(width / 2, height * 0.9, `${unlocked} kanji unlocked`, {
        fontSize: '12px',
        color: '#4a3f35',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5);
    }

    // Version
    this.add.text(width - 10, height - 10, 'v0.2.0', {
      fontSize: '10px',
      color: '#2d2520',
      fontFamily: 'sans-serif',
    }).setOrigin(1, 1);
  }

  private continueGame(): void {
    SaveManager.load();
    this.scene.start('GameScene');
  }

  private newGame(): void {
    GameState.reset();
    this.scene.start('GameScene');
  }

  private startSandbox(): void {
    // Sandbox mode = same as new game for now, just start fresh
    GameState.reset();
    this.scene.start('GameScene');
  }
}

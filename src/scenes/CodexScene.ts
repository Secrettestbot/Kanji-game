import Phaser from 'phaser';
import { COLORS } from '../config';
import { GameState } from '../state/GameState';
import { DataManager } from '../data/DataManager';
import type { KanjiData } from '../types';

export class CodexScene extends Phaser.Scene {
  private panel!: Phaser.GameObjects.Container;
  private entries: Phaser.GameObjects.Container[] = [];
  private detailPanel!: Phaser.GameObjects.Container;
  private scrollY = 0;
  private entriesContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'CodexScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Dark overlay
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setInteractive();

    // Main panel
    this.panel = this.add.container(width / 2, height / 2);

    const panelBg = this.add.rectangle(0, 0, 700, 500, COLORS.SUMI_DARK, 0.95)
      .setStrokeStyle(3, COLORS.INDIGO);
    this.panel.add(panelBg);

    // Title
    const title = this.add.text(0, -230, '図鑑 Codex — Kanji Encyclopedia', {
      fontSize: '20px',
      color: '#7eb8da',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.panel.add(title);

    // Close button
    const closeBtn = this.add.text(330, -230, '✕', {
      fontSize: '24px',
      color: '#f5f0e1',
      fontFamily: 'sans-serif',
    }).setOrigin(0.5).setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.closeCodex())
      .on('pointerover', () => closeBtn.setColor('#c53d43'))
      .on('pointerout', () => closeBtn.setColor('#f5f0e1'));
    this.panel.add(closeBtn);

    // Stats bar
    const unlocked = GameState.getAllUnlockedKanji();
    const total = DataManager.getAllKanji().length;
    const statsText = this.add.text(0, -200, `Unlocked: ${unlocked.length} / ${total}`, {
      fontSize: '14px',
      color: '#c4a747',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5);
    this.panel.add(statsText);

    // Entries container (scrollable area)
    this.entriesContainer = this.add.container(-320, -170);
    this.panel.add(this.entriesContainer);

    // Detail panel (right side)
    this.detailPanel = this.add.container(170, 30);
    this.panel.add(this.detailPanel);

    // Populate entries
    this.populateEntries(unlocked);

    // Keyboard
    this.input.keyboard?.on('keydown-ESC', () => this.closeCodex());
    this.input.keyboard?.on('keydown-C', () => this.closeCodex());

    // Scroll
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gx: number[], _gy: number[], _gz: number[], deltaY: number) => {
      this.scrollY = Phaser.Math.Clamp(this.scrollY - deltaY * 0.5, -Math.max(0, unlocked.length * 45 - 380), 0);
      this.entriesContainer.setY(-170 + this.scrollY);
    });
  }

  private populateEntries(unlocked: string[]): void {
    // Clear
    for (const e of this.entries) e.destroy();
    this.entries = [];

    if (unlocked.length === 0) {
      const emptyText = this.add.text(160, 100, 'No kanji unlocked yet.\nBuild a factory and pass\nPronunciation Gates to fill the Codex!', {
        fontSize: '14px',
        color: '#8b7d6b',
        fontFamily: '"Noto Sans JP", sans-serif',
        align: 'center',
        lineSpacing: 6,
      }).setOrigin(0.5);
      this.entriesContainer.add(emptyText);
      return;
    }

    unlocked.forEach((char, i) => {
      const kanjiData = DataManager.getKanji(char);
      const entry = GameState.getCodexEntry(char);
      const y = i * 45;

      const container = this.add.container(0, y);

      const bg = this.add.rectangle(80, 0, 160, 40, COLORS.SUMI_MEDIUM)
        .setStrokeStyle(1, COLORS.SUMI_LIGHT)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.showDetail(char))
        .on('pointerover', () => bg.setFillStyle(COLORS.SUMI_LIGHT))
        .on('pointerout', () => bg.setFillStyle(COLORS.SUMI_MEDIUM));

      const kanjiText = this.add.text(20, 0, char, {
        fontSize: '24px',
        color: '#f5f0e1',
        fontFamily: '"Noto Sans JP", sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5);

      const meaningText = this.add.text(90, -6, kanjiData?.meanings[0] || '?', {
        fontSize: '12px',
        color: '#f5f0e1',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0, 0.5);

      const srsTier = entry?.srsTier || 1;
      const srsLabel = ['', '●', '●●', '●●●'][srsTier];
      const srsText = this.add.text(90, 8, srsLabel, {
        fontSize: '10px',
        color: srsTier >= 3 ? '#68be8d' : srsTier >= 2 ? '#c4a747' : '#8b7d6b',
        fontFamily: 'sans-serif',
      });

      container.add([bg, kanjiText, meaningText, srsText]);
      this.entriesContainer.add(container);
      this.entries.push(container);
    });

    // Auto-show first entry detail
    if (unlocked.length > 0) {
      this.showDetail(unlocked[0]);
    }
  }

  private showDetail(character: string): void {
    // Clear detail panel
    this.detailPanel.removeAll(true);

    const kanjiData = DataManager.getKanji(character);
    const entry = GameState.getCodexEntry(character);
    if (!kanjiData) return;

    // Large kanji
    const kanjiDisplay = this.add.text(0, -120, character, {
      fontSize: '80px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.detailPanel.add(kanjiDisplay);

    // Meanings
    const meanings = this.add.text(0, -50, kanjiData.meanings.join(', '), {
      fontSize: '16px',
      color: '#c4a747',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.detailPanel.add(meanings);

    // Readings
    const onyomi = kanjiData.onyomi.length > 0 ? `On: ${kanjiData.onyomi.join(', ')}` : '';
    const kunyomi = kanjiData.kunyomi.length > 0 ? `Kun: ${kanjiData.kunyomi.join(', ')}` : '';
    const readingsText = [onyomi, kunyomi].filter(Boolean).join('\n');
    const readings = this.add.text(0, -15, readingsText, {
      fontSize: '14px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
      lineSpacing: 4,
      align: 'center',
    }).setOrigin(0.5, 0);
    this.detailPanel.add(readings);

    // Radicals
    const radicalsLabel = this.add.text(0, 35, `Radicals: ${kanjiData.radicals.join(' + ')}`, {
      fontSize: '13px',
      color: '#68be8d',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5);
    this.detailPanel.add(radicalsLabel);

    // JLPT & Strokes
    const meta = this.add.text(0, 60, `JLPT N${kanjiData.jlptLevel}  |  ${kanjiData.strokeCount} strokes`, {
      fontSize: '12px',
      color: '#8b7d6b',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5);
    this.detailPanel.add(meta);

    // Etymology
    if (kanjiData.etymology) {
      const etym = this.add.text(0, 90, kanjiData.etymology, {
        fontSize: '11px',
        color: '#8b7d6b',
        fontFamily: '"Noto Sans JP", sans-serif',
        wordWrap: { width: 280 },
        lineSpacing: 3,
        align: 'center',
      }).setOrigin(0.5, 0);
      this.detailPanel.add(etym);
    }

    // SRS info
    if (entry) {
      const srsInfo = this.add.text(0, 150, `SRS Tier ${entry.srsTier}  |  Reviewed ${entry.timesReviewed}x  |  Interval: ${entry.srsInterval}d`, {
        fontSize: '11px',
        color: '#7eb8da',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5);
      this.detailPanel.add(srsInfo);
    }

    // Related words
    const words = DataManager.getWordsForKanji(character).slice(0, 3);
    if (words.length > 0) {
      const wordsTitle = this.add.text(0, 175, 'Related Words:', {
        fontSize: '12px',
        color: '#c4a747',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5);
      this.detailPanel.add(wordsTitle);

      words.forEach((w, i) => {
        const wordText = this.add.text(0, 195 + i * 18, `${w.word} (${w.reading}) — ${w.meanings[0]}`, {
          fontSize: '11px',
          color: '#f5f0e1',
          fontFamily: '"Noto Sans JP", sans-serif',
        }).setOrigin(0.5);
        this.detailPanel.add(wordText);
      });
    }
  }

  private closeCodex(): void {
    this.scene.resume('GameScene');
    this.scene.stop();
  }
}

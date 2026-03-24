import Phaser from 'phaser';
import { COLORS } from '../config';
import { GameState } from '../state/GameState';
import { DataManager } from '../data/DataManager';
import { romajiToHiragana, romajiToKatakana, isKana } from '../systems/RomajiConverter';
import { SaveManager } from '../state/SaveManager';
import type { KanjiData } from '../types';

enum ReviewPhase {
  PROMPT,    // Show kanji, wait for answer
  FEEDBACK,  // Show correct/incorrect
  SUMMARY,   // Session summary
}

interface ReviewItem {
  character: string;
  kanjiData: KanjiData;
  answered: boolean;
  correct: boolean;
}

export class SRSReviewScene extends Phaser.Scene {
  private reviewItems: ReviewItem[] = [];
  private currentIndex = 0;
  private phase = ReviewPhase.PROMPT;
  private correctCount = 0;
  private totalCount = 0;

  // UI
  private panel!: Phaser.GameObjects.Container;
  private kanjiDisplay!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private inputText = '';
  private inputDisplay!: Phaser.GameObjects.Text;
  private inputBg!: Phaser.GameObjects.Rectangle;
  private progressText!: Phaser.GameObjects.Text;
  private optionButtons: Phaser.GameObjects.Container[] = [];

  constructor() {
    super({ key: 'SRSReviewScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Build review queue
    const dueKanji = GameState.getKanjiDueForReview();
    this.reviewItems = [];
    for (const char of dueKanji.slice(0, 20)) { // Max 20 per session
      const kanjiData = DataManager.getKanji(char);
      if (kanjiData) {
        this.reviewItems.push({
          character: char,
          kanjiData,
          answered: false,
          correct: false,
        });
      }
    }

    this.currentIndex = 0;
    this.correctCount = 0;
    this.totalCount = this.reviewItems.length;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, COLORS.SUMI_BLACK, 0.95)
      .setInteractive();

    // Panel
    this.panel = this.add.container(width / 2, height / 2);

    const panelBg = this.add.rectangle(0, 0, 520, 450, COLORS.SUMI_DARK, 0.95)
      .setStrokeStyle(3, COLORS.SKY);
    this.panel.add(panelBg);

    // Title
    this.panel.add(this.add.text(0, -200, '復習 SRS Review', {
      fontSize: '20px',
      color: '#7eb8da',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    // Progress
    this.progressText = this.add.text(0, -175, '', {
      fontSize: '12px',
      color: '#8b7d6b',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5);
    this.panel.add(this.progressText);

    // Kanji display
    this.kanjiDisplay = this.add.text(0, -100, '', {
      fontSize: '72px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.panel.add(this.kanjiDisplay);

    // Prompt
    this.promptText = this.add.text(0, -30, '', {
      fontSize: '16px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5);
    this.panel.add(this.promptText);

    // Input
    this.inputBg = this.add.rectangle(0, 20, 300, 40, COLORS.SUMI_MEDIUM)
      .setStrokeStyle(2, COLORS.SUMI_LIGHT).setVisible(false);
    this.panel.add(this.inputBg);

    this.inputDisplay = this.add.text(0, 20, '', {
      fontSize: '20px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5).setVisible(false);
    this.panel.add(this.inputDisplay);

    // Feedback
    this.feedbackText = this.add.text(0, 160, '', {
      fontSize: '14px',
      color: '#c4a747',
      fontFamily: '"Noto Sans JP", sans-serif',
      align: 'center',
      lineSpacing: 4,
    }).setOrigin(0.5);
    this.panel.add(this.feedbackText);

    // Keyboard
    this.input.keyboard?.on('keydown', this.handleKeyDown, this);
    this.input.keyboard?.on('keydown-ESC', () => this.exitReview());

    if (this.reviewItems.length === 0) {
      this.showEmpty();
    } else {
      this.showNextItem();
    }
  }

  private showEmpty(): void {
    this.kanjiDisplay.setText('✓');
    this.promptText.setText('No kanji due for review!');
    this.feedbackText.setText('Come back later or unlock more kanji.');
    this.createButton('Return', 80, () => this.exitReview());
  }

  private showNextItem(): void {
    if (this.currentIndex >= this.reviewItems.length) {
      this.showSummary();
      return;
    }

    this.phase = ReviewPhase.PROMPT;
    this.inputText = '';
    this.clearButtons();

    const item = this.reviewItems[this.currentIndex];
    this.kanjiDisplay.setText(item.character);
    this.progressText.setText(`${this.currentIndex + 1} / ${this.totalCount}  |  ✓ ${this.correctCount}`);

    // Alternate between meaning and reading questions
    const askReading = this.currentIndex % 2 === 0;

    if (askReading) {
      this.promptText.setText('Type the reading (romaji):');
      this.inputBg.setVisible(true);
      this.inputDisplay.setVisible(true).setText('_');
      this.feedbackText.setText('Press Enter to submit');
    } else {
      this.promptText.setText('What does this kanji mean?');
      this.inputBg.setVisible(false);
      this.inputDisplay.setVisible(false);

      // Multiple choice
      const correctMeaning = item.kanjiData.meanings[0];
      const distractors = this.getDistractorMeanings(correctMeaning, 3);
      const options = this.shuffleArray([correctMeaning, ...distractors]);

      options.forEach((option, i) => {
        this.createButton(option, i * 42, () => {
          const correct = option === correctMeaning;
          this.handleAnswer(correct);
        });
      });

      this.feedbackText.setText('');
    }
  }

  private handleAnswer(correct: boolean): void {
    const item = this.reviewItems[this.currentIndex];
    item.answered = true;
    item.correct = correct;

    if (correct) {
      this.correctCount++;
      GameState.updateSRS(item.character, true);
      GameState.addInkPoints(1); // SRS reward
    } else {
      GameState.updateSRS(item.character, false);
    }

    this.phase = ReviewPhase.FEEDBACK;
    this.clearButtons();
    this.inputBg.setVisible(false);
    this.inputDisplay.setVisible(false);

    const readings = [
      ...item.kanjiData.onyomi.map(r => `${r} (on)`),
      ...item.kanjiData.kunyomi.map(r => `${r} (kun)`),
    ].join(', ');

    if (correct) {
      this.feedbackText.setText('✓ Correct!').setColor('#68be8d');
    } else {
      this.feedbackText.setText(
        `✕ Incorrect\n${item.character}: ${item.kanjiData.meanings[0]}\nReadings: ${readings}`
      ).setColor('#c53d43');
    }

    this.createButton('Next →', 100, () => {
      this.currentIndex++;
      this.showNextItem();
    });
  }

  private showSummary(): void {
    this.phase = ReviewPhase.SUMMARY;
    this.clearButtons();
    this.inputBg.setVisible(false);
    this.inputDisplay.setVisible(false);

    const pct = this.totalCount > 0 ? Math.round((this.correctCount / this.totalCount) * 100) : 0;

    this.kanjiDisplay.setText(`${pct}%`);
    this.promptText.setText('Review Complete!');
    this.progressText.setText(`${this.correctCount} / ${this.totalCount} correct`);

    const grade = pct >= 90 ? 'Excellent!' : pct >= 70 ? 'Good work!' : pct >= 50 ? 'Keep practicing!' : 'Review more often!';
    this.feedbackText.setText(`${grade}\n+${this.correctCount} ink points earned`).setColor('#c4a747');

    this.createButton('Return to Menu', 100, () => this.exitReview());
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.phase !== ReviewPhase.PROMPT) return;
    if (this.currentIndex % 2 !== 0) return; // Only for reading questions

    if (event.key === 'Enter') {
      this.submitReading();
    } else if (event.key === 'Backspace') {
      this.inputText = this.inputText.slice(0, -1);
      this.inputDisplay.setText(this.inputText || '_');
    } else if (event.key.length === 1 && /[a-zA-Z\-]/.test(event.key)) {
      this.inputText += event.key.toLowerCase();
      this.inputDisplay.setText(this.inputText);
    }
  };

  private submitReading(): void {
    if (!this.inputText.trim()) return;

    const item = this.reviewItems[this.currentIndex];
    const hiraganaInput = isKana(this.inputText) ? this.inputText : romajiToHiragana(this.inputText);
    const katakanaInput = isKana(this.inputText) ? this.inputText : romajiToKatakana(this.inputText);

    const allReadings = [
      ...(item.kanjiData.onyomi || []),
      ...(item.kanjiData.kunyomi || []),
    ].map(r => r.replace(/\./g, ''));

    const correct = allReadings.some(r =>
      r === hiraganaInput || r === katakanaInput || r === this.inputText.toLowerCase()
    );

    this.handleAnswer(correct);
  }

  private exitReview(): void {
    SaveManager.save();
    this.scene.start('MainMenuScene');
  }

  // ─── UI Helpers ───

  private createButton(text: string, y: number, onClick: () => void): void {
    const container = this.add.container(0, y);
    const bg = this.add.rectangle(0, 0, 340, 34, COLORS.SUMI_MEDIUM)
      .setStrokeStyle(1, COLORS.SUMI_LIGHT)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick)
      .on('pointerover', () => bg.setFillStyle(COLORS.SUMI_LIGHT))
      .on('pointerout', () => bg.setFillStyle(COLORS.SUMI_MEDIUM));

    const label = this.add.text(0, 0, text, {
      fontSize: '14px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5);

    container.add([bg, label]);
    this.panel.add(container);
    this.optionButtons.push(container);
  }

  private clearButtons(): void {
    for (const btn of this.optionButtons) btn.destroy();
    this.optionButtons = [];
  }

  private getDistractorMeanings(correct: string, count: number): string[] {
    const allKanji = DataManager.getAllKanji();
    const distractors: string[] = [];
    const shuffled = [...allKanji].sort(() => Math.random() - 0.5);
    for (const k of shuffled) {
      if (distractors.length >= count) break;
      const meaning = k.meanings[0];
      if (meaning && meaning !== correct && !distractors.includes(meaning)) {
        distractors.push(meaning);
      }
    }
    while (distractors.length < count) {
      distractors.push(['energy', 'spirit', 'thought'][distractors.length] || 'unknown');
    }
    return distractors;
  }

  private shuffleArray<T>(arr: T[]): T[] {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }
}

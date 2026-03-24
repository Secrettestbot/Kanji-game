import Phaser from 'phaser';
import { COLORS } from '../config';
import { DataManager } from '../data/DataManager';
import { romajiToHiragana, romajiToKatakana, isKana } from '../systems/RomajiConverter';
import type { KanjiData } from '../types';

interface GateData {
  kanji: string;
  kanjiData?: KanjiData;
}

enum QuizPhase {
  MEANING,      // Multiple choice: pick the meaning
  READING,      // Type the reading in romaji
  RESULT,       // Show result
}

export class PronunciationGateScene extends Phaser.Scene {
  private kanji = '';
  private kanjiData?: KanjiData;
  private phase = QuizPhase.MEANING;
  private attempts = 0;
  private maxAttempts = 3;
  private passed = false;

  // UI elements
  private overlay!: Phaser.GameObjects.Rectangle;
  private panel!: Phaser.GameObjects.Container;
  private kanjiDisplay!: Phaser.GameObjects.Text;
  private promptText!: Phaser.GameObjects.Text;
  private feedbackText!: Phaser.GameObjects.Text;
  private optionButtons: Phaser.GameObjects.Container[] = [];

  // Reading input
  private inputText = '';
  private inputDisplay!: Phaser.GameObjects.Text;
  private inputBg!: Phaser.GameObjects.Rectangle;

  constructor() {
    super({ key: 'PronunciationGateScene' });
  }

  init(data: GateData): void {
    this.kanji = data.kanji;
    this.kanjiData = data.kanjiData || DataManager.getKanji(data.kanji);
    this.phase = QuizPhase.MEANING;
    this.attempts = 0;
    this.passed = false;
    this.inputText = '';
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Dark overlay
    this.overlay = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
      .setInteractive(); // Block clicks through

    // Central panel
    this.panel = this.add.container(width / 2, height / 2);

    const panelBg = this.add.rectangle(0, 0, 500, 420, COLORS.SUMI_DARK, 0.95)
      .setStrokeStyle(3, COLORS.VERMILLION);
    this.panel.add(panelBg);

    // Title
    const titleText = this.add.text(0, -185, '門 Pronunciation Gate', {
      fontSize: '18px',
      color: '#c53d43',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.panel.add(titleText);

    // Kanji display (large)
    this.kanjiDisplay = this.add.text(0, -120, this.kanji, {
      fontSize: '72px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.panel.add(this.kanjiDisplay);

    // Prompt
    this.promptText = this.add.text(0, -55, '', {
      fontSize: '16px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5);
    this.panel.add(this.promptText);

    // Feedback text
    this.feedbackText = this.add.text(0, 170, '', {
      fontSize: '14px',
      color: '#c4a747',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5);
    this.panel.add(this.feedbackText);

    // Input display (for reading phase)
    this.inputBg = this.add.rectangle(0, 10, 300, 40, COLORS.SUMI_MEDIUM)
      .setStrokeStyle(2, COLORS.SUMI_LIGHT)
      .setVisible(false);
    this.panel.add(this.inputBg);

    this.inputDisplay = this.add.text(0, 10, '', {
      fontSize: '20px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5).setVisible(false);
    this.panel.add(this.inputDisplay);

    // Setup keyboard input
    this.input.keyboard?.on('keydown', this.handleKeyDown, this);

    // Start with meaning quiz
    this.showMeaningQuiz();
  }

  private showMeaningQuiz(): void {
    this.phase = QuizPhase.MEANING;
    this.promptText.setText('What does this kanji mean?');
    this.feedbackText.setText(`Attempt ${this.attempts + 1} of ${this.maxAttempts}`);
    this.inputBg.setVisible(false);
    this.inputDisplay.setVisible(false);

    // Clear old buttons
    this.clearOptions();

    if (!this.kanjiData) {
      this.endGate(false);
      return;
    }

    // Generate 4 options: 1 correct + 3 distractors
    const correctMeaning = this.kanjiData.meanings[0];
    const distractors = this.getDistractorMeanings(correctMeaning, 3);
    const options = this.shuffleArray([correctMeaning, ...distractors]);

    options.forEach((option, i) => {
      const y = -10 + i * 45;
      this.createOptionButton(option, y, option === correctMeaning, () => {
        if (option === correctMeaning) {
          this.feedbackText.setText('Correct!').setColor('#68be8d');
          this.time.delayedCall(800, () => this.showReadingQuiz());
        } else {
          this.attempts++;
          if (this.attempts >= this.maxAttempts) {
            this.showReveal();
          } else {
            this.feedbackText.setText(`Incorrect. Try again! (${this.attempts}/${this.maxAttempts})`).setColor('#c53d43');
          }
        }
      });
    });
  }

  private showReadingQuiz(): void {
    this.phase = QuizPhase.READING;
    this.clearOptions();
    this.inputText = '';

    const reading = this.kanjiData?.onyomi?.[0] || this.kanjiData?.kunyomi?.[0] || '';
    this.promptText.setText(`Type the reading in romaji (e.g., "${reading}")`);
    this.feedbackText.setText('Press Enter to submit');

    this.inputBg.setVisible(true);
    this.inputDisplay.setVisible(true).setText('_');

    // Submit button
    this.createOptionButton('Submit (Enter)', 70, false, () => this.submitReading());
  }

  private submitReading(): void {
    if (!this.inputText.trim()) return;

    const hiraganaInput = isKana(this.inputText) ? this.inputText : romajiToHiragana(this.inputText);
    const katakanaInput = isKana(this.inputText) ? this.inputText : romajiToKatakana(this.inputText);

    const allReadings = [
      ...(this.kanjiData?.onyomi || []),
      ...(this.kanjiData?.kunyomi || []),
    ];

    // Normalize readings: remove dots from kunyomi readings (e.g., やす.む → やすむ)
    const normalizedReadings = allReadings.map(r => r.replace(/\./g, ''));

    const correct = normalizedReadings.some(r =>
      r === hiraganaInput || r === katakanaInput || r === this.inputText.toLowerCase()
    );

    if (correct) {
      this.passed = true;
      this.feedbackText.setText('Correct! Well done!').setColor('#68be8d');
      this.time.delayedCall(1000, () => this.endGate(true));
    } else {
      this.attempts++;
      if (this.attempts >= this.maxAttempts) {
        this.showReveal();
      } else {
        this.feedbackText.setText(
          `Not quite. Try again! (${this.attempts}/${this.maxAttempts})`
        ).setColor('#c53d43');
        this.inputText = '';
        this.inputDisplay.setText('_');
      }
    }
  }

  private showReveal(): void {
    this.phase = QuizPhase.RESULT;
    this.clearOptions();
    this.inputBg.setVisible(false);
    this.inputDisplay.setVisible(false);

    const readings = [
      ...(this.kanjiData?.onyomi || []).map(r => `${r} (on)`),
      ...(this.kanjiData?.kunyomi || []).map(r => `${r} (kun)`),
    ].join(', ');

    const meanings = this.kanjiData?.meanings?.join(', ') || '?';

    this.promptText.setText(
      `${this.kanji}\nMeanings: ${meanings}\nReadings: ${readings}`
    ).setLineSpacing(8);

    this.feedbackText.setText('Study this kanji and try again next time.').setColor('#c4a747');

    this.createOptionButton('Continue', 80, false, () => this.endGate(false));
  }

  private endGate(passed: boolean): void {
    // Emit result to GameScene
    const gameScene = this.scene.get('GameScene');
    gameScene.events.emit('gate-result', { passed, kanji: this.kanji });

    // Resume game and stop this overlay
    this.scene.resume('GameScene');
    this.scene.stop();
  }

  private handleKeyDown = (event: KeyboardEvent): void => {
    if (this.phase !== QuizPhase.READING) return;

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

  // ─── UI Helpers ───

  private createOptionButton(text: string, y: number, _isCorrect: boolean, onClick: () => void): void {
    const container = this.add.container(0, y);

    const bg = this.add.rectangle(0, 0, 360, 36, COLORS.SUMI_MEDIUM)
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

  private clearOptions(): void {
    for (const btn of this.optionButtons) {
      btn.destroy();
    }
    this.optionButtons = [];
  }

  private getDistractorMeanings(correct: string, count: number): string[] {
    const allKanji = DataManager.getAllKanji();
    const distractors: string[] = [];

    const shuffled = this.shuffleArray([...allKanji]);
    for (const k of shuffled) {
      if (distractors.length >= count) break;
      const meaning = k.meanings[0];
      if (meaning && meaning !== correct && !distractors.includes(meaning)) {
        distractors.push(meaning);
      }
    }

    // Fill with fallback if not enough
    while (distractors.length < count) {
      distractors.push(['energy', 'spirit', 'thought', 'movement', 'light'][distractors.length] || 'unknown');
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

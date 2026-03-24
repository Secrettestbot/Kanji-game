import Phaser from 'phaser';
import { COLORS } from '../config';
import { DocumentAnalyzer, AnalysisResult } from '../pmg/DocumentAnalyzer';
import { MapGenerator } from '../pmg/MapGenerator';

export class CustomModeScene extends Phaser.Scene {
  private inputElement?: HTMLTextAreaElement;
  private analysis?: AnalysisResult;
  private panel!: Phaser.GameObjects.Container;
  private summaryContainer!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'CustomModeScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, COLORS.SUMI_BLACK);

    this.panel = this.add.container(width / 2, height / 2);

    // Panel background
    const panelBg = this.add.rectangle(0, 0, 650, 500, COLORS.SUMI_DARK, 0.95)
      .setStrokeStyle(3, COLORS.VERMILLION);
    this.panel.add(panelBg);

    // Title
    this.panel.add(this.add.text(0, -230, '自由 Custom Mode — Paste Japanese Text', {
      fontSize: '18px',
      color: '#c53d43',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    // Instructions
    this.panel.add(this.add.text(0, -200, 'Paste any Japanese text below. The game will analyze it and generate a factory map.', {
      fontSize: '12px',
      color: '#8b7d6b',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5));

    // Create HTML textarea for text input (Phaser doesn't have native text areas)
    this.createTextInput(width, height);

    // Analyze button
    const analyzeBtn = this.add.container(0, 40);
    const analyzeBg = this.add.rectangle(0, 0, 200, 38, COLORS.VERMILLION)
      .setStrokeStyle(2, COLORS.SUMI_LIGHT)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.analyzeText())
      .on('pointerover', () => analyzeBg.setFillStyle(0xe04e55))
      .on('pointerout', () => analyzeBg.setFillStyle(COLORS.VERMILLION));
    const analyzeLabel = this.add.text(0, 0, '分析 Analyze', {
      fontSize: '16px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    analyzeBtn.add([analyzeBg, analyzeLabel]);
    this.panel.add(analyzeBtn);

    // Summary container (populated after analysis)
    this.summaryContainer = this.add.container(0, 100);
    this.panel.add(this.summaryContainer);

    // Back button
    const backBtn = this.add.container(-250, -230);
    const backBg = this.add.rectangle(0, 0, 80, 28, COLORS.SUMI_MEDIUM)
      .setStrokeStyle(1, COLORS.SUMI_LIGHT)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.goBack())
      .on('pointerover', () => backBg.setFillStyle(COLORS.SUMI_LIGHT))
      .on('pointerout', () => backBg.setFillStyle(COLORS.SUMI_MEDIUM));
    backBtn.add([backBg, this.add.text(0, 0, '← Back', {
      fontSize: '12px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5)]);
    this.panel.add(backBtn);

    // Sample text button
    const sampleBtn = this.add.container(200, 40);
    const sampleBg = this.add.rectangle(0, 0, 160, 38, COLORS.SUMI_MEDIUM)
      .setStrokeStyle(1, COLORS.SUMI_LIGHT)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.loadSampleText())
      .on('pointerover', () => sampleBg.setFillStyle(COLORS.SUMI_LIGHT))
      .on('pointerout', () => sampleBg.setFillStyle(COLORS.SUMI_MEDIUM));
    sampleBtn.add([sampleBg, this.add.text(0, 0, '例文 Sample', {
      fontSize: '14px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5)]);
    this.panel.add(sampleBtn);

    // ESC to go back
    this.input.keyboard?.on('keydown-ESC', () => this.goBack());
  }

  private createTextInput(width: number, height: number): void {
    // Use a DOM textarea for proper text input
    this.inputElement = document.createElement('textarea');
    this.inputElement.style.position = 'absolute';
    this.inputElement.style.left = `${(width - 580) / 2}px`;
    this.inputElement.style.top = `${(height - 500) / 2 + 80}px`;
    this.inputElement.style.width = '580px';
    this.inputElement.style.height = '120px';
    this.inputElement.style.background = '#2d2520';
    this.inputElement.style.color = '#f5f0e1';
    this.inputElement.style.border = '2px solid #4a3f35';
    this.inputElement.style.borderRadius = '4px';
    this.inputElement.style.padding = '8px';
    this.inputElement.style.fontSize = '16px';
    this.inputElement.style.fontFamily = '"Noto Sans JP", sans-serif';
    this.inputElement.style.resize = 'none';
    this.inputElement.style.outline = 'none';
    this.inputElement.style.zIndex = '10';
    this.inputElement.placeholder = '日本語のテキストをここに貼り付けてください...\n(Paste Japanese text here...)';

    document.body.appendChild(this.inputElement);

    // Clean up on scene shutdown
    this.events.on('shutdown', () => {
      if (this.inputElement) {
        this.inputElement.remove();
        this.inputElement = undefined;
      }
    });
  }

  private analyzeText(): void {
    const text = this.inputElement?.value || '';
    if (!text.trim()) return;

    this.analysis = DocumentAnalyzer.analyze(text);
    this.showSummary();
  }

  private showSummary(): void {
    this.summaryContainer.removeAll(true);
    if (!this.analysis) return;

    const a = this.analysis;

    // Stats
    const lines = [
      `Kanji found: ${a.allKanji.length}  (${a.newKanji.length} new, ${a.knownKanji.length} known)`,
      `Producible: ${a.producibleKanji.length}  |  Radicals needed: ${a.radicalSet.length}`,
      a.unknownKanji.length > 0 ? `Not in database: ${a.unknownKanji.join(' ')}` : '',
      `Estimated play time: ~${a.estimatedMinutes} min`,
    ].filter(Boolean);

    lines.forEach((line, i) => {
      this.summaryContainer.add(this.add.text(0, i * 22, line, {
        fontSize: '13px',
        color: '#f5f0e1',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5));
    });

    // Kanji preview
    if (a.producibleKanji.length > 0) {
      this.summaryContainer.add(this.add.text(0, lines.length * 22 + 10,
        `New kanji: ${a.producibleKanji.join(' ')}`, {
        fontSize: '16px',
        color: '#c4a747',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5));
    }

    // Generate button
    if (a.producibleKanji.length > 0) {
      const genY = lines.length * 22 + 50;
      const genBtn = this.add.container(0, genY);
      const genBg = this.add.rectangle(0, 0, 240, 42, COLORS.JADE)
        .setStrokeStyle(2, 0xffffff)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.generateAndStart())
        .on('pointerover', () => genBg.setFillStyle(0x7ace9d))
        .on('pointerout', () => genBg.setFillStyle(COLORS.JADE));
      genBtn.add([genBg, this.add.text(0, 0, '▶ Generate & Play', {
        fontSize: '16px',
        color: '#f5f0e1',
        fontFamily: '"Noto Sans JP", sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5)]);
      this.summaryContainer.add(genBtn);
    } else {
      this.summaryContainer.add(this.add.text(0, lines.length * 22 + 20,
        'No producible kanji found. Try different text with simpler kanji.', {
        fontSize: '13px',
        color: '#c53d43',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5));
    }
  }

  private generateAndStart(): void {
    if (!this.analysis) return;

    const mapData = MapGenerator.generate(this.analysis);

    // Create a pseudo-scroll for GameScene
    const scroll = {
      id: 'custom-' + Date.now(),
      chapter: 0,
      title: 'Custom Text',
      titleJp: '自由モード',
      sourceText: this.analysis.sourceText,
      translation: '',
      newKanji: this.analysis.producibleKanji,
      revisionKanji: this.analysis.knownKanji,
      culturalNote: '',
      dispatchQuotas: mapData.dispatchQuotas,
      mapData,
    };

    // Remove textarea before transitioning
    if (this.inputElement) {
      this.inputElement.remove();
      this.inputElement = undefined;
    }

    this.scene.start('GameScene', { scroll });
  }

  private loadSampleText(): void {
    if (this.inputElement) {
      this.inputElement.value = '山の上に大きい木がある。日と月が空に出る。\n人は水を飲む。火が金を溶かす。\n川の中に小さい魚がいる。';
    }
  }

  private goBack(): void {
    if (this.inputElement) {
      this.inputElement.remove();
      this.inputElement = undefined;
    }
    this.scene.start('MainMenuScene');
  }
}

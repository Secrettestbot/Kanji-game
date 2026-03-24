import Phaser from 'phaser';
import { COLORS } from '../config';
import { SaveManager } from '../state/SaveManager';
import { GameState } from '../state/GameState';

interface SettingsData {
  romajiHints: boolean;
  furiganaEnabled: boolean;
  autoSave: boolean;
  sfxVolume: number;
}

const SETTINGS_KEY = 'sumi_kojo_settings';

export class SettingsScene extends Phaser.Scene {
  private settings: SettingsData = {
    romajiHints: true,
    furiganaEnabled: false,
    autoSave: true,
    sfxVolume: 0.7,
  };

  private panel!: Phaser.GameObjects.Container;

  constructor() {
    super({ key: 'SettingsScene' });
  }

  create(): void {
    const { width, height } = this.cameras.main;

    this.loadSettings();

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, COLORS.SUMI_BLACK);

    this.panel = this.add.container(width / 2, height / 2);

    const panelBg = this.add.rectangle(0, 0, 500, 420, COLORS.SUMI_DARK, 0.95)
      .setStrokeStyle(3, COLORS.SUMI_MEDIUM);
    this.panel.add(panelBg);

    // Title
    this.panel.add(this.add.text(0, -185, '設定 Settings', {
      fontSize: '22px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5));

    // Toggle options
    let y = -120;
    this.createToggle('Show romaji hints in quizzes', y, this.settings.romajiHints, (val) => {
      this.settings.romajiHints = val;
      this.saveSettings();
    });

    y += 55;
    this.createToggle('Enable furigana on kanji', y, this.settings.furiganaEnabled, (val) => {
      this.settings.furiganaEnabled = val;
      this.saveSettings();
    });

    y += 55;
    this.createToggle('Auto-save (every 30s)', y, this.settings.autoSave, (val) => {
      this.settings.autoSave = val;
      this.saveSettings();
    });

    // Volume slider label
    y += 65;
    this.panel.add(this.add.text(-180, y, 'SFX Volume', {
      fontSize: '14px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
    }));

    // Simple volume display (no real audio yet)
    const volText = this.add.text(100, y, `${Math.round(this.settings.sfxVolume * 100)}%`, {
      fontSize: '14px',
      color: '#c4a747',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5, 0);
    this.panel.add(volText);

    // Volume buttons
    const volDown = this.createSmallButton('-', 50, y, () => {
      this.settings.sfxVolume = Math.max(0, this.settings.sfxVolume - 0.1);
      volText.setText(`${Math.round(this.settings.sfxVolume * 100)}%`);
      this.saveSettings();
    });
    const volUp = this.createSmallButton('+', 150, y, () => {
      this.settings.sfxVolume = Math.min(1, this.settings.sfxVolume + 0.1);
      volText.setText(`${Math.round(this.settings.sfxVolume * 100)}%`);
      this.saveSettings();
    });

    // Danger zone
    y += 70;
    this.panel.add(this.add.text(0, y, '— Data Management —', {
      fontSize: '12px',
      color: '#8b7d6b',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5));

    y += 30;
    const deleteBg = this.add.rectangle(0, y, 200, 34, 0x5a2020)
      .setStrokeStyle(1, COLORS.VERMILLION)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.confirmDelete())
      .on('pointerover', () => deleteBg.setFillStyle(0x7a3030))
      .on('pointerout', () => deleteBg.setFillStyle(0x5a2020));
    this.panel.add(deleteBg);
    this.panel.add(this.add.text(0, y, 'Delete All Save Data', {
      fontSize: '13px',
      color: '#c53d43',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5));

    // Back button
    y += 55;
    const backBg = this.add.rectangle(0, y, 180, 38, COLORS.SUMI_MEDIUM)
      .setStrokeStyle(2, COLORS.SUMI_LIGHT)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.scene.start('MainMenuScene'))
      .on('pointerover', () => backBg.setFillStyle(COLORS.SUMI_LIGHT))
      .on('pointerout', () => backBg.setFillStyle(COLORS.SUMI_MEDIUM));
    this.panel.add(backBg);
    this.panel.add(this.add.text(0, y, '← Back to Menu', {
      fontSize: '14px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5));

    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MainMenuScene'));
  }

  private createToggle(label: string, y: number, initial: boolean, onChange: (val: boolean) => void): void {
    let value = initial;

    this.panel.add(this.add.text(-180, y, label, {
      fontSize: '14px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
    }));

    const toggleBg = this.add.rectangle(160, y + 8, 50, 24,
      value ? COLORS.JADE : COLORS.SUMI_MEDIUM
    ).setStrokeStyle(1, COLORS.SUMI_LIGHT)
      .setInteractive({ useHandCursor: true });

    const toggleLabel = this.add.text(160, y + 8, value ? 'ON' : 'OFF', {
      fontSize: '11px',
      color: '#f5f0e1',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    toggleBg.on('pointerdown', () => {
      value = !value;
      toggleBg.setFillStyle(value ? COLORS.JADE : COLORS.SUMI_MEDIUM);
      toggleLabel.setText(value ? 'ON' : 'OFF');
      onChange(value);
    });

    this.panel.add(toggleBg);
    this.panel.add(toggleLabel);
  }

  private createSmallButton(text: string, x: number, y: number, onClick: () => void): void {
    const bg = this.add.rectangle(x, y + 8, 30, 24, COLORS.SUMI_MEDIUM)
      .setStrokeStyle(1, COLORS.SUMI_LIGHT)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', onClick)
      .on('pointerover', () => bg.setFillStyle(COLORS.SUMI_LIGHT))
      .on('pointerout', () => bg.setFillStyle(COLORS.SUMI_MEDIUM));
    this.panel.add(bg);
    this.panel.add(this.add.text(x, y + 8, text, {
      fontSize: '14px',
      color: '#f5f0e1',
      fontFamily: 'sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5));
  }

  private confirmDelete(): void {
    // Simple confirmation — replace delete button with confirm
    SaveManager.deleteSave();
    GameState.reset();
    localStorage.removeItem(SETTINGS_KEY);
    this.scene.start('MainMenuScene');
  }

  private loadSettings(): void {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        this.settings = { ...this.settings, ...JSON.parse(raw) };
      }
    } catch { /* use defaults */ }
  }

  private saveSettings(): void {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(this.settings));
    } catch { /* ignore */ }
  }

  static getSettings(): SettingsData {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) return JSON.parse(raw);
    } catch { /* defaults */ }
    return { romajiHints: true, furiganaEnabled: false, autoSave: true, sfxVolume: 0.7 };
  }
}

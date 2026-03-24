import Phaser from 'phaser';
import { COLORS, TILE_SIZE } from '../config';

export class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload(): void {
    // Generate textures programmatically (no external assets needed)
    this.createTextures();

    // Show loading text
    const cx = this.cameras.main.centerX;
    const cy = this.cameras.main.centerY;
    const loadingText = this.add.text(cx, cy, '墨工場\nLoading...', {
      fontSize: '32px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", "Hiragino Sans", sans-serif',
      align: 'center',
    }).setOrigin(0.5);

    this.load.on('complete', () => {
      loadingText.destroy();
    });
  }

  create(): void {
    this.scene.start('MainMenuScene');
  }

  private createTextures(): void {
    // Floor tile - washi paper texture
    const floorGfx = this.make.graphics({ x: 0, y: 0 });
    floorGfx.fillStyle(COLORS.WASHI_CREAM);
    floorGfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    // Subtle grain effect
    floorGfx.fillStyle(COLORS.WASHI_DARK, 0.3);
    for (let i = 0; i < 8; i++) {
      const rx = Math.random() * TILE_SIZE;
      const ry = Math.random() * TILE_SIZE;
      floorGfx.fillRect(rx, ry, 1, 1);
    }
    floorGfx.lineStyle(1, COLORS.GRID_LINE, 0.3);
    floorGfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    floorGfx.generateTexture('tile_floor', TILE_SIZE, TILE_SIZE);
    floorGfx.destroy();

    // Obstacle tile - stone
    const obstGfx = this.make.graphics({ x: 0, y: 0 });
    obstGfx.fillStyle(COLORS.SUMI_MEDIUM);
    obstGfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    obstGfx.fillStyle(COLORS.SUMI_DARK, 0.5);
    obstGfx.fillRect(2, 2, TILE_SIZE - 4, TILE_SIZE - 4);
    obstGfx.generateTexture('tile_obstacle', TILE_SIZE, TILE_SIZE);
    obstGfx.destroy();

    // Ore node tile
    const oreGfx = this.make.graphics({ x: 0, y: 0 });
    oreGfx.fillStyle(COLORS.WASHI_CREAM);
    oreGfx.fillRect(0, 0, TILE_SIZE, TILE_SIZE);
    oreGfx.fillStyle(COLORS.JADE, 0.6);
    oreGfx.fillCircle(TILE_SIZE / 2, TILE_SIZE / 2, TILE_SIZE / 3);
    oreGfx.lineStyle(1, COLORS.GRID_LINE, 0.3);
    oreGfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    oreGfx.generateTexture('tile_ore', TILE_SIZE, TILE_SIZE);
    oreGfx.destroy();

    // Machine textures
    this.createMachineTexture('machine_extractor', COLORS.EXTRACTOR, '採');
    this.createMachineTexture('machine_furnace', COLORS.FURNACE, '炉');
    this.createMachineTexture('machine_gate', COLORS.GATE, '門');
    this.createMachineTexture('machine_loom', COLORS.LOOM, '織');
    this.createMachineTexture('machine_dispatch', COLORS.DISPATCH, '送');

    // Conveyor belt texture — bamboo channel look
    const beltGfx = this.make.graphics({ x: 0, y: 0 });
    beltGfx.fillStyle(COLORS.BELT_COLOR);
    beltGfx.fillRect(4, 4, TILE_SIZE - 8, TILE_SIZE - 8);
    // Grooves
    beltGfx.fillStyle(COLORS.SUMI_DARK, 0.3);
    beltGfx.fillRect(6, 8, TILE_SIZE - 12, 1);
    beltGfx.fillRect(6, 15, TILE_SIZE - 12, 1);
    beltGfx.fillRect(6, 22, TILE_SIZE - 12, 1);
    beltGfx.fillStyle(COLORS.SUMI_LIGHT, 0.4);
    beltGfx.fillRect(6, TILE_SIZE / 2 - 1, TILE_SIZE - 12, 2);
    beltGfx.lineStyle(1, COLORS.GRID_LINE, 0.3);
    beltGfx.strokeRect(0, 0, TILE_SIZE, TILE_SIZE);
    beltGfx.generateTexture('belt', TILE_SIZE, TILE_SIZE);
    beltGfx.destroy();

    // Belt direction arrow
    const arrowGfx = this.make.graphics({ x: 0, y: 0 });
    arrowGfx.fillStyle(COLORS.WASHI_CREAM, 0.8);
    arrowGfx.fillTriangle(
      TILE_SIZE / 2, 6,
      TILE_SIZE - 8, TILE_SIZE - 8,
      8, TILE_SIZE - 8
    );
    arrowGfx.generateTexture('belt_arrow', TILE_SIZE, TILE_SIZE);
    arrowGfx.destroy();

    // Radical item circle texture (green)
    const radItemGfx = this.make.graphics({ x: 0, y: 0 });
    radItemGfx.fillStyle(COLORS.JADE, 0.9);
    radItemGfx.fillCircle(10, 10, 10);
    radItemGfx.lineStyle(1, COLORS.SUMI_BLACK, 0.5);
    radItemGfx.strokeCircle(10, 10, 10);
    radItemGfx.generateTexture('item_radical', 20, 20);
    radItemGfx.destroy();

    // Kanji item circle texture (red)
    const kanjiItemGfx = this.make.graphics({ x: 0, y: 0 });
    kanjiItemGfx.fillStyle(COLORS.VERMILLION, 0.9);
    kanjiItemGfx.fillCircle(10, 10, 10);
    kanjiItemGfx.lineStyle(1, COLORS.SUMI_BLACK, 0.5);
    kanjiItemGfx.strokeCircle(10, 10, 10);
    kanjiItemGfx.generateTexture('item_kanji', 20, 20);
    kanjiItemGfx.destroy();
  }

  private createMachineTexture(key: string, color: number, kanji: string): void {
    const size = TILE_SIZE * 2;
    const gfx = this.make.graphics({ x: 0, y: 0 });

    // Background
    gfx.fillStyle(COLORS.SUMI_DARK);
    gfx.fillRoundedRect(1, 1, size - 2, size - 2, 4);

    // Inner color
    gfx.fillStyle(color, 0.8);
    gfx.fillRoundedRect(3, 3, size - 6, size - 6, 3);

    // Border
    gfx.lineStyle(2, COLORS.SUMI_BLACK);
    gfx.strokeRoundedRect(1, 1, size - 2, size - 2, 4);

    gfx.generateTexture(key, size, size);
    gfx.destroy();

    // Add kanji label as separate texture
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d')!;
    ctx.font = `bold ${size * 0.45}px "Noto Sans JP", sans-serif`;
    ctx.fillStyle = '#f5f0e1';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(kanji, size / 2, size / 2);
    this.textures.addCanvas(key + '_label', canvas);
  }
}

import Phaser from 'phaser';
import { TILE_SIZE, MAP_DEFAULT_WIDTH, MAP_DEFAULT_HEIGHT, COLORS, STARTING_INK_POINTS } from '../config';
import { TileType, MachineType, Direction, MachineTier, Position, BeltSegment, MachineInstance, OreNodeData } from '../types';

// Build mode selection
type BuildSelection =
  | { type: 'none' }
  | { type: 'machine'; machineType: MachineType }
  | { type: 'belt' }
  | { type: 'demolish' };

export class GameScene extends Phaser.Scene {
  // Map state
  private mapWidth = MAP_DEFAULT_WIDTH;
  private mapHeight = MAP_DEFAULT_HEIGHT;
  private tiles: TileType[][] = [];
  private tileSprites: (Phaser.GameObjects.Image | null)[][] = [];

  // Machine & belt state
  private machines: MachineInstance[] = [];
  private machineSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private belts: BeltSegment[] = [];
  private beltSprites: Map<string, Phaser.GameObjects.Container> = new Map();
  private oreNodes: OreNodeData[] = [];

  // Occupation grid: tracks what occupies each tile
  private occupationGrid: (string | null)[][] = [];

  // Build mode
  private buildSelection: BuildSelection = { type: 'none' };
  private hoverHighlight!: Phaser.GameObjects.Rectangle;
  private isDraggingBelt = false;

  // Camera
  private isDraggingCamera = false;
  private lastPointer = { x: 0, y: 0 };

  // Economy
  private inkPoints = STARTING_INK_POINTS;

  // UI layer
  private uiContainer!: Phaser.GameObjects.Container;

  // Counters
  private machineIdCounter = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  create(): void {
    this.initMap();
    this.renderMap();
    this.setupCamera();
    this.setupInput();
    this.createBuildPanel();
    this.createHUD();

    // Place some demo ore nodes
    this.placeOreNodes();
  }

  // ─── Map Initialization ───

  private initMap(): void {
    this.tiles = [];
    this.tileSprites = [];
    this.occupationGrid = [];

    for (let y = 0; y < this.mapHeight; y++) {
      this.tiles[y] = [];
      this.tileSprites[y] = [];
      this.occupationGrid[y] = [];
      for (let x = 0; x < this.mapWidth; x++) {
        this.tiles[y][x] = TileType.FLOOR;
        this.tileSprites[y][x] = null;
        this.occupationGrid[y][x] = null;
      }
    }

    // Scatter some obstacles
    for (let i = 0; i < Math.floor(this.mapWidth * this.mapHeight * 0.05); i++) {
      const ox = Math.floor(Math.random() * this.mapWidth);
      const oy = Math.floor(Math.random() * this.mapHeight);
      // Keep edges clear
      if (ox > 2 && ox < this.mapWidth - 3 && oy > 2 && oy < this.mapHeight - 3) {
        this.tiles[oy][ox] = TileType.OBSTACLE;
        this.occupationGrid[oy][ox] = 'obstacle';
      }
    }
  }

  private placeOreNodes(): void {
    // Demo ore nodes with radicals for testing
    const demoRadicals = ['人', '大', '山', '川', '日', '月', '木', '火', '水', '金', '土', '口'];
    let placed = 0;
    for (const radical of demoRadicals) {
      let attempts = 0;
      while (attempts < 50) {
        const x = 2 + Math.floor(Math.random() * (this.mapWidth - 4));
        const y = 2 + Math.floor(Math.random() * (this.mapHeight - 4));
        if (this.tiles[y][x] === TileType.FLOOR && !this.occupationGrid[y][x]) {
          this.tiles[y][x] = TileType.ORE_NODE;
          this.oreNodes.push({ radical, x, y, richness: 3 });

          // Update sprite
          if (this.tileSprites[y][x]) {
            this.tileSprites[y][x]!.destroy();
          }
          const sprite = this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 'tile_ore');
          this.tileSprites[y][x] = sprite;

          // Radical label on ore node
          this.add.text(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, radical, {
            fontSize: '16px',
            color: '#1a1410',
            fontFamily: '"Noto Sans JP", sans-serif',
            fontStyle: 'bold',
          }).setOrigin(0.5).setDepth(1);

          placed++;
          break;
        }
        attempts++;
      }
    }
  }

  private renderMap(): void {
    for (let y = 0; y < this.mapHeight; y++) {
      for (let x = 0; x < this.mapWidth; x++) {
        const px = x * TILE_SIZE + TILE_SIZE / 2;
        const py = y * TILE_SIZE + TILE_SIZE / 2;
        let textureKey = 'tile_floor';
        if (this.tiles[y][x] === TileType.OBSTACLE) {
          textureKey = 'tile_obstacle';
        } else if (this.tiles[y][x] === TileType.ORE_NODE) {
          textureKey = 'tile_ore';
        }
        const sprite = this.add.image(px, py, textureKey);
        this.tileSprites[y][x] = sprite;
      }
    }

    // Hover highlight
    this.hoverHighlight = this.add.rectangle(0, 0, TILE_SIZE, TILE_SIZE)
      .setStrokeStyle(2, COLORS.HIGHLIGHT)
      .setFillStyle(COLORS.HIGHLIGHT, 0.15)
      .setDepth(100)
      .setVisible(false);
  }

  // ─── Camera ───

  private setupCamera(): void {
    const worldWidth = this.mapWidth * TILE_SIZE;
    const worldHeight = this.mapHeight * TILE_SIZE;

    this.cameras.main.setBounds(
      -TILE_SIZE * 2, -TILE_SIZE * 2,
      worldWidth + TILE_SIZE * 4,
      worldHeight + TILE_SIZE * 4
    );

    // Center camera
    this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);

    // Zoom bounds
    this.cameras.main.setZoom(1);
  }

  // ─── Input ───

  private setupInput(): void {
    // Mouse wheel zoom
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gx: number[], _gy: number[], _gz: number[], deltaY: number) => {
      const cam = this.cameras.main;
      const newZoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, 0.5, 3);
      cam.setZoom(newZoom);
    });

    // Pointer down
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
        this.isDraggingCamera = true;
        this.lastPointer = { x: pointer.x, y: pointer.y };
        return;
      }

      // Check if clicking on UI (above game world)
      if (pointer.x > this.cameras.main.width - 200) return;

      const worldPos = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tileX = Math.floor(worldPos.x / TILE_SIZE);
      const tileY = Math.floor(worldPos.y / TILE_SIZE);

      if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) return;

      if (this.buildSelection.type === 'machine') {
        this.placeMachine(tileX, tileY, this.buildSelection.machineType);
      } else if (this.buildSelection.type === 'belt') {
        this.placeBelt(tileX, tileY);
        this.isDraggingBelt = true;
      } else if (this.buildSelection.type === 'demolish') {
        this.demolishAt(tileX, tileY);
      }
    });

    // Pointer move
    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDraggingCamera) {
        const dx = pointer.x - this.lastPointer.x;
        const dy = pointer.y - this.lastPointer.y;
        this.cameras.main.scrollX -= dx / this.cameras.main.zoom;
        this.cameras.main.scrollY -= dy / this.cameras.main.zoom;
        this.lastPointer = { x: pointer.x, y: pointer.y };
        return;
      }

      // Update hover highlight
      const worldPos = this.cameras.main.getWorldPoint(pointer.x, pointer.y);
      const tileX = Math.floor(worldPos.x / TILE_SIZE);
      const tileY = Math.floor(worldPos.y / TILE_SIZE);

      if (tileX >= 0 && tileX < this.mapWidth && tileY >= 0 && tileY < this.mapHeight
          && this.buildSelection.type !== 'none') {
        this.hoverHighlight.setPosition(
          tileX * TILE_SIZE + TILE_SIZE / 2,
          tileY * TILE_SIZE + TILE_SIZE / 2
        ).setVisible(true);
      } else {
        this.hoverHighlight.setVisible(false);
      }

      // Belt dragging
      if (this.isDraggingBelt && pointer.leftButtonDown()) {
        if (tileX >= 0 && tileX < this.mapWidth && tileY >= 0 && tileY < this.mapHeight) {
          this.placeBelt(tileX, tileY);
        }
      }
    });

    // Pointer up
    this.input.on('pointerup', () => {
      this.isDraggingCamera = false;
      this.isDraggingBelt = false;
    });

    // Keyboard shortcuts
    this.input.keyboard?.on('keydown-ESC', () => {
      this.buildSelection = { type: 'none' };
      this.hoverHighlight.setVisible(false);
      this.updateBuildPanelHighlight();
    });

    this.input.keyboard?.on('keydown-ONE', () => {
      this.buildSelection = { type: 'machine', machineType: MachineType.EXTRACTION_STATION };
      this.updateBuildPanelHighlight();
    });
    this.input.keyboard?.on('keydown-TWO', () => {
      this.buildSelection = { type: 'machine', machineType: MachineType.COMPOSITION_FURNACE };
      this.updateBuildPanelHighlight();
    });
    this.input.keyboard?.on('keydown-THREE', () => {
      this.buildSelection = { type: 'belt' };
      this.updateBuildPanelHighlight();
    });
    this.input.keyboard?.on('keydown-FOUR', () => {
      this.buildSelection = { type: 'machine', machineType: MachineType.DISPATCH_BOARD };
      this.updateBuildPanelHighlight();
    });
    this.input.keyboard?.on('keydown-X', () => {
      this.buildSelection = { type: 'demolish' };
      this.updateBuildPanelHighlight();
    });
  }

  // ─── Machine Placement ───

  private placeMachine(tileX: number, tileY: number, machineType: MachineType): void {
    const size = this.getMachineSize(machineType);

    // Check bounds
    if (tileX + size.w > this.mapWidth || tileY + size.h > this.mapHeight) return;

    // Check occupation
    for (let dy = 0; dy < size.h; dy++) {
      for (let dx = 0; dx < size.w; dx++) {
        if (this.occupationGrid[tileY + dy][tileX + dx]) return;
        if (this.tiles[tileY + dy][tileX + dx] === TileType.OBSTACLE) return;
      }
    }

    // Check cost
    const cost = this.getMachineCost(machineType);
    if (this.inkPoints < cost) return;

    this.inkPoints -= cost;

    const id = `machine_${this.machineIdCounter++}`;
    const machine: MachineInstance = {
      id,
      type: machineType,
      tier: MachineTier.T1,
      x: tileX,
      y: tileY,
      width: size.w,
      height: size.h,
    };
    this.machines.push(machine);

    // Mark occupation
    for (let dy = 0; dy < size.h; dy++) {
      for (let dx = 0; dx < size.w; dx++) {
        this.occupationGrid[tileY + dy][tileX + dx] = id;
      }
    }

    // Create visual
    this.createMachineSprite(machine);
    this.updateHUD();
  }

  private createMachineSprite(machine: MachineInstance): void {
    const textureKey = this.getMachineTexture(machine.type);
    const px = machine.x * TILE_SIZE + (machine.width * TILE_SIZE) / 2;
    const py = machine.y * TILE_SIZE + (machine.height * TILE_SIZE) / 2;

    const container = this.add.container(px, py);

    const bg = this.add.image(0, 0, textureKey).setDisplaySize(
      machine.width * TILE_SIZE - 2,
      machine.height * TILE_SIZE - 2
    );
    container.add(bg);

    // Label
    const label = this.add.image(0, 0, textureKey + '_label').setDisplaySize(
      machine.width * TILE_SIZE - 2,
      machine.height * TILE_SIZE - 2
    );
    container.add(label);

    // Machine name below
    const name = this.getMachineName(machine.type);
    const nameText = this.add.text(0, machine.height * TILE_SIZE / 2 + 2, name, {
      fontSize: '9px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5, 0);
    container.add(nameText);

    container.setDepth(10);
    this.machineSprites.set(machine.id, container);
  }

  // ─── Belt Placement ───

  private placeBelt(tileX: number, tileY: number): void {
    if (tileX < 0 || tileX >= this.mapWidth || tileY < 0 || tileY >= this.mapHeight) return;
    if (this.occupationGrid[tileY][tileX]) return;
    if (this.tiles[tileY][tileX] === TileType.OBSTACLE) return;

    // Check if belt already exists at this position
    const key = `${tileX},${tileY}`;
    if (this.beltSprites.has(key)) return;

    // Cost check
    if (this.inkPoints < 1) return;
    this.inkPoints -= 1;

    // Determine direction based on last belt
    let dir = Direction.RIGHT;
    if (this.belts.length > 0) {
      const lastBelt = this.belts[this.belts.length - 1];
      const dx = tileX - lastBelt.x;
      const dy = tileY - lastBelt.y;
      if (Math.abs(dx) >= Math.abs(dy)) {
        dir = dx >= 0 ? Direction.RIGHT : Direction.LEFT;
      } else {
        dir = dy >= 0 ? Direction.DOWN : Direction.UP;
      }
    }

    const belt: BeltSegment = { x: tileX, y: tileY, direction: dir };
    this.belts.push(belt);
    this.occupationGrid[tileY][tileX] = 'belt';

    // Create visual
    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;

    const container = this.add.container(px, py);
    const bg = this.add.image(0, 0, 'belt');
    container.add(bg);

    const arrow = this.add.image(0, 0, 'belt_arrow').setScale(0.6).setAlpha(0.7);
    const rotation = { up: 0, right: Math.PI / 2, down: Math.PI, left: -Math.PI / 2 };
    arrow.setRotation(rotation[dir]);
    container.add(arrow);

    container.setDepth(5);
    this.beltSprites.set(key, container);
    this.updateHUD();
  }

  // ─── Demolish ───

  private demolishAt(tileX: number, tileY: number): void {
    const occupant = this.occupationGrid[tileY]?.[tileX];
    if (!occupant) return;

    if (occupant === 'obstacle') return;

    if (occupant === 'belt') {
      const key = `${tileX},${tileY}`;
      const sprite = this.beltSprites.get(key);
      if (sprite) {
        sprite.destroy();
        this.beltSprites.delete(key);
      }
      this.belts = this.belts.filter(b => !(b.x === tileX && b.y === tileY));
      this.occupationGrid[tileY][tileX] = null;
      this.inkPoints += 1; // refund
    } else {
      // Machine
      const machine = this.machines.find(m => m.id === occupant);
      if (!machine) return;

      // Clear occupation
      for (let dy = 0; dy < machine.height; dy++) {
        for (let dx = 0; dx < machine.width; dx++) {
          this.occupationGrid[machine.y + dy][machine.x + dx] = null;
        }
      }

      // Remove sprite
      const sprite = this.machineSprites.get(machine.id);
      if (sprite) {
        sprite.destroy();
        this.machineSprites.delete(machine.id);
      }

      // Refund half cost
      const cost = this.getMachineCost(machine.type);
      this.inkPoints += Math.floor(cost / 2);

      this.machines = this.machines.filter(m => m.id !== machine.id);
    }

    this.updateHUD();
  }

  // ─── Build Panel (right sidebar) ───

  private buildButtons: Phaser.GameObjects.Container[] = [];

  private createBuildPanel(): void {
    this.uiContainer = this.add.container(0, 0).setScrollFactor(0).setDepth(1000);

    const panelWidth = 180;
    const panelX = this.cameras.main.width - panelWidth;

    // Panel background
    const panelBg = this.add.rectangle(
      panelX + panelWidth / 2, this.cameras.main.height / 2,
      panelWidth, this.cameras.main.height
    ).setFillStyle(COLORS.SUMI_DARK, 0.92).setStrokeStyle(2, COLORS.SUMI_MEDIUM);
    this.uiContainer.add(panelBg);

    // Title
    const title = this.add.text(panelX + panelWidth / 2, 16, '建築 Build', {
      fontSize: '16px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.uiContainer.add(title);

    // Build buttons
    const buttons = [
      { label: '採 Extractor', key: '1', action: () => { this.buildSelection = { type: 'machine', machineType: MachineType.EXTRACTION_STATION }; } },
      { label: '炉 Furnace', key: '2', action: () => { this.buildSelection = { type: 'machine', machineType: MachineType.COMPOSITION_FURNACE }; } },
      { label: '⟶ Belt', key: '3', action: () => { this.buildSelection = { type: 'belt' }; } },
      { label: '送 Dispatch', key: '4', action: () => { this.buildSelection = { type: 'machine', machineType: MachineType.DISPATCH_BOARD }; } },
      { label: '✕ Demolish', key: 'X', action: () => { this.buildSelection = { type: 'demolish' }; } },
      { label: '⊘ Cancel', key: 'Esc', action: () => { this.buildSelection = { type: 'none' }; } },
    ];

    buttons.forEach((btn, i) => {
      const y = 50 + i * 44;
      const btnContainer = this.add.container(panelX + panelWidth / 2, y);

      const bg = this.add.rectangle(0, 0, panelWidth - 20, 36)
        .setFillStyle(COLORS.SUMI_MEDIUM)
        .setStrokeStyle(1, COLORS.SUMI_LIGHT)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          btn.action();
          this.updateBuildPanelHighlight();
        })
        .on('pointerover', () => bg.setFillStyle(COLORS.SUMI_LIGHT))
        .on('pointerout', () => this.updateButtonColor(bg, i));

      const label = this.add.text(0, 0, `[${btn.key}] ${btn.label}`, {
        fontSize: '12px',
        color: '#f5f0e1',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5);

      btnContainer.add([bg, label]);
      this.uiContainer.add(btnContainer);
      this.buildButtons.push(btnContainer);
    });
  }

  private updateBuildPanelHighlight(): void {
    this.buildButtons.forEach((container, i) => {
      const bg = container.list[0] as Phaser.GameObjects.Rectangle;
      this.updateButtonColor(bg, i);
    });
  }

  private updateButtonColor(bg: Phaser.GameObjects.Rectangle, index: number): void {
    const isSelected =
      (index === 0 && this.buildSelection.type === 'machine' && this.buildSelection.machineType === MachineType.EXTRACTION_STATION) ||
      (index === 1 && this.buildSelection.type === 'machine' && this.buildSelection.machineType === MachineType.COMPOSITION_FURNACE) ||
      (index === 2 && this.buildSelection.type === 'belt') ||
      (index === 3 && this.buildSelection.type === 'machine' && this.buildSelection.machineType === MachineType.DISPATCH_BOARD) ||
      (index === 4 && this.buildSelection.type === 'demolish');

    bg.setFillStyle(isSelected ? COLORS.VERMILLION : COLORS.SUMI_MEDIUM);
  }

  // ─── HUD ───

  private hudText!: Phaser.GameObjects.Text;

  private createHUD(): void {
    this.hudText = this.add.text(12, 12, '', {
      fontSize: '14px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
      backgroundColor: '#2d2520cc',
      padding: { x: 8, y: 6 },
    }).setScrollFactor(0).setDepth(1000);

    this.updateHUD();
  }

  private updateHUD(): void {
    this.hudText.setText(
      `墨 Ink Points: ${this.inkPoints}  |  Machines: ${this.machines.length}  |  Belts: ${this.belts.length}`
    );
  }

  // ─── Helpers ───

  private getMachineSize(type: MachineType): { w: number; h: number } {
    switch (type) {
      case MachineType.EXTRACTION_STATION: return { w: 2, h: 2 };
      case MachineType.COMPOSITION_FURNACE: return { w: 2, h: 2 };
      case MachineType.PRONUNCIATION_GATE: return { w: 2, h: 1 };
      case MachineType.LEXICON_LOOM: return { w: 2, h: 2 };
      case MachineType.DISPATCH_BOARD: return { w: 2, h: 2 };
      case MachineType.BUFFER_CHEST: return { w: 1, h: 1 };
    }
  }

  private getMachineCost(type: MachineType): number {
    switch (type) {
      case MachineType.EXTRACTION_STATION: return 5;
      case MachineType.COMPOSITION_FURNACE: return 10;
      case MachineType.PRONUNCIATION_GATE: return 0;
      case MachineType.LEXICON_LOOM: return 30;
      case MachineType.DISPATCH_BOARD: return 5;
      case MachineType.BUFFER_CHEST: return 2;
    }
  }

  private getMachineTexture(type: MachineType): string {
    switch (type) {
      case MachineType.EXTRACTION_STATION: return 'machine_extractor';
      case MachineType.COMPOSITION_FURNACE: return 'machine_furnace';
      case MachineType.PRONUNCIATION_GATE: return 'machine_gate';
      case MachineType.LEXICON_LOOM: return 'machine_loom';
      case MachineType.DISPATCH_BOARD: return 'machine_dispatch';
      case MachineType.BUFFER_CHEST: return 'machine_extractor';
    }
  }

  private getMachineName(type: MachineType): string {
    switch (type) {
      case MachineType.EXTRACTION_STATION: return 'Extractor';
      case MachineType.COMPOSITION_FURNACE: return 'Furnace';
      case MachineType.PRONUNCIATION_GATE: return 'Gate';
      case MachineType.LEXICON_LOOM: return 'Loom';
      case MachineType.DISPATCH_BOARD: return 'Dispatch';
      case MachineType.BUFFER_CHEST: return 'Chest';
    }
  }
}

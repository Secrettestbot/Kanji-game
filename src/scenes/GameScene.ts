import Phaser from 'phaser';
import { TILE_SIZE, MAP_DEFAULT_WIDTH, MAP_DEFAULT_HEIGHT, COLORS, STARTING_INK_POINTS } from '../config';
import { TileType, MachineType, Direction, MachineTier, BeltSegment, MachineInstance, OreNodeData, DispatchQuota, ScrollData } from '../types';
import { ProductionSystem } from '../systems/ProductionSystem';
import { ConveyorSystem, BeltItem } from '../systems/ConveyorSystem';
import { GameState } from '../state/GameState';
import { SaveManager } from '../state/SaveManager';
import { DataManager } from '../data/DataManager';

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

  // Economy (synced with GameState)
  private inkPoints = STARTING_INK_POINTS;

  // UI layer
  private uiContainer!: Phaser.GameObjects.Container;

  // Counters
  private machineIdCounter = 0;

  // Systems
  private productionSystem!: ProductionSystem;
  private conveyorSystem!: ConveyorSystem;

  // Item sprites on belts
  private itemSprites: Map<string, Phaser.GameObjects.Container> = new Map();

  // Dispatch tracking
  private shippedKanjiCount = 0;
  private totalShippedCount = 0;
  private dispatchQuotas: DispatchQuota[] = [];
  private quotaTimers: number[] = [];

  // Gate state
  private gateActive = false;
  private gateMachineId: string | null = null;

  // Notification queue
  private notifications: Phaser.GameObjects.Container[] = [];

  // Quota UI
  private quotaContainer!: Phaser.GameObjects.Container;
  private quotaTexts: Phaser.GameObjects.Text[] = [];

  // Auto-save timer
  private autoSaveTimer = 0;

  // Campaign scroll (if playing a scroll)
  private activeScroll?: ScrollData;

  // Scroll completion tracking
  private scrollKanjiProduced = new Set<string>();
  private playTimer = 0;

  constructor() {
    super({ key: 'GameScene' });
  }

  init(data?: { scroll?: ScrollData }): void {
    this.activeScroll = data?.scroll;
  }

  create(): void {
    this.productionSystem = new ProductionSystem();
    this.conveyorSystem = new ConveyorSystem();

    // Reset state for new scene
    this.machines = [];
    this.machineSprites = new Map();
    this.belts = [];
    this.beltSprites = new Map();
    this.oreNodes = [];
    this.itemSprites = new Map();
    this.buildButtons = [];
    this.notifications = [];
    this.quotaTexts = [];
    this.totalShippedCount = 0;
    this.shippedKanjiCount = 0;
    this.machineIdCounter = 0;
    this.inkPoints = GameState.getInkPoints();

    // Use scroll data if available
    if (this.activeScroll) {
      this.mapWidth = this.activeScroll.mapData.width;
      this.mapHeight = this.activeScroll.mapData.height;
    } else {
      this.mapWidth = MAP_DEFAULT_WIDTH;
      this.mapHeight = MAP_DEFAULT_HEIGHT;
    }

    this.initMap();
    this.renderMap();
    this.setupCamera();
    this.setupInput();
    this.createBuildPanel();
    this.createHUD();
    this.createQuotaPanel();

    if (this.activeScroll) {
      this.placeScrollOreNodes();
      this.dispatchQuotas = this.activeScroll.dispatchQuotas.map(q => ({ ...q, fulfilled: 0 }));
      this.quotaTimers = this.dispatchQuotas.map(q => q.timeWindowSeconds);
      this.updateQuotaDisplay();
    } else {
      this.placeOreNodes();
      this.generateDispatchQuotas();
    }

    // Listen for gate scene results
    this.scene.get('PronunciationGateScene')?.events?.on('gate-result', this.handleGateResult, this);

    // Listen for codex close
    this.events.on('resume', () => {
      this.gateActive = false;
    });
  }

  update(_time: number, delta: number): void {
    const dt = delta / 1000; // ms to seconds

    if (this.gateActive) return; // Pause production during gate

    // Run production system tick
    this.productionSystem.update(
      dt,
      this.machines,
      (machine) => this.getAdjacentOreNode(machine),
      (machine) => this.getOutputBeltDirection(machine),
    );

    // Process production events
    const events = this.productionSystem.getEvents();
    for (const evt of events) {
      switch (evt.type) {
        case 'radical_extracted':
          this.onRadicalExtracted(evt.machineId!, evt.character!, evt.x, evt.y);
          break;
        case 'gate_triggered':
          this.onGateTriggered(evt.machineId!, evt.character!);
          break;
        case 'kanji_produced':
          this.onKanjiProduced(evt.machineId!, evt.character!);
          break;
      }
    }

    // Run conveyor system tick
    this.conveyorSystem.update(
      dt,
      (x, y) => this.getBeltAt(x, y),
      (x, y) => this.getMachineAtTile(x, y),
      (item, machine) => this.onItemReachMachine(item, machine),
      (item) => this.onItemFallOff(item),
    );

    // Update item sprite positions
    this.updateItemSprites();

    // Tick dispatch quota timers
    this.tickQuotas(dt);

    // Track play time
    this.playTimer += dt;

    // Auto-save every 30 seconds
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer >= 30) {
      this.autoSaveTimer = 0;
      SaveManager.save();
    }
  }

  private checkScrollCompletion(): void {
    if (!this.activeScroll) return;

    // Check if all new kanji for this scroll have been produced
    const allProduced = this.activeScroll.newKanji.every(k => this.scrollKanjiProduced.has(k));
    if (!allProduced) return;

    // Scroll complete!
    this.time.delayedCall(1500, () => {
      SaveManager.save();
      this.scene.start('RevealScene', {
        scroll: this.activeScroll,
        stats: {
          kanjiUnlocked: this.scrollKanjiProduced.size,
          totalShipped: this.totalShippedCount,
          timePlayed: Math.floor(this.playTimer),
        },
      });
    });
  }

  // ─── Production Event Handlers ───

  private onRadicalExtracted(machineId: string, radical: string, _mx: number, _my: number): void {
    const machine = this.machines.find(m => m.id === machineId);
    if (!machine) return;

    // Subtle pulse on extractor
    const sprite = this.machineSprites.get(machineId);
    if (sprite) {
      this.tweens.add({
        targets: sprite,
        scaleX: 1.05,
        scaleY: 1.05,
        duration: 100,
        yoyo: true,
      });
    }

    // Find output position (right side of 2x2 machine)
    const outX = machine.x + machine.width;
    const outY = machine.y + Math.floor(machine.height / 2);

    // Check if there's a belt at the output position
    const belt = this.getBeltAt(outX, outY);
    if (belt) {
      const item = this.conveyorSystem.addItem(radical, 'radical', outX, outY);
      this.createItemSprite(item);
    }
  }

  private onGateTriggered(machineId: string, character: string): void {
    // Check if kanji is already unlocked - if so, skip gate
    if (GameState.isKanjiUnlocked(character)) {
      this.productionSystem.gateCleared(machineId);
      return;
    }

    this.gateActive = true;
    this.gateMachineId = machineId;

    // Launch pronunciation gate overlay
    this.scene.launch('PronunciationGateScene', {
      kanji: character,
      kanjiData: DataManager.getKanji(character),
    });
    this.scene.pause();
  }

  private handleGateResult = (result: { passed: boolean; kanji: string }): void => {
    this.scene.resume();
    this.gateActive = false;

    if (result.passed && this.gateMachineId) {
      GameState.unlockKanji(result.kanji);
      this.productionSystem.gateCleared(this.gateMachineId);
      this.showNotification(`✓ ${result.kanji} unlocked!`, COLORS.JADE);
    } else if (this.gateMachineId) {
      this.productionSystem.gateFailed(this.gateMachineId);
      this.showNotification(`${result.kanji} — try again next time`, COLORS.VERMILLION);
    }
    this.gateMachineId = null;
  };

  private onKanjiProduced(machineId: string, character: string): void {
    const machine = this.machines.find(m => m.id === machineId);
    if (!machine) return;

    // Track for scroll completion
    this.scrollKanjiProduced.add(character);

    // Machine activation flash effect
    const sprite = this.machineSprites.get(machineId);
    if (sprite) {
      const flash = this.add.circle(
        machine.x * TILE_SIZE + (machine.width * TILE_SIZE) / 2,
        machine.y * TILE_SIZE + (machine.height * TILE_SIZE) / 2,
        machine.width * TILE_SIZE * 0.6,
        COLORS.VERMILLION, 0.4
      ).setDepth(15);
      this.tweens.add({
        targets: flash,
        alpha: 0,
        scale: 1.5,
        duration: 400,
        onComplete: () => flash.destroy(),
      });
    }

    // Output kanji to belt
    const outX = machine.x + machine.width;
    const outY = machine.y + Math.floor(machine.height / 2);

    const belt = this.getBeltAt(outX, outY);
    if (belt) {
      const item = this.conveyorSystem.addItem(character, 'kanji', outX, outY);
      this.createItemSprite(item);
    }

    // Check scroll completion
    this.checkScrollCompletion();
  }

  private onItemReachMachine(item: BeltItem, machine: MachineInstance): void {
    if (machine.type === MachineType.COMPOSITION_FURNACE && item.type === 'radical') {
      // Feed radical into furnace
      this.productionSystem.feedRadical(machine.id, item.character);
      this.removeItemSprite(item.id);
    } else if (machine.type === MachineType.DISPATCH_BOARD && item.type === 'kanji') {
      // Ship kanji
      const points = GameState.shipKanji(item.character);
      this.inkPoints = GameState.getInkPoints();
      this.totalShippedCount++;
      this.removeItemSprite(item.id);

      // Check quota fulfillment
      const quotaBonus = this.fulfillQuota(item.character);
      const totalPoints = points + quotaBonus;
      const bonusText = quotaBonus > 0 ? ` (+${quotaBonus} bonus!)` : '';
      this.showNotification(`📦 ${item.character} shipped! +${totalPoints} ink${bonusText}`, COLORS.GOLD);
      this.updateHUD();
      this.updateQuotaDisplay();
    } else {
      // Item can't be consumed, fall off
      this.removeItemSprite(item.id);
    }
  }

  private onItemFallOff(item: BeltItem): void {
    this.removeItemSprite(item.id);
  }

  // ─── Item Sprite Management ───

  private createItemSprite(item: BeltItem): void {
    const container = this.add.container(item.pixelX, item.pixelY);

    // Background circle
    const bg = this.add.circle(0, 0, 10, item.type === 'radical' ? COLORS.JADE : COLORS.VERMILLION, 0.9);
    container.add(bg);

    // Character text
    const text = this.add.text(0, 0, item.character, {
      fontSize: '12px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    container.add(text);

    container.setDepth(50);
    this.itemSprites.set(item.id, container);
  }

  private removeItemSprite(id: string): void {
    const sprite = this.itemSprites.get(id);
    if (sprite) {
      // Fade out and destroy
      this.tweens.add({
        targets: sprite,
        alpha: 0,
        scale: 0.3,
        duration: 200,
        onComplete: () => sprite.destroy(),
      });
      this.itemSprites.delete(id);
    }
  }

  private updateItemSprites(): void {
    for (const item of this.conveyorSystem.getItems()) {
      const sprite = this.itemSprites.get(item.id);
      if (sprite) {
        sprite.setPosition(item.pixelX, item.pixelY);
      }
    }
  }

  // ─── Dispatch Quota System ───

  private generateDispatchQuotas(): void {
    this.dispatchQuotas = [];
    this.quotaTimers = [];

    // Get kanji that can be produced from available ore nodes
    const availableRadicals = this.oreNodes.map(n => n.radical);
    const allKanji = DataManager.getAllKanji();
    const producible = allKanji.filter(k =>
      k.radicals.every(r => availableRadicals.includes(r))
    );

    if (producible.length === 0) return;

    // Generate 3 quotas
    const shuffled = [...producible].sort(() => Math.random() - 0.5);
    for (let i = 0; i < Math.min(3, shuffled.length); i++) {
      const k = shuffled[i];
      const quota: DispatchQuota = {
        kanji: k.character,
        quantity: 1 + Math.floor(Math.random() * 3),
        fulfilled: 0,
        timeWindowSeconds: 120 + Math.floor(Math.random() * 180),
        rewardMultiplier: 1 + Math.random() * 2,
      };
      this.dispatchQuotas.push(quota);
      this.quotaTimers.push(quota.timeWindowSeconds);
    }

    this.updateQuotaDisplay();
  }

  private fulfillQuota(kanji: string): number {
    let bonus = 0;
    for (let i = 0; i < this.dispatchQuotas.length; i++) {
      const q = this.dispatchQuotas[i];
      if (q.kanji === kanji && q.fulfilled < q.quantity) {
        q.fulfilled++;
        if (q.fulfilled >= q.quantity) {
          // Quota complete! Award bonus
          bonus = Math.floor(q.quantity * q.rewardMultiplier * 2);
          GameState.addInkPoints(bonus);
          this.inkPoints = GameState.getInkPoints();
          this.showNotification(`★ Quota complete! ${q.kanji} ×${q.quantity}`, COLORS.GOLD);

          // Replace with a new quota after a delay
          this.time.delayedCall(2000, () => this.replaceQuota(i));
        }
        break;
      }
    }
    return bonus;
  }

  private replaceQuota(index: number): void {
    const availableRadicals = this.oreNodes.map(n => n.radical);
    const allKanji = DataManager.getAllKanji();
    const producible = allKanji.filter(k =>
      k.radicals.every(r => availableRadicals.includes(r))
    );

    if (producible.length === 0) return;

    const k = producible[Math.floor(Math.random() * producible.length)];
    this.dispatchQuotas[index] = {
      kanji: k.character,
      quantity: 1 + Math.floor(Math.random() * 3),
      fulfilled: 0,
      timeWindowSeconds: 120 + Math.floor(Math.random() * 180),
      rewardMultiplier: 1 + Math.random() * 2,
    };
    this.quotaTimers[index] = this.dispatchQuotas[index].timeWindowSeconds;
    this.updateQuotaDisplay();
  }

  private tickQuotas(dt: number): void {
    let needsUpdate = false;
    for (let i = 0; i < this.quotaTimers.length; i++) {
      if (this.dispatchQuotas[i].fulfilled >= this.dispatchQuotas[i].quantity) continue;
      this.quotaTimers[i] -= dt;
      if (this.quotaTimers[i] <= 0) {
        // Quota expired, replace it
        this.showNotification(`✕ Quota expired: ${this.dispatchQuotas[i].kanji}`, COLORS.SUMI_LIGHT);
        this.replaceQuota(i);
      }
      needsUpdate = true;
    }
    if (needsUpdate) this.updateQuotaDisplay();
  }

  private createQuotaPanel(): void {
    const cam = this.cameras.main;
    this.quotaContainer = this.add.container(12, 50).setScrollFactor(0).setDepth(1000);

    const title = this.add.text(0, 0, '📋 Dispatch Orders', {
      fontSize: '13px',
      color: '#c4a747',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    });
    this.quotaContainer.add(title);
  }

  private updateQuotaDisplay(): void {
    // Remove old texts
    for (const t of this.quotaTexts) t.destroy();
    this.quotaTexts = [];

    this.dispatchQuotas.forEach((q, i) => {
      const timer = Math.max(0, Math.floor(this.quotaTimers[i] || 0));
      const min = Math.floor(timer / 60);
      const sec = timer % 60;
      const timeStr = `${min}:${sec.toString().padStart(2, '0')}`;
      const done = q.fulfilled >= q.quantity;
      const mult = q.rewardMultiplier.toFixed(1);

      const text = this.add.text(0, 22 + i * 22,
        done
          ? `  ✓ ${q.kanji} ×${q.quantity} — Complete!`
          : `  ${q.kanji} ${q.fulfilled}/${q.quantity}  ${timeStr}  ×${mult}`,
        {
          fontSize: '12px',
          color: done ? '#68be8d' : '#f5f0e1',
          fontFamily: '"Noto Sans JP", sans-serif',
          backgroundColor: '#2d2520aa',
          padding: { x: 4, y: 2 },
        }
      );
      this.quotaContainer.add(text);
      this.quotaTexts.push(text);
    });
  }

  // ─── Helper Queries ───

  private getAdjacentOreNode(machine: MachineInstance): OreNodeData | undefined {
    // Check all tiles adjacent to the machine footprint
    for (let dy = -1; dy <= machine.height; dy++) {
      for (let dx = -1; dx <= machine.width; dx++) {
        // Only check border tiles
        if (dy >= 0 && dy < machine.height && dx >= 0 && dx < machine.width) continue;

        const tx = machine.x + dx;
        const ty = machine.y + dy;
        if (tx < 0 || tx >= this.mapWidth || ty < 0 || ty >= this.mapHeight) continue;

        const node = this.oreNodes.find(n => n.x === tx && n.y === ty && n.richness > 0);
        if (node) return node;
      }
    }
    return undefined;
  }

  private getOutputBeltDirection(machine: MachineInstance): Direction | null {
    const outX = machine.x + machine.width;
    const outY = machine.y + Math.floor(machine.height / 2);
    const belt = this.getBeltAt(outX, outY);
    return belt?.direction ?? null;
  }

  private getBeltAt(x: number, y: number): BeltSegment | undefined {
    return this.belts.find(b => b.x === x && b.y === y);
  }

  private getMachineAtTile(x: number, y: number): MachineInstance | undefined {
    const occupant = this.occupationGrid[y]?.[x];
    if (!occupant || occupant === 'belt' || occupant === 'obstacle') return undefined;
    return this.machines.find(m => m.id === occupant);
  }

  // ─── Notifications ───

  private showNotification(text: string, color: number): void {
    const cam = this.cameras.main;
    const container = this.add.container(cam.width / 2, 60 + this.notifications.length * 40)
      .setScrollFactor(0).setDepth(2000);

    const bg = this.add.rectangle(0, 0, 300, 30, color, 0.85).setStrokeStyle(1, 0x000000, 0.3);
    const label = this.add.text(0, 0, text, {
      fontSize: '14px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5);

    container.add([bg, label]);
    this.notifications.push(container);

    this.tweens.add({
      targets: container,
      alpha: 0,
      y: container.y - 20,
      delay: 1500,
      duration: 500,
      onComplete: () => {
        container.destroy();
        this.notifications = this.notifications.filter(n => n !== container);
      },
    });
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
      if (ox > 2 && ox < this.mapWidth - 3 && oy > 2 && oy < this.mapHeight - 3) {
        this.tiles[oy][ox] = TileType.OBSTACLE;
        this.occupationGrid[oy][ox] = 'obstacle';
      }
    }
  }

  private placeOreNodes(): void {
    const demoRadicals = ['人', '大', '山', '川', '日', '月', '木', '火', '水', '金', '土', '口'];
    for (const radical of demoRadicals) {
      let attempts = 0;
      while (attempts < 50) {
        const x = 2 + Math.floor(Math.random() * (this.mapWidth - 4));
        const y = 2 + Math.floor(Math.random() * (this.mapHeight - 4));
        if (this.tiles[y][x] === TileType.FLOOR && !this.occupationGrid[y][x]) {
          this.tiles[y][x] = TileType.ORE_NODE;
          this.oreNodes.push({ radical, x, y, richness: 3 });

          if (this.tileSprites[y][x]) {
            this.tileSprites[y][x]!.destroy();
          }
          const sprite = this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 'tile_ore');
          this.tileSprites[y][x] = sprite;

          this.add.text(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, radical, {
            fontSize: '16px',
            color: '#1a1410',
            fontFamily: '"Noto Sans JP", sans-serif',
            fontStyle: 'bold',
          }).setOrigin(0.5).setDepth(1);

          break;
        }
        attempts++;
      }
    }
  }

  private placeScrollOreNodes(): void {
    if (!this.activeScroll) return;
    for (const node of this.activeScroll.mapData.oreNodes) {
      const { x, y, radical, richness } = node;
      if (x >= this.mapWidth || y >= this.mapHeight) continue;
      if (this.tiles[y][x] !== TileType.FLOOR) continue;

      this.tiles[y][x] = TileType.ORE_NODE;
      this.oreNodes.push({ radical, x, y, richness });

      if (this.tileSprites[y][x]) {
        this.tileSprites[y][x]!.destroy();
      }
      const sprite = this.add.image(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, 'tile_ore');
      this.tileSprites[y][x] = sprite;

      this.add.text(x * TILE_SIZE + TILE_SIZE / 2, y * TILE_SIZE + TILE_SIZE / 2, radical, {
        fontSize: '16px',
        color: '#1a1410',
        fontFamily: '"Noto Sans JP", sans-serif',
        fontStyle: 'bold',
      }).setOrigin(0.5).setDepth(1);
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

    this.cameras.main.centerOn(worldWidth / 2, worldHeight / 2);
    this.cameras.main.setZoom(1);
  }

  // ─── Input ───

  private setupInput(): void {
    this.input.on('wheel', (_pointer: Phaser.Input.Pointer, _gx: number[], _gy: number[], _gz: number[], deltaY: number) => {
      const cam = this.cameras.main;
      const newZoom = Phaser.Math.Clamp(cam.zoom - deltaY * 0.001, 0.5, 3);
      cam.setZoom(newZoom);
    });

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown() || pointer.middleButtonDown()) {
        this.isDraggingCamera = true;
        this.lastPointer = { x: pointer.x, y: pointer.y };
        return;
      }

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

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (this.isDraggingCamera) {
        const dx = pointer.x - this.lastPointer.x;
        const dy = pointer.y - this.lastPointer.y;
        this.cameras.main.scrollX -= dx / this.cameras.main.zoom;
        this.cameras.main.scrollY -= dy / this.cameras.main.zoom;
        this.lastPointer = { x: pointer.x, y: pointer.y };
        return;
      }

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

      if (this.isDraggingBelt && pointer.leftButtonDown()) {
        if (tileX >= 0 && tileX < this.mapWidth && tileY >= 0 && tileY < this.mapHeight) {
          this.placeBelt(tileX, tileY);
        }
      }
    });

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

    // Codex shortcut
    this.input.keyboard?.on('keydown-C', () => {
      this.scene.launch('CodexScene');
      this.scene.pause();
    });
  }

  // ─── Machine Placement ───

  private placeMachine(tileX: number, tileY: number, machineType: MachineType): void {
    const size = this.getMachineSize(machineType);

    if (tileX + size.w > this.mapWidth || tileY + size.h > this.mapHeight) return;

    for (let dy = 0; dy < size.h; dy++) {
      for (let dx = 0; dx < size.w; dx++) {
        if (this.occupationGrid[tileY + dy][tileX + dx]) return;
        if (this.tiles[tileY + dy][tileX + dx] === TileType.OBSTACLE) return;
      }
    }

    const cost = this.getMachineCost(machineType);
    if (this.inkPoints < cost) return;

    this.inkPoints -= cost;
    GameState.spendInkPoints(cost);

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

    // Init in production system
    this.productionSystem.initMachine(machine);

    for (let dy = 0; dy < size.h; dy++) {
      for (let dx = 0; dx < size.w; dx++) {
        this.occupationGrid[tileY + dy][tileX + dx] = id;
      }
    }

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

    const label = this.add.image(0, 0, textureKey + '_label').setDisplaySize(
      machine.width * TILE_SIZE - 2,
      machine.height * TILE_SIZE - 2
    );
    container.add(label);

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

    const key = `${tileX},${tileY}`;
    if (this.beltSprites.has(key)) return;

    if (this.inkPoints < 1) return;
    this.inkPoints -= 1;

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

    const px = tileX * TILE_SIZE + TILE_SIZE / 2;
    const py = tileY * TILE_SIZE + TILE_SIZE / 2;

    const container = this.add.container(px, py);
    const bgSprite = this.add.image(0, 0, 'belt');
    container.add(bgSprite);

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
      this.inkPoints += 1;
    } else {
      const machine = this.machines.find(m => m.id === occupant);
      if (!machine) return;

      for (let dy = 0; dy < machine.height; dy++) {
        for (let dx = 0; dx < machine.width; dx++) {
          this.occupationGrid[machine.y + dy][machine.x + dx] = null;
        }
      }

      const sprite = this.machineSprites.get(machine.id);
      if (sprite) {
        sprite.destroy();
        this.machineSprites.delete(machine.id);
      }

      const cost = this.getMachineCost(machine.type);
      this.inkPoints += Math.floor(cost / 2);

      this.productionSystem.removeMachine(machine.id);
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

    const panelBg = this.add.rectangle(
      panelX + panelWidth / 2, this.cameras.main.height / 2,
      panelWidth, this.cameras.main.height
    ).setFillStyle(COLORS.SUMI_DARK, 0.92).setStrokeStyle(2, COLORS.SUMI_MEDIUM);
    this.uiContainer.add(panelBg);

    const title = this.add.text(panelX + panelWidth / 2, 16, '建築 Build', {
      fontSize: '16px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0);
    this.uiContainer.add(title);

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

      const bgRect = this.add.rectangle(0, 0, panelWidth - 20, 36)
        .setFillStyle(COLORS.SUMI_MEDIUM)
        .setStrokeStyle(1, COLORS.SUMI_LIGHT)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          btn.action();
          this.updateBuildPanelHighlight();
        })
        .on('pointerover', () => bgRect.setFillStyle(COLORS.SUMI_LIGHT))
        .on('pointerout', () => this.updateButtonColor(bgRect, i));

      const labelText = this.add.text(0, 0, `[${btn.key}] ${btn.label}`, {
        fontSize: '12px',
        color: '#f5f0e1',
        fontFamily: '"Noto Sans JP", sans-serif',
      }).setOrigin(0.5);

      btnContainer.add([bgRect, labelText]);
      this.uiContainer.add(btnContainer);
      this.buildButtons.push(btnContainer);
    });

    // Codex button at bottom
    const codexY = 50 + buttons.length * 44 + 20;
    const codexBtn = this.add.container(panelX + panelWidth / 2, codexY);
    const codexBg = this.add.rectangle(0, 0, panelWidth - 20, 36)
      .setFillStyle(COLORS.INDIGO)
      .setStrokeStyle(1, COLORS.SKY)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.scene.launch('CodexScene');
        this.scene.pause();
      })
      .on('pointerover', () => codexBg.setFillStyle(COLORS.SKY))
      .on('pointerout', () => codexBg.setFillStyle(COLORS.INDIGO));
    const codexLabel = this.add.text(0, 0, '[C] 図鑑 Codex', {
      fontSize: '12px',
      color: '#f5f0e1',
      fontFamily: '"Noto Sans JP", sans-serif',
    }).setOrigin(0.5);
    codexBtn.add([codexBg, codexLabel]);
    this.uiContainer.add(codexBtn);
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
    const unlocked = GameState.getAllUnlockedKanji().length;
    this.hudText.setText(
      `墨 Ink: ${this.inkPoints}  |  Machines: ${this.machines.length}  |  Belts: ${this.belts.length}  |  Kanji: ${unlocked}  |  Shipped: ${this.totalShippedCount}`
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

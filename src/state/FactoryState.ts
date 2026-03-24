import type { MachineInstance, BeltSegment, OreNodeData, FactoryItemData, DispatchQuota, TileType } from '../types';

export interface FactorySnapshot {
  mapWidth: number;
  mapHeight: number;
  tiles: TileType[][];
  machines: MachineInstance[];
  belts: BeltSegment[];
  oreNodes: OreNodeData[];
  items: FactoryItemData[];
  dispatchQuotas: DispatchQuota[];
}

class FactoryStateClass {
  private machines: MachineInstance[] = [];
  private belts: BeltSegment[] = [];
  private oreNodes: OreNodeData[] = [];
  private items: FactoryItemData[] = [];
  private dispatchQuotas: DispatchQuota[] = [];
  private itemIdCounter = 0;

  // Machines
  addMachine(machine: MachineInstance): void {
    this.machines.push(machine);
  }

  removeMachine(id: string): MachineInstance | undefined {
    const idx = this.machines.findIndex(m => m.id === id);
    if (idx === -1) return undefined;
    return this.machines.splice(idx, 1)[0];
  }

  getMachines(): MachineInstance[] {
    return this.machines;
  }

  getMachineAt(x: number, y: number): MachineInstance | undefined {
    return this.machines.find(m =>
      x >= m.x && x < m.x + m.width &&
      y >= m.y && y < m.y + m.height
    );
  }

  // Belts
  addBelt(belt: BeltSegment): void {
    this.belts.push(belt);
  }

  removeBelt(x: number, y: number): BeltSegment | undefined {
    const idx = this.belts.findIndex(b => b.x === x && b.y === y);
    if (idx === -1) return undefined;
    return this.belts.splice(idx, 1)[0];
  }

  getBelts(): BeltSegment[] {
    return this.belts;
  }

  getBeltAt(x: number, y: number): BeltSegment | undefined {
    return this.belts.find(b => b.x === x && b.y === y);
  }

  // Get connected belt chain from a starting point
  getBeltChain(startX: number, startY: number): BeltSegment[] {
    const chain: BeltSegment[] = [];
    let current = this.getBeltAt(startX, startY);
    const visited = new Set<string>();

    while (current && !visited.has(`${current.x},${current.y}`)) {
      visited.add(`${current.x},${current.y}`);
      chain.push(current);

      // Follow direction
      const next = this.getNextBeltPosition(current);
      current = this.getBeltAt(next.x, next.y);
    }

    return chain;
  }

  private getNextBeltPosition(belt: BeltSegment): { x: number; y: number } {
    switch (belt.direction) {
      case 'up': return { x: belt.x, y: belt.y - 1 };
      case 'down': return { x: belt.x, y: belt.y + 1 };
      case 'left': return { x: belt.x - 1, y: belt.y };
      case 'right': return { x: belt.x + 1, y: belt.y };
      default: return { x: belt.x, y: belt.y };
    }
  }

  // Ore Nodes
  addOreNode(node: OreNodeData): void {
    this.oreNodes.push(node);
  }

  getOreNodes(): OreNodeData[] {
    return this.oreNodes;
  }

  getOreNodeAt(x: number, y: number): OreNodeData | undefined {
    return this.oreNodes.find(n => n.x === x && n.y === y);
  }

  depleteOreNode(x: number, y: number): void {
    const node = this.getOreNodeAt(x, y);
    if (node && node.richness > 0) {
      node.richness--;
    }
  }

  // Items (radicals/kanji flowing on belts)
  createItem(character: string, type: 'radical' | 'kanji' | 'word', x: number, y: number): FactoryItemData {
    const item: FactoryItemData = {
      id: `item_${this.itemIdCounter++}`,
      character,
      type,
      x,
      y,
    };
    this.items.push(item);
    return item;
  }

  removeItem(id: string): void {
    this.items = this.items.filter(i => i.id !== id);
  }

  getItems(): FactoryItemData[] {
    return this.items;
  }

  getItemsAt(x: number, y: number): FactoryItemData[] {
    return this.items.filter(i => Math.floor(i.x) === x && Math.floor(i.y) === y);
  }

  // Dispatch Quotas
  setDispatchQuotas(quotas: DispatchQuota[]): void {
    this.dispatchQuotas = quotas;
  }

  getDispatchQuotas(): DispatchQuota[] {
    return this.dispatchQuotas;
  }

  fulfillQuota(kanji: string): boolean {
    const quota = this.dispatchQuotas.find(q => q.kanji === kanji && q.fulfilled < q.quantity);
    if (quota) {
      quota.fulfilled++;
      return true;
    }
    return false;
  }

  // Snapshot for save/load
  getSnapshot(): Partial<FactorySnapshot> {
    return {
      machines: [...this.machines],
      belts: [...this.belts],
      oreNodes: [...this.oreNodes],
      items: [...this.items],
      dispatchQuotas: [...this.dispatchQuotas],
    };
  }

  loadSnapshot(snapshot: Partial<FactorySnapshot>): void {
    if (snapshot.machines) this.machines = snapshot.machines;
    if (snapshot.belts) this.belts = snapshot.belts;
    if (snapshot.oreNodes) this.oreNodes = snapshot.oreNodes;
    if (snapshot.items) this.items = snapshot.items;
    if (snapshot.dispatchQuotas) this.dispatchQuotas = snapshot.dispatchQuotas;
  }

  clear(): void {
    this.machines = [];
    this.belts = [];
    this.oreNodes = [];
    this.items = [];
    this.dispatchQuotas = [];
    this.itemIdCounter = 0;
  }
}

export const FactoryState = new FactoryStateClass();

import type { BeltSegment, Direction, MachineInstance, FactoryItemData } from '../types';
import { TILE_SIZE } from '../config';

const BELT_SPEED = 1.5; // tiles per second

export interface BeltItem {
  id: string;
  character: string;
  type: 'radical' | 'kanji' | 'word';
  tileX: number;
  tileY: number;
  pixelX: number;
  pixelY: number;
  progress: number; // 0-1 within current tile
}

export class ConveyorSystem {
  private items: BeltItem[] = [];
  private itemIdCounter = 0;

  getItems(): BeltItem[] {
    return this.items;
  }

  addItem(character: string, type: 'radical' | 'kanji' | 'word', tileX: number, tileY: number): BeltItem {
    const item: BeltItem = {
      id: `belt_item_${this.itemIdCounter++}`,
      character,
      type,
      tileX,
      tileY,
      pixelX: tileX * TILE_SIZE + TILE_SIZE / 2,
      pixelY: tileY * TILE_SIZE + TILE_SIZE / 2,
      progress: 0,
    };
    this.items.push(item);
    return item;
  }

  removeItem(id: string): void {
    this.items = this.items.filter(i => i.id !== id);
  }

  update(
    deltaSeconds: number,
    getBeltAt: (x: number, y: number) => BeltSegment | undefined,
    getMachineAt: (x: number, y: number) => MachineInstance | undefined,
    onReachMachine: (item: BeltItem, machine: MachineInstance) => void,
    onFallOff: (item: BeltItem) => void,
  ): void {
    const toRemove: string[] = [];

    for (const item of this.items) {
      const belt = getBeltAt(item.tileX, item.tileY);

      if (!belt) {
        // Not on a belt, check if on machine
        const machine = getMachineAt(item.tileX, item.tileY);
        if (machine) {
          onReachMachine(item, machine);
          toRemove.push(item.id);
        } else {
          onFallOff(item);
          toRemove.push(item.id);
        }
        continue;
      }

      // Move along belt
      item.progress += BELT_SPEED * deltaSeconds;

      if (item.progress >= 1) {
        item.progress -= 1;

        // Move to next tile
        const next = this.getNextPosition(item.tileX, item.tileY, belt.direction);
        item.tileX = next.x;
        item.tileY = next.y;

        // Check if next tile has a machine
        const machine = getMachineAt(next.x, next.y);
        if (machine) {
          onReachMachine(item, machine);
          toRemove.push(item.id);
          continue;
        }

        // Check if next tile has no belt (end of line)
        const nextBelt = getBeltAt(next.x, next.y);
        if (!nextBelt) {
          onFallOff(item);
          toRemove.push(item.id);
          continue;
        }
      }

      // Update pixel position with interpolation
      const dir = belt.direction;
      const baseX = item.tileX * TILE_SIZE + TILE_SIZE / 2;
      const baseY = item.tileY * TILE_SIZE + TILE_SIZE / 2;
      const offset = item.progress * TILE_SIZE;

      switch (dir) {
        case 'up':
          item.pixelX = baseX;
          item.pixelY = baseY - offset;
          break;
        case 'down':
          item.pixelX = baseX;
          item.pixelY = baseY + offset;
          break;
        case 'left':
          item.pixelX = baseX - offset;
          item.pixelY = baseY;
          break;
        case 'right':
          item.pixelX = baseX + offset;
          item.pixelY = baseY;
          break;
      }
    }

    // Remove consumed/fallen items
    for (const id of toRemove) {
      this.removeItem(id);
    }
  }

  private getNextPosition(x: number, y: number, direction: Direction): { x: number; y: number } {
    switch (direction) {
      case 'up': return { x, y: y - 1 };
      case 'down': return { x, y: y + 1 };
      case 'left': return { x: x - 1, y };
      case 'right': return { x: x + 1, y };
      default: return { x, y };
    }
  }

  clear(): void {
    this.items = [];
    this.itemIdCounter = 0;
  }
}

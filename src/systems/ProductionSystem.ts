import { RATES, ORE_RATE_MODIFIER } from '../config';
import type { MachineInstance, OreNodeData, FactoryItemData, Direction } from '../types';
import { MachineType, MachineTier } from '../types';
import { RecipeSystem } from './RecipeSystem';

export interface ProductionEvent {
  type: 'radical_extracted' | 'kanji_produced' | 'gate_triggered' | 'item_shipped' | 'item_moved';
  machineId?: string;
  character?: string;
  x: number;
  y: number;
}

interface MachineState {
  // Extraction station
  extractionTimer?: number;
  assignedOreNode?: OreNodeData;

  // Composition furnace
  inputRadicals?: Map<string, number>;
  productionTimer?: number;
  outputKanji?: string;
  waitingForGate?: boolean;

  // General
  outputItems?: FactoryItemData[];
}

export class ProductionSystem {
  private machineStates: Map<string, MachineState> = new Map();
  private events: ProductionEvent[] = [];

  // Item tracking: items on belts
  private beltItems: Map<string, { item: FactoryItemData; progress: number; beltIndex: number }> = new Map();

  getEvents(): ProductionEvent[] {
    return this.events.splice(0);
  }

  getMachineState(machineId: string): MachineState {
    if (!this.machineStates.has(machineId)) {
      this.machineStates.set(machineId, {});
    }
    return this.machineStates.get(machineId)!;
  }

  initMachine(machine: MachineInstance): void {
    const state: MachineState = {};

    if (machine.type === MachineType.EXTRACTION_STATION) {
      state.extractionTimer = 0;
    } else if (machine.type === MachineType.COMPOSITION_FURNACE) {
      state.inputRadicals = new Map();
      state.productionTimer = 0;
      state.waitingForGate = false;
    }

    state.outputItems = [];
    this.machineStates.set(machine.id, state);
  }

  removeMachine(machineId: string): void {
    this.machineStates.delete(machineId);
  }

  // Assign an ore node to an extraction station
  assignOreNode(machineId: string, oreNode: OreNodeData): void {
    const state = this.getMachineState(machineId);
    state.assignedOreNode = oreNode;
  }

  // Main update tick
  update(
    deltaSeconds: number,
    machines: MachineInstance[],
    getAdjacentOreNode: (machine: MachineInstance) => OreNodeData | undefined,
    getOutputBeltDirection: (machine: MachineInstance) => Direction | null,
  ): void {
    for (const machine of machines) {
      const state = this.getMachineState(machine.id);

      switch (machine.type) {
        case MachineType.EXTRACTION_STATION:
          this.updateExtractor(deltaSeconds, machine, state, getAdjacentOreNode);
          break;
        case MachineType.COMPOSITION_FURNACE:
          this.updateFurnace(deltaSeconds, machine, state, getOutputBeltDirection);
          break;
        case MachineType.DISPATCH_BOARD:
          // Dispatch consumes items that reach it
          break;
      }
    }
  }

  private updateExtractor(
    delta: number,
    machine: MachineInstance,
    state: MachineState,
    getAdjacentOreNode: (machine: MachineInstance) => OreNodeData | undefined,
  ): void {
    // Find ore node if not assigned
    if (!state.assignedOreNode) {
      state.assignedOreNode = getAdjacentOreNode(machine);
    }

    const oreNode = state.assignedOreNode;
    if (!oreNode || (oreNode.hp !== undefined && oreNode.hp <= 0)) return;

    // Get extraction rate based on tier
    const baseRate = machine.tier === MachineTier.T0 ? RATES.EXTRACTION_T0
      : machine.tier === MachineTier.T1 ? RATES.EXTRACTION_T1
      : RATES.EXTRACTION_T2;

    const rateModifier = ORE_RATE_MODIFIER[oreNode.richness] ?? 1;
    const adjustedRate = baseRate / rateModifier;

    state.extractionTimer = (state.extractionTimer || 0) + delta;

    if (state.extractionTimer >= adjustedRate) {
      state.extractionTimer -= adjustedRate;

      // Produce radical and deplete ore node HP
      if (oreNode.hp === undefined) {
        // Initialize HP from richness: richness 3 = 60 extractions, 2 = 40, 1 = 20
        oreNode.hp = (oreNode.richness || 3) * 20;
      }
      oreNode.hp--;

      this.events.push({
        type: 'radical_extracted',
        machineId: machine.id,
        character: oreNode.radical,
        x: machine.x,
        y: machine.y,
      });

      // If ore node is depleted, clear assignment so extractor looks for a new one
      if (oreNode.hp <= 0) {
        state.assignedOreNode = undefined;
      }
    }
  }

  private updateFurnace(
    delta: number,
    machine: MachineInstance,
    state: MachineState,
    _getOutputDirection: (machine: MachineInstance) => Direction | null,
  ): void {
    if (state.waitingForGate) return; // Waiting for pronunciation gate

    if (!state.inputRadicals) state.inputRadicals = new Map();
    const radicals = state.inputRadicals;

    // Determine the target kanji.
    // If the player pinned a recipe on this furnace, only build that; otherwise
    // pick the best kanji fully covered by the current radical pool.
    // Subset matching matters: surplus radicals must never block production,
    // or the furnace jams permanently as soon as an extra radical arrives.
    let target: string | undefined;
    if (machine.recipe) {
      if (RecipeSystem.canProduce(machine.recipe, radicals)) target = machine.recipe;
    } else {
      target = RecipeSystem.findBestFromInventory(radicals)?.character;
    }

    if (!target) {
      // Nothing buildable yet — hold the cycle timer so partial progress isn't lost
      return;
    }

    const cycleTime = machine.tier === MachineTier.T2 ? RATES.FURNACE_T2_CYCLE : RATES.FURNACE_CYCLE;
    state.productionTimer = (state.productionTimer || 0) + delta;

    if (state.productionTimer < cycleTime) return;

    // Consume exactly this recipe's radicals; surplus stays in the furnace
    if (!RecipeSystem.consume(target, radicals)) {
      // Pool changed underneath us — retry next tick rather than emitting a
      // kanji that was never paid for
      return;
    }

    state.productionTimer = 0;
    state.waitingForGate = true;
    state.outputKanji = target;

    this.events.push({
      type: 'gate_triggered',
      machineId: machine.id,
      character: target,
      x: machine.x,
      y: machine.y,
    });
  }

  // Called when a radical item arrives at a furnace
  feedRadical(machineId: string, radical: string): void {
    const state = this.getMachineState(machineId);
    if (!state.inputRadicals) state.inputRadicals = new Map();
    state.inputRadicals.set(radical, (state.inputRadicals.get(radical) || 0) + 1);
  }

  // Called when pronunciation gate is passed
  gateCleared(machineId: string): string | undefined {
    const state = this.getMachineState(machineId);
    if (!state.waitingForGate) return undefined;

    state.waitingForGate = false;
    const kanji = state.outputKanji;
    state.outputKanji = undefined;

    if (kanji) {
      this.events.push({
        type: 'kanji_produced',
        machineId,
        character: kanji,
        x: 0, y: 0,
      });
    }
    return kanji;
  }

  // Called when pronunciation gate is failed (reset gracefully)
  gateFailed(machineId: string): void {
    const state = this.getMachineState(machineId);
    state.waitingForGate = false;
    state.outputKanji = undefined;
    state.productionTimer = 0;
    // Radicals stay in furnace — no penalty per design doc
  }

  clear(): void {
    this.machineStates.clear();
    this.beltItems.clear();
    this.events = [];
  }
}

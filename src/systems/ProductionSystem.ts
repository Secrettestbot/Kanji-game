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
    if (!oreNode || oreNode.richness <= 0) return;

    // Get extraction rate based on tier
    const baseRate = machine.tier === MachineTier.T0 ? RATES.EXTRACTION_T0
      : machine.tier === MachineTier.T1 ? RATES.EXTRACTION_T1
      : RATES.EXTRACTION_T2;

    const rateModifier = ORE_RATE_MODIFIER[oreNode.richness] ?? 1;
    const adjustedRate = baseRate / rateModifier;

    state.extractionTimer = (state.extractionTimer || 0) + delta;

    if (state.extractionTimer >= adjustedRate) {
      state.extractionTimer -= adjustedRate;

      // Produce radical
      this.events.push({
        type: 'radical_extracted',
        machineId: machine.id,
        character: oreNode.radical,
        x: machine.x,
        y: machine.y,
      });
    }
  }

  private updateFurnace(
    delta: number,
    machine: MachineInstance,
    state: MachineState,
    _getOutputDirection: (machine: MachineInstance) => Direction | null,
  ): void {
    if (state.waitingForGate) return; // Waiting for pronunciation gate

    const radicals = state.inputRadicals!;

    // Check if we have a recipe match
    const match = RecipeSystem.findMatch(Array.from(radicals.keys()).flatMap(k => {
      const count = radicals.get(k) || 0;
      return Array(count).fill(k);
    }));

    if (match) {
      const cycleTime = machine.tier === MachineTier.T2 ? RATES.FURNACE_T2_CYCLE : RATES.FURNACE_CYCLE;
      state.productionTimer = (state.productionTimer || 0) + delta;

      if (state.productionTimer >= cycleTime) {
        state.productionTimer = 0;

        // Consume radicals
        const recipe = RecipeSystem.getRequiredRadicals(match.character);
        for (const r of recipe) {
          const count = radicals.get(r) || 0;
          if (count <= 1) radicals.delete(r);
          else radicals.set(r, count - 1);
        }

        // Trigger pronunciation gate
        state.waitingForGate = true;
        state.outputKanji = match.character;

        this.events.push({
          type: 'gate_triggered',
          machineId: machine.id,
          character: match.character,
          x: machine.x,
          y: machine.y,
        });
      }
    }
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

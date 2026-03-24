// Core type definitions for Sumi Kōjō

export enum TileType {
  FLOOR = 'floor',
  OBSTACLE = 'obstacle',
  ORE_NODE = 'ore_node',
}

export enum MachineType {
  EXTRACTION_STATION = 'extraction_station',
  COMPOSITION_FURNACE = 'composition_furnace',
  PRONUNCIATION_GATE = 'pronunciation_gate',
  LEXICON_LOOM = 'lexicon_loom',
  DISPATCH_BOARD = 'dispatch_board',
  BUFFER_CHEST = 'buffer_chest',
}

export enum Direction {
  UP = 'up',
  DOWN = 'down',
  LEFT = 'left',
  RIGHT = 'right',
}

export enum MachineTier {
  T0 = 0,
  T1 = 1,
  T2 = 2,
}

export interface Position {
  x: number;
  y: number;
}

export interface TileData {
  type: TileType;
  x: number;
  y: number;
  radical?: string; // for ore nodes
  richness?: number; // for ore nodes (1-3)
}

export interface MachineInstance {
  id: string;
  type: MachineType;
  tier: MachineTier;
  x: number;
  y: number;
  width: number;  // in tiles
  height: number; // in tiles
}

export interface BeltSegment {
  x: number;
  y: number;
  direction: Direction;
}

export interface OreNodeData {
  radical: string;
  x: number;
  y: number;
  richness: number; // 1-3
}

export interface FactoryItemData {
  id: string;
  character: string; // the radical or kanji character
  type: 'radical' | 'kanji' | 'word';
  x: number;
  y: number;
}

export interface DispatchQuota {
  kanji: string;
  quantity: number;
  fulfilled: number;
  timeWindowSeconds: number;
  rewardMultiplier: number;
}

export interface MapData {
  seed: number;
  width: number;
  height: number;
  tiles: TileType[][];
  machines: MachineInstance[];
  belts: BeltSegment[];
  oreNodes: OreNodeData[];
  orderQueue: string[];
  dispatchQuotas: DispatchQuota[];
}

// Kanji data types
export interface RadicalData {
  character: string;
  meaning: string;
  readings: string[];
  strokeCount: number;
}

export interface KanjiData {
  character: string;
  meanings: string[];
  onyomi: string[];
  kunyomi: string[];
  radicals: string[];      // recipe: radical characters needed
  jlptLevel: number;       // 5=N5, 1=N1
  strokeCount: number;
  etymology?: string;
  frequency?: number;
}

export interface WordData {
  word: string;
  reading: string;
  meanings: string[];
  kanji: string[];         // kanji characters in this word
  jlptLevel: number;
}

// Player state types
export interface CodexEntry {
  character: string;
  unlocked: boolean;
  timesReviewed: number;
  lastReviewDate?: number;
  srsInterval: number;     // days
  srsTier: number;         // 1-3
}

export interface PlayerState {
  inkPoints: number;
  codexEntries: Record<string, CodexEntry>;
  completedScrolls: string[];
  currentChapter: number;
  tutorialCompleted: boolean;
  totalKanjiShipped: number;
  newKanjiShipped: Set<string>;
}

export interface ScrollData {
  id: string;
  chapter: number;
  title: string;
  titleJp: string;
  sourceText: string;
  translation: string;
  newKanji: string[];
  revisionKanji: string[];
  mapData: MapData;
  culturalNote: string;
  dispatchQuotas: DispatchQuota[];
}

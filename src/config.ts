// Game constants derived from design document

export const TILE_SIZE = 32;
export const MAP_DEFAULT_WIDTH = 40; // tiles
export const MAP_DEFAULT_HEIGHT = 30; // tiles

// Colors - Sumi ink / Japanese aesthetic palette
export const COLORS = {
  // Background & terrain
  WASHI_CREAM: 0xf5f0e1,
  WASHI_DARK: 0xe8dcc8,
  SUMI_BLACK: 0x1a1410,
  SUMI_DARK: 0x2d2520,
  SUMI_MEDIUM: 0x4a3f35,
  SUMI_LIGHT: 0x8b7d6b,

  // Accent colors
  VERMILLION: 0xc53d43,    // torii gate red
  INDIGO: 0x264348,        // ai-iro
  GOLD: 0xc4a747,          // kincha
  JADE: 0x68be8d,          // wakamidori
  SKY: 0x7eb8da,           // sora-iro

  // UI
  INK_POINT: 0xc4a747,
  GRID_LINE: 0xd4c9b0,
  HIGHLIGHT: 0xc53d43,
  BELT_COLOR: 0x8b7d6b,

  // Machine colors
  EXTRACTOR: 0x68be8d,
  FURNACE: 0xc53d43,
  GATE: 0x7eb8da,
  LOOM: 0x9b72aa,
  DISPATCH: 0xc4a747,
};

// Economy
export const COSTS = {
  EXTRACTION_T0: 5,
  EXTRACTION_T1: 15,
  EXTRACTION_T2: 40,
  FURNACE_T1: 10,
  FURNACE_T2: 25,
  LEXICON_LOOM: 30,
  CONVEYOR: 1,
  JUNCTION: 1,
};

// Production rates (seconds)
export const RATES = {
  EXTRACTION_T0: 4,   // seconds per radical
  EXTRACTION_T1: 2.5,
  EXTRACTION_T2: 1.5,
  FURNACE_CYCLE: 6,   // seconds per kanji at T1
  FURNACE_T2_CYCLE: 4,
};

// Ink Points rewards
export const REWARDS = {
  KANJI_SHIPPED: 1,
  NEW_KANJI_MULTIPLIER: 3,
  SRS_CORRECT: 1,
};

// Starting resources
export const STARTING_INK_POINTS = 20;

// OreNode richness
export const ORE_RICHNESS = {
  RICH: 3,
  MODERATE: 2,
  DEPLETED: 1,
  EXHAUSTED: 0,
};

export const ORE_RATE_MODIFIER: Record<number, number> = {
  3: 1.0,
  2: 0.9,
  1: 0.75,
  0: 0,
};

import type { MapData, OreNodeData, DispatchQuota } from '../types';
import { TileType } from '../types';
import type { AnalysisResult } from './DocumentAnalyzer';

const GOLDEN_RATIO = 1.618;
const MIN_MAP_SIZE = 20;
const MAX_MAP_SIZE = 60;
const TILE_MARGIN = 3;

export class MapGenerator {
  /**
   * Generate a complete playable map from document analysis results.
   * Stages:
   *   1. Compute map dimensions (golden ratio)
   *   2. Place floor and obstacles
   *   3. Place ore nodes for each required radical
   *   4. Generate dispatch quotas from producible kanji
   */
  static generate(analysis: AnalysisResult): MapData {
    const { producibleKanji, radicalSet } = analysis;

    // Stage 1: Map dimensions based on content size
    const nodeCount = radicalSet.length;
    const area = Math.max(nodeCount * 40, 400); // ~40 tiles per node minimum
    const height = Math.max(MIN_MAP_SIZE, Math.min(MAX_MAP_SIZE, Math.round(Math.sqrt(area / GOLDEN_RATIO))));
    const width = Math.max(MIN_MAP_SIZE, Math.min(MAX_MAP_SIZE, Math.round(height * GOLDEN_RATIO)));

    // Stage 2: Initialize tile grid
    const tiles: TileType[][] = [];
    for (let y = 0; y < height; y++) {
      tiles[y] = [];
      for (let x = 0; x < width; x++) {
        tiles[y][x] = TileType.FLOOR;
      }
    }

    // Scatter obstacles using seeded random (Poisson-disc-lite)
    const obstacleCount = Math.floor(width * height * 0.04);
    const occupied = new Set<string>();

    for (let i = 0; i < obstacleCount; i++) {
      const ox = TILE_MARGIN + Math.floor(Math.random() * (width - TILE_MARGIN * 2));
      const oy = TILE_MARGIN + Math.floor(Math.random() * (height - TILE_MARGIN * 2));
      const key = `${ox},${oy}`;
      if (!occupied.has(key)) {
        tiles[oy][ox] = TileType.OBSTACLE;
        occupied.add(key);
      }
    }

    // Stage 3: Place ore nodes in organized columns
    const oreNodes: OreNodeData[] = [];
    const radicals = [...radicalSet];
    const cols = Math.ceil(radicals.length / Math.max(1, Math.floor((height - TILE_MARGIN * 2) / 5)));
    const nodesPerCol = Math.ceil(radicals.length / Math.max(1, cols));

    radicals.forEach((radical, i) => {
      const col = Math.floor(i / nodesPerCol);
      const row = i % nodesPerCol;

      // Space columns evenly across left portion of map
      const colSpacing = Math.max(6, Math.floor((width * 0.5) / Math.max(1, cols)));
      const x = TILE_MARGIN + 1 + col * colSpacing;
      const y = TILE_MARGIN + 1 + row * 5;

      if (x < width - TILE_MARGIN && y < height - TILE_MARGIN) {
        // Clear any obstacle at this position
        tiles[y][x] = TileType.ORE_NODE;
        occupied.add(`${x},${y}`);

        oreNodes.push({
          radical,
          x,
          y,
          richness: 3,
        });
      }
    });

    // Stage 4: Generate dispatch quotas from producible kanji
    const quotaKanji = producibleKanji.slice(0, 5); // Max 5 quota targets
    const dispatchQuotas: DispatchQuota[] = quotaKanji.map(kanji => ({
      kanji,
      quantity: 1 + Math.floor(Math.random() * 2),
      fulfilled: 0,
      timeWindowSeconds: 150 + Math.floor(Math.random() * 150),
      rewardMultiplier: 1.2 + Math.random() * 1.8,
    }));

    return {
      seed: Date.now(),
      width,
      height,
      tiles,
      machines: [],
      belts: [],
      oreNodes,
      orderQueue: producibleKanji,
      dispatchQuotas,
    };
  }
}

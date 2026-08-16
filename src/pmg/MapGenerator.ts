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

    // Stage 3: Place ore nodes in organized columns.
    // Every radical MUST get a node — dropping one silently makes the kanji
    // that needs it unbuildable and the generated map unwinnable.
    const oreNodes: OreNodeData[] = [];
    const radicals = [...radicalSet];

    if (radicals.length > 0) {
      // Find the tightest spacing that fits every node inside the usable area,
      // relaxing from roomy to compact rather than discarding overflow.
      let rowSpacing = 5;
      let colSpacing = 6;
      let rows = 0;
      let cols = 0;

      for (;;) {
        const usableH = height - TILE_MARGIN * 2;
        const usableW = width - TILE_MARGIN * 2;
        rows = Math.max(1, Math.floor(usableH / rowSpacing));
        cols = Math.max(1, Math.ceil(radicals.length / rows));

        if (cols * colSpacing <= usableW) break;      // fits
        if (colSpacing > 3) { colSpacing--; continue; }
        if (rowSpacing > 2) { rowSpacing--; continue; }
        break; // already at minimum spacing; clamp below
      }

      const usableW = width - TILE_MARGIN * 2;
      const maxCols = Math.max(1, Math.floor(usableW / colSpacing));

      radicals.forEach((radical, i) => {
        const col = Math.floor(i / rows);
        const row = i % rows;

        // Clamp into bounds so a node is never lost, even in the pathological
        // case where spacing bottomed out before everything fit.
        const x = Math.min(
          TILE_MARGIN + Math.min(col, maxCols - 1) * colSpacing,
          width - TILE_MARGIN - 1,
        );
        const y = Math.min(
          TILE_MARGIN + row * rowSpacing,
          height - TILE_MARGIN - 1,
        );

        // Nudge off any tile already taken so two nodes never stack
        let px = x;
        let py = y;
        let guard = 0;
        while (occupied.has(`${px},${py}`) && guard < width * height) {
          px++;
          if (px >= width - TILE_MARGIN) { px = TILE_MARGIN; py++; }
          if (py >= height - TILE_MARGIN) py = TILE_MARGIN;
          guard++;
        }

        tiles[py][px] = TileType.ORE_NODE;
        occupied.add(`${px},${py}`);
        oreNodes.push({ radical, x: px, y: py, richness: 3 });
      });
    }

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

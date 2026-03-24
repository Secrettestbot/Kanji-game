import { DataManager } from '../data/DataManager';
import type { KanjiData } from '../types';

export class RecipeSystem {
  // Check if a collection of radicals matches any kanji recipe
  static findMatch(radicals: string[]): KanjiData | undefined {
    return DataManager.findKanjiFromRadicals(radicals);
  }

  // Get all radicals needed for a specific kanji
  static getRequiredRadicals(kanjiChar: string): string[] {
    return DataManager.getRecipe(kanjiChar) || [];
  }

  // Check if we have enough radicals to make a specific kanji
  static canProduce(kanjiChar: string, availableRadicals: Map<string, number>): boolean {
    const recipe = DataManager.getRecipe(kanjiChar);
    if (!recipe) return false;

    // Count required radicals
    const needed = new Map<string, number>();
    for (const r of recipe) {
      needed.set(r, (needed.get(r) || 0) + 1);
    }

    // Check availability
    for (const [radical, count] of needed) {
      if ((availableRadicals.get(radical) || 0) < count) return false;
    }
    return true;
  }

  // Consume radicals and return the kanji
  static produce(kanjiChar: string, availableRadicals: Map<string, number>): boolean {
    const recipe = DataManager.getRecipe(kanjiChar);
    if (!recipe) return false;

    // Consume
    for (const r of recipe) {
      const current = availableRadicals.get(r) || 0;
      if (current <= 0) return false;
      availableRadicals.set(r, current - 1);
    }
    return true;
  }

  // Get all kanji that can be made with currently available radicals
  static getProducibleKanji(availableRadicals: Map<string, number>): KanjiData[] {
    const results: KanjiData[] = [];
    for (const kanji of DataManager.getAllKanji()) {
      if (RecipeSystem.canProduce(kanji.character, availableRadicals)) {
        results.push(kanji);
      }
    }
    return results;
  }
}

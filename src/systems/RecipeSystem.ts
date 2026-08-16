import { DataManager } from '../data/DataManager';
import type { KanjiData } from '../types';

export class RecipeSystem {
  // Exact-set match: the given radicals are precisely one kanji's recipe.
  static findMatch(radicals: string[]): KanjiData | undefined {
    return DataManager.findKanjiFromRadicals(radicals);
  }

  /**
   * Best kanji producible from a furnace's radical pool (subset match).
   * Unlike findMatch, surplus radicals in the pool do not block production.
   */
  static findBestFromInventory(
    availableRadicals: Map<string, number>,
    exclude?: (k: KanjiData) => boolean,
  ): KanjiData | undefined {
    return DataManager.findBestKanjiFromInventory(availableRadicals, exclude);
  }

  /**
   * Consume exactly one kanji's recipe from the pool.
   * Returns false and leaves the pool untouched if the recipe is not fully covered.
   */
  static consume(kanjiChar: string, availableRadicals: Map<string, number>): boolean {
    if (!RecipeSystem.canProduce(kanjiChar, availableRadicals)) return false;

    const recipe = DataManager.getRecipe(kanjiChar) || [];
    for (const r of recipe) {
      const remaining = (availableRadicals.get(r) || 0) - 1;
      if (remaining <= 0) availableRadicals.delete(r);
      else availableRadicals.set(r, remaining);
    }
    return true;
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

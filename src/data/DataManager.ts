import type { KanjiData, RadicalData, WordData } from '../types';
import radicalsData from './radicals.json';
import kanjiData from './kanji.json';
import wordsData from './words.json';

class DataManagerClass {
  private radicals: Map<string, RadicalData> = new Map();
  private kanji: Map<string, KanjiData> = new Map();
  private words: WordData[] = [];
  private kanjiByRadical: Map<string, KanjiData[]> = new Map();

  constructor() {
    this.loadData();
  }

  private loadData(): void {
    // Load radicals
    for (const r of radicalsData) {
      this.radicals.set(r.character, r as RadicalData);
    }

    // Load kanji
    for (const k of kanjiData) {
      this.kanji.set(k.character, k as KanjiData);

      // Index by radical
      for (const rad of k.radicals) {
        if (!this.kanjiByRadical.has(rad)) {
          this.kanjiByRadical.set(rad, []);
        }
        this.kanjiByRadical.get(rad)!.push(k as KanjiData);
      }
    }

    // Load words
    this.words = wordsData as WordData[];
  }

  // Radical queries
  getRadical(character: string): RadicalData | undefined {
    return this.radicals.get(character);
  }

  getAllRadicals(): RadicalData[] {
    return Array.from(this.radicals.values());
  }

  getRadicalsByGroup(group: string): RadicalData[] {
    return this.getAllRadicals().filter(r => (r as RadicalData & { group?: string }).group === group);
  }

  // Kanji queries
  getKanji(character: string): KanjiData | undefined {
    return this.kanji.get(character);
  }

  getAllKanji(): KanjiData[] {
    return Array.from(this.kanji.values());
  }

  getKanjiByJLPT(level: number): KanjiData[] {
    return this.getAllKanji().filter(k => k.jlptLevel === level);
  }

  getKanjiUsingRadical(radical: string): KanjiData[] {
    return this.kanjiByRadical.get(radical) || [];
  }

  // Recipe: what radicals are needed to make this kanji?
  getRecipe(kanjiChar: string): string[] | undefined {
    const k = this.kanji.get(kanjiChar);
    return k?.radicals;
  }

  // Exact-set match: the radicals given are exactly one kanji's recipe.
  // Kept for callers that genuinely want an exact match.
  findKanjiFromRadicals(radicals: string[]): KanjiData | undefined {
    const sorted = [...radicals].sort();
    for (const k of this.kanji.values()) {
      const recipe = [...k.radicals].sort();
      if (recipe.length === sorted.length && recipe.every((r, i) => r === sorted[i])) {
        return k;
      }
    }
    return undefined;
  }

  /**
   * Subset match: find the best kanji producible from an inventory of radicals.
   * A furnace holds a pool of radicals; it should be able to build any recipe
   * fully covered by that pool, not only when the pool matches a recipe exactly.
   *
   * Preference order (so a pool of 一+二 builds 三 rather than just 一):
   *   1. most radicals consumed (favours complete/complex kanji)
   *   2. fewest strokes  (favours simpler, earlier-learned kanji on ties)
   *   3. codepoint order (deterministic final tie-break)
   */
  findBestKanjiFromInventory(
    available: Map<string, number>,
    exclude?: (k: KanjiData) => boolean,
  ): KanjiData | undefined {
    let best: KanjiData | undefined;

    for (const k of this.kanji.values()) {
      const recipe = k.radicals;
      if (!recipe || recipe.length === 0) continue;
      if (exclude?.(k)) continue;

      // Count required radicals for this recipe
      const needed = new Map<string, number>();
      for (const r of recipe) needed.set(r, (needed.get(r) || 0) + 1);

      // Is the whole recipe covered by the pool?
      let covered = true;
      for (const [radical, count] of needed) {
        if ((available.get(radical) || 0) < count) { covered = false; break; }
      }
      if (!covered) continue;

      if (!best) { best = k; continue; }

      if (recipe.length !== best.radicals.length) {
        if (recipe.length > best.radicals.length) best = k;
      } else if (k.strokeCount !== best.strokeCount) {
        if (k.strokeCount < best.strokeCount) best = k;
      } else if (k.character < best.character) {
        best = k;
      }
    }

    return best;
  }

  // Word queries
  getWordsForKanji(kanjiChar: string): WordData[] {
    return this.words.filter(w => w.kanji.includes(kanjiChar));
  }

  getWordsMadeFrom(availableKanji: string[]): WordData[] {
    return this.words.filter(w =>
      w.kanji.every(k => availableKanji.includes(k))
    );
  }

  getAllWords(): WordData[] {
    return this.words;
  }

  // Search
  searchKanji(query: string): KanjiData[] {
    const q = query.toLowerCase();
    return this.getAllKanji().filter(k =>
      k.character === query ||
      k.meanings.some(m => m.toLowerCase().includes(q)) ||
      k.onyomi.some(r => r.includes(query)) ||
      k.kunyomi.some(r => r.includes(query))
    );
  }
}

// Singleton
export const DataManager = new DataManagerClass();

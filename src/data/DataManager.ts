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

  // Check if a set of radicals can produce a kanji
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

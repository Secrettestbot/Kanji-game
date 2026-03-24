import { DataManager } from '../data/DataManager';
import { GameState } from '../state/GameState';

export interface AnalysisResult {
  sourceText: string;
  allKanji: string[];       // Every unique kanji found in text
  newKanji: string[];       // Kanji not yet in codex
  knownKanji: string[];     // Kanji already in codex
  unknownKanji: string[];   // Kanji not in our data (can't produce)
  producibleKanji: string[]; // New kanji we have recipes for
  radicalSet: string[];      // All radicals needed for producible kanji
  estimatedMinutes: number;
}

// CJK Unified Ideographs range
const CJK_REGEX = /[\u4e00-\u9fff]/g;

export class DocumentAnalyzer {
  static analyze(text: string): AnalysisResult {
    // Extract unique kanji from text
    const matches = text.match(CJK_REGEX) || [];
    const allKanji = [...new Set(matches)];

    const knownKanji: string[] = [];
    const newKanji: string[] = [];
    const unknownKanji: string[] = [];
    const producibleKanji: string[] = [];

    for (const char of allKanji) {
      const kanjiData = DataManager.getKanji(char);

      if (GameState.isKanjiUnlocked(char)) {
        knownKanji.push(char);
      } else if (kanjiData) {
        newKanji.push(char);
        // Check if we have radical data for its recipe
        if (kanjiData.radicals.length > 0) {
          producibleKanji.push(char);
        }
      } else {
        unknownKanji.push(char);
      }
    }

    // Collect all radicals needed
    const radicalSet = new Set<string>();
    for (const kanji of producibleKanji) {
      const recipe = DataManager.getRecipe(kanji);
      if (recipe) {
        for (const r of recipe) {
          radicalSet.add(r);
        }
      }
    }

    // Rough time estimate: ~30s per new kanji (extract + compose + gate)
    const estimatedMinutes = Math.max(1, Math.ceil(producibleKanji.length * 0.5));

    return {
      sourceText: text,
      allKanji,
      newKanji,
      knownKanji,
      unknownKanji,
      producibleKanji,
      radicalSet: [...radicalSet],
      estimatedMinutes,
    };
  }
}

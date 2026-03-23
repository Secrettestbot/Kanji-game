import { STARTING_INK_POINTS } from '../config';
import type { CodexEntry, PlayerState } from '../types';

class GameStateClass {
  private state: PlayerState;

  constructor() {
    this.state = this.createDefaultState();
  }

  private createDefaultState(): PlayerState {
    return {
      inkPoints: STARTING_INK_POINTS,
      codexEntries: {},
      completedScrolls: [],
      currentChapter: 1,
      tutorialCompleted: false,
      totalKanjiShipped: 0,
      newKanjiShipped: new Set<string>(),
    };
  }

  // Ink Points
  getInkPoints(): number {
    return this.state.inkPoints;
  }

  addInkPoints(amount: number): void {
    this.state.inkPoints += amount;
  }

  spendInkPoints(amount: number): boolean {
    if (this.state.inkPoints < amount) return false;
    this.state.inkPoints -= amount;
    return true;
  }

  // Codex
  isKanjiUnlocked(character: string): boolean {
    return !!this.state.codexEntries[character]?.unlocked;
  }

  unlockKanji(character: string): void {
    if (!this.state.codexEntries[character]) {
      this.state.codexEntries[character] = {
        character,
        unlocked: true,
        timesReviewed: 0,
        srsInterval: 1,
        srsTier: 1,
      };
    } else {
      this.state.codexEntries[character].unlocked = true;
    }
  }

  getCodexEntry(character: string): CodexEntry | undefined {
    return this.state.codexEntries[character];
  }

  getAllUnlockedKanji(): string[] {
    return Object.keys(this.state.codexEntries).filter(
      k => this.state.codexEntries[k].unlocked
    );
  }

  // SRS
  updateSRS(character: string, correct: boolean): void {
    const entry = this.state.codexEntries[character];
    if (!entry) return;

    entry.timesReviewed++;
    entry.lastReviewDate = Date.now();

    if (correct) {
      // Advance interval
      entry.srsInterval = Math.min(entry.srsInterval * 2, 365);
      if (entry.srsInterval > 30) entry.srsTier = 3;
      else if (entry.srsInterval > 7) entry.srsTier = 2;
      else entry.srsTier = 1;
    } else {
      // Reset to tier 1
      entry.srsInterval = 1;
      entry.srsTier = 1;
    }
  }

  getKanjiDueForReview(): string[] {
    const now = Date.now();
    return Object.values(this.state.codexEntries)
      .filter(entry => {
        if (!entry.unlocked || !entry.lastReviewDate) return entry.unlocked;
        const daysSinceReview = (now - entry.lastReviewDate) / (1000 * 60 * 60 * 24);
        return daysSinceReview >= entry.srsInterval;
      })
      .map(entry => entry.character);
  }

  // Shipping
  shipKanji(character: string): number {
    this.state.totalKanjiShipped++;
    const isNew = !this.state.newKanjiShipped.has(character);
    if (isNew) {
      this.state.newKanjiShipped.add(character);
    }
    const points = isNew ? 3 : 1; // 3x multiplier for new kanji
    this.addInkPoints(points);
    return points;
  }

  // Scrolls
  completeScroll(scrollId: string): void {
    if (!this.state.completedScrolls.includes(scrollId)) {
      this.state.completedScrolls.push(scrollId);
    }
  }

  isScrollCompleted(scrollId: string): boolean {
    return this.state.completedScrolls.includes(scrollId);
  }

  getCompletedScrolls(): string[] {
    return [...this.state.completedScrolls];
  }

  // Tutorial
  isTutorialCompleted(): boolean {
    return this.state.tutorialCompleted;
  }

  completeTutorial(): void {
    this.state.tutorialCompleted = true;
  }

  // Serialization
  serialize(): string {
    const serializable = {
      ...this.state,
      newKanjiShipped: Array.from(this.state.newKanjiShipped),
    };
    return JSON.stringify(serializable);
  }

  deserialize(json: string): void {
    const data = JSON.parse(json);
    this.state = {
      ...data,
      newKanjiShipped: new Set(data.newKanjiShipped || []),
    };
  }

  reset(): void {
    this.state = this.createDefaultState();
  }
}

export const GameState = new GameStateClass();

import { GameState } from '../state/GameState';
import { REWARDS } from '../config';

export class EconomySystem {
  static getInkPoints(): number {
    return GameState.getInkPoints();
  }

  static canAfford(cost: number): boolean {
    return GameState.getInkPoints() >= cost;
  }

  static spend(amount: number): boolean {
    return GameState.spendInkPoints(amount);
  }

  static shipKanji(character: string): { points: number; isNew: boolean } {
    const isNew = !GameState.isKanjiUnlocked(character);
    const points = isNew ? REWARDS.KANJI_SHIPPED * REWARDS.NEW_KANJI_MULTIPLIER : REWARDS.KANJI_SHIPPED;
    GameState.addInkPoints(points);

    if (isNew) {
      GameState.unlockKanji(character);
    }

    return { points, isNew };
  }

  static earnSRSReward(): void {
    GameState.addInkPoints(REWARDS.SRS_CORRECT);
  }

  static earnQuotaBonus(multiplier: number, basePoints: number): number {
    const bonus = Math.floor(basePoints * multiplier);
    GameState.addInkPoints(bonus);
    return bonus;
  }
}

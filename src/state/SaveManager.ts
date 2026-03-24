import { GameState } from './GameState';
import { FactoryState } from './FactoryState';

const SAVE_KEY = 'sumi_kojo_save';
const FACTORY_KEY = 'sumi_kojo_factory';

export class SaveManager {
  static save(): void {
    try {
      localStorage.setItem(SAVE_KEY, GameState.serialize());
      localStorage.setItem(FACTORY_KEY, JSON.stringify(FactoryState.getSnapshot()));
    } catch (e) {
      console.warn('Failed to save game:', e);
    }
  }

  static load(): boolean {
    try {
      const gameData = localStorage.getItem(SAVE_KEY);
      const factoryData = localStorage.getItem(FACTORY_KEY);

      if (gameData) {
        GameState.deserialize(gameData);
      }
      if (factoryData) {
        FactoryState.loadSnapshot(JSON.parse(factoryData));
      }

      return !!gameData;
    } catch (e) {
      console.warn('Failed to load save:', e);
      return false;
    }
  }

  static hasSave(): boolean {
    return !!localStorage.getItem(SAVE_KEY);
  }

  static deleteSave(): void {
    localStorage.removeItem(SAVE_KEY);
    localStorage.removeItem(FACTORY_KEY);
  }

  static autoSave(): void {
    SaveManager.save();
  }
}

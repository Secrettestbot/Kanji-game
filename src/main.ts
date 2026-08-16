import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { MainMenuScene } from './scenes/MainMenuScene';
import { GameScene } from './scenes/GameScene';
import { PronunciationGateScene } from './scenes/PronunciationGateScene';
import { CodexScene } from './scenes/CodexScene';
import { SRSReviewScene } from './scenes/SRSReviewScene';
import { CustomModeScene } from './scenes/CustomModeScene';
import { RevealScene } from './scenes/RevealScene';
import { SettingsScene } from './scenes/SettingsScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a1410',
  scene: [
    BootScene,
    MainMenuScene,
    GameScene,
    PronunciationGateScene,
    CodexScene,
    SRSReviewScene,
    CustomModeScene,
    RevealScene,
    SettingsScene,
  ],
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  input: {
    mouse: {
      preventDefaultWheel: true,
    },
  },
  render: {
    pixelArt: false,
    antialias: true,
  },
};

const game = new Phaser.Game(config);

// Debug handle: lets you inspect scenes and factory state from the browser
// console (e.g. __SUMI__.scene.getScene('GameScene').machines), and lets
// automated smoke tests drive the game. Harmless in a local single-player game.
(window as unknown as { __SUMI__: Phaser.Game }).__SUMI__ = game;

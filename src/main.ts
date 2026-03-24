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

new Phaser.Game(config);

import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#1a1410',
  scene: [BootScene, GameScene],
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

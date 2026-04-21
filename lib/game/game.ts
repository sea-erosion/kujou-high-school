/**
 * game.ts - Phaser game configuration
 */
import Phaser from 'phaser';
import { TitleScene }  from './scenes/TitleScene';
import { GameScene }   from './scenes/GameScene';
import { UIScene }     from './scenes/UIScene';
import { EditorScene } from './scenes/EditorScene';

export function createGame(parent: HTMLElement): Phaser.Game {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 800,
    height: 480,
    parent,
    backgroundColor: '#0a0a1a',
    pixelArt: true,
    antialias: false,
    physics: {
      default: 'arcade',
      arcade: { gravity: { x: 0, y: 900 }, debug: false },
    },
    scene: [TitleScene, GameScene, UIScene, EditorScene],
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    render: {
      pixelArt: true,
      antialias: false,
      antialiasGL: false,
    },
  };
  return new Phaser.Game(config);
}

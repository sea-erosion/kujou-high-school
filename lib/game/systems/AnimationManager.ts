/**
 * AnimationManager.ts
 * Slices canvas textures into named frames, then registers all animations.
 * Player sheet: 32x48, 14 cols x 6 rows
 * Enemy sheet:  32x48, 10 cols x 4 rows
 * FX sheet:     24x24, 10 cols x 6 rows
 */
export class AnimationManager {
  private scene: Phaser.Scene;
  constructor(scene: Phaser.Scene) { this.scene = scene; }

  registerAll() {
    this.sliceTexture('player', 32, 48, 14, 6);
    this.sliceTexture('enemy',  32, 48, 10, 4);
    this.sliceTexture('fx',     24, 24, 10, 6);
    this.registerPlayerAnims();
    this.registerEnemyAnims();
    this.registerFXAnims();
  }

  private sliceTexture(key: string, fw: number, fh: number, cols: number, rows: number) {
    const tex = this.scene.textures.get(key);
    if (!tex) return;
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const name = `${col}_${row}`;
        if (!tex.has(name)) tex.add(name, 0, col * fw, row * fh, fw, fh);
      }
    }
  }

  private frames(texKey: string, cols: number[], row: number): Phaser.Types.Animations.AnimationFrame[] {
    return cols.map(col => ({ key: texKey, frame: `${col}_${row}` }));
  }

  private anim(key: string, frames: Phaser.Types.Animations.AnimationFrame[], fps = 8, repeat = -1) {
    if (!this.scene.anims.exists(key))
      this.scene.anims.create({ key, frames, frameRate: fps, repeat });
  }

  private registerPlayerAnims() {
    const p = (k: string, c: number[], r: number, fps: number, rep: number) =>
      this.anim(k, this.frames('player', c, r), fps, rep);
    p('player_idle',     [0,1,2],     0, 6,  -1);
    p('player_run',      [0,1,2,3],   1, 10, -1);
    p('player_jump',     [0,1,2,3,4], 2, 10,  0);
    p('player_atk_fwd',  [0,1,2,3],   3, 14,  0);
    p('player_atk_up',   [4,5,6,7],   3, 14,  0);
    p('player_atk_dn',   [8,9,10,11], 3, 14,  0);
    p('player_guard',    [0,1,2],     4, 8,   0);
    p('player_dash',     [3,4,5],     4, 14,  0);
    p('player_roll',     [6,7,8,9],   4, 12,  0);
    p('player_hurt',     [0,1],       5, 10,  0);
    p('player_death',    [2,3,4],     5, 8,   0);
    p('player_finisher', [5,6,7,8,9], 5, 14,  0);
  }

  private registerEnemyAnims() {
    const e = (k: string, c: number[], r: number, fps: number, rep: number) =>
      this.anim(k, this.frames('enemy', c, r), fps, rep);
    e('thug_idle',  [0,1,2],   0, 6,  -1);
    e('thug_run',   [3,4,5,6], 0, 10, -1);
    e('thug_atk',   [7,8,9],   0, 12,  0);
    e('thug_hurt',  [0,1],     1, 10,  0);
    e('thug_death', [2,3],     1, 8,   0);
    e('thug2_idle', [4,5,6],   1, 6,  -1);
    e('thug2_run',  [7,8,9],   1, 10, -1);
    e('boss_idle',  [0,1,2],   2, 5,  -1);
    e('boss_run',   [3,4,5,6], 2, 8,  -1);
    e('boss_atk',   [7,8,9],   2, 10,  0);
    e('boss_hurt',  [0,1],     3, 8,   0);
    e('boss_death', [2,3],     3, 6,   0);
  }

  private registerFXAnims() {
    const f = (k: string, c: number[], r: number, fps: number) =>
      this.anim(k, this.frames('fx', c, r), fps, 0);
    f('fx_hit',    [0,1,2,3], 0, 16);
    f('fx_guard',  [4,5,6],   0, 14);
    f('fx_finish', [7,8,9],   0, 14);
  }
}

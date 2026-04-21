/**
 * GameScene.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * タイルマップシステム対応メインゲームシーン
 * 水平・垂直両方向スクロール、梯子、移動床、バネ、ピット、ワープ対応
 * ─────────────────────────────────────────────────────────────────────────────
 */

import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy, Thug, GangBoss } from '../entities/Enemy';
import { StatusType } from '../systems/StatusEffects';
import { TileMap, TS, LevelDef, EnemySpawnDef } from '../systems/TileSystem';
import { ALL_LEVELS } from '../systems/LevelData';

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemies: Enemy[] = [];
  private pendingEnemies: EnemySpawnDef[] = [];

  // タイルマップ
  private tileMap!: TileMap;
  private currentLevelIdx: number = 0;
  private currentLevel!: LevelDef;

  // Audio
  private audioContext?: AudioContext;
  private _sounds: Record<string, AudioBuffer> = {};

  // レベル状態
  private bossSpawned: boolean = false;
  private bossEnemy?: Enemy;
  private cleared: boolean = false;
  private warpCooldown: number = 0;

  // デバッグ
  private debugGraphics?: Phaser.GameObjects.Graphics;
  private showDebug: boolean = false;
  private tileDebugGraphics?: Phaser.GameObjects.Graphics;

  // カメラ追従設定
  private camLerpX: number = 0.08;
  private camLerpY: number = 0.08;

  constructor() {
    super({ key: 'GameScene' });
  }

  // ─── PRELOAD ──────────────────────────────

  preload() {
    if (!this.textures.exists('player')) {
      const { loadGeneratedAssets } = require('../assets/SpriteGenerator');
      loadGeneratedAssets(this);
    }
  }

  // ─── CREATE ───────────────────────────────

  create() {
    // アセット確認
    if (!this.textures.exists('player')) {
      const { loadGeneratedAssets } = require('../assets/SpriteGenerator');
      loadGeneratedAssets(this);
    }
    if (!this.anims.exists('player_idle')) {
      const { AnimationManager } = require('../systems/AnimationManager');
      new AnimationManager(this).registerAll();
    }

    this.currentLevel = this.customLevel ?? ALL_LEVELS[this.currentLevelIdx];
    this.cleared = false;
    this.bossSpawned = false;
    this.bossEnemy = undefined;
    this.enemies = [];
    this.warpCooldown = 0;

    // ── 物理設定 ─────────────────────────────

    this.physics.world.gravity.y = this.currentLevel.gravity;

    // ── タイルマップ構築 ──────────────────────

    this.buildTileMap();

    // ── 背景 ─────────────────────────────────

    this.setupBackground();

    // ── プレイヤー ───────────────────────────

    const { x: spawnWx, y: spawnWy } = this.tileMap.tileToWorld(
      this.currentLevel.playerStart.x,
      this.currentLevel.playerStart.y
    );
    this.player = new Player(this, spawnWx, spawnWy - TS);
    this.wirePlayerCallbacks();

    // ── コライダー設定 ────────────────────────

    this.setupCollisions();

    // ── 敵スポーン ───────────────────────────

    this.pendingEnemies = [...this.currentLevel.enemies];
    this.spawnInitialEnemies();

    // ── カメラ ───────────────────────────────

    this.setupCamera();

    // ── オーディオ ───────────────────────────

    this.setupAudio();

    // ── UI シーン ────────────────────────────

    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }

    // ── デバッグ ─────────────────────────────

    this.debugGraphics      = this.add.graphics().setDepth(98);
    this.tileDebugGraphics  = this.add.graphics().setDepth(97);
    this.input.keyboard!.addKey('F1').on('down', () => {
      this.showDebug = !this.showDebug;
      if (!this.showDebug) {
        this.debugGraphics?.clear();
        this.tileDebugGraphics?.clear();
      }
    });

    // ── レベルラベル ─────────────────────────

    this.showLevelBanner(this.currentLevel.name);

    // 初期HP emit
    this.time.delayedCall(100, () => {
      this.events.emit('hpChanged', this.player.hp, this.player.maxHp);
    });

    this.cameras.main.fadeIn(500, 0, 0, 0);
  }

  // ─── タイルマップ構築 ─────────────────────

  private buildTileMap() {
    this.physics.world.setBounds(
      0, 0,
      this.currentLevel.mapWidth  * TS,
      this.currentLevel.mapHeight * TS
    );
    this.tileMap = new TileMap(this, this.currentLevel);
  }

  // ─── 背景 ────────────────────────────────

  private setupBackground() {
    const W = this.tileMap.pixelWidth;
    const H = this.tileMap.pixelHeight;
    const bgColor = this.currentLevel.bgColor;

    // グラデーション背景
    const bgGfx = this.add.graphics().setDepth(-4).setScrollFactor(0.05);
    bgGfx.fillGradientStyle(
      bgColor, bgColor,
      (bgColor + 0x0a0520) & 0xffffff, (bgColor + 0x0a0520) & 0xffffff,
      1
    );
    bgGfx.fillRect(0, 0, W, H);

    // 背景建物シルエット
    if (this.textures.exists('bg0')) {
      this.add.image(0, 0, 'bg0')
        .setOrigin(0, 0).setDisplaySize(W, H)
        .setScrollFactor(0.05).setDepth(-3).setAlpha(0.6);
    }
    if (this.textures.exists('bg1')) {
      this.add.image(0, 0, 'bg1')
        .setOrigin(0, 0).setDisplaySize(W, H)
        .setScrollFactor(0.2).setDepth(-2).setAlpha(0.7);
    }
    if (this.textures.exists('bg2')) {
      this.add.image(0, 0, 'bg2')
        .setOrigin(0, 0).setDisplaySize(W, H)
        .setScrollFactor(0.5).setDepth(-1).setAlpha(0.5);
    }

    // レベル固有の装飾
    this.addLevelSpecificBG();
  }

  private addLevelSpecificBG() {
    const W  = this.tileMap.pixelWidth;
    const H  = this.tileMap.pixelHeight;
    const gfx = this.add.graphics().setDepth(0).setScrollFactor(0.15);

    if (this.currentLevelIdx === 0) {
      // 1F廊下: 床の蛍光灯
      for (let x = 80; x < W; x += 128) {
        gfx.fillStyle(0xffee88, 0.12);
        gfx.fillRect(x, 0, 60, H);
        gfx.fillStyle(0xffee88, 0.35);
        gfx.fillRect(x + 20, 0, 20, 4);
      }
    } else if (this.currentLevelIdx === 1) {
      // 校舎内部: 縦方向強調グリッド
      for (let y = 0; y < H; y += TS * 10) {
        gfx.fillStyle(0x330066, 0.1);
        gfx.fillRect(0, y, W, 2);
      }
      for (let x = 0; x < W; x += TS * 5) {
        gfx.fillStyle(0x220044, 0.08);
        gfx.fillRect(x, 0, 1, H);
      }
    } else if (this.currentLevelIdx === 2) {
      // 屋上: 赤警告ライン
      for (let x = 0; x < W; x += 64) {
        gfx.fillStyle(x % 128 < 64 ? 0x331111 : 0x220a0a, 0.4);
        gfx.fillRect(x, H - 32, 64, 32);
      }
      // 月光
      gfx.fillStyle(0xaaaaff, 0.06);
      gfx.fillCircle(W * 0.7, -20, 80);
    }
  }

  // ─── コライダー ───────────────────────────

  private setupCollisions() {
    const p = this.player.sprite;
    const tm = this.tileMap;

    // プレイヤー ↔ ソリッドタイル
    this.physics.add.collider(p, tm.solidGroup);

    // プレイヤー ↔ 片側プラットフォーム
    this.physics.add.collider(p, tm.platformGroup, undefined, (player, platform) => {
      const pb = (player as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
      // 上から乗っているときのみ衝突
      return pb.velocity.y >= 0 && pb.bottom <= (platform as any).body.top + 4;
    });

    // プレイヤー ↔ 移動床（毎フレーム手動処理）
    // 移動床との衝突は update() で overlap チェック

    // プレイヤー ↔ 梯子（重なり検知）
    this.physics.add.overlap(p, tm.ladderGroup, () => {
      this.player.nearLadder = true;
    });

    // プレイヤー ↔ ハザード
    this.physics.add.overlap(p, tm.hazardGroup, (_p, hazard) => {
      const dmg = (hazard as any).__damage ?? 10;
      this.player.takeDamage(dmg, false);
    });

    // プレイヤー ↔ バネ
    this.physics.add.overlap(p, tm.springGroup, () => {
      this.player.onSpring = true;
    });

    // プレイヤー ↔ ワープ
    this.physics.add.overlap(p, tm.warpGroup, () => {
      if (this.warpCooldown > 0) return;
      const dest = this.tileMap.getWarpDest(this.player.x, this.player.y);
      if (dest) {
        this.warpCooldown = 1500;
        this.triggerWarp(dest.x, dest.y);
      }
    });

    // プレイヤー ↔ ブレイカブルブロック（攻撃で破壊）
    this.physics.add.collider(p, tm.solidGroup);

    // プレイヤー ↔ ワールド境界
    this.player.sprite.setCollideWorldBounds(true);

    // 敵のコライダーはspawnEnemy()内で設定
  }

  // ─── カメラ ───────────────────────────────

  private setupCamera() {
    const W = this.tileMap.pixelWidth;
    const H = this.tileMap.pixelHeight;

    this.cameras.main.setBounds(0, 0, W, H);
    this.cameras.main.startFollow(
      this.player.sprite,
      true,
      this.camLerpX,
      this.camLerpY
    );
    // ズーム: 縦に長いステージはズームアウト
    const targetZoom = this.currentLevelIdx === 1 ? 1.2 : 1.0;
    this.cameras.main.setZoom(targetZoom);
  }

  // ─── 敵スポーン ───────────────────────────

  private spawnInitialEnemies() {
    const initial = this.pendingEnemies.filter(e => !e.triggerTileX);
    this.pendingEnemies = this.pendingEnemies.filter(e => e.triggerTileX);
    initial.forEach(e => this.spawnEnemy(e));
  }

  private spawnEnemy(def: EnemySpawnDef): Enemy {
    const wx = def.tileX * TS;
    const wy = def.tileY * TS;
    let enemy: Enemy;

    if (def.type === 'boss') {
      enemy = new GangBoss(this, wx, wy);
      this.bossEnemy = enemy;
      this.bossSpawned = true;
      this.announceBoss(enemy);
    } else {
      enemy = new Thug(this, wx, wy, def.type === 'thug_red' ? 'red' : 'blue');
    }

    // 敵のコライダー登録
    this.physics.add.collider(enemy.sprite, this.tileMap.solidGroup);
    this.physics.add.collider(enemy.sprite, this.tileMap.platformGroup, undefined, (e, p) => {
      const eb = (e as Phaser.Physics.Arcade.Sprite).body as Phaser.Physics.Arcade.Body;
      return eb.velocity.y >= 0 && eb.bottom <= (p as any).body.top + 4;
    });

    this.enemies.push(enemy);
    return enemy;
  }

  private announceBoss(enemy: Enemy) {
    this.time.delayedCall(200, () => {
      this.events.emit('bossHpChanged', enemy.hp, enemy.maxHp, '番長「鬼頭組長」');
      this.cameras.main.shake(400, 0.015);
      this.cameras.main.flash(200, 60, 0, 0);
      const W = this.scale.width;
      const txt = this.add.text(W / 2, 80, '⚠ BOSS ⚠', {
        fontSize: '32px', fontFamily: 'monospace', color: '#ff2222',
        stroke: '#000', strokeThickness: 4
      }).setOrigin(0.5).setDepth(30).setScrollFactor(0);
      this.tweens.add({ targets: txt, alpha: 0, y: 50, duration: 1500, delay: 1000, onComplete: () => txt.destroy() });
    });
  }

  // ─── プレイヤーコールバック ────────────────

  private wirePlayerCallbacks() {
    this.player.onHpChanged = (hp, max) => this.events.emit('hpChanged', hp, max);
    this.player.onComboChanged = count => this.events.emit('comboChanged', count);
    this.player.onStatusChanged = statuses => {
      this.events.emit('statusChanged', statuses);
      this.events.emit('blindChanged', statuses.includes('blind'));
    };
    this.player.onWarp = (wx, wy) => this.triggerWarp(wx, wy);
  }

  // ─── ワープ処理 ────────────────────────────

  private triggerWarp(toX: number, toY: number) {
    this.cameras.main.flash(300, 150, 0, 200);
    this.cameras.main.shake(150, 0.008);
    // ワープエフェクト
    const gfx = this.add.graphics().setDepth(50);
    gfx.fillStyle(0xcc66ff, 0.8);
    gfx.fillCircle(this.player.x, this.player.y, 30);
    this.tweens.add({
      targets: gfx, scaleX: 0, scaleY: 0, alpha: 0, duration: 300,
      onComplete: () => gfx.destroy()
    });
    this.time.delayedCall(150, () => {
      this.player.sprite.setPosition(toX, toY);
      (this.player.sprite.body as Phaser.Physics.Arcade.Body).reset(toX, toY);
    });
    try { this.sound.play('sfx_dash', { volume: 0.6 }); } catch(_){}
  }

  // ─── レベルバナー ────────────────────────

  private showLevelBanner(name: string) {
    const W = this.scale.width;
    const banner = this.add.text(W / 2, 60, name, {
      fontSize: '22px', fontFamily: 'monospace', color: '#ccaaff',
      stroke: '#000', strokeThickness: 4,
      backgroundColor: '#00000055',
      padding: { x: 16, y: 6 }
    }).setOrigin(0.5).setDepth(30).setScrollFactor(0).setAlpha(0);

    this.tweens.add({ targets: banner, alpha: 1, duration: 400 });
    this.time.delayedCall(1600, () => {
      this.tweens.add({ targets: banner, alpha: 0, duration: 500, onComplete: () => banner.destroy() });
    });
  }

  // ─── オーディオ ───────────────────────────

  private setupAudio() {
    try {
      this.audioContext = new AudioContext();
      const ac = this.audioContext;
      const tone = (freq: number, dur: number, type: OscillatorType = 'square', vol = 0.3): AudioBuffer => {
        const sr = ac.sampleRate;
        const len = Math.floor(sr * dur);
        const buf = ac.createBuffer(1, len, sr);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) {
          const t = i / sr;
          let s = 0;
          if (type === 'square')   s = Math.sin(2*Math.PI*freq*t) > 0 ? vol : -vol;
          else if (type==='sawtooth') s = vol*(2*(t*freq-Math.floor(t*freq+0.5)));
          else                     s = vol*Math.sin(2*Math.PI*freq*t);
          const attack = 0.01, release = 0.1;
          const env = t<attack?t/attack:t>dur-release?(dur-t)/release:1;
          data[i] = s * env;
        }
        return buf;
      };
      this._sounds = {
        sfx_jump:   tone(440, 0.12, 'square',   0.2),
        sfx_dash:   tone(280, 0.1,  'sawtooth', 0.2),
        sfx_swing:  tone(220, 0.08, 'square',   0.25),
        sfx_impact: tone(160, 0.15, 'square',   0.4),
        sfx_guard:  tone(660, 0.1,  'sine',     0.3),
        sfx_hurt:   tone(120, 0.2,  'sawtooth', 0.35),
        sfx_warp:   tone(880, 0.3,  'sine',     0.25),
        sfx_spring: tone(550, 0.1,  'square',   0.3),
      };
      const origPlay = this.sound.play.bind(this.sound);
      this.sound.play = (key: string, config?: any): any => {
        if (this._sounds?.[key] && this.audioContext) {
          this.playBuffer(this._sounds[key], config?.volume ?? 0.3);
        }
        return { destroy: () => {} } as any;
      };
    } catch { /* audio optional */ }
  }

  private playBuffer(buf: AudioBuffer, vol = 0.3) {
    if (!this.audioContext) return;
    const src  = this.audioContext.createBufferSource();
    const gain = this.audioContext.createGain();
    src.buffer = buf;
    gain.gain.value = vol;
    src.connect(gain);
    gain.connect(this.audioContext.destination);
    src.start();
  }

  // ─── MAIN UPDATE ──────────────────────────

  update(time: number, delta: number) {
    if (!this.player) return;

    const dt = delta / 1000;

    // クールダウン
    if (this.warpCooldown > 0) this.warpCooldown -= delta;

    // ── タイルマップ更新（移動床） ─────────────
    this.tileMap.update(delta);

    // ── プレイヤーの梯子・バネリセット ──────────
    this.player.nearLadder = false;
    this.player.onSpring   = false;

    // ── 移動床との乗り移り ─────────────────────
    this.updateMovingPlatformRider(dt);

    // ── プレイヤー更新 ────────────────────────
    this.player.update(time, delta);

    // ── ウェーブトリガー ─────────────────────
    this.checkWaveTriggers();

    // ── 敵更新・ヒット判定 ───────────────────
    this.updateEnemies(time, delta);

    // ── プレイヤーのヒット → 敵 ──────────────
    this.checkPlayerHitsEnemies();

    // ── ブレイカブル攻撃 ─────────────────────
    if (this.player.hitbox.active) {
      this.checkBreakableHit();
    }

    // ── 死亡・クリア判定 ─────────────────────
    this.checkEndConditions();

    // ── デバッグ描画 ─────────────────────────
    if (this.showDebug) this.drawDebug();
    else {
      this.debugGraphics?.clear();
      this.tileDebugGraphics?.clear();
    }
  }

  // ─── 移動床の乗り移り処理 ────────────────

  private updateMovingPlatformRider(dt: number) {
    const px = this.player.sprite;
    const pBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;

    for (const mp of this.tileMap.movingPlatforms) {
      const mpBody = mp.body.body as Phaser.Physics.Arcade.Body;
      const mpTop = mp.body.y - mp.body.displayHeight / 2;
      const pBottom = pBody.bottom;
      const pLeft   = pBody.left;
      const pRight  = pBody.right;
      const mLeft   = mp.body.x - mp.body.displayWidth / 2;
      const mRight  = mp.body.x + mp.body.displayWidth / 2;

      // プレイヤーが移動床の上に乗っているか
      const onTop = (
        pBottom >= mpTop - 4 &&
        pBottom <= mpTop + 8 &&
        pRight  >= mLeft &&
        pLeft   <= mRight &&
        pBody.velocity.y >= 0
      );

      if (onTop) {
        // 移動床の速度を加算（摩擦による追従）
        const vel = mpBody.velocity;
        this.player.movingPlatformVel = { x: vel.x, y: vel.y };
        pBody.setVelocityX(pBody.velocity.x + vel.x * dt * 60);
        if (vel.y < 0) {
          pBody.setVelocityY(vel.y);
        }
        // 衝突処理
        if (pBody.velocity.y > 0) {
          px.setY(mpTop - pBody.height / 2);
          pBody.setVelocityY(0);
          (pBody as any).blocked.down = true;
        }
      } else {
        if (this.player.movingPlatformVel.x !== 0 || this.player.movingPlatformVel.y !== 0) {
          this.player.movingPlatformVel = { x: 0, y: 0 };
        }
      }

      // 移動床の物理体を更新（staticなのでリセット必要）
      mpBody.reset(mp.body.x, mp.body.y);
    }
  }

  // ─── 敵更新 ───────────────────────────────

  private updateEnemies(time: number, delta: number) {
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.isDead) {
        this.enemies.splice(i, 1);
        continue;
      }
      enemy.update(time, delta, this.player.x, this.player.y);

      // 敵ヒットボックス → プレイヤー
      if (enemy.hitbox.active && !this.player.isInvincible) {
        if (this.rectsOverlap(
          enemy.hitbox.x - enemy.hitbox.w / 2, enemy.hitbox.y - enemy.hitbox.h / 2,
          enemy.hitbox.w, enemy.hitbox.h,
          this.player.x - 12, this.player.y - 20, 24, 40
        )) {
          this.player.takeDamage(enemy.hitbox.damage, true, enemy.x);
          enemy.hitbox.active = false;
          // ボスからランダムステータス
          if (enemy.isBoss && Math.random() < 0.3) {
            const statuses: StatusType[] = ['shock', 'bleed', 'paralysis'];
            this.player.statusEffects.apply(statuses[Math.floor(Math.random() * statuses.length)]);
            this.player.onStatusChanged?.(this.player.statusEffects.getAll());
          }
        }
      }
    }
  }

  // ─── プレイヤー攻撃 → 敵 ─────────────────

  private checkPlayerHitsEnemies() {
    if (!this.player.hitbox.active) return;
    const hb = this.player.hitbox;

    for (const enemy of this.enemies) {
      if (enemy.isDead) continue;
      if (this.rectsOverlap(
        hb.x - hb.w / 2, hb.y - hb.h / 2, hb.w, hb.h,
        enemy.x - 16, enemy.y - 30, 32, 50
      )) {
        const isFinisher = hb.isFinisher;
        enemy.takeDamage(
          hb.damage,
          true,
          this.player.x,
          this.getAttackStatus(isFinisher)
        );
        // ヒットFX
        const fxKey = isFinisher ? 'fx_finish' : 'fx_hit';
        const fx = this.add.sprite(enemy.x, enemy.y - 20, 'fx').setDepth(20);
        fx.play(fxKey);
        fx.once('animationcomplete', () => fx.destroy());

        if (isFinisher) this.player.triggerFinisherEffect();

        this.player.hitbox.active = false; // 1敵ヒットで終了

        if (enemy.isBoss) {
          this.events.emit('bossHpChanged', Math.max(0, enemy.hp), enemy.maxHp, '番長「鬼頭組長」');
        }
      }
    }
  }

  // ─── 破壊ブロック攻撃 ────────────────────

  private checkBreakableHit() {
    const hb = this.player.hitbox;
    const { col: hCol, row: hRow } = this.tileMap.worldToTile(hb.x, hb.y);
    // 攻撃範囲周辺の数タイルをチェック
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const id = this.tileMap.getTileAt(hCol + dc, hRow + dr);
        if (id === 15 /* BREAKABLE */) {
          this.tileMap.breakTileAt(hCol + dc, hRow + dr);
        }
      }
    }
  }

  // ─── ウェーブトリガー ─────────────────────

  private checkWaveTriggers() {
    const playerTileX = Math.floor(this.player.x / TS);
    const toSpawn = this.pendingEnemies.filter(
      e => e.triggerTileX !== undefined && playerTileX >= e.triggerTileX
    );
    if (toSpawn.length === 0) return;
    this.pendingEnemies = this.pendingEnemies.filter(e => !toSpawn.includes(e));
    toSpawn.forEach(e => {
      this.time.delayedCall(Math.random() * 300, () => this.spawnEnemy(e));
    });
  }

  // ─── 終了条件 ────────────────────────────

  private checkEndConditions() {
    // プレイヤー死亡
    if (this.player.isDead && !this.cleared) {
      this.cleared = true;
      this.time.delayedCall(1500, () => {
        if (this.returnToEditor) {
          this.cameras.main.fadeOut(400, 0, 0, 0);
          this.time.delayedCall(400, () => {
            this.scene.stop('UIScene');
            this.scene.stop('GameScene');
            this.scene.start('EditorScene');
          });
        } else {
          this.events.emit('playerDead');
        }
      });
      return;
    }

    // ボス撃破
    if (this.bossSpawned && this.bossEnemy?.isDead && !this.cleared) {
      this.cleared = true;
      this.time.delayedCall(2000, () => {
        // 次のレベルへ
        if (this.currentLevelIdx < ALL_LEVELS.length - 1) {
          this.transitionToNextLevel();
        } else {
          this.events.emit('levelClear');
        }
      });
    }
  }

  // ─── レベル遷移 ──────────────────────────

  private transitionToNextLevel() {
    this.cameras.main.fadeOut(600, 0, 0, 0);
    this.time.delayedCall(600, () => {
      if (this.returnToEditor) {
        // エディタプレイテストからなのでエディタに戻る
        this.scene.stop('GameScene');
        this.scene.start('EditorScene');
        return;
      }
      this.currentLevelIdx++;
      this.scene.restart({ levelIdx: this.currentLevelIdx });
    });
  }

  // カスタムレベル（エディタから）
  private customLevel: LevelDef | null = null;
  private returnToEditor: boolean = false;

  init(data: { levelIdx?: number; customLevel?: LevelDef; returnToEditor?: boolean }) {
    if (data?.levelIdx !== undefined) {
      this.currentLevelIdx = data.levelIdx;
    }
    this.customLevel    = data?.customLevel ?? null;
    this.returnToEditor = data?.returnToEditor ?? false;
  }

  // ─── ヘルパー ────────────────────────────

  private getAttackStatus(isFinisher: boolean): StatusType | undefined {
    if (!isFinisher) return undefined;
    const s: StatusType[] = ['bleed', 'shock', 'freeze', 'burn'];
    return s[Math.floor(Math.random() * s.length)];
  }

  private rectsOverlap(ax: number, ay: number, aw: number, ah: number,
                        bx: number, by: number, bw: number, bh: number): boolean {
    return ax < bx+bw && ax+aw > bx && ay < by+bh && ay+ah > by;
  }

  // ─── デバッグ描画 ─────────────────────────

  private drawDebug() {
    const g  = this.debugGraphics!;
    const tg = this.tileDebugGraphics!;
    g.clear();
    tg.clear();

    // プレイヤーヒットボックス
    const hb = this.player.hitbox;
    if (hb.active) {
      g.lineStyle(1, 0x00ff00, 1);
      g.strokeRect(hb.x - hb.w/2, hb.y - hb.h/2, hb.w, hb.h);
    }
    // プレイヤー判定ボックス
    const pb = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    g.lineStyle(1, 0x00ffff, 0.5);
    g.strokeRect(pb.left, pb.top, pb.width, pb.height);

    // 敵ヒットボックス
    for (const e of this.enemies) {
      if (e.hitbox.active) {
        g.lineStyle(1, 0xff2200, 1);
        g.strokeRect(e.hitbox.x - e.hitbox.w/2, e.hitbox.y - e.hitbox.h/2, e.hitbox.w, e.hitbox.h);
      }
      const eb = e.sprite.body as Phaser.Physics.Arcade.Body;
      g.lineStyle(1, 0xff6600, 0.4);
      g.strokeRect(eb.left, eb.top, eb.width, eb.height);
    }

    // 移動床の当たり判定
    for (const mp of this.tileMap.movingPlatforms) {
      const mb = mp.body.body as Phaser.Physics.Arcade.Body;
      g.lineStyle(1, 0xffff00, 0.8);
      g.strokeRect(mb.left, mb.top, mb.width, mb.height);
    }

    // プレイヤー状態ラベル
    const stateInfo = [
      `pos: (${Math.floor(this.player.x)}, ${Math.floor(this.player.y)})`,
      `tile: (${Math.floor(this.player.x/TS)}, ${Math.floor(this.player.y/TS)})`,
      `climb: ${this.player.climbing}`,
      `nearLadder: ${this.player.nearLadder}`,
      `vel: (${Math.floor(pb.velocity.x)}, ${Math.floor(pb.velocity.y)})`,
    ];
    stateInfo.forEach((line, i) => {
      const existing = this.children.getByName(`dbg_${i}`) as Phaser.GameObjects.Text | null;
      if (existing) {
        existing.setPosition(this.player.x - 40, this.player.y - 90 + i * 12);
        existing.setText(line);
      } else {
        this.add.text(this.player.x - 40, this.player.y - 90 + i * 12, line, {
          fontSize: '8px', color: '#00ffcc', backgroundColor: '#00000088'
        }).setDepth(99).setName(`dbg_${i}`);
      }
    });
  }
}

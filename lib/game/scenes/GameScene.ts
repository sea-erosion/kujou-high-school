/**
 * GameScene.ts
 * Main gameplay scene: level layout, enemy spawning, collision, camera, audio
 */

import Phaser from 'phaser';
import { Player } from '../entities/Player';
import { Enemy, Thug, GangBoss } from '../entities/Enemy';
import { StatusType } from '../systems/StatusEffects';

// ─── LEVEL DEFINITION ────────────────────────

interface PlatformDef {
  x: number; y: number; w: number; h: number;
  type: 'floor' | 'platform' | 'wall';
}

interface EnemySpawn {
  x: number; y: number;
  type: 'thug' | 'thug_red' | 'boss';
  trigger?: number; // x position that triggers this wave
}

const LEVEL_1: { platforms: PlatformDef[]; enemies: EnemySpawn[]; width: number; height: number } = {
  width: 3200,
  height: 600,
  platforms: [
    // Ground
    { x: 0,    y: 480, w: 3200, h: 20,  type: 'floor' },
    // Walls
    { x: 0,    y: 0,   w: 16,   h: 480, type: 'wall' },
    { x: 3184, y: 0,   w: 16,   h: 480, type: 'wall' },
    // Platforms (school corridor)
    { x: 200,  y: 380, w: 160,  h: 12,  type: 'platform' },
    { x: 450,  y: 320, w: 120,  h: 12,  type: 'platform' },
    { x: 650,  y: 260, w: 140,  h: 12,  type: 'platform' },
    { x: 880,  y: 340, w: 120,  h: 12,  type: 'platform' },
    { x: 1100, y: 280, w: 160,  h: 12,  type: 'platform' },
    // Staircase area
    { x: 1300, y: 420, w: 100,  h: 12,  type: 'platform' },
    { x: 1400, y: 360, w: 100,  h: 12,  type: 'platform' },
    { x: 1500, y: 300, w: 100,  h: 12,  type: 'platform' },
    // Mid section
    { x: 1700, y: 380, w: 200,  h: 12,  type: 'platform' },
    { x: 2000, y: 300, w: 180,  h: 12,  type: 'platform' },
    // Boss arena approach
    { x: 2300, y: 380, w: 120,  h: 12,  type: 'platform' },
    { x: 2500, y: 310, w: 100,  h: 12,  type: 'platform' },
    // Boss arena platforms
    { x: 2700, y: 400, w: 500,  h: 12,  type: 'platform' },
    { x: 2780, y: 300, w: 180,  h: 12,  type: 'platform' },
  ],
  enemies: [
    // Wave 1: intro thugs
    { x: 400,  y: 440, type: 'thug' },
    { x: 550,  y: 440, type: 'thug' },
    // Wave 2: platform ambush
    { x: 800,  y: 440, type: 'thug_red', trigger: 600 },
    { x: 900,  y: 440, type: 'thug',     trigger: 600 },
    // Wave 3: corridor
    { x: 1200, y: 440, type: 'thug',     trigger: 1000 },
    { x: 1350, y: 440, type: 'thug_red', trigger: 1000 },
    { x: 1450, y: 440, type: 'thug',     trigger: 1000 },
    // Wave 4: heavy
    { x: 1800, y: 440, type: 'thug_red', trigger: 1600 },
    { x: 1950, y: 440, type: 'thug_red', trigger: 1600 },
    { x: 2100, y: 440, type: 'thug',     trigger: 1600 },
    // Wave 5: pre-boss
    { x: 2400, y: 440, type: 'thug',     trigger: 2200 },
    { x: 2500, y: 440, type: 'thug_red', trigger: 2200 },
    // BOSS
    { x: 2900, y: 430, type: 'boss',     trigger: 2700 },
  ],
};

// ─── GAME SCENE ──────────────────────────────

export class GameScene extends Phaser.Scene {
  private player!: Player;
  private enemies: Enemy[] = [];
  private pendingEnemies: EnemySpawn[] = [];
  private platforms!: Phaser.Physics.Arcade.StaticGroup;
  private backgroundLayers: Phaser.GameObjects.TileSprite[] = [];

  // Audio
  private bgMusic?: Phaser.Sound.BaseSound;
  private audioContext?: AudioContext;

  // Level state
  private levelWidth: number = LEVEL_1.width;
  private bossSpawned: boolean = false;
  private bossEnemy?: Enemy;
  private cleared: boolean = false;

  // Debug
  private debugGraphics?: Phaser.GameObjects.Graphics;
  private showDebug: boolean = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  // ─── PRELOAD ──────────────────────────────

  preload() {
    // Assets are canvas-generated; loaded in TitleScene
    // If coming directly, generate them
    if (!this.textures.exists('player')) {
      const { loadGeneratedAssets } = require('../assets/SpriteGenerator');
      loadGeneratedAssets(this);
      const { AnimationManager } = require('../systems/AnimationManager');
      new AnimationManager(this).registerAll();
    }
  }

  // ─── CREATE ───────────────────────────────

  create() {
    const { width: W, height: H } = this.scale;

    // Ensure assets loaded
    if (!this.textures.exists('player')) {
      const { loadGeneratedAssets } = require('../assets/SpriteGenerator');
      loadGeneratedAssets(this);
    }
    if (!this.anims.exists('player_idle')) {
      const { AnimationManager } = require('../systems/AnimationManager');
      new AnimationManager(this).registerAll();
    }

    // Physics world bounds
    this.physics.world.setBounds(0, 0, this.levelWidth, 600);
    this.physics.world.gravity.y = 900;

    // ── BACKGROUND LAYERS (parallax) ──────────

    this.setupBackground(W, H);

    // ── PLATFORM TILES ────────────────────────

    this.buildLevel();

    // ── PLAYER ────────────────────────────────

    this.player = new Player(this, 80, 420);

    // Wire UI events
    this.player.onHpChanged = (hp, max) => {
      this.events.emit('hpChanged', hp, max);
    };
    this.player.onComboChanged = (count) => {
      this.events.emit('comboChanged', count);
    };
    this.player.onStatusChanged = (statuses) => {
      this.events.emit('statusChanged', statuses);
      // Check blind
      this.events.emit('blindChanged', statuses.includes('blind'));
    };

    // ── ENEMIES ───────────────────────────────

    this.pendingEnemies = [...LEVEL_1.enemies];
    this.spawnInitialEnemies();

    // ── CAMERA ────────────────────────────────

    this.cameras.main.setBounds(0, 0, this.levelWidth, 600);
    this.cameras.main.startFollow(this.player.sprite, true, 0.1, 0.1);
    this.cameras.main.setZoom(1);
    this.cameras.main.fadeIn(400, 0, 0, 0);

    // ── COLLISIONS ────────────────────────────

    this.setupCollisions();

    // ── AUDIO ─────────────────────────────────

    this.setupAudio();

    // ── UI SCENE ──────────────────────────────

    if (!this.scene.isActive('UIScene')) {
      this.scene.launch('UIScene');
    }

    // ── DEBUG ────────────────────────────────

    this.debugGraphics = this.add.graphics().setDepth(99);
    this.input.keyboard!.addKey('F1').on('down', () => {
      this.showDebug = !this.showDebug;
    });

    // Initial HP emit
    this.time.delayedCall(100, () => {
      this.events.emit('hpChanged', this.player.hp, this.player.maxHp);
    });
  }

  // ─── BACKGROUND ───────────────────────────

  private setupBackground(W: number, H: number) {
    // Sky (static)
    if (this.textures.exists('bg0')) {
      this.add.image(0, 0, 'bg0')
        .setOrigin(0, 0)
        .setDisplaySize(this.levelWidth, H)
        .setScrollFactor(0.1)
        .setDepth(-3);
    }
    if (this.textures.exists('bg1')) {
      this.add.image(0, 0, 'bg1')
        .setOrigin(0, 0)
        .setDisplaySize(this.levelWidth, H)
        .setScrollFactor(0.3)
        .setDepth(-2);
    }
    if (this.textures.exists('bg2')) {
      this.add.image(0, 0, 'bg2')
        .setOrigin(0, 0)
        .setDisplaySize(this.levelWidth, H)
        .setScrollFactor(0.6)
        .setDepth(-1);
    }

    // Gradient floor atmosphere
    const gfx = this.add.graphics().setDepth(-1).setScrollFactor(0);
    const grad = gfx.fillGradientStyle(0x0a0a1a, 0x0a0a1a, 0x1a0a2a, 0x1a0a2a, 1);
    gfx.fillRect(0, 0, W, H);
  }

  // ─── LEVEL BUILD ──────────────────────────

  private buildLevel() {
    this.platforms = this.physics.add.staticGroup();

    LEVEL_1.platforms.forEach(def => {
      // Create visual block
      const gfx = this.add.graphics().setDepth(2);
      const isGround = def.type === 'floor';
      const isPlatform = def.type === 'platform';

      if (isGround) {
        gfx.fillStyle(0x2a2040, 1);
        gfx.fillRect(def.x, def.y, def.w, def.h);
        gfx.fillStyle(0x4a3a70, 1);
        gfx.fillRect(def.x, def.y, def.w, 3);
        // Floor pattern
        gfx.lineStyle(1, 0x3a2a50, 0.5);
        for (let x = def.x; x < def.x + def.w; x += 32) {
          gfx.lineBetween(x, def.y + 3, x, def.y + def.h);
        }
      } else if (isPlatform) {
        gfx.fillStyle(0x3a2a60, 1);
        gfx.fillRect(def.x, def.y, def.w, def.h);
        gfx.fillStyle(0x6a5a90, 1);
        gfx.fillRect(def.x, def.y, def.w, 3);
        gfx.fillStyle(0x2a1a50, 1);
        gfx.fillRect(def.x, def.y + 3, def.w, def.h - 3);
      } else {
        gfx.fillStyle(0x2a2040, 1);
        gfx.fillRect(def.x, def.y, def.w, def.h);
      }

      // Add invisible physics body
      const body = this.add.rectangle(def.x + def.w/2, def.y + def.h/2, def.w, def.h);
      this.platforms.add(body as any);
      const physBody = (body as any).body as Phaser.Physics.Arcade.StaticBody;
      if (isPlatform) {
        physBody.checkCollision.down = true;
        physBody.checkCollision.left = false;
        physBody.checkCollision.right = false;
        physBody.checkCollision.up = false;
      }

      // Decorations on platforms
      if (isPlatform && Math.random() > 0.6) {
        this.addPlatformDecor(def);
      }
    });

    // School background tiles
    this.addSchoolDecoratives();
  }

  private addPlatformDecor(def: PlatformDef) {
    const gfx = this.add.graphics().setDepth(1);
    // Railing
    gfx.lineStyle(1, 0x6644aa, 0.6);
    for (let x = def.x + 8; x < def.x + def.w; x += 16) {
      gfx.lineBetween(x, def.y, x, def.y - 20);
    }
    gfx.lineBetween(def.x, def.y - 20, def.x + def.w, def.y - 20);
  }

  private addSchoolDecoratives() {
    // Locker banks
    [200, 800, 1600, 2200].forEach(x => {
      const gfx = this.add.graphics().setDepth(1);
      for (let i = 0; i < 5; i++) {
        const lx = x + i * 24;
        gfx.fillStyle(0x304060, 1);
        gfx.fillRect(lx, 380, 22, 100);
        gfx.fillStyle(0x405080, 1);
        gfx.fillRect(lx+2, 382, 8, 18);
        gfx.fillRect(lx+2, 408, 8, 18);
        gfx.fillStyle(0x88aacc, 0.6);
        gfx.fillRect(lx+8, 390, 3, 4);
        gfx.fillRect(lx+8, 416, 3, 4);
        gfx.lineStyle(1, 0x203050, 1);
        gfx.strokeRect(lx, 380, 22, 100);
        gfx.lineBetween(lx, 430, lx+22, 430);
      }
    });

    // Windows in bg
    [400, 700, 1000, 1400, 1800, 2400].forEach(x => {
      const gfx = this.add.graphics().setDepth(0).setScrollFactor(0.5);
      gfx.fillStyle(0x88ccee, 0.15);
      gfx.fillRect(x, 60, 60, 80);
      gfx.lineStyle(1, 0x446688, 0.4);
      gfx.strokeRect(x, 60, 60, 80);
      gfx.lineBetween(x, 100, x+60, 100);
      gfx.lineBetween(x+30, 60, x+30, 140);
    });

    // Boss arena decorations
    const bossGfx = this.add.graphics().setDepth(1);
    bossGfx.fillStyle(0x1a1030, 1);
    bossGfx.fillRect(2700, 0, 500, 480);
    // Red lights
    [2720, 2800, 2900, 3000, 3080].forEach(lx => {
      bossGfx.fillStyle(0x441111, 0.8);
      bossGfx.fillRect(lx, 30, 12, 12);
      bossGfx.fillStyle(0xff2222, 0.5);
      bossGfx.fillCircle(lx+6, 36, 8);
    });
    // Warning stripes on floor
    for (let sx = 2700; sx < 3200; sx += 32) {
      bossGfx.fillStyle(sx % 64 < 32 ? 0x331111 : 0x221111, 0.6);
      bossGfx.fillRect(sx, 460, 32, 20);
    }
    // Boss name plate
    this.add.text(2900, 300, '番長', {
      fontSize: '40px', fontFamily: 'monospace', color: '#330000', stroke: '#110000', strokeThickness: 4
    }).setOrigin(0.5).setAlpha(0.3).setDepth(1);
  }

  // ─── ENEMIES ──────────────────────────────

  private spawnInitialEnemies() {
    const initial = this.pendingEnemies.filter(e => !e.trigger);
    this.pendingEnemies = this.pendingEnemies.filter(e => e.trigger);
    initial.forEach(e => this.spawnEnemy(e));
  }

  private spawnEnemy(def: EnemySpawn): Enemy {
    let enemy: Enemy;
    if (def.type === 'boss') {
      enemy = new GangBoss(this, def.x, def.y);
      this.bossEnemy = enemy;
      this.bossSpawned = true;
      // Announce boss
      this.time.delayedCall(200, () => {
        this.events.emit('bossHpChanged', enemy.hp, enemy.maxHp, '番長「鬼頭組長」');
        this.cameras.main.shake(400, 0.015);
        const txt = this.add.text(this.cameras.main.midPoint.x, 200, '⚠ BOSS ⚠', {
          fontSize: '32px', fontFamily: 'monospace', color: '#ff2222',
          stroke: '#000', strokeThickness: 4
        }).setOrigin(0.5).setDepth(30).setScrollFactor(0);
        this.tweens.add({ targets: txt, alpha: 0, y: 160, duration: 1500, delay: 1000, onComplete: () => txt.destroy() });
      });
    } else {
      const variant = def.type === 'thug_red' ? 'red' : 'blue';
      enemy = new Thug(this, def.x, def.y, variant);
    }

    // Add collider with platforms
    this.physics.add.collider(enemy.sprite, this.platforms);
    this.enemies.push(enemy);
    return enemy;
  }

  // ─── COLLISIONS ───────────────────────────

  private setupCollisions() {
    // Player ↔ platforms
    this.physics.add.collider(this.player.sprite, this.platforms);

    // Player world bounds
    this.player.sprite.setCollideWorldBounds(true);
  }

  // ─── AUDIO ────────────────────────────────

  private setupAudio() {
    // Generate simple tones via Web Audio API
    try {
      this.audioContext = new AudioContext();
      this.createSounds();
    } catch { /* audio not critical */ }
  }

  private createSounds() {
    if (!this.audioContext) return;
    const ac = this.audioContext;

    const makeSFX = (key: string, fn: (ctx: AudioContext) => AudioBuffer) => {
      try {
        const buf = fn(ac);
        this.cache.audio.add(key, buf);
        this.sound.add(key, { audioContext: ac } as any);
      } catch {}
    };

    // We'll use Phaser's sound manager with generated buffers
    // For simplicity, create a tone helper
    const tone = (freq: number, dur: number, type: OscillatorType = 'square', vol = 0.3): AudioBuffer => {
      const sr = ac.sampleRate;
      const len = Math.floor(sr * dur);
      const buf = ac.createBuffer(1, len, sr);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) {
        const t = i / sr;
        let s = 0;
        if (type === 'square') s = Math.sin(2 * Math.PI * freq * t) > 0 ? vol : -vol;
        else if (type === 'sawtooth') s = vol * (2 * (t * freq - Math.floor(t * freq + 0.5)));
        else s = vol * Math.sin(2 * Math.PI * freq * t);
        // Envelope
        const attack = 0.01, release = 0.1;
        const env = t < attack ? t / attack : t > dur - release ? (dur - t) / release : 1;
        data[i] = s * env;
      }
      return buf;
    };

    // Store as buffers in a lookup for manual playback
    this._sounds = {
      sfx_jump:   tone(440, 0.12, 'square', 0.2),
      sfx_dash:   tone(280, 0.1,  'sawtooth', 0.2),
      sfx_swing:  tone(220, 0.08, 'square', 0.25),
      sfx_impact: tone(160, 0.15, 'square', 0.4),
      sfx_guard:  tone(660, 0.1,  'sine', 0.3),
      sfx_hurt:   tone(120, 0.2,  'sawtooth', 0.35),
    };

    // Override scene.sound.play to use our buffers
    const origPlay = this.sound.play.bind(this.sound);
    this.sound.play = (key: string, config?: any): any => {
      if (this._sounds?.[key] && this.audioContext) {
        this.playBuffer(this._sounds[key], config?.volume ?? 0.3);
      }
      return { destroy: () => {} } as any;
    };
  }

  private _sounds: Record<string, AudioBuffer> = {};

  private playBuffer(buf: AudioBuffer, vol: number = 0.3) {
    if (!this.audioContext) return;
    const src = this.audioContext.createBufferSource();
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

    // Update player
    this.player.update(time, delta);

    // Wave triggers
    this.checkWaveTriggers();

    // Update enemies
    const aliveBefore = this.enemies.filter(e => !e.isDead).length;

    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const enemy = this.enemies[i];
      if (enemy.isDead) {
        this.enemies.splice(i, 1);
        continue;
      }
      enemy.update(time, delta, this.player.x, this.player.y);

      // Check enemy hitbox → player
      if (enemy.hitbox.active && !this.player.isInvincible) {
        if (this.rectsOverlap(
          enemy.hitbox.x, enemy.hitbox.y, enemy.hitbox.w, enemy.hitbox.h,
          this.player.x - 12, this.player.y - 20, 24, 40
        )) {
          this.player.takeDamage(enemy.hitbox.damage, true, enemy.x);
          enemy.hitbox.active = false;
          // Apply random status from heavy enemies
          if (enemy.isBoss && Math.random() < 0.3) {
            const statuses: StatusType[] = ['shock', 'bleed', 'paralysis'];
            this.player.statusEffects.apply(
              statuses[Math.floor(Math.random() * statuses.length)]
            );
            this.player.onStatusChanged?.(this.player.statusEffects.getAll());
          }
        }
      }
    }

    // Check player hitbox → enemies
    if (this.player.hitbox.active) {
      for (const enemy of this.enemies) {
        if (enemy.isDead) continue;
        if (this.rectsOverlap(
          this.player.hitbox.x - this.player.hitbox.w / 2,
          this.player.hitbox.y - this.player.hitbox.h / 2,
          this.player.hitbox.w,
          this.player.hitbox.h,
          enemy.x - 16, enemy.y - 30, 32, 50
        )) {
          // Apply damage
          const isFinisher = this.player.hitbox.isFinisher;
          enemy.takeDamage(
            this.player.hitbox.damage * (this.player.statusEffects.reversedControls() ? 0.5 : 1),
            true,
            this.player.x,
            this.getAttackStatus(isFinisher)
          );

          // Spawn hit FX
          const fxKey = isFinisher ? 'fx_finish' : 'fx_hit';
          const fx = this.add.sprite(enemy.x, enemy.y - 20, 'fx').setDepth(20);
          fx.play(fxKey);
          fx.on('animationcomplete', () => fx.destroy());

          if (isFinisher) {
            this.player.triggerFinisherEffect();
          }

          // One hit per swing
          this.player.hitbox.active = false;

          // Boss HP update
          if (enemy.isBoss) {
            this.events.emit('bossHpChanged', Math.max(0, enemy.hp), enemy.maxHp, '番長「鬼頭組長」');
          }
        }
      }
    }

    // Check player death
    if (this.player.isDead && !this.cleared) {
      this.cleared = true; // prevent re-emit
      this.time.delayedCall(1500, () => {
        this.events.emit('playerDead');
      });
    }

    // Check level clear (boss dead)
    if (this.bossSpawned && this.bossEnemy?.isDead && !this.cleared) {
      this.cleared = true;
      this.time.delayedCall(2000, () => {
        this.events.emit('levelClear');
      });
    }

    // Debug
    if (this.showDebug) {
      this.drawDebug();
    } else {
      this.debugGraphics?.clear();
    }
  }

  // ─── HELPERS ──────────────────────────────

  private checkWaveTriggers() {
    const px = this.player.x;
    const toSpawn = this.pendingEnemies.filter(e => e.trigger && px >= e.trigger);
    if (toSpawn.length === 0) return;
    this.pendingEnemies = this.pendingEnemies.filter(e => !toSpawn.includes(e));
    toSpawn.forEach(e => {
      // Small delay stagger
      this.time.delayedCall(Math.random() * 300, () => this.spawnEnemy(e));
    });
  }

  private getAttackStatus(isFinisher: boolean): StatusType | undefined {
    if (!isFinisher) return undefined;
    const statuses: StatusType[] = ['bleed', 'shock', 'freeze', 'burn'];
    return statuses[Math.floor(Math.random() * statuses.length)];
  }

  private rectsOverlap(
    ax: number, ay: number, aw: number, ah: number,
    bx: number, by: number, bw: number, bh: number
  ): boolean {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  private drawDebug() {
    const g = this.debugGraphics!;
    g.clear();

    // Player hitbox
    if (this.player.hitbox.active) {
      g.lineStyle(1, 0x00ff00, 1);
      g.strokeRect(
        this.player.hitbox.x - this.player.hitbox.w / 2,
        this.player.hitbox.y - this.player.hitbox.h / 2,
        this.player.hitbox.w,
        this.player.hitbox.h
      );
    }

    // Enemy hitboxes
    for (const e of this.enemies) {
      if (e.hitbox.active) {
        g.lineStyle(1, 0xff0000, 1);
        g.strokeRect(e.hitbox.x - e.hitbox.w/2, e.hitbox.y - e.hitbox.h/2, e.hitbox.w, e.hitbox.h);
      }
    }
  }
}
